using System.Net;
using System.Net.Http.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace Curatarr.Tests;

public class CatalogEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CatalogEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var testDb = Path.Combine(Path.GetTempPath(), $"curatarr_endpoints_test_{Guid.NewGuid():N}.db");
                services.AddSingleton(new SqliteConnectionFactory($"Data Source={testDb}"));
            });
        });
    }

    private bool _isSeeded = false;

    private async Task SeedCatalogAsync()
    {
        if (_isSeeded) return;

            using var scope = _factory.Services.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IMediaRepository>();
            var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
            await initializer.InitializeAsync();

            var item1 = new MediaItem
            {
                Id = "cat-movie-pre2017",
                MediaType = MediaType.Movie,
                Title = "Interstellar",
                SortTitle = "interstellar",
                Year = 2014,
                AddedAt = DateTime.Parse("2015-01-01T00:00:00Z"),
                TotalSizeBytes = 25000000000,
                Instances = [
                    new MediaInstance { Id = "inst-1", MediaItemId = "cat-movie-pre2017", ConnectionId = "radarr-1", ExternalId = 101, Resolution = "4K", HasFile = true, CutoffUnmet = false }
                ],
                WatchStats = []
            };

            var item2 = new MediaItem
            {
                Id = "cat-series-post2017",
                MediaType = MediaType.Series,
                Title = "Severance",
                SortTitle = "severance",
                Year = 2022,
                AddedAt = DateTime.Parse("2022-03-01T00:00:00Z"),
                TotalSizeBytes = 15000000000,
                Instances = [
                    new MediaInstance { Id = "inst-2", MediaItemId = "cat-series-post2017", ConnectionId = "sonarr-1", ExternalId = 102, Resolution = "1080p", HasFile = true, CutoffUnmet = true }
                ],
                WatchStats = [
                    new WatchStat { Id = "ws-2", MediaItemId = "cat-series-post2017", UserId = "user1", PlayCount = 2, LastPlayedAt = DateTime.Parse("2023-01-01T00:00:00Z") }
                ]
            };

            var item3 = new MediaItem
            {
                Id = "cat-movie-cutoff",
                MediaType = MediaType.Movie,
                Title = "Alien",
                SortTitle = "alien",
                Year = 1979,
                AddedAt = DateTime.Parse("2020-05-01T00:00:00Z"),
                TotalSizeBytes = 8000000000,
                Instances = [
                    new MediaInstance { Id = "inst-3", MediaItemId = "cat-movie-cutoff", ConnectionId = "radarr-1", ExternalId = 103, Resolution = "SD", HasFile = true, CutoffUnmet = true }
                ],
                WatchStats = []
            };

            await repo.UpsertBatchAsync([item1, item2, item3]);
            _isSeeded = true;
    }

    [Fact]
    public async Task GetCatalog_WithPre2017Filter_ShouldFilterAccurately()
    {
        await SeedCatalogAsync();
        var client = _factory.CreateClient();

        // 1. Exclude pre-2017
        var resExclude = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?pre2017Filter=exclude");
        resExclude.Should().NotBeNull();
        resExclude!.Select(x => x.Id).Should().NotContain("cat-movie-pre2017");
        resExclude.Select(x => x.Id).Should().Contain("cat-series-post2017");

        // 2. Only pre-2017
        var resOnly = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?pre2017Filter=only");
        resOnly.Should().NotBeNull();
        resOnly!.Select(x => x.Id).Should().Contain("cat-movie-pre2017");
        resOnly.Select(x => x.Id).Should().NotContain("cat-series-post2017");
    }

    [Fact]
    public async Task GetCatalog_WithMediaTypeAndResolution_ShouldFilterAccurately()
    {
        await SeedCatalogAsync();
        var client = _factory.CreateClient();

        // Filter by MediaType = movie
        var resMovies = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?mediaType=movie");
        resMovies.Should().NotBeNull();
        resMovies!.All(x => x.MediaType == MediaType.Movie).Should().BeTrue();

        // Filter by Resolution = 4K
        var res4k = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?resolution=4K");
        res4k.Should().NotBeNull();
        res4k!.Should().ContainSingle(x => x.Id == "cat-movie-pre2017");

        // Filter by CutoffUnmet = true
        var resCutoff = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?cutoffUnmet=true");
        resCutoff.Should().NotBeNull();
        resCutoff!.Select(x => x.Id).Should().Contain(["cat-series-post2017", "cat-movie-cutoff"]);
    }

    [Fact]
    public async Task GetCatalog_WithPaginationAndSorting_ShouldReturnCorrectSlices()
    {
        await SeedCatalogAsync();
        var client = _factory.CreateClient();

        // Sort by size desc, limit 1
        var paged1 = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?sortBy=size&sortDesc=true&limit=1&offset=0");
        paged1.Should().NotBeNull();
        paged1!.Should().HaveCount(1);
        paged1[0].Id.Should().Be("cat-movie-pre2017"); // 25 GB

        // Limit 1, offset 1
        var paged2 = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?sortBy=size&sortDesc=true&limit=1&offset=1");
        paged2.Should().NotBeNull();
        paged2!.Should().HaveCount(1);
        paged2[0].Id.Should().Be("cat-series-post2017"); // 15 GB
    }

    [Fact]
    public async Task GetCatalogById_ShouldReturnItemOrNotFound()
    {
        await SeedCatalogAsync();
        var client = _factory.CreateClient();

        var foundRes = await client.GetAsync("/api/v1/catalog/cat-movie-pre2017");
        foundRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var item = await foundRes.Content.ReadFromJsonAsync<MediaItem>();
        item.Should().NotBeNull();
        item!.Title.Should().Be("Interstellar");

        var notFoundRes = await client.GetAsync("/api/v1/catalog/non-existent-id");
        notFoundRes.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetStats_ShouldReturnTotalSizeAndItemCount()
    {
        await SeedCatalogAsync();
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/api/v1/stats");
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var stats = await res.Content.ReadFromJsonAsync<StatsResponse>();
        stats.Should().NotBeNull();
        stats!.totalItemCount.Should().BeGreaterOrEqualTo(3);
        stats.totalLibrarySizeBytes.Should().BeGreaterOrEqualTo(48000000000);
    }

    [Fact]
    public async Task GetUsers_And_CategoriesWithUser_ShouldReturnExpectedResults()
    {
        await SeedCatalogAsync();
        var client = _factory.CreateClient();

        // 1. GetUsers when no Tautulli connection is configured
        var usersRes = await client.GetAsync("/api/v1/users");
        usersRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var usersList = await usersRes.Content.ReadFromJsonAsync<List<object>>();
        usersList.Should().NotBeNull();

        // 2. GetCategories with userId
        var catRes = await client.GetAsync("/api/v1/categories?userId=user1");
        catRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Catalog with mediaType=series and sortBy=title ascending
        var seriesRes = await client.GetFromJsonAsync<List<MediaItem>>("/api/v1/catalog?mediaType=series&sortBy=title&sortDesc=false");
        seriesRes.Should().NotBeNull();
        seriesRes!.Should().ContainSingle(i => i.Id == "cat-series-post2017");
    }

    [Fact]
    public async Task GetUsers_WithTautulliConnection_HandlesSuccess_Error_And_Disabled()
    {
        var mockConnRepo = Substitute.For<IConnectionRepository>();
        var mockTautulli = Substitute.For<ITautulliClient>();

        var client = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton(_ => mockConnRepo);
                services.AddSingleton(_ => mockTautulli);
            });
        }).CreateClient();

        // 1. Inactive Tautulli connection (IsEnabled = false)
        mockConnRepo.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([
                new ServiceConnection
                {
                    Id = "t1",
                    ConnectionType = ConnectionType.Tautulli,
                    IsEnabled = false
                }
            ]);
        var disabledRes = await client.GetAsync("/api/v1/users");
        disabledRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var disabledList = await disabledRes.Content.ReadFromJsonAsync<List<object>>();
        disabledList.Should().BeEmpty();

        // 2. Active Tautulli connection with successful users fetch
        var activeConn = new ServiceConnection
        {
            Id = "t2",
            ConnectionType = ConnectionType.Tautulli,
            IsEnabled = true,
            BaseUrl = "http://tautulli:8181",
            ApiKey = "key"
        };
        mockConnRepo.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([activeConn]);
        mockTautulli.GetUsersAsync(activeConn, Arg.Any<CancellationToken>())
            .Returns([new TautulliUserDto("u1", "alice", "Alice")]);

        var activeRes = await client.GetAsync("/api/v1/users");
        activeRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var activeList = await activeRes.Content.ReadFromJsonAsync<List<TautulliUserDto>>();
        activeList.Should().HaveCount(1);
        activeList![0].Username.Should().Be("alice");

        // 3. Active Tautulli connection with exception thrown
        mockTautulli.GetUsersAsync(activeConn, Arg.Any<CancellationToken>())
            .Returns<IReadOnlyList<TautulliUserDto>>(_ => throw new HttpRequestException("Tautulli down"));

        var errorRes = await client.GetAsync("/api/v1/users");
        errorRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var errorList = await errorRes.Content.ReadFromJsonAsync<List<object>>();
        errorList.Should().BeEmpty();
    }

    [Fact]
    public async Task CatalogEndpoints_RequestedByAndProtectionRequests_ShouldWork()
    {
        await SeedCatalogAsync();
        var client = _factory.CreateClient();

        using var scope = _factory.Services.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IMediaRepository>();

        var testItem = new MediaItem
        {
            Id = "req-test-item-1",
            MediaType = MediaType.Movie,
            Title = "Requester Test Movie",
            SortTitle = "Requester Test Movie",
            RequestedBy = "spelech",
            TotalSizeBytes = 5000000000
        };
        await repo.UpsertBatchAsync([testItem]);

        await repo.AddOrUpdateProtectionRequestAsync(new ProtectionRequest
        {
            Id = "pr-test-1",
            MediaItemId = testItem.Id,
            UserId = "user-1",
            Username = "spelech",
            Reason = "Save this movie"
        });

        // Query catalog with requestedBy filter
        var reqRes = await client.GetAsync("/api/v1/catalog?requestedBy=spelech");
        reqRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var reqList = await reqRes.Content.ReadFromJsonAsync<List<MediaItem>>();
        reqList.Should().Contain(i => i.Id == "req-test-item-1");

        // Query catalog with category=protection_requested
        var protCatRes = await client.GetAsync("/api/v1/catalog?category=protection_requested");
        protCatRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var protCatList = await protCatRes.Content.ReadFromJsonAsync<List<MediaItem>>();
        protCatList.Should().Contain(i => i.Id == "req-test-item-1");

        // Query GET /api/v1/protection-requests
        var protListRes = await client.GetAsync("/api/v1/protection-requests");
        protListRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var protRequests = await protListRes.Content.ReadFromJsonAsync<List<PendingProtectionRequestDto>>();
        protRequests.Should().Contain(p => p.MediaItemId == "req-test-item-1" && p.Username == "spelech");
    }

    public record StatsResponse(long totalLibrarySizeBytes, int totalItemCount);
}

