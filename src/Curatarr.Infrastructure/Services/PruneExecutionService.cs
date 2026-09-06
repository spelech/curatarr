using System.Text.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Infrastructure.Services;

public class PruneExecutionService : IPruneExecutionService
{
    private readonly IMediaRepository _mediaRepo;
    private readonly IConnectionRepository _connectionRepo;
    private readonly IAuditRepository _auditRepo;
    private readonly ISonarrClient _sonarrClient;
    private readonly IRadarrClient _radarrClient;
    private readonly IOverseerrClient _overseerrClient;

    public PruneExecutionService(
        IMediaRepository mediaRepo,
        IConnectionRepository connectionRepo,
        IAuditRepository auditRepo,
        ISonarrClient sonarrClient,
        IRadarrClient radarrClient,
        IOverseerrClient overseerrClient)
    {
        _mediaRepo = mediaRepo;
        _connectionRepo = connectionRepo;
        _auditRepo = auditRepo;
        _sonarrClient = sonarrClient;
        _radarrClient = radarrClient;
        _overseerrClient = overseerrClient;
    }

    public async Task<PruneResult> ExecutePruneAsync(PruneCommand command, CancellationToken ct = default)
    {
        var item = await _mediaRepo.GetByIdAsync(command.MediaItemId, ct);
        if (item == null)
        {
            return new PruneResult(false, "Media item not found", 0, 0);
        }

        if (item.IsProtected)
        {
            return new PruneResult(false, "Item is protected from deletion (whitelisted). Unprotect first to delete.", 0, 0);
        }

        var allConnections = await _connectionRepo.GetAllAsync(ct);
        var targetConnections = allConnections
            .Where(c => command.TargetConnectionIds.Contains(c.Id))
            .ToList();

        long totalBytesFreed = 0;
        int instancesAffected = 0;
        var affectedInstanceNames = new List<string>();

        if (command.SeasonNumber.HasValue && item.MediaType == MediaType.Series)
        {
            // Season-level deletion
            var season = item.Seasons.FirstOrDefault(s => s.SeasonNumber == command.SeasonNumber.Value);
            var seasonSize = season?.SizeBytes ?? 0;

            foreach (var conn in targetConnections.Where(c => c.ConnectionType == ConnectionType.Sonarr))
            {
                var instance = item.Instances.FirstOrDefault(i => i.ConnectionId == conn.Id);
                if (instance == null) continue;

                try
                {
                    var files = await _sonarrClient.GetEpisodeFilesAsync(conn, instance.ExternalId, ct);
                    var seasonFiles = files.Where(f => f.SeasonNumber == command.SeasonNumber.Value).ToList();
                    var fileIds = seasonFiles.Select(f => f.Id).ToList();

                    if (fileIds.Count > 0)
                    {
                        await _sonarrClient.DeleteEpisodeFilesAsync(conn, fileIds, ct);
                    }

                    await _sonarrClient.UnmonitorSeasonAsync(conn, instance.ExternalId, command.SeasonNumber.Value, ct);

                    instancesAffected++;
                    affectedInstanceNames.Add(conn.Name);
                    totalBytesFreed += seasonFiles.Sum(f => f.Size);
                }
                catch (Exception ex)
                {
                    return new PruneResult(false, $"Failed deleting season from {conn.Name}: {ex.Message}", totalBytesFreed, instancesAffected);
                }
            }

            // Remove season from local DB
            await _mediaRepo.DeleteSeasonAsync(item.Id, command.SeasonNumber.Value, ct);
        }
        else
        {
            // Full movie or series purge
            foreach (var conn in targetConnections)
            {
                var instance = item.Instances.FirstOrDefault(i => i.ConnectionId == conn.Id);
                if (instance == null) continue;

                try
                {
                    if (item.MediaType == MediaType.Movie && conn.ConnectionType == ConnectionType.Radarr)
                    {
                        await _radarrClient.DeleteMovieAsync(conn, instance.ExternalId, deleteFiles: true, addImportExclusion: command.AddImportExclusion, ct);
                        totalBytesFreed += instance.SizeBytes;
                        instancesAffected++;
                        affectedInstanceNames.Add(conn.Name);
                        await _mediaRepo.DeleteInstanceAsync(instance.Id, ct);
                    }
                    else if (item.MediaType == MediaType.Series && conn.ConnectionType == ConnectionType.Sonarr)
                    {
                        await _sonarrClient.DeleteSeriesAsync(conn, instance.ExternalId, deleteFiles: true, addImportExclusion: command.AddImportExclusion, ct);
                        totalBytesFreed += instance.SizeBytes;
                        instancesAffected++;
                        affectedInstanceNames.Add(conn.Name);
                        await _mediaRepo.DeleteInstanceAsync(instance.Id, ct);
                    }
                }
                catch (Exception ex)
                {
                    return new PruneResult(false, $"Failed deleting from {conn.Name}: {ex.Message}", totalBytesFreed, instancesAffected);
                }
            }

            // If all instances were deleted, delete the root media item
            var remaining = item.Instances.Where(i => !command.TargetConnectionIds.Contains(i.ConnectionId)).ToList();
            if (remaining.Count == 0)
            {
                await _mediaRepo.DeleteMediaItemAsync(item.Id, ct);
            }
        }

        // Record forensic audit log
        var audit = new AuditLogEntry
        {
            Id = Guid.NewGuid().ToString("N"),
            MediaItemId = item.Id,
            Title = item.Title,
            MediaType = item.MediaType.ToString(),
            SeasonNumber = command.SeasonNumber,
            InstancesAffectedJson = JsonSerializer.Serialize(affectedInstanceNames),
            BytesFreed = totalBytesFreed,
            AddedToImportExclusion = command.AddImportExclusion,
            Actor = command.Actor,
            ExecutedAt = DateTime.UtcNow,
            Details = command.SeasonNumber.HasValue 
                ? $"Season {command.SeasonNumber.Value} pruned across: {string.Join(", ", affectedInstanceNames)}"
                : $"Full {item.MediaType} pruned across: {string.Join(", ", affectedInstanceNames)}"
        };
        await _auditRepo.AddAsync(audit, ct);

        return new PruneResult(true, $"Successfully pruned {item.Title}", totalBytesFreed, instancesAffected);
    }
}
