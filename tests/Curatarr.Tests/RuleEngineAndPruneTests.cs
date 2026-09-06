using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Curatarr.Infrastructure.Services;
using FluentAssertions;
using NSubstitute;

namespace Curatarr.Tests;

public class RuleEngineAndPruneTests : IDisposable
{
    private readonly string _dbPath;
    private readonly SqliteConnectionFactory _factory;
    private readonly DatabaseInitializer _initializer;
    private readonly IConnectionRepository _connRepo;
    private readonly IMediaRepository _mediaRepo;
    private readonly IAuditRepository _auditRepo;

    public RuleEngineAndPruneTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"curatarr_rule_{Guid.NewGuid():N}.db");
        _factory = new SqliteConnectionFactory($"Data Source={_dbPath}");
        _initializer = new DatabaseInitializer(_factory);
        _connRepo = new ConnectionRepository(_factory);
        _mediaRepo = new MediaRepository(_factory);
        _auditRepo = new AuditRepository(_factory);
    }

    public void Dispose()
    {
        if (File.Exists(_dbPath))
        {
            try { File.Delete(_dbPath); } catch { /* best effort */ }
        }
    }

    [Fact]
    public async Task SmartCategoryEngine_ShouldReturnAccurateSummaries()
    {
        await _initializer.InitializeAsync();

        // Seed 1 never watched movie, 1 stale movie, 1 protected show
        var movieNever = new MediaItem
        {
            Id = "movie-never",
            MediaType = MediaType.Movie,
            Title = "Unwatched Movie",
            SortTitle = "Unwatched Movie",
            AddedAt = DateTime.UtcNow.AddDays(-100),
            TotalSizeBytes = 10_000_000_000,
            IsProtected = false
        };

        var movieStale = new MediaItem
        {
            Id = "movie-stale",
            MediaType = MediaType.Movie,
            Title = "Stale Movie",
            SortTitle = "Stale Movie",
            AddedAt = DateTime.UtcNow.AddDays(-300),
            TotalSizeBytes = 20_000_000_000,
            IsProtected = false,
            WatchStats =
            [
                new WatchStat
                {
                    Id = "ws-1",
                    MediaItemId = "movie-stale",
                    UserId = "user-1",
                    Username = "steve",
                    PlayCount = 1,
                    LastPlayedAt = DateTime.UtcNow.AddDays(-200)
                }
            ]
        };

        var showProtected = new MediaItem
        {
            Id = "show-prot",
            MediaType = MediaType.Series,
            Title = "Protected Show",
            SortTitle = "Protected Show",
            TotalSizeBytes = 50_000_000_000,
            IsProtected = true,
            ProtectionReason = "Keep forever"
        };

        await _mediaRepo.UpsertBatchAsync([movieNever, movieStale, showProtected]);

        ISmartCategoryEngine engine = new SmartCategoryEngine(_factory);
        var summaries = await engine.GetSummariesAsync(userIdFilter: null);

        var neverCat = summaries.FirstOrDefault(s => s.CategoryId == SmartCategoryIds.NeverWatched);
        neverCat.Should().NotBeNull();
        neverCat!.Count.Should().Be(1);
        neverCat.ReclaimableSizeBytes.Should().Be(10_000_000_000);

        var staleCat = summaries.FirstOrDefault(s => s.CategoryId == SmartCategoryIds.Stale);
        staleCat.Should().NotBeNull();
        staleCat!.Count.Should().Be(1);
        staleCat.ReclaimableSizeBytes.Should().Be(20_000_000_000);

        var protCat = summaries.FirstOrDefault(s => s.CategoryId == SmartCategoryIds.Protected);
        protCat.Should().NotBeNull();
        protCat!.Count.Should().Be(1);
    }

    [Fact]
    public async Task PruneExecutionService_ShouldRejectProtectedItem()
    {
        await _initializer.InitializeAsync();

        var show = new MediaItem
        {
            Id = "protected-item",
            MediaType = MediaType.Series,
            Title = "Protected Show",
            IsProtected = true,
            ProtectionReason = "Whitelist"
        };
        await _mediaRepo.UpsertBatchAsync([show]);

        var sonarrClient = Substitute.For<ISonarrClient>();
        var radarrClient = Substitute.For<IRadarrClient>();
        var overseerrClient = Substitute.For<IOverseerrClient>();

        IPruneExecutionService service = new PruneExecutionService(_mediaRepo, _connRepo, _auditRepo, sonarrClient, radarrClient, overseerrClient);

        var cmd = new PruneCommand(
            MediaItemId: "protected-item",
            SeasonNumber: null,
            TargetConnectionIds: ["conn-1"],
            AddImportExclusion: false,
            Actor: "WebUI"
        );

        var result = await service.ExecutePruneAsync(cmd);
        result.Success.Should().BeFalse();
        result.Message.Should().Contain("protected");

        // Verify Arr clients were NOT called
        await sonarrClient.DidNotReceive().DeleteSeriesAsync(Arg.Any<ServiceConnection>(), Arg.Any<int>(), Arg.Any<bool>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PruneExecutionService_ShouldExecuteMoviePrune_AndLogToAudit()
    {
        await _initializer.InitializeAsync();

        var conn = new ServiceConnection
        {
            Id = "radarr-hd",
            ConnectionType = ConnectionType.Radarr,
            Name = "Radarr HD",
            BaseUrl = "http://radarr:7878",
            ApiKey = "key"
        };
        await _connRepo.UpsertAsync(conn);

        var movie = new MediaItem
        {
            Id = "movie-1",
            MediaType = MediaType.Movie,
            Title = "Delete Me Movie",
            TotalSizeBytes = 8_000_000_000,
            IsProtected = false,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-1",
                    MediaItemId = "movie-1",
                    ConnectionId = "radarr-hd",
                    ExternalId = 999,
                    SizeBytes = 8_000_000_000,
                    HasFile = true
                }
            ]
        };
        await _mediaRepo.UpsertBatchAsync([movie]);

        var sonarrClient = Substitute.For<ISonarrClient>();
        var radarrClient = Substitute.For<IRadarrClient>();
        var overseerrClient = Substitute.For<IOverseerrClient>();

        IPruneExecutionService service = new PruneExecutionService(_mediaRepo, _connRepo, _auditRepo, sonarrClient, radarrClient, overseerrClient);

        var cmd = new PruneCommand(
            MediaItemId: "movie-1",
            SeasonNumber: null,
            TargetConnectionIds: ["radarr-hd"],
            AddImportExclusion: false,
            Actor: "WebUI"
        );

        var result = await service.ExecutePruneAsync(cmd);
        result.Success.Should().BeTrue();
        result.BytesFreed.Should().Be(8_000_000_000);

        // Verify Radarr API was called with deleteFiles=true and addImportExclusion=false
        await radarrClient.Received(1).DeleteMovieAsync(
            Arg.Is<ServiceConnection>(c => c.Id == "radarr-hd"),
            999,
            deleteFiles: true,
            addImportExclusion: false,
            Arg.Any<CancellationToken>()
        );

        // Verify audit log
        var audits = await _auditRepo.GetRecentAsync(5);
        audits.Should().ContainSingle();
        audits[0].Title.Should().Be("Delete Me Movie");
        audits[0].BytesFreed.Should().Be(8_000_000_000);
        audits[0].AddedToImportExclusion.Should().BeFalse();
    }
}
