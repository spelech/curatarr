using Dapper;

namespace Curatarr.Infrastructure.Data;

public class DatabaseInitializer
{
    private readonly SqliteConnectionFactory _connectionFactory;

    public DatabaseInitializer(SqliteConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task InitializeAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        connection.Open();

        // Enable WAL mode and foreign keys
        await connection.ExecuteAsync("PRAGMA journal_mode = WAL;");
        await connection.ExecuteAsync("PRAGMA foreign_keys = ON;");

        const string schemaSql = @"
        CREATE TABLE IF NOT EXISTS service_connections (
            id TEXT PRIMARY KEY,
            connection_type INTEGER NOT NULL,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            tier_tag TEXT,
            is_enabled INTEGER NOT NULL DEFAULT 1,
            last_sync_at TEXT,
            last_status TEXT DEFAULT 'Unknown',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS media_items (
            id TEXT PRIMARY KEY,
            media_type INTEGER NOT NULL,
            title TEXT NOT NULL,
            sort_title TEXT NOT NULL,
            year INTEGER,
            tmdb_id TEXT,
            tvdb_id TEXT,
            imdb_id TEXT,
            plex_rating_key INTEGER,
            poster_url TEXT,
            added_at TEXT,
            total_size_bytes INTEGER NOT NULL DEFAULT 0,
            is_protected INTEGER NOT NULL DEFAULT 0,
            protection_reason TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS media_instances (
            id TEXT PRIMARY KEY,
            media_item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
            connection_id TEXT NOT NULL,
            external_id INTEGER NOT NULL,
            quality_profile_name TEXT,
            cutoff_unmet INTEGER NOT NULL DEFAULT 0,
            is_monitored INTEGER NOT NULL DEFAULT 1,
            disk_path TEXT,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            has_file INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS seasons (
            id TEXT PRIMARY KEY,
            media_item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
            season_number INTEGER NOT NULL,
            is_monitored INTEGER NOT NULL DEFAULT 1,
            episode_count INTEGER NOT NULL DEFAULT 0,
            episode_file_count INTEGER NOT NULL DEFAULT 0,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS watch_stats (
            id TEXT PRIMARY KEY,
            media_item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
            season_number INTEGER,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            play_count INTEGER NOT NULL DEFAULT 0,
            last_played_at TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            media_item_id TEXT,
            title TEXT NOT NULL,
            media_type TEXT NOT NULL,
            season_number INTEGER,
            instances_affected_json TEXT NOT NULL,
            bytes_freed INTEGER NOT NULL,
            added_to_import_exclusion INTEGER NOT NULL,
            actor TEXT NOT NULL,
            executed_at TEXT NOT NULL,
            details TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
        CREATE INDEX IF NOT EXISTS idx_media_protected ON media_items(is_protected);
        CREATE INDEX IF NOT EXISTS idx_media_added ON media_items(added_at);
        CREATE INDEX IF NOT EXISTS idx_media_size ON media_items(total_size_bytes);
        CREATE INDEX IF NOT EXISTS idx_media_ids ON media_items(tmdb_id, tvdb_id, imdb_id);
        CREATE INDEX IF NOT EXISTS idx_instances_item ON media_instances(media_item_id);
        CREATE INDEX IF NOT EXISTS idx_seasons_item ON seasons(media_item_id, season_number);
        CREATE INDEX IF NOT EXISTS idx_watch_item ON watch_stats(media_item_id);
        CREATE INDEX IF NOT EXISTS idx_watch_user ON watch_stats(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(executed_at);
        ";

        await connection.ExecuteAsync(schemaSql);
    }
}
