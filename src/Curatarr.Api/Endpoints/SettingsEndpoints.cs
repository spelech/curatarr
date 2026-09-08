using Curatarr.Core.Models;
using Curatarr.Core.Repositories;

namespace Curatarr.Api.Endpoints;

public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/settings");

        group.MapGet("/", async (ISettingsRepository repo, CancellationToken ct) =>
        {
            var settings = await repo.GetSettingsAsync(ct);
            return Results.Ok(settings);
        });

        group.MapPut("/", async (ISettingsRepository repo, CuratarrSettings incoming, CancellationToken ct) =>
        {
            // Validate non-negative and reasonable ranges
            if (incoming.MovieSpaceHogThresholdBytes < 0 ||
                incoming.Movie4kSpaceHogThresholdBytes < 0 ||
                incoming.SeriesEpisodeSpaceHogThresholdBytes < 0 ||
                incoming.StaleDays < 1 ||
                incoming.AbandonedDays < 1 ||
                incoming.SyncIntervalHours < 1 || incoming.SyncIntervalHours > 168 ||
                incoming.CatalogBatchSize < 10 || incoming.CatalogBatchSize > 500)
            {
                return Results.BadRequest(new { error = "Settings values must be within valid operational ranges." });
            }

            await repo.SaveSettingsAsync(incoming, ct);
            return Results.Ok(incoming);
        });
    }
}
