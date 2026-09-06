using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Api.Endpoints;

public static class CatalogEndpoints
{
    public static void MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1");

        group.MapGet("/categories", async (ISmartCategoryEngine engine, string? userId, CancellationToken ct) =>
        {
            var summaries = await engine.GetSummariesAsync(userId, ct);
            return Results.Ok(summaries);
        });

        group.MapGet("/catalog", async (
            IMediaRepository repo,
            string? category,
            string? userId,
            string? mediaType,
            string? search,
            string? sortBy,
            bool? sortDesc,
            int? limit,
            int? offset,
            CancellationToken ct) =>
        {
            MediaType? mType = mediaType?.ToLowerInvariant() switch
            {
                "movie" => MediaType.Movie,
                "series" => MediaType.Series,
                _ => null
            };

            var options = new MediaFilterOptions(
                CategoryId: category,
                UserIdFilter: userId,
                MediaTypeFilter: mType,
                SearchQuery: search,
                SortBy: sortBy ?? "size",
                SortDescending: sortDesc ?? true,
                Limit: limit ?? 50,
                Offset: offset ?? 0
            );

            var items = await repo.GetPagedAsync(options, ct);
            return Results.Ok(items);
        });

        group.MapGet("/catalog/{id}", async (IMediaRepository repo, string id, CancellationToken ct) =>
        {
            var item = await repo.GetByIdAsync(id, ct);
            return item != null ? Results.Ok(item) : Results.NotFound();
        });

        group.MapPost("/protect", async (IMediaRepository repo, ProtectRequest req, CancellationToken ct) =>
        {
            await repo.SetProtectionAsync(req.MediaItemId, req.IsProtected, req.Reason, ct);
            return Results.Ok(new { success = true });
        });

        group.MapGet("/users", async (IConnectionRepository connRepo, ITautulliClient tautulli, CancellationToken ct) =>
        {
            var conns = await connRepo.GetAllAsync(ct);
            var tautulliConn = conns.FirstOrDefault(c => c.ConnectionType == ConnectionType.Tautulli && c.IsEnabled);
            if (tautulliConn == null)
            {
                return Results.Ok(Array.Empty<object>());
            }

            try
            {
                var users = await tautulli.GetUsersAsync(tautulliConn, ct);
                return Results.Ok(users);
            }
            catch
            {
                return Results.Ok(Array.Empty<object>());
            }
        });

        group.MapGet("/stats", async (IMediaRepository repo, CancellationToken ct) =>
        {
            var totalSize = await repo.GetTotalLibrarySizeBytesAsync(ct);
            var totalCount = await repo.GetTotalCountAsync(ct);
            return Results.Ok(new { totalLibrarySizeBytes = totalSize, totalItemCount = totalCount });
        });
    }

    public record ProtectRequest(string MediaItemId, bool IsProtected, string? Reason);
}
