using Curatarr.Core.Models;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using Dapper;

namespace Curatarr.Infrastructure.Services;

public class SmartCategoryEngine : ISmartCategoryEngine
{
    private readonly SqliteConnectionFactory _factory;

    public SmartCategoryEngine(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<CategoryCountSummary>> GetSummariesAsync(string? userIdFilter, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();

        var staleDate = DateTime.UtcNow.AddDays(-180).ToString("o");
        var abandonedDate = DateTime.UtcNow.AddDays(-90).ToString("o");

        // Never Watched
        const string sqlNever = @"
            SELECT COUNT(*) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 0
              AND (SELECT COALESCE(SUM(ws.play_count), 0) FROM watch_stats ws WHERE ws.media_item_id = m.id AND (@UserId IS NULL OR ws.user_id = @UserId)) = 0;";

        var never = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlNever, new { UserId = userIdFilter }, cancellationToken: ct));

        // Stale
        const string sqlStale = @"
            SELECT COUNT(*) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 0
              AND (SELECT COALESCE(SUM(ws.play_count), 0) FROM watch_stats ws WHERE ws.media_item_id = m.id AND (@UserId IS NULL OR ws.user_id = @UserId)) > 0
              AND (SELECT MAX(ws.last_played_at) FROM watch_stats ws WHERE ws.media_item_id = m.id AND (@UserId IS NULL OR ws.user_id = @UserId)) < @StaleDate;";

        var stale = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlStale, new { UserId = userIdFilter, StaleDate = staleDate }, cancellationToken: ct));

        // Abandoned
        const string sqlAbandoned = @"
            SELECT COUNT(*) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 0 AND m.media_type = 1
              AND EXISTS (SELECT 1 FROM watch_stats ws WHERE ws.media_item_id = m.id AND ws.season_number = 1 AND ws.play_count > 0)
              AND (SELECT MAX(ws.last_played_at) FROM watch_stats ws WHERE ws.media_item_id = m.id) < @AbandonedDate;";

        var abandoned = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlAbandoned, new { AbandonedDate = abandonedDate }, cancellationToken: ct));

        // Cutoff Unmet
        const string sqlCutoff = @"
            SELECT COUNT(DISTINCT m.id) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 0
              AND EXISTS (SELECT 1 FROM media_instances mi WHERE mi.media_item_id = m.id AND mi.cutoff_unmet = 1);";

        var cutoff = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlCutoff, cancellationToken: ct));

        // Space Hogs (> 15 GB)
        const string sqlSpace = @"
            SELECT COUNT(*) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 0 AND m.total_size_bytes > 15000000000;";

        var space = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlSpace, cancellationToken: ct));

        // Missing
        const string sqlMissing = @"
            SELECT COUNT(DISTINCT m.id) as Count, 0 as Size
            FROM media_items m
            WHERE m.is_protected = 0
              AND EXISTS (SELECT 1 FROM media_instances mi WHERE mi.media_item_id = m.id AND mi.is_monitored = 1 AND mi.has_file = 0);";

        var missing = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlMissing, cancellationToken: ct));

        // Protected
        const string sqlProtected = @"
            SELECT COUNT(*) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 1;";

        var prot = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlProtected, cancellationToken: ct));

        return
        [
            new CategoryCountSummary(SmartCategoryIds.NeverWatched, "Never Watched", never.Count, never.Size),
            new CategoryCountSummary(SmartCategoryIds.Stale, "Stale (>180d)", stale.Count, stale.Size),
            new CategoryCountSummary(SmartCategoryIds.Abandoned, "Abandoned TV", abandoned.Count, abandoned.Size),
            new CategoryCountSummary(SmartCategoryIds.CutoffUnmet, "Cutoff Unmet", cutoff.Count, cutoff.Size),
            new CategoryCountSummary(SmartCategoryIds.SpaceHogs, "Space Hogs", space.Count, space.Size),
            new CategoryCountSummary(SmartCategoryIds.Missing, "Missing / Stalled", missing.Count, 0),
            new CategoryCountSummary(SmartCategoryIds.Protected, "Protected", prot.Count, prot.Size),
        ];
    }
}
