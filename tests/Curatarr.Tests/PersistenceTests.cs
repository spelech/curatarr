using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Dapper;
using FluentAssertions;
using NSubstitute;

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
    public async Task MediaRepository_ShouldFilterByPre2017WatchHistory()
    {
        await _initializer.InitializeAsync();
        IMediaRepository repo = new MediaRepository(_factory);

        var pre2017Unwatched = new MediaItem
        {
            Id = "pre2017-unwatched",
            MediaType = MediaType.Movie,
            Title = "Old Movie Pre-2017",
            AddedAt = DateTime.Parse("2015-06-01T00:00:00Z"),
            Year = 2014,
            TotalSizeBytes = 1000,
            WatchStats = []
        };

        var post2017Unwatched = new MediaItem
        {
            Id = "post2017-unwatched",
            MediaType = MediaType.Movie,
            Title = "Recent Movie Post-2017",
            AddedAt = DateTime.Parse("2021-06-01T00:00:00Z"),
            Year = 2020,
            TotalSizeBytes = 1000,
            WatchStats = []
        };

        var pre2017Watched = new MediaItem
        {
            Id = "pre2017-watched",
            MediaType = MediaType.Movie,
            Title = "Old Movie But Watched",
            AddedAt = DateTime.Parse("2015-06-01T00:00:00Z"),
            Year = 2014,
            TotalSizeBytes = 1000,
            WatchStats = [
                new WatchStat { Id = "ws1", MediaItemId = "pre2017-watched", UserId = "u1", PlayCount = 3 }
            ]
        };

        var nullAddedOldYear = new MediaItem
        {
            Id = "null-added-old-year",
            MediaType = MediaType.Movie,
            Title = "Unknown Added Date Old Year",
            AddedAt = null,
            Year = 2012,
            TotalSizeBytes = 1000,
            WatchStats = []
        };

        await repo.UpsertBatchAsync([pre2017Unwatched, post2017Unwatched, pre2017Watched, nullAddedOldYear]);

        // Filter: only pre-2017
        var onlyResults = await repo.GetPagedAsync(new MediaFilterOptions(Pre2017Filter: "only"));
        onlyResults.Select(x => x.Id).Should().BeEquivalentTo(["pre2017-unwatched", "null-added-old-year"]);

        // Filter: exclude pre-2017
        var excludeResults = await repo.GetPagedAsync(new MediaFilterOptions(Pre2017Filter: "exclude"));
        excludeResults.Select(x => x.Id).Should().BeEquivalentTo(["post2017-unwatched", "pre2017-watched"]);

        // Filter: all (default)
        var allResults = await repo.GetPagedAsync(new MediaFilterOptions(Pre2017Filter: "all"));
        allResults.Select(x => x.Id).Should().Contain(["pre2017-unwatched", "post2017-unwatched", "pre2017-watched", "null-added-old-year"]);
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

    [Fact]
    public async Task MediaRepository_DeleteSeasonAsync_ShouldRemoveSeason()
    {
        await _initializer.InitializeAsync();
        IMediaRepository repo = new MediaRepository(_factory);

        var series = new MediaItem
        {
            Id = "series-season-del-test",
            MediaType = MediaType.Series,
            Title = "Severance Season Del",
            Seasons = [
                new Season { Id = "s1", MediaItemId = "series-season-del-test", SeasonNumber = 1, EpisodeFileCount = 9, SizeBytes = 20000 },
                new Season { Id = "s2", MediaItemId = "series-season-del-test", SeasonNumber = 2, EpisodeFileCount = 10, SizeBytes = 25000 }
            ]
        };

        await repo.UpsertBatchAsync([series]);
        var before = await repo.GetByIdAsync("series-season-del-test");
        before!.Seasons.Should().HaveCount(2);

        await repo.DeleteSeasonAsync("series-season-del-test", 1);

        var after = await repo.GetByIdAsync("series-season-del-test");
        after!.Seasons.Should().HaveCount(1);
        after.Seasons[0].SeasonNumber.Should().Be(2);
    }

    [Fact]
    public async Task MediaRepository_FindByExternalIdAsync_ShouldMatchCorrectly()
    {
        await _initializer.InitializeAsync();
        IMediaRepository repo = new MediaRepository(_factory);

        var item = new MediaItem
        {
            Id = "ext-id-test",
            MediaType = MediaType.Movie,
            Title = "Dune",
            TmdbId = "438631",
            TvdbId = "99999",
            ImdbId = "tt1160419"
        };
        await repo.UpsertBatchAsync([item]);

        var matchTmdb = await repo.FindByExternalIdAsync("438631", null, null);
        matchTmdb.Should().NotBeNull();
        matchTmdb!.Id.Should().Be("ext-id-test");

        var matchTvdb = await repo.FindByExternalIdAsync(null, "99999", null);
        matchTvdb.Should().NotBeNull();
        matchTvdb!.Id.Should().Be("ext-id-test");

        var matchImdb = await repo.FindByExternalIdAsync(null, null, "tt1160419");
        matchImdb.Should().NotBeNull();
        matchImdb!.Id.Should().Be("ext-id-test");

        var noMatch = await repo.FindByExternalIdAsync("0000", "0000", "0000");
        noMatch.Should().BeNull();
    }

    [Fact]
    public async Task MediaRepository_GetTotalLibrarySizeBytesAndCount_ShouldCalculateCorrectly()
    {
        await _initializer.InitializeAsync();
        IMediaRepository repo = new MediaRepository(_factory);

        var item1 = new MediaItem { Id = "size-count-1", MediaType = MediaType.Movie, Title = "Movie 1", TotalSizeBytes = 10_000_000_000 };
        var item2 = new MediaItem { Id = "size-count-2", MediaType = MediaType.Series, Title = "Series 1", TotalSizeBytes = 25_000_000_000 };

        await repo.UpsertBatchAsync([item1, item2]);

        var totalSize = await repo.GetTotalLibrarySizeBytesAsync();
        var totalCount = await repo.GetTotalCountAsync();

        totalSize.Should().BeGreaterOrEqualTo(35_000_000_000);
        totalCount.Should().BeGreaterOrEqualTo(2);
    }

    [Fact]
    public void DateTimeHandler_ShouldHandleAllTypesAndConversions()
    {
        var handler = new DateTimeHandler();
        var param = NSubstitute.Substitute.For<System.Data.IDbDataParameter>();

        // SetValue
        var now = DateTime.UtcNow;
        handler.SetValue(param, now);
        param.Received().Value = now.ToString("o");

        // Parse UTC DateTime
        var parsedUtc = handler.Parse(now);
        parsedUtc.Kind.Should().Be(DateTimeKind.Utc);
        parsedUtc.Should().BeCloseTo(now, TimeSpan.FromSeconds(1));

        // Parse Local DateTime
        var localDt = DateTime.SpecifyKind(now, DateTimeKind.Local);
        var parsedFromLocal = handler.Parse(localDt);
        parsedFromLocal.Kind.Should().Be(DateTimeKind.Utc);

        // Parse DateTimeOffset
        var dto = new DateTimeOffset(now);
        var parsedFromDto = handler.Parse(dto);
        parsedFromDto.Should().BeCloseTo(now, TimeSpan.FromSeconds(1));

        // Parse string
        var isoStr = now.ToString("o");
        var parsedFromStr = handler.Parse(isoStr);
        parsedFromStr.Should().BeCloseTo(now, TimeSpan.FromSeconds(1));

        // Parse fallback object (e.g. boxed string or Convert.ToDateTime compatible)
        object boxed = now.ToString("yyyy-MM-dd HH:mm:ss");
        var parsedFallback = handler.Parse(boxed);
        parsedFallback.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public void NullableDateTimeHandler_ShouldHandleNullsAndConversions()
    {
        var handler = new NullableDateTimeHandler();
        var param = NSubstitute.Substitute.For<System.Data.IDbDataParameter>();

        // SetValue with null
        handler.SetValue(param, null);
        param.Received().Value = DBNull.Value;

        // SetValue with value
        var now = DateTime.UtcNow;
        handler.SetValue(param, now);
        param.Received().Value = now.ToString("o");

        // Parse null and DBNull
        handler.Parse(null!).Should().BeNull();
        handler.Parse(DBNull.Value).Should().BeNull();

        // Parse UTC DateTime
        var parsedUtc = handler.Parse(now);
        parsedUtc.Should().NotBeNull();
        parsedUtc!.Value.Kind.Should().Be(DateTimeKind.Utc);

        // Parse Local DateTime
        var localDt = DateTime.SpecifyKind(now, DateTimeKind.Local);
        var parsedFromLocal = handler.Parse(localDt);
        parsedFromLocal!.Value.Kind.Should().Be(DateTimeKind.Utc);

        // Parse DateTimeOffset
        var dto = new DateTimeOffset(now);
        var parsedFromDto = handler.Parse(dto);
        parsedFromDto.Should().NotBeNull();

        // Parse string
        var isoStr = now.ToString("o");
        var parsedFromStr = handler.Parse(isoStr);
        parsedFromStr.Should().NotBeNull();

        // Parse fallback object
        object boxed = now.ToString("yyyy-MM-dd HH:mm:ss");
        var parsedFallback = handler.Parse(boxed);
        parsedFallback.Should().NotBeNull();
    }

    [Fact]
    public async Task SettingsRepository_CorruptJson_ShouldFallbackToDefaults()
    {
        await _initializer.InitializeAsync();
        var settingsRepo = new SettingsRepository(_factory);

        using (var conn = _factory.CreateConnection())
        {
            await conn.ExecuteAsync("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('curatarr_thresholds', '{this is not valid json', CURRENT_TIMESTAMP);");
        }

        var loaded = await settingsRepo.GetSettingsAsync();
        loaded.Should().NotBeNull();
        loaded.StaleDays.Should().Be(180);
    }

    [Fact]
    public async Task MediaRepository_GetPagedAsync_ShouldCoverAllSortAndFilterBranches()
    {
        await _initializer.InitializeAsync();
        IMediaRepository repo = new MediaRepository(_factory);

        var itemA = new MediaItem
        {
            Id = "sort-a",
            MediaType = MediaType.Movie,
            Title = "Alpha",
            SortTitle = "Alpha",
            TotalSizeBytes = 1000,
            AddedAt = new DateTime(2016, 5, 1, 0, 0, 0, DateTimeKind.Utc),
            Year = 2015,
            Instances = [new MediaInstance { Id = "inst-a", MediaItemId = "sort-a", ConnectionId = "conn-1", ExternalId = 101, CutoffUnmet = true, Resolution = "1080p", HasFile = true }]
        };
        var itemB = new MediaItem
        {
            Id = "sort-b",
            MediaType = MediaType.Movie,
            Title = "Beta",
            SortTitle = "Beta",
            TotalSizeBytes = 5000,
            AddedAt = DateTime.UtcNow.AddDays(-2),
            Year = 2022,
            Instances = [new MediaInstance { Id = "inst-b", MediaItemId = "sort-b", ConnectionId = "conn-1", ExternalId = 102, CutoffUnmet = false, Resolution = "4K", HasFile = true }]
        };

        await repo.UpsertBatchAsync([itemA, itemB]);

        // Sort by title asc & desc
        var titleAsc = await repo.GetPagedAsync(new MediaFilterOptions(SortBy: "title", SortDescending: false));
        titleAsc[0].Title.Should().Be("Alpha");
        var titleDesc = await repo.GetPagedAsync(new MediaFilterOptions(SortBy: "title", SortDescending: true));
        titleDesc[0].Title.Should().Be("Beta");

        // Sort by added asc & desc
        var addedAsc = await repo.GetPagedAsync(new MediaFilterOptions(SortBy: "added", SortDescending: false));
        addedAsc[0].Id.Should().Be("sort-a");
        var addedDesc = await repo.GetPagedAsync(new MediaFilterOptions(SortBy: "added", SortDescending: true));
        addedDesc[0].Id.Should().Be("sort-b");

        // Sort by size asc & desc
        var sizeAsc = await repo.GetPagedAsync(new MediaFilterOptions(SortBy: "size", SortDescending: false));
        sizeAsc[0].Id.Should().Be("sort-a");
        var sizeDesc = await repo.GetPagedAsync(new MediaFilterOptions(SortBy: "size", SortDescending: true));
        sizeDesc[0].Id.Should().Be("sort-b");

        // Resolution filter
        var res4k = await repo.GetPagedAsync(new MediaFilterOptions(ResolutionFilter: "4K"));
        res4k.Should().ContainSingle(i => i.Id == "sort-b");

        // Cutoff unmet filter
        var cutoffUnmet = await repo.GetPagedAsync(new MediaFilterOptions(CutoffUnmetFilter: true));
        cutoffUnmet.Should().ContainSingle(i => i.Id == "sort-a");

        // Pre-2017 exclude vs only vs all
        var pre2017Exclude = await repo.GetPagedAsync(new MediaFilterOptions(Pre2017Filter: "exclude"));
        pre2017Exclude.Should().Contain(i => i.Id == "sort-b");

        var pre2017Only = await repo.GetPagedAsync(new MediaFilterOptions(Pre2017Filter: "only"));
        pre2017Only.Should().Contain(i => i.Id == "sort-a");

        var pre2017All = await repo.GetPagedAsync(new MediaFilterOptions(Pre2017Filter: "all"));
        pre2017All.Count.Should().BeGreaterOrEqualTo(2);

        // RequestedBy filter (case-insensitive)
        itemA.RequestedBy = "spelech";
        await repo.UpsertBatchAsync([itemA]);
        var reqSpelech = await repo.GetPagedAsync(new MediaFilterOptions(RequestedByFilter: "SPELECH"));
        reqSpelech.Should().ContainSingle(i => i.Id == "sort-a");

        var reqOther = await repo.GetPagedAsync(new MediaFilterOptions(RequestedByFilter: "non_existent_requester"));
        reqOther.Should().BeEmpty();

        // Protection requests queue & category
        await repo.AddOrUpdateProtectionRequestAsync(new ProtectionRequest
        {
            Id = "req-1",
            MediaItemId = "sort-b",
            UserId = "user-alice",
            Username = "Alice",
            Reason = "Must keep!"
        });

        var protReqCategory = await repo.GetPagedAsync(new MediaFilterOptions(CategoryId: SmartCategoryIds.ProtectionRequested));
        protReqCategory.Should().ContainSingle(i => i.Id == "sort-b");

        var allPending = await repo.GetAllProtectionRequestsAsync();
        allPending.Should().ContainSingle(r => r.MediaItemId == "sort-b" && r.Username == "Alice" && r.Title == "Beta");

        // Empty result branch
        var emptyRes = await repo.GetPagedAsync(new MediaFilterOptions(SearchQuery: "NonExistentItemXYZ123"));
        emptyRes.Should().BeEmpty();
    }
}

