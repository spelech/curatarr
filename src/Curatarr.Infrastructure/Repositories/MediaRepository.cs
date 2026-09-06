using System.Data;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Dapper;

namespace Curatarr.Infrastructure.Repositories;

public class MediaRepository : IMediaRepository
{
    private readonly SqliteConnectionFactory _factory;

    public MediaRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<MediaItem?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sqlItem = @"
            SELECT id, media_type as MediaType, title, sort_title as SortTitle, year, 
                   tmdb_id as TmdbId, tvdb_id as TvdbId, imdb_id as ImdbId, 
                   plex_rating_key as PlexRatingKey, poster_url as PosterUrl, 
                   added_at as AddedAt, total_size_bytes as TotalSizeBytes, 
                   is_protected as IsProtected, protection_reason as ProtectionReason, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM media_items
            WHERE id = @Id;";

        var item = await conn.QuerySingleOrDefaultAsync<MediaItem>(new CommandDefinition(sqlItem, new { Id = id }, cancellationToken: ct));
        if (item == null) return null;

        const string sqlInstances = @"
            SELECT id, media_item_id as MediaItemId, connection_id as ConnectionId, 
                   external_id as ExternalId, quality_profile_name as QualityProfileName, 
                   cutoff_unmet as CutoffUnmet, is_monitored as IsMonitored, 
                   disk_path as DiskPath, size_bytes as SizeBytes, has_file as HasFile, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM media_instances
            WHERE media_item_id = @Id;";
        var instances = await conn.QueryAsync<MediaInstance>(new CommandDefinition(sqlInstances, new { Id = id }, cancellationToken: ct));
        item.Instances = instances.ToList();

        const string sqlSeasons = @"
            SELECT id, media_item_id as MediaItemId, season_number as SeasonNumber, 
                   is_monitored as IsMonitored, episode_count as EpisodeCount, 
                   episode_file_count as EpisodeFileCount, size_bytes as SizeBytes, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM seasons
            WHERE media_item_id = @Id
            ORDER BY season_number ASC;";
        var seasons = await conn.QueryAsync<Season>(new CommandDefinition(sqlSeasons, new { Id = id }, cancellationToken: ct));
        item.Seasons = seasons.ToList();

        const string sqlWatchStats = @"
            SELECT id, media_item_id as MediaItemId, season_number as SeasonNumber, 
                   user_id as UserId, username, play_count as PlayCount, 
                   last_played_at as LastPlayedAt, updated_at as UpdatedAt
            FROM watch_stats
            WHERE media_item_id = @Id;";
        var watchStats = await conn.QueryAsync<WatchStat>(new CommandDefinition(sqlWatchStats, new { Id = id }, cancellationToken: ct));
        item.WatchStats = watchStats.ToList();

        return item;
    }

    public async Task<MediaItem?> FindByExternalIdAsync(string? tmdbId, string? tvdbId, string? imdbId, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id, media_type as MediaType, title, sort_title as SortTitle, year, 
                   tmdb_id as TmdbId, tvdb_id as TvdbId, imdb_id as ImdbId, 
                   plex_rating_key as PlexRatingKey, poster_url as PosterUrl, 
                   added_at as AddedAt, total_size_bytes as TotalSizeBytes, 
                   is_protected as IsProtected, protection_reason as ProtectionReason, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM media_items
            WHERE (@TmdbId IS NOT NULL AND tmdb_id = @TmdbId)
               OR (@TvdbId IS NOT NULL AND tvdb_id = @TvdbId)
               OR (@ImdbId IS NOT NULL AND imdb_id = @ImdbId)
            LIMIT 1;";

        return await conn.QuerySingleOrDefaultAsync<MediaItem>(new CommandDefinition(sql, new { TmdbId = tmdbId, TvdbId = tvdbId, ImdbId = imdbId }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<MediaItem>> GetPagedAsync(MediaFilterOptions options, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        var whereClauses = new List<string>();
        var parameters = new DynamicParameters();

        if (options.MediaTypeFilter.HasValue)
        {
            whereClauses.Add("m.media_type = @MediaType");
            parameters.Add("MediaType", (int)options.MediaTypeFilter.Value);
        }

        if (!string.IsNullOrWhiteSpace(options.SearchQuery))
        {
            whereClauses.Add("(m.title LIKE @Query OR m.sort_title LIKE @Query)");
            parameters.Add("Query", $"%{options.SearchQuery.Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(options.CategoryId))
        {
            switch (options.CategoryId)
            {
                case SmartCategoryIds.Protected:
                    whereClauses.Add("m.is_protected = 1");
                    break;
                case SmartCategoryIds.NeverWatched:
                    whereClauses.Add("m.is_protected = 0");
                    whereClauses.Add("(SELECT COALESCE(SUM(ws.play_count), 0) FROM watch_stats ws WHERE ws.media_item_id = m.id AND (@UserId IS NULL OR ws.user_id = @UserId)) = 0");
                    parameters.Add("UserId", options.UserIdFilter);
                    break;
                case SmartCategoryIds.Stale:
                    whereClauses.Add("m.is_protected = 0");
                    whereClauses.Add("(SELECT COALESCE(SUM(ws.play_count), 0) FROM watch_stats ws WHERE ws.media_item_id = m.id AND (@UserId IS NULL OR ws.user_id = @UserId)) > 0");
                    whereClauses.Add("(SELECT MAX(ws.last_played_at) FROM watch_stats ws WHERE ws.media_item_id = m.id AND (@UserId IS NULL OR ws.user_id = @UserId)) < @StaleDate");
                    parameters.Add("UserId", options.UserIdFilter);
                    parameters.Add("StaleDate", DateTime.UtcNow.AddDays(-180).ToString("o"));
                    break;
                case SmartCategoryIds.CutoffUnmet:
                    whereClauses.Add("m.is_protected = 0");
                    whereClauses.Add("EXISTS (SELECT 1 FROM media_instances mi WHERE mi.media_item_id = m.id AND mi.cutoff_unmet = 1)");
                    break;
                case SmartCategoryIds.SpaceHogs:
                    whereClauses.Add("m.is_protected = 0");
                    whereClauses.Add("m.total_size_bytes > @MinSize");
                    parameters.Add("MinSize", 15_000_000_000L); // > 15 GB
                    break;
                case SmartCategoryIds.Missing:
                    whereClauses.Add("m.is_protected = 0");
                    whereClauses.Add("EXISTS (SELECT 1 FROM media_instances mi WHERE mi.media_item_id = m.id AND mi.is_monitored = 1 AND mi.has_file = 0)");
                    break;
                case SmartCategoryIds.Abandoned:
                    whereClauses.Add("m.is_protected = 0 AND m.media_type = 1"); // Series
                    whereClauses.Add("EXISTS (SELECT 1 FROM watch_stats ws WHERE ws.media_item_id = m.id AND ws.season_number = 1 AND ws.play_count > 0)");
                    whereClauses.Add("(SELECT MAX(ws.last_played_at) FROM watch_stats ws WHERE ws.media_item_id = m.id) < @AbandonedDate");
                    parameters.Add("AbandonedDate", DateTime.UtcNow.AddDays(-90).ToString("o"));
                    break;
            }
        }

        var whereSql = whereClauses.Count > 0 ? "WHERE " + string.Join(" AND ", whereClauses) : "";
        var orderSql = options.SortBy switch
        {
            "added" => options.SortDescending ? "ORDER BY m.added_at DESC" : "ORDER BY m.added_at ASC",
            "title" => options.SortDescending ? "ORDER BY m.sort_title DESC" : "ORDER BY m.sort_title ASC",
            _ => options.SortDescending ? "ORDER BY m.total_size_bytes DESC" : "ORDER BY m.total_size_bytes ASC"
        };

        parameters.Add("Limit", options.Limit);
        parameters.Add("Offset", options.Offset);

        var sql = $@"
            SELECT m.id, m.media_type as MediaType, m.title, m.sort_title as SortTitle, m.year, 
                   m.tmdb_id as TmdbId, m.tvdb_id as TvdbId, m.imdb_id as ImdbId, 
                   m.plex_rating_key as PlexRatingKey, m.poster_url as PosterUrl, 
                   m.added_at as AddedAt, m.total_size_bytes as TotalSizeBytes, 
                   m.is_protected as IsProtected, m.protection_reason as ProtectionReason, 
                   m.created_at as CreatedAt, m.updated_at as UpdatedAt
            FROM media_items m
            {whereSql}
            {orderSql}
            LIMIT @Limit OFFSET @Offset;";

        var items = (await conn.QueryAsync<MediaItem>(new CommandDefinition(sql, parameters, cancellationToken: ct))).ToList();
        if (items.Count == 0) return items;

        var itemIds = items.Select(i => i.Id).ToList();

        // Populate child instances, seasons, and watch stats
        const string sqlInst = @"
            SELECT id, media_item_id as MediaItemId, connection_id as ConnectionId, 
                   external_id as ExternalId, quality_profile_name as QualityProfileName, 
                   cutoff_unmet as CutoffUnmet, is_monitored as IsMonitored, 
                   disk_path as DiskPath, size_bytes as SizeBytes, has_file as HasFile, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM media_instances
            WHERE media_item_id IN @Ids;";
        var allInstances = await conn.QueryAsync<MediaInstance>(new CommandDefinition(sqlInst, new { Ids = itemIds }, cancellationToken: ct));
        var instLookup = allInstances.ToLookup(i => i.MediaItemId);

        const string sqlSeas = @"
            SELECT id, media_item_id as MediaItemId, season_number as SeasonNumber, 
                   is_monitored as IsMonitored, episode_count as EpisodeCount, 
                   episode_file_count as EpisodeFileCount, size_bytes as SizeBytes, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM seasons
            WHERE media_item_id IN @Ids
            ORDER BY season_number ASC;";
        var allSeasons = await conn.QueryAsync<Season>(new CommandDefinition(sqlSeas, new { Ids = itemIds }, cancellationToken: ct));
        var seasLookup = allSeasons.ToLookup(s => s.MediaItemId);

        const string sqlWatch = @"
            SELECT id, media_item_id as MediaItemId, season_number as SeasonNumber, 
                   user_id as UserId, username, play_count as PlayCount, 
                   last_played_at as LastPlayedAt, updated_at as UpdatedAt
            FROM watch_stats
            WHERE media_item_id IN @Ids;";
        var allWatch = await conn.QueryAsync<WatchStat>(new CommandDefinition(sqlWatch, new { Ids = itemIds }, cancellationToken: ct));
        var watchLookup = allWatch.ToLookup(w => w.MediaItemId);

        foreach (var item in items)
        {
            item.Instances = instLookup[item.Id].ToList();
            item.Seasons = seasLookup[item.Id].ToList();
            item.WatchStats = watchLookup[item.Id].ToList();
        }

        return items;
    }

    public async Task UpsertBatchAsync(IEnumerable<MediaItem> items, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        conn.Open();
        using var trans = conn.BeginTransaction();

        const string sqlItem = @"
            INSERT INTO media_items (id, media_type, title, sort_title, year, tmdb_id, tvdb_id, imdb_id, plex_rating_key, poster_url, added_at, total_size_bytes, is_protected, protection_reason, created_at, updated_at)
            VALUES (@Id, @MediaType, @Title, @SortTitle, @Year, @TmdbId, @TvdbId, @ImdbId, @PlexRatingKey, @PosterUrl, @AddedAt, @TotalSizeBytes, @IsProtected, @ProtectionReason, @CreatedAt, @UpdatedAt)
            ON CONFLICT(id) DO UPDATE SET
                media_type = excluded.media_type,
                title = excluded.title,
                sort_title = excluded.sort_title,
                year = excluded.year,
                tmdb_id = COALESCE(excluded.tmdb_id, media_items.tmdb_id),
                tvdb_id = COALESCE(excluded.tvdb_id, media_items.tvdb_id),
                imdb_id = COALESCE(excluded.imdb_id, media_items.imdb_id),
                plex_rating_key = COALESCE(excluded.plex_rating_key, media_items.plex_rating_key),
                poster_url = COALESCE(excluded.poster_url, media_items.poster_url),
                added_at = COALESCE(excluded.added_at, media_items.added_at),
                total_size_bytes = excluded.total_size_bytes,
                updated_at = excluded.updated_at;";

        const string sqlInstance = @"
            INSERT INTO media_instances (id, media_item_id, connection_id, external_id, quality_profile_name, cutoff_unmet, is_monitored, disk_path, size_bytes, has_file, created_at, updated_at)
            VALUES (@Id, @MediaItemId, @ConnectionId, @ExternalId, @QualityProfileName, @CutoffUnmet, @IsMonitored, @DiskPath, @SizeBytes, @HasFile, @CreatedAt, @UpdatedAt)
            ON CONFLICT(id) DO UPDATE SET
                quality_profile_name = excluded.quality_profile_name,
                cutoff_unmet = excluded.cutoff_unmet,
                is_monitored = excluded.is_monitored,
                disk_path = excluded.disk_path,
                size_bytes = excluded.size_bytes,
                has_file = excluded.has_file,
                updated_at = excluded.updated_at;";

        const string sqlSeason = @"
            INSERT INTO seasons (id, media_item_id, season_number, is_monitored, episode_count, episode_file_count, size_bytes, created_at, updated_at)
            VALUES (@Id, @MediaItemId, @SeasonNumber, @IsMonitored, @EpisodeCount, @EpisodeFileCount, @SizeBytes, @CreatedAt, @UpdatedAt)
            ON CONFLICT(id) DO UPDATE SET
                is_monitored = excluded.is_monitored,
                episode_count = excluded.episode_count,
                episode_file_count = excluded.episode_file_count,
                size_bytes = excluded.size_bytes,
                updated_at = excluded.updated_at;";

        const string sqlWatch = @"
            INSERT INTO watch_stats (id, media_item_id, season_number, user_id, username, play_count, last_played_at, updated_at)
            VALUES (@Id, @MediaItemId, @SeasonNumber, @UserId, @Username, @PlayCount, @LastPlayedAt, @UpdatedAt)
            ON CONFLICT(id) DO UPDATE SET
                play_count = excluded.play_count,
                last_played_at = excluded.last_played_at,
                updated_at = excluded.updated_at;";

        foreach (var item in items)
        {
            await conn.ExecuteAsync(new CommandDefinition(sqlItem, new
            {
                item.Id,
                MediaType = (int)item.MediaType,
                item.Title,
                item.SortTitle,
                item.Year,
                item.TmdbId,
                item.TvdbId,
                item.ImdbId,
                item.PlexRatingKey,
                item.PosterUrl,
                AddedAt = item.AddedAt?.ToString("o"),
                item.TotalSizeBytes,
                item.IsProtected,
                item.ProtectionReason,
                CreatedAt = item.CreatedAt.ToString("o"),
                UpdatedAt = item.UpdatedAt.ToString("o")
            }, transaction: trans, cancellationToken: ct));

            foreach (var inst in item.Instances)
            {
                inst.MediaItemId = item.Id;
                await conn.ExecuteAsync(new CommandDefinition(sqlInstance, new
                {
                    inst.Id,
                    inst.MediaItemId,
                    inst.ConnectionId,
                    inst.ExternalId,
                    inst.QualityProfileName,
                    inst.CutoffUnmet,
                    inst.IsMonitored,
                    inst.DiskPath,
                    inst.SizeBytes,
                    inst.HasFile,
                    CreatedAt = inst.CreatedAt.ToString("o"),
                    UpdatedAt = inst.UpdatedAt.ToString("o")
                }, transaction: trans, cancellationToken: ct));
            }

            foreach (var s in item.Seasons)
            {
                s.MediaItemId = item.Id;
                await conn.ExecuteAsync(new CommandDefinition(sqlSeason, new
                {
                    s.Id,
                    s.MediaItemId,
                    s.SeasonNumber,
                    s.IsMonitored,
                    s.EpisodeCount,
                    s.EpisodeFileCount,
                    s.SizeBytes,
                    CreatedAt = s.CreatedAt.ToString("o"),
                    UpdatedAt = s.UpdatedAt.ToString("o")
                }, transaction: trans, cancellationToken: ct));
            }

            foreach (var ws in item.WatchStats)
            {
                ws.MediaItemId = item.Id;
                await conn.ExecuteAsync(new CommandDefinition(sqlWatch, new
                {
                    ws.Id,
                    ws.MediaItemId,
                    ws.SeasonNumber,
                    ws.UserId,
                    ws.Username,
                    ws.PlayCount,
                    LastPlayedAt = ws.LastPlayedAt?.ToString("o"),
                    UpdatedAt = ws.UpdatedAt.ToString("o")
                }, transaction: trans, cancellationToken: ct));
            }
        }

        trans.Commit();
    }

    public async Task SetProtectionAsync(string id, bool isProtected, string? reason, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            UPDATE media_items 
            SET is_protected = @IsProtected, protection_reason = @Reason, updated_at = @UpdatedAt
            WHERE id = @Id;";
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = id,
            IsProtected = isProtected ? 1 : 0,
            Reason = reason,
            UpdatedAt = DateTime.UtcNow.ToString("o")
        }, cancellationToken: ct));
    }

    public async Task DeleteInstanceAsync(string instanceId, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "DELETE FROM media_instances WHERE id = @Id;";
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = instanceId }, cancellationToken: ct));
    }

    public async Task DeleteSeasonAsync(string mediaItemId, int seasonNumber, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "DELETE FROM seasons WHERE media_item_id = @MediaItemId AND season_number = @SeasonNumber;";
        await conn.ExecuteAsync(new CommandDefinition(sql, new { MediaItemId = mediaItemId, SeasonNumber = seasonNumber }, cancellationToken: ct));
    }

    public async Task DeleteMediaItemAsync(string id, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "DELETE FROM media_items WHERE id = @Id;";
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
    }

    public async Task<long> GetTotalLibrarySizeBytesAsync(CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "SELECT COALESCE(SUM(total_size_bytes), 0) FROM media_items;";
        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task<int> GetTotalCountAsync(CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "SELECT COUNT(*) FROM media_items;";
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql, cancellationToken: ct));
    }
}
