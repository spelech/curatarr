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
            var cleanUserId = string.IsNullOrWhiteSpace(userId) ? null : userId;
            var summaries = await engine.GetSummariesAsync(cleanUserId, ct);
            return Results.Ok(summaries);
        }).RequireCuratarrRole();

        group.MapGet("/catalog", async (
            IMediaRepository repo,
            ISettingsRepository settingsRepo,
            string? category,
            string? userId,
            string? mediaType,
            string? search,
            string? resolution,
            bool? cutoffUnmet,
            string? pre2017Filter,
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

            var settings = await settingsRepo.GetSettingsAsync(ct);
            var effectiveLimit = limit.HasValue && limit.Value > 0
                ? Math.Clamp(limit.Value, 1, 500)
                : Math.Clamp(settings.CatalogBatchSize, 10, 500);
            var effectiveOffset = Math.Max(0, offset ?? 0);

            var cleanUserId = string.IsNullOrWhiteSpace(userId) ? null : userId;
            var options = new MediaFilterOptions(
                CategoryId: category,
                UserIdFilter: cleanUserId,
                MediaTypeFilter: mType,
                SearchQuery: search,
                ResolutionFilter: resolution,
                CutoffUnmetFilter: cutoffUnmet,
                Pre2017Filter: pre2017Filter,
                SortBy: sortBy ?? "size",
                SortDescending: sortDesc ?? true,
                Limit: effectiveLimit,
                Offset: effectiveOffset
            );

            var items = await repo.GetPagedAsync(options, ct);
            return Results.Ok(items);
        }).RequireCuratarrRole();

        group.MapGet("/catalog/{id}", async (IMediaRepository repo, string id, CancellationToken ct) =>
        {
            var item = await repo.GetByIdAsync(id, ct);
            return item != null ? Results.Ok(item) : Results.NotFound();
        }).RequireCuratarrRole();

        group.MapPost("/protect", async (IMediaRepository repo, ProtectRequest req, CancellationToken ct) =>
        {
            await repo.SetProtectionAsync(req.MediaItemId, req.IsProtected, req.Reason, ct);
            return Results.Ok(new { success = true });
        }).RequireCuratarrRole(UserRole.Admin);

        group.MapPost("/protection-requests", async (
            HttpContext context,
            IMediaRepository repo,
            AddProtectionRequest req,
            CancellationToken ct) =>
        {
            var session = context.Items["CuratarrUser"] as UserSession;
            if (session == null)
            {
                return Results.Unauthorized();
            }

            var protReq = new ProtectionRequest
            {
                Id = Guid.NewGuid().ToString("N"),
                MediaItemId = req.MediaItemId,
                UserId = session.UserId,
                Username = session.Username,
                UserThumb = session.ThumbUrl,
                Reason = req.Reason,
                CreatedAt = DateTime.UtcNow
            };

            await repo.AddOrUpdateProtectionRequestAsync(protReq, ct);
            return Results.Ok(new { success = true });
        }).RequireCuratarrRole();

        group.MapDelete("/protection-requests/{mediaItemId}", async (
            HttpContext context,
            IMediaRepository repo,
            string mediaItemId,
            CancellationToken ct) =>
        {
            var session = context.Items["CuratarrUser"] as UserSession;
            if (session == null)
            {
                return Results.Unauthorized();
            }

            await repo.RemoveProtectionRequestAsync(mediaItemId, session.UserId, ct);
            return Results.Ok(new { success = true });
        }).RequireCuratarrRole();

        group.MapDelete("/protection-requests/{mediaItemId}/all", async (
            IMediaRepository repo,
            string mediaItemId,
            CancellationToken ct) =>
        {
            await repo.ClearProtectionRequestsAsync(mediaItemId, ct);
            return Results.Ok(new { success = true });
        }).RequireCuratarrRole(UserRole.Admin);

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
        }).RequireCuratarrRole();

        group.MapGet("/stats", async (IMediaRepository repo, CancellationToken ct) =>
        {
            var totalSize = await repo.GetTotalLibrarySizeBytesAsync(ct);
            var totalCount = await repo.GetTotalCountAsync(ct);
            return Results.Ok(new { totalLibrarySizeBytes = totalSize, totalItemCount = totalCount });
        }).RequireCuratarrRole();
    }

    public record ProtectRequest(string MediaItemId, bool IsProtected, string? Reason);
    public record AddProtectionRequest(string MediaItemId, string? Reason);
}
