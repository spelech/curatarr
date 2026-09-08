using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Dapper;

namespace Curatarr.Infrastructure.Services;

public class SmartCategoryEngine : ISmartCategoryEngine
{
    private readonly SqliteConnectionFactory _factory;
    private readonly ISettingsRepository _settingsRepo;

    public SmartCategoryEngine(SqliteConnectionFactory factory, ISettingsRepository? settingsRepo = null)
    {
        _factory = factory;
        _settingsRepo = settingsRepo ?? new SettingsRepository(factory);
    }

    public async Task<IReadOnlyList<CategoryCountSummary>> GetSummariesAsync(string? userIdFilter, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        var settings = await _settingsRepo.GetSettingsAsync(ct);

        var staleDate = DateTime.UtcNow.AddDays(-settings.StaleDays).ToString("o");
        var abandonedDate = DateTime.UtcNow.AddDays(-settings.AbandonedDays).ToString("o");

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
              AND EXISTS (SELECT 1 FROM watch_stats ws WHERE ws.media_item_id = m.id AND ws.play_count > 0)
              AND (SELECT MAX(ws.last_played_at) FROM watch_stats ws WHERE ws.media_item_id = m.id) < @AbandonedDate;";

        var abandoned = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlAbandoned, new { AbandonedDate = abandonedDate }, cancellationToken: ct));

        // Cutoff Unmet
        const string sqlCutoff = @"
            SELECT COUNT(DISTINCT m.id) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 0
              AND EXISTS (SELECT 1 FROM media_instances mi WHERE mi.media_item_id = m.id AND mi.cutoff_unmet = 1);";

        var cutoff = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlCutoff, cancellationToken: ct));

        // Space Hogs (Adjustable: Movies HD vs 4K; Series by Per-Episode size)
        const string sqlSpace = @"
            SELECT COUNT(*) as Count, COALESCE(SUM(m.total_size_bytes), 0) as Size
            FROM media_items m
            WHERE m.is_protected = 0
              AND (
                (m.media_type = 0 AND (
                  (EXISTS (SELECT 1 FROM media_instances mi WHERE mi.media_item_id = m.id AND mi.resolution = '4K') AND m.total_size_bytes > @Movie4kThresholdBytes)
                  OR
                  (NOT EXISTS (SELECT 1 FROM media_instances mi WHERE mi.media_item_id = m.id AND mi.resolution = '4K') AND m.total_size_bytes > @MovieThresholdBytes)
                ))
                OR
                (m.media_type = 1 AND (
                  SELECT COALESCE(SUM(s.episode_file_count), 0) FROM seasons s WHERE s.media_item_id = m.id
                ) > 0 AND (
                  m.total_size_bytes / (SELECT SUM(s.episode_file_count) FROM seasons s WHERE s.media_item_id = m.id)
                ) > @SeriesEpisodeThresholdBytes)
              );";

        var space = await conn.QuerySingleAsync<(int Count, long Size)>(new CommandDefinition(sqlSpace, new
        {
            Movie4kThresholdBytes = settings.Movie4kSpaceHogThresholdBytes,
            MovieThresholdBytes = settings.MovieSpaceHogThresholdBytes,
            SeriesEpisodeThresholdBytes = settings.SeriesEpisodeSpaceHogThresholdBytes
        }, cancellationToken: ct));

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
            new CategoryCountSummary(SmartCategoryIds.Stale, $"Stale (>{settings.StaleDays}d)", stale.Count, stale.Size),
            new CategoryCountSummary(SmartCategoryIds.Abandoned, "Abandoned TV", abandoned.Count, abandoned.Size),
            new CategoryCountSummary(SmartCategoryIds.CutoffUnmet, "Cutoff Unmet", cutoff.Count, cutoff.Size),
            new CategoryCountSummary(SmartCategoryIds.SpaceHogs, "Space Hogs", space.Count, space.Size),
            new CategoryCountSummary(SmartCategoryIds.Missing, "Missing / Stalled", missing.Count, 0),
            new CategoryCountSummary(SmartCategoryIds.Protected, "Protected", prot.Count, prot.Size),
        ];
    }
}
