using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Curatarr.Infrastructure.Services;
using Dapper;
using FluentAssertions;
using NSubstitute;

namespace Curatarr.Tests;

public class CatalogSyncTests : IDisposable
{
    private readonly string _dbPath;
    private readonly SqliteConnectionFactory _factory;
    private readonly DatabaseInitializer _initializer;
    private readonly IConnectionRepository _connRepo;
    private readonly IMediaRepository _mediaRepo;

    public CatalogSyncTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"curatarr_sync_{Guid.NewGuid():N}.db");
        _factory = new SqliteConnectionFactory($"Data Source={_dbPath}");
        _initializer = new DatabaseInitializer(_factory);
        _connRepo = new ConnectionRepository(_factory);
        _mediaRepo = new MediaRepository(_factory);
    }

    public void Dispose()
    {
        if (File.Exists(_dbPath))
        {
            try { File.Delete(_dbPath); } catch { /* best effort */ }
        }
    }

    [Fact]
    public async Task SyncAsync_ShouldCorrelateDualInstances_IntoSingleMediaItem()
    {
        await _initializer.InitializeAsync();

        // 1. Setup connections for Sonarr HD and Sonarr 4K
        var connHd = new ServiceConnection
        {
            Id = "sonarr-hd",
            ConnectionType = ConnectionType.Sonarr,
            Name = "Sonarr HD",
            BaseUrl = "http://sonarrhd:8989",
            ApiKey = "key1",
            TierTag = "HD",
            IsEnabled = true
        };
        var conn4K = new ServiceConnection
        {
            Id = "sonarr-4k",
            ConnectionType = ConnectionType.Sonarr,
            Name = "Sonarr 4K",
            BaseUrl = "http://sonarr4k:8989",
            ApiKey = "key2",
            TierTag = "4K",
            IsEnabled = true
        };
        await _connRepo.UpsertAsync(connHd);
        await _connRepo.UpsertAsync(conn4K);

        // 2. Mock Sonarr client returning same show (TvdbId: 100) on both instances
        var sonarrClient = Substitute.For<ISonarrClient>();
        var radarrClient = Substitute.For<IRadarrClient>();
        var tautulliClient = Substitute.For<ITautulliClient>();
        var plexClient = Substitute.For<IPlexClient>();

        var showHd = new SonarrSeriesDto(
            1, "Dark", "dark", 100, "tt5753856", 2017, true, "/tv/Dark", 10_000_000_000, 10, 10, 1,
            [new SonarrSeasonDto(1, true, 10_000_000_000, 10, 10)]
        );
        var show4K = new SonarrSeriesDto(
            2, "Dark", "dark", 100, "tt5753856", 2017, true, "/tv4k/Dark", 40_000_000_000, 10, 10, 2,
            [new SonarrSeasonDto(1, true, 40_000_000_000, 10, 10)]
        );

        sonarrClient.GetSeriesAsync(Arg.Is<ServiceConnection>(c => c.Id == "sonarr-hd"), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SonarrSeriesDto>>([showHd]));
        sonarrClient.GetSeriesAsync(Arg.Is<ServiceConnection>(c => c.Id == "sonarr-4k"), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SonarrSeriesDto>>([show4K]));

        // Mock Tautulli history
        var tautulliConn = new ServiceConnection
        {
            Id = "tautulli",
            ConnectionType = ConnectionType.Tautulli,
            Name = "Tautulli",
            BaseUrl = "http://tautulli:8181",
            ApiKey = "key3",
            IsEnabled = true
        };
        await _connRepo.UpsertAsync(tautulliConn);

        var history = new TautulliHistoryItemDto(
            RatingKey: 999,
            GrandparentRatingKey: null,
            ParentRatingKey: null,
            Title: "Dark",
            GrandparentTitle: "Dark",
            UserId: "u1",
            Username: "steve",
            SeasonNumber: 1,
            Date: DateTime.UtcNow.AddDays(-5)
        );
        tautulliClient.GetHistoryAsync(Arg.Any<ServiceConnection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<TautulliHistoryItemDto>>([history]));

        var syncService = new CatalogSyncService(_connRepo, _mediaRepo, sonarrClient, radarrClient, tautulliClient, plexClient);

        // 3. Execute sync
        await syncService.TriggerSyncAsync(fullSync: true);

        // 4. Verify correlation
        var items = await _mediaRepo.GetPagedAsync(new MediaFilterOptions { Limit = 10 });
        items.Should().ContainSingle();

        var dark = items[0];
        dark.Title.Should().Be("Dark");
        dark.TvdbId.Should().Be("100");
        dark.TotalSizeBytes.Should().Be(50_000_000_000); // 10GB HD + 40GB 4K
        dark.Instances.Should().HaveCount(2);
        dark.Instances.Select(i => i.ConnectionId).Should().Contain(["sonarr-hd", "sonarr-4k"]);
        dark.WatchStats.Should().ContainSingle();
        dark.WatchStats[0].Username.Should().Be("steve");
        dark.WatchStats[0].PlayCount.Should().Be(1);
    }

    [Fact]
    public async Task SyncAsync_RepeatedSyncs_ShouldBeIdempotentAndProduceZeroDuplicates()
    {
        await _initializer.InitializeAsync();

        var connHd = new ServiceConnection
        {
            Id = "sonarr-hd",
            ConnectionType = ConnectionType.Sonarr,
            Name = "Sonarr HD",
            BaseUrl = "http://sonarrhd:8989",
            ApiKey = "key1",
            TierTag = "HD",
            IsEnabled = true
        };
        var connRadarr = new ServiceConnection
        {
            Id = "radarr-hd",
            ConnectionType = ConnectionType.Radarr,
            Name = "Radarr HD",
            BaseUrl = "http://radarrhd:7878",
            ApiKey = "key2",
            TierTag = "HD",
            IsEnabled = true
        };
        await _connRepo.UpsertAsync(connHd);
        await _connRepo.UpsertAsync(connRadarr);

        var sonarrClient = Substitute.For<ISonarrClient>();
        var radarrClient = Substitute.For<IRadarrClient>();
        var tautulliClient = Substitute.For<ITautulliClient>();
        var plexClient = Substitute.For<IPlexClient>();

        var show = new SonarrSeriesDto(
            10, "Severance", "severance", 300, "tt11280740", 2022, true, "/tv/Severance", 12_000_000_000, 9, 9, 1,
            [new SonarrSeasonDto(1, true, 12_000_000_000, 9, 9)]
        );
        sonarrClient.GetSeriesAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SonarrSeriesDto>>([show]));

        var movie = new RadarrMovieDto(
            20, "Dune: Part Two", "dune part two", 693134, "tt15239678", 2024, true, true, "/movies/Dune 2", 25_000_000_000, 1
        );
        radarrClient.GetMoviesAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<RadarrMovieDto>>([movie]));

        var syncService = new CatalogSyncService(_connRepo, _mediaRepo, sonarrClient, radarrClient, tautulliClient, plexClient);

        // Run sync 3 consecutive times
        await syncService.TriggerSyncAsync(fullSync: true);
        await syncService.TriggerSyncAsync(fullSync: false);
        await syncService.TriggerSyncAsync(fullSync: false);

        // Verify count and sizes in repo
        var items = await _mediaRepo.GetPagedAsync(new MediaFilterOptions { Limit = 100 });
        items.Should().HaveCount(2);

        var sev = items.First(i => i.Title == "Severance");
        sev.TotalSizeBytes.Should().Be(12_000_000_000);
        sev.Instances.Should().HaveCount(1);
        sev.Seasons.Should().HaveCount(1);

        var dune = items.First(i => i.Title == "Dune: Part Two");
        dune.TotalSizeBytes.Should().Be(25_000_000_000);
        dune.Instances.Should().HaveCount(1);

        // Verify SQLite raw tables have zero duplicate rows
        using var conn = _factory.CreateConnection();
        var itemCount = await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM media_items;");
        var instCount = await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM media_instances;");
        var seasCount = await conn.ExecuteScalarAsync<int>("SELECT count(*) FROM seasons;");

        itemCount.Should().Be(2);
        instCount.Should().Be(2);
        seasCount.Should().Be(1);
    }
}
