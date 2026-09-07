using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Dapper;
using FluentAssertions;

namespace Curatarr.Tests;

public class PersistenceTests : IDisposable
{
    private readonly string _dbPath;
    private readonly SqliteConnectionFactory _factory;
    private readonly DatabaseInitializer _initializer;

    public PersistenceTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"curatarr_test_{Guid.NewGuid():N}.db");
        _factory = new SqliteConnectionFactory($"Data Source={_dbPath}");
        _initializer = new DatabaseInitializer(_factory);
    }

    public void Dispose()
    {
        if (File.Exists(_dbPath))
        {
            try { File.Delete(_dbPath); } catch { /* best effort */ }
        }
    }

    [Fact]
    public async Task DatabaseInitializer_ShouldInitializeWalModeAndTables()
    {
        await _initializer.InitializeAsync();

        using var conn = _factory.CreateConnection();
        conn.Open();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "PRAGMA journal_mode;";
        var mode = cmd.ExecuteScalar()?.ToString();
        mode.Should().BeEquivalentTo("wal");
    }

    [Fact]
    public async Task ConnectionRepository_ShouldPerformCrud()
    {
        await _initializer.InitializeAsync();
        IConnectionRepository repo = new ConnectionRepository(_factory);

        var conn = new ServiceConnection
        {
            Id = Guid.NewGuid().ToString("N"),
            ConnectionType = ConnectionType.Sonarr,
            Name = "Sonarr 4K",
            BaseUrl = "http://sonarr4k:8989",
            ApiKey = "secret123",
            TierTag = "4K",
            IsEnabled = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await repo.UpsertAsync(conn);

        var retrieved = await repo.GetByIdAsync(conn.Id);
        retrieved.Should().NotBeNull();
        retrieved!.Name.Should().Be("Sonarr 4K");
        retrieved.TierTag.Should().Be("4K");

        var all = await repo.GetAllAsync();
        all.Should().ContainSingle(c => c.Id == conn.Id);

        await repo.DeleteAsync(conn.Id);
        var afterDelete = await repo.GetByIdAsync(conn.Id);
        afterDelete.Should().BeNull();
    }

    [Fact]
    public async Task MediaRepository_ShouldInsertAndQueryWithProtection()
    {
        await _initializer.InitializeAsync();
        IMediaRepository repo = new MediaRepository(_factory);

        var item = new MediaItem
        {
            Id = Guid.NewGuid().ToString("N"),
            MediaType = MediaType.Movie,
            Title = "Inception",
            SortTitle = "Inception",
            Year = 2010,
            TmdbId = "27205",
            ImdbId = "tt1375666",
            AddedAt = DateTime.UtcNow.AddDays(-100),
            TotalSizeBytes = 15_000_000_000,
            IsProtected = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Instances =
            [
                new MediaInstance
                {
                    Id = Guid.NewGuid().ToString("N"),
                    MediaItemId = "", // will be linked
                    ConnectionId = "dummy-conn",
                    ExternalId = 101,
                    QualityProfileName = "Ultra-HD",
                    CutoffUnmet = false,
                    IsMonitored = true,
                    DiskPath = "/movies/Inception (2010)",
                    SizeBytes = 15_000_000_000,
                    HasFile = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            ],
            WatchStats =
            [
                new WatchStat
                {
                    Id = Guid.NewGuid().ToString("N"),
                    MediaItemId = "", // will be linked
                    UserId = "user-1",
                    Username = "steve",
                    PlayCount = 3,
                    LastPlayedAt = DateTime.UtcNow.AddDays(-10),
                    UpdatedAt = DateTime.UtcNow
                }
            ]
        };

        await repo.UpsertBatchAsync([item]);

        var fetched = await repo.GetByIdAsync(item.Id);
        fetched.Should().NotBeNull();
        fetched!.Title.Should().Be("Inception");
        fetched.Instances.Should().HaveCount(1);
        fetched.WatchStats.Should().HaveCount(1);
        fetched.IsProtected.Should().BeFalse();

        // Toggle protection
        await repo.SetProtectionAsync(item.Id, true, "Favorite movie");
        var protectedItem = await repo.GetByIdAsync(item.Id);
        protectedItem!.IsProtected.Should().BeTrue();
        protectedItem.ProtectionReason.Should().Be("Favorite movie");
    }

    [Fact]
    public async Task MediaRepository_ShouldFilterByResolution_AndCutoffUnmet()
    {
        await _initializer.InitializeAsync();
        IMediaRepository repo = new MediaRepository(_factory);

        var sdCutoffItem = new MediaItem
        {
            Id = "sd-cutoff",
            MediaType = MediaType.Movie,
            Title = "SD Cutoff Unmet Movie",
            SortTitle = "SD Cutoff Unmet Movie",
            TotalSizeBytes = 1_000_000_000,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-sd",
                    MediaItemId = "sd-cutoff",
                    ConnectionId = "radarr-1",
                    ExternalId = 1,
                    Resolution = "SD",
                    CutoffUnmet = true,
                    HasFile = true
                }
            ]
        };

        var hdItem = new MediaItem
        {
            Id = "hd-met",
            MediaType = MediaType.Movie,
            Title = "HD Met Movie",
            SortTitle = "HD Met Movie",
            TotalSizeBytes = 5_000_000_000,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-hd",
                    MediaItemId = "hd-met",
                    ConnectionId = "radarr-1",
                    ExternalId = 2,
                    Resolution = "1080p",
                    CutoffUnmet = false,
                    HasFile = true
                }
            ]
        };

        var fourKCutoffItem = new MediaItem
        {
            Id = "4k-cutoff",
            MediaType = MediaType.Movie,
            Title = "4K Cutoff Movie",
            SortTitle = "4K Cutoff Movie",
            TotalSizeBytes = 30_000_000_000,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-4k",
                    MediaItemId = "4k-cutoff",
                    ConnectionId = "radarr-2",
                    ExternalId = 3,
                    Resolution = "4K",
                    CutoffUnmet = true,
                    HasFile = true
                }
            ]
        };

        await repo.UpsertBatchAsync([sdCutoffItem, hdItem, fourKCutoffItem]);

        // Filter by Resolution = SD
        var sdResults = await repo.GetPagedAsync(new MediaFilterOptions(ResolutionFilter: "SD"));
        sdResults.Should().ContainSingle();
        sdResults[0].Id.Should().Be("sd-cutoff");
        sdResults[0].Instances[0].Resolution.Should().Be("SD");

        // Filter by Resolution = 1080p
        var hdResults = await repo.GetPagedAsync(new MediaFilterOptions(ResolutionFilter: "1080p"));
        hdResults.Should().ContainSingle();
        hdResults[0].Id.Should().Be("hd-met");

        // Filter by CutoffUnmet = true
        var cutoffResults = await repo.GetPagedAsync(new MediaFilterOptions(CutoffUnmetFilter: true));
        cutoffResults.Should().HaveCount(2);
        cutoffResults.Select(x => x.Id).Should().Contain(["sd-cutoff", "4k-cutoff"]);

        // Combined: SD + CutoffUnmet = true
        var combined = await repo.GetPagedAsync(new MediaFilterOptions(ResolutionFilter: "SD", CutoffUnmetFilter: true));
        combined.Should().ContainSingle();
        combined[0].Id.Should().Be("sd-cutoff");
    }

    [Fact]
    public async Task AuditRepository_ShouldRecordAndCalculateTotalFreed()
    {
        await _initializer.InitializeAsync();
        IAuditRepository repo = new AuditRepository(_factory);

        var entry1 = new AuditLogEntry
        {
            Id = Guid.NewGuid().ToString("N"),
            MediaItemId = "item-1",
            Title = "Old Show",
            MediaType = "Series",
            SeasonNumber = 1,
            InstancesAffectedJson = "[\"Sonarr HD\"]",
            BytesFreed = 10_000_000_000,
            AddedToImportExclusion = false,
            Actor = "WebUI",
            ExecutedAt = DateTime.UtcNow,
            Details = "Season 1 pruned"
        };

        var entry2 = new AuditLogEntry
        {
            Id = Guid.NewGuid().ToString("N"),
            MediaItemId = "item-2",
            Title = "Old Movie",
            MediaType = "Movie",
            SeasonNumber = null,
            InstancesAffectedJson = "[\"Radarr HD\"]",
            BytesFreed = 5_000_000_000,
            AddedToImportExclusion = true,
            Actor = "MCP_Agent",
            ExecutedAt = DateTime.UtcNow,
            Details = "Movie pruned"
        };

        await repo.AddAsync(entry1);
        await repo.AddAsync(entry2);

        var total = await repo.GetTotalBytesFreedAsync();
        total.Should().Be(15_000_000_000);

        var recent = await repo.GetRecentAsync(10);
        recent.Should().HaveCount(2);
    }

    [Fact]
    public async Task DatabaseInitializer_ShouldMigrateLegacyDatabase_WithoutResolutionOrCutoffColumns()
    {
        var legacyDbPath = Path.Combine(Path.GetTempPath(), $"curatarr_legacy_{Guid.NewGuid():N}.db");
        try
        {
            var legacyFactory = new SqliteConnectionFactory($"Data Source={legacyDbPath}");
            using (var conn = legacyFactory.CreateConnection())
            {
                conn.Open();
                // Create legacy media_items and media_instances tables without resolution/cutoff_unmet
                await conn.ExecuteAsync(@"
                    CREATE TABLE media_items (
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

                    CREATE TABLE media_instances (
                        id TEXT PRIMARY KEY,
                        media_item_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
                        connection_id TEXT NOT NULL,
                        external_id INTEGER NOT NULL,
                        quality_profile_name TEXT,
                        is_monitored INTEGER NOT NULL DEFAULT 1,
                        disk_path TEXT,
                        size_bytes INTEGER NOT NULL DEFAULT 0,
                        has_file INTEGER NOT NULL DEFAULT 1,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                ");
            }

            var legacyInitializer = new DatabaseInitializer(legacyFactory);
            // Must succeed without SQLite Error: no such column
            await legacyInitializer.InitializeAsync();

            using (var verifyConn = legacyFactory.CreateConnection())
            {
                verifyConn.Open();
                var cols = (await verifyConn.QueryAsync<dynamic>("PRAGMA table_info(media_instances);")).ToList();
                var colNames = cols.Select(c => ((IDictionary<string, object>)c)["name"]?.ToString() ?? "").ToList();
                colNames.Should().Contain(["resolution", "cutoff_unmet"]);
            }
        }
        finally
        {
            if (File.Exists(legacyDbPath))
            {
                try { File.Delete(legacyDbPath); } catch { /* best effort */ }
            }
        }
    }
}
