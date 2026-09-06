using System.Collections.Concurrent;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Infrastructure.Services;

public class CatalogSyncService : ICatalogSyncService
{
    private readonly IConnectionRepository _connectionRepo;
    private readonly IMediaRepository _mediaRepo;
    private readonly ISonarrClient _sonarrClient;
    private readonly IRadarrClient _radarrClient;
    private readonly ITautulliClient _tautulliClient;
    private readonly IPlexClient _plexClient;

    private readonly SemaphoreSlim _syncLock = new(1, 1);
    private SyncProgress _currentProgress = new("Idle", 0, false, null, null);

    public CatalogSyncService(
        IConnectionRepository connectionRepo,
        IMediaRepository mediaRepo,
        ISonarrClient sonarrClient,
        IRadarrClient radarrClient,
        ITautulliClient tautulliClient,
        IPlexClient plexClient)
    {
        _connectionRepo = connectionRepo;
        _mediaRepo = mediaRepo;
        _sonarrClient = sonarrClient;
        _radarrClient = radarrClient;
        _tautulliClient = tautulliClient;
        _plexClient = plexClient;
    }

    public SyncProgress GetCurrentProgress() => _currentProgress;

    public async Task TriggerSyncAsync(bool fullSync = false, CancellationToken ct = default)
    {
        if (!await _syncLock.WaitAsync(0, ct))
        {
            // Already running
            return;
        }

        try
        {
            _currentProgress = _currentProgress with { Status = "Syncing", IsRunning = true, LastError = null };

            var connections = await _connectionRepo.GetAllAsync(ct);
            var enabledConnections = connections.Where(c => c.IsEnabled).ToList();

            // Cache existing items for fast lookup by external keys
            var itemMap = new ConcurrentDictionary<string, MediaItem>(); // key: tvdb:xxx or tmdb:yyy or imdb:zzz or title:year

            // 1. Process Sonarr instances
            var sonarrConns = enabledConnections.Where(c => c.ConnectionType == ConnectionType.Sonarr).ToList();
            foreach (var conn in sonarrConns)
            {
                try
                {
                    var seriesList = await _sonarrClient.GetSeriesAsync(conn, ct);
                    foreach (var s in seriesList)
                    {
                        var key = s.TvdbId.HasValue ? $"tvdb:{s.TvdbId}" : (s.ImdbId != null ? $"imdb:{s.ImdbId}" : $"title:{s.Title.ToLowerInvariant()}:{s.Year}");

                        var item = itemMap.GetOrAdd(key, _ => new MediaItem
                        {
                            Id = Guid.NewGuid().ToString("N"),
                            MediaType = MediaType.Series,
                            Title = s.Title,
                            SortTitle = s.SortTitle ?? s.Title,
                            Year = s.Year,
                            TvdbId = s.TvdbId?.ToString(),
                            ImdbId = s.ImdbId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });

                        // Add instance
                        item.Instances.Add(new MediaInstance
                        {
                            Id = Guid.NewGuid().ToString("N"),
                            MediaItemId = item.Id,
                            ConnectionId = conn.Id,
                            ExternalId = s.Id,
                            QualityProfileName = conn.TierTag ?? "Default",
                            CutoffUnmet = false,
                            IsMonitored = s.Monitored,
                            DiskPath = s.Path,
                            SizeBytes = s.SizeOnDisk,
                            HasFile = s.EpisodeFileCount > 0,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });

                        // Merge seasons
                        foreach (var seas in s.Seasons)
                        {
                            var existingSeason = item.Seasons.FirstOrDefault(x => x.SeasonNumber == seas.SeasonNumber);
                            if (existingSeason == null)
                            {
                                item.Seasons.Add(new Season
                                {
                                    Id = Guid.NewGuid().ToString("N"),
                                    MediaItemId = item.Id,
                                    SeasonNumber = seas.SeasonNumber,
                                    IsMonitored = seas.Monitored,
                                    EpisodeCount = seas.TotalEpisodeCount,
                                    EpisodeFileCount = seas.EpisodeFileCount,
                                    SizeBytes = seas.SizeOnDisk,
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow
                                });
                            }
                            else
                            {
                                existingSeason.SizeBytes = Math.Max(existingSeason.SizeBytes, seas.SizeOnDisk);
                                existingSeason.EpisodeFileCount = Math.Max(existingSeason.EpisodeFileCount, seas.EpisodeFileCount);
                            }
                        }
                    }

                    conn.LastSyncAt = DateTime.UtcNow;
                    conn.LastStatus = "Synced";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
                catch (Exception ex)
                {
                    conn.LastStatus = $"Error: {ex.Message}";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
            }

            // 2. Process Radarr instances
            var radarrConns = enabledConnections.Where(c => c.ConnectionType == ConnectionType.Radarr).ToList();
            foreach (var conn in radarrConns)
            {
                try
                {
                    var movies = await _radarrClient.GetMoviesAsync(conn, ct);
                    foreach (var m in movies)
                    {
                        var key = m.TmdbId.HasValue ? $"tmdb:{m.TmdbId}" : (m.ImdbId != null ? $"imdb:{m.ImdbId}" : $"title:{m.Title.ToLowerInvariant()}:{m.Year}");

                        var item = itemMap.GetOrAdd(key, _ => new MediaItem
                        {
                            Id = Guid.NewGuid().ToString("N"),
                            MediaType = MediaType.Movie,
                            Title = m.Title,
                            SortTitle = m.SortTitle ?? m.Title,
                            Year = m.Year,
                            TmdbId = m.TmdbId?.ToString(),
                            ImdbId = m.ImdbId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });

                        item.Instances.Add(new MediaInstance
                        {
                            Id = Guid.NewGuid().ToString("N"),
                            MediaItemId = item.Id,
                            ConnectionId = conn.Id,
                            ExternalId = m.Id,
                            QualityProfileName = conn.TierTag ?? "Default",
                            CutoffUnmet = false,
                            IsMonitored = m.Monitored,
                            DiskPath = m.Path,
                            SizeBytes = m.SizeOnDisk,
                            HasFile = m.HasFile,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });
                    }

                    conn.LastSyncAt = DateTime.UtcNow;
                    conn.LastStatus = "Synced";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
                catch (Exception ex)
                {
                    conn.LastStatus = $"Error: {ex.Message}";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
            }

            // Calculate aggregate sizes
            foreach (var item in itemMap.Values)
            {
                item.TotalSizeBytes = item.Instances.Sum(i => i.SizeBytes);
            }

            // 3. Process Tautulli Watch History
            var tautulliConns = enabledConnections.Where(c => c.ConnectionType == ConnectionType.Tautulli).ToList();
            foreach (var conn in tautulliConns)
            {
                try
                {
                    var history = await _tautulliClient.GetHistoryAsync(conn, length: 10000, ct: ct);
                    foreach (var h in history)
                    {
                        var showOrMovieTitle = h.GrandparentTitle ?? h.Title;
                        if (string.IsNullOrEmpty(showOrMovieTitle)) continue;

                        var matchedItem = itemMap.Values.FirstOrDefault(i =>
                            string.Equals(i.Title, showOrMovieTitle, StringComparison.OrdinalIgnoreCase) ||
                            (h.RatingKey.HasValue && i.PlexRatingKey == h.RatingKey.Value));

                        if (matchedItem != null)
                        {
                            var stat = matchedItem.WatchStats.FirstOrDefault(ws => ws.UserId == h.UserId && ws.SeasonNumber == h.SeasonNumber);
                            if (stat == null)
                            {
                                matchedItem.WatchStats.Add(new WatchStat
                                {
                                    Id = Guid.NewGuid().ToString("N"),
                                    MediaItemId = matchedItem.Id,
                                    SeasonNumber = h.SeasonNumber,
                                    UserId = h.UserId,
                                    Username = h.Username,
                                    PlayCount = 1,
                                    LastPlayedAt = h.Date,
                                    UpdatedAt = DateTime.UtcNow
                                });
                            }
                            else
                            {
                                stat.PlayCount++;
                                if (!stat.LastPlayedAt.HasValue || h.Date > stat.LastPlayedAt.Value)
                                {
                                    stat.LastPlayedAt = h.Date;
                                }
                            }
                        }
                    }

                    conn.LastSyncAt = DateTime.UtcNow;
                    conn.LastStatus = "Synced";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
                catch (Exception ex)
                {
                    conn.LastStatus = $"Error: {ex.Message}";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
            }

            // 4. Batch upsert everything
            var allItems = itemMap.Values.ToList();
            await _mediaRepo.UpsertBatchAsync(allItems, ct);

            _currentProgress = new SyncProgress("Completed", allItems.Count, false, DateTime.UtcNow, null);
        }
        catch (Exception ex)
        {
            _currentProgress = new SyncProgress("Failed", 0, false, DateTime.UtcNow, ex.Message);
        }
        finally
        {
            _syncLock.Release();
        }
    }
}
