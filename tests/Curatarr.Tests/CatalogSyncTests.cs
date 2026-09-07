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

    [Fact]
    public async Task SyncAsync_ShouldNotCollide_WhenMovieAndShowHaveSameTitle()
    {
        await _initializer.InitializeAsync();

        var connSonarr = new ServiceConnection
        {
            Id = "sonarr-1",
            ConnectionType = ConnectionType.Sonarr,
            Name = "Sonarr",
            BaseUrl = "http://sonarr:8989",
            ApiKey = "key1",
            IsEnabled = true
        };
        var connRadarr = new ServiceConnection
        {
            Id = "radarr-1",
            ConnectionType = ConnectionType.Radarr,
            Name = "Radarr",
            BaseUrl = "http://radarr:7878",
            ApiKey = "key2",
            IsEnabled = true
        };
        var connPlex = new ServiceConnection
        {
            Id = "plex-1",
            ConnectionType = ConnectionType.Plex,
            Name = "Plex",
            BaseUrl = "http://plex:32400",
            ApiKey = "key3",
            IsEnabled = true
        };
        var connTautulli = new ServiceConnection
        {
            Id = "tautulli-1",
            ConnectionType = ConnectionType.Tautulli,
            Name = "Tautulli",
            BaseUrl = "http://tautulli:8181",
            ApiKey = "key4",
            IsEnabled = true
        };

        await _connRepo.UpsertAsync(connSonarr);
        await _connRepo.UpsertAsync(connRadarr);
        await _connRepo.UpsertAsync(connPlex);
        await _connRepo.UpsertAsync(connTautulli);

        var sonarrClient = Substitute.For<ISonarrClient>();
        var radarrClient = Substitute.For<IRadarrClient>();
        var tautulliClient = Substitute.For<ITautulliClient>();
        var plexClient = Substitute.For<IPlexClient>();

        // TV Show: House (2004)
        var houseShow = new SonarrSeriesDto(
            1, "House", "house", 73255, "tt0412142", 2004, true, "/tv/House", 400_000_000_000, 176, 176, 1,
            [new SonarrSeasonDto(1, true, 50_000_000_000, 22, 22)]
        );
        sonarrClient.GetSeriesAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SonarrSeriesDto>>([houseShow]));

        // Movie: House (1977)
        var houseMovie = new RadarrMovieDto(
            2, "House", "house", 27406, "tt0076162", 1977, true, true, "/movies/House (1977)", 6_500_000_000, 1
        );
        radarrClient.GetMoviesAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<RadarrMovieDto>>([houseMovie]));

        // Plex Sections: Movies and TV Shows
        plexClient.GetSectionsAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PlexSectionDto>>([
                new PlexSectionDto("1", "Movies", "movie", null),
                new PlexSectionDto("2", "TV Shows", "show", null)
            ]));

        // Plex section items
        plexClient.GetSectionItemsAsync(Arg.Any<ServiceConnection>(), "1", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PlexMetadataItemDto>>([
                new PlexMetadataItemDto(19153, "House", "movie", "guid1", 1977, ViewCount: 0)
            ]));
        plexClient.GetSectionItemsAsync(Arg.Any<ServiceConnection>(), "2", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PlexMetadataItemDto>>([
                new PlexMetadataItemDto(27406, "House", "show", "guid2", 2004, ViewCount: 98, LastViewedAt: DateTime.UtcNow.AddDays(-10))
            ]));

        // Tautulli watch history for episode of House (Season 1)
        var historyItem = new TautulliHistoryItemDto(
            RatingKey: 4391,
            GrandparentRatingKey: "27406",
            ParentRatingKey: "19656",
            Title: "Control",
            GrandparentTitle: "House",
            UserId: "user1",
            Username: "spelech",
            SeasonNumber: 1,
            Date: DateTime.UtcNow.AddDays(-5),
            MediaType: "episode",
            Year: 2005
        );
        tautulliClient.GetHistoryAsync(Arg.Any<ServiceConnection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<TautulliHistoryItemDto>>([historyItem]));

        var syncService = new CatalogSyncService(_connRepo, _mediaRepo, sonarrClient, radarrClient, tautulliClient, plexClient);
        await syncService.TriggerSyncAsync(fullSync: true);

        var items = await _mediaRepo.GetPagedAsync(new MediaFilterOptions { Limit = 10 });
        items.Should().HaveCount(2);

        var movieItem = items.First(i => i.MediaType == MediaType.Movie);
        movieItem.Title.Should().Be("House");
        movieItem.Year.Should().Be(1977);
        movieItem.PlexRatingKey.Should().Be(19153);
        movieItem.WatchStats.Should().BeEmpty(); // Movie was not watched!

        var showItem = items.First(i => i.MediaType == MediaType.Series);
        showItem.Title.Should().Be("House");
        showItem.Year.Should().Be(2004);
        showItem.PlexRatingKey.Should().Be(27406);
        showItem.WatchStats.Should().ContainSingle();
        showItem.WatchStats[0].Username.Should().Be("spelech");
        showItem.WatchStats[0].SeasonNumber.Should().Be(1);
        showItem.WatchStats[0].PlayCount.Should().Be(1);
    }

    [Fact]
    public async Task SyncAsync_ShouldMatchTvShow_WhenEpisodeAirYearDiffersFromSeriesPremiereYear()
    {
        await _initializer.InitializeAsync();

        var connSonarr = new ServiceConnection
        {
            Id = "sonarr-1",
            ConnectionType = ConnectionType.Sonarr,
            Name = "Sonarr",
            BaseUrl = "http://sonarr:8989",
            ApiKey = "key1",
            IsEnabled = true
        };
        var connTautulli = new ServiceConnection
        {
            Id = "tautulli-1",
            ConnectionType = ConnectionType.Tautulli,
            Name = "Tautulli",
            BaseUrl = "http://tautulli:8181",
            ApiKey = "key2",
            IsEnabled = true
        };

        await _connRepo.UpsertAsync(connSonarr);
        await _connRepo.UpsertAsync(connTautulli);

        var sonarrClient = Substitute.For<ISonarrClient>();
        var radarrClient = Substitute.For<IRadarrClient>();
        var tautulliClient = Substitute.For<ITautulliClient>();
        var plexClient = Substitute.For<IPlexClient>();

        // Series premiere year is 2005
        var show = new SonarrSeriesDto(
            100, "It's Always Sunny in Philadelphia", "its always sunny in philadelphia", 75805, "tt0472954", 2005, true, "/tv/Sunny", 50_000_000_000, 180, 180, 18,
            [new SonarrSeasonDto(18, true, 2_000_000_000, 8, 8)]
        );
        sonarrClient.GetSeriesAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<SonarrSeriesDto>>([show]));

        // Episode history where Year is 2026 (the episode air year, NOT the 2005 premiere year)
        var historyItem = new TautulliHistoryItemDto(
            RatingKey: 99999,
            GrandparentRatingKey: "88888", // Not in Plex rating key map
            ParentRatingKey: "77777",
            Title: "2026: A Virtual Insanity",
            GrandparentTitle: "It's Always Sunny in Philadelphia",
            UserId: "user-ginkel",
            Username: "ginkel900",
            SeasonNumber: 18,
            Date: DateTime.UtcNow.AddDays(-2),
            MediaType: "episode",
            Year: 2026
        );
        tautulliClient.GetHistoryAsync(Arg.Any<ServiceConnection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<TautulliHistoryItemDto>>([historyItem]));

        var syncService = new CatalogSyncService(_connRepo, _mediaRepo, sonarrClient, radarrClient, tautulliClient, plexClient);
        await syncService.TriggerSyncAsync(fullSync: true);

        var items = await _mediaRepo.GetPagedAsync(new MediaFilterOptions { Limit = 10 });
        items.Should().ContainSingle();

        var sunny = items[0];
        sunny.Title.Should().Be("It's Always Sunny in Philadelphia");
        sunny.Year.Should().Be(2005);
        sunny.WatchStats.Should().ContainSingle();
        sunny.WatchStats[0].Username.Should().Be("ginkel900");
        sunny.WatchStats[0].PlayCount.Should().Be(1);
    }

    [Fact]
    public async Task SyncAsync_ShouldCorrelatePlexAndTautulli_ViaExternalGuid_WhenTitlesDiffer()
    {
        await _initializer.InitializeAsync();

        var connRadarr = new ServiceConnection
        {
            Id = "radarr-1",
            ConnectionType = ConnectionType.Radarr,
            Name = "Radarr",
            BaseUrl = "http://radarr:7878",
            ApiKey = "key1",
            IsEnabled = true
        };
        var connPlex = new ServiceConnection
        {
            Id = "plex-1",
            ConnectionType = ConnectionType.Plex,
            Name = "Plex",
            BaseUrl = "http://plex:32400",
            ApiKey = "key2",
            IsEnabled = true
        };
        var connTautulli = new ServiceConnection
        {
            Id = "tautulli-1",
            ConnectionType = ConnectionType.Tautulli,
            Name = "Tautulli",
            BaseUrl = "http://tautulli:8181",
            ApiKey = "key3",
            IsEnabled = true
        };

        await _connRepo.UpsertAsync(connRadarr);
        await _connRepo.UpsertAsync(connPlex);
        await _connRepo.UpsertAsync(connTautulli);

        var sonarrClient = Substitute.For<ISonarrClient>();
        var radarrClient = Substitute.For<IRadarrClient>();
        var tautulliClient = Substitute.For<ITautulliClient>();
        var plexClient = Substitute.For<IPlexClient>();

        // Radarr has clean title "Saving Private Ryan" with IMDB ID tt0120815
        var movie = new RadarrMovieDto(
            500, "Saving Private Ryan", "saving private ryan", 857, "tt0120815", 1998, true, true, "/movies/Saving Private Ryan", 40_000_000_000, 1
        );
        radarrClient.GetMoviesAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<RadarrMovieDto>>([movie]));

        // Plex has title with suffix "Saving Private Ryan A" and IMDB GUID
        plexClient.GetSectionsAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PlexSectionDto>>([
                new PlexSectionDto("1", "Movies", "movie", null)
            ]));
        plexClient.GetSectionItemsAsync(Arg.Any<ServiceConnection>(), "1", Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PlexMetadataItemDto>>([
                new PlexMetadataItemDto(
                    RatingKey: 5925,
                    Title: "Saving Private Ryan A",
                    Type: "movie",
                    Guid: "com.plexapp.agents.imdb://tt0120815?lang=en",
                    Year: 1998,
                    Guids: ["imdb://tt0120815", "tmdb://857"]
                )
            ]));

        // Tautulli recorded a play under ratingKey 5925
        var historyItem = new TautulliHistoryItemDto(
            RatingKey: 5925,
            GrandparentRatingKey: null,
            ParentRatingKey: null,
            Title: "Saving Private Ryan A",
            GrandparentTitle: null,
            UserId: "user-steve",
            Username: "loudrockmusic",
            SeasonNumber: null,
            Date: DateTime.UtcNow.AddDays(-1000),
            MediaType: "movie",
            Year: 1998
        );
        tautulliClient.GetHistoryAsync(Arg.Any<ServiceConnection>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<TautulliHistoryItemDto>>([historyItem]));

        var syncService = new CatalogSyncService(_connRepo, _mediaRepo, sonarrClient, radarrClient, tautulliClient, plexClient);
        await syncService.TriggerSyncAsync(fullSync: true);

        var items = await _mediaRepo.GetPagedAsync(new MediaFilterOptions { Limit = 10 });
        items.Should().ContainSingle();

        var ryan = items[0];
        ryan.Title.Should().Be("Saving Private Ryan");
        ryan.PlexRatingKey.Should().Be(5925);
        ryan.WatchStats.Should().ContainSingle();
        ryan.WatchStats[0].Username.Should().Be("loudrockmusic");
        ryan.WatchStats[0].PlayCount.Should().Be(1);
    }
}
