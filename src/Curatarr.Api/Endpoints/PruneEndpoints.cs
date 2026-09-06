using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Api.Endpoints;

public static class PruneAndSyncEndpoints
{
    public static void MapPruneAndSyncEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1");

        // Pruning
        group.MapPost("/prune", async (IPruneExecutionService service, PruneRequest req, CancellationToken ct) =>
        {
            var cmd = new PruneCommand(
                MediaItemId: req.MediaItemId,
                SeasonNumber: req.SeasonNumber,
                TargetConnectionIds: req.TargetConnectionIds ?? [],
                AddImportExclusion: req.AddImportExclusion,
                Actor: req.Actor ?? "WebUI"
            );

            var result = await service.ExecutePruneAsync(cmd, ct);
            if (!result.Success && result.Message.Contains("protected"))
            {
                return Results.BadRequest(result);
            }

            return result.Success ? Results.Ok(result) : Results.Problem(result.Message);
        });

        // Audit Logs
        group.MapGet("/audit", async (IAuditRepository repo, int? limit, CancellationToken ct) =>
        {
            var logs = await repo.GetRecentAsync(limit ?? 100, ct);
            var totalFreed = await repo.GetTotalBytesFreedAsync(ct);
            return Results.Ok(new { totalBytesFreed = totalFreed, logs });
        });

        // Background Sync
        group.MapPost("/sync", (ICatalogSyncService syncService, bool? fullSync) =>
        {
            _ = Task.Run(() => syncService.TriggerSyncAsync(fullSync ?? false, CancellationToken.None));
            return Results.Ok(new { message = "Sync started", progress = syncService.GetCurrentProgress() });
        });

        group.MapGet("/sync/status", (ICatalogSyncService syncService) =>
        {
            return Results.Ok(syncService.GetCurrentProgress());
        });

        // Manual Plex Refresh
        group.MapPost("/plex/refresh", async (IConnectionRepository connRepo, IPlexClient plex, CancellationToken ct) =>
        {
            var conns = await connRepo.GetAllAsync(ct);
            var plexConn = conns.FirstOrDefault(c => c.ConnectionType == ConnectionType.Plex && c.IsEnabled);
            if (plexConn == null)
            {
                return Results.BadRequest(new { message = "No active Plex connection configured" });
            }

            try
            {
                var sections = await plex.GetSectionsAsync(plexConn, ct);
                foreach (var s in sections)
                {
                    await plex.RefreshSectionAsync(plexConn, s.Key, ct);
                }
                return Results.Ok(new { message = $"Triggered scan on {sections.Count} Plex libraries", sections = sections.Select(s => s.Title) });
            }
            catch (Exception ex)
            {
                return Results.Problem($"Failed refreshing Plex: {ex.Message}");
            }
        });
    }

    public record PruneRequest(
        string MediaItemId,
        int? SeasonNumber,
        List<string>? TargetConnectionIds,
        bool AddImportExclusion,
        string? Actor
    );
}
