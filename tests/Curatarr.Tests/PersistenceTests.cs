using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
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
}
