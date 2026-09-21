using System.Net;
using System.Net.Http.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace Curatarr.Tests;

public class PruneAndSyncEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _baseFactory;

    public PruneAndSyncEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _baseFactory = factory;
    }

    [Fact]
    public async Task PruneEndpoint_ShouldReturnAppropriateStatusForDifferentResults()
    {
        var mockPruneService = Substitute.For<IPruneExecutionService>();
        mockPruneService.ExecutePruneAsync(Arg.Is<PruneCommand>(c => c.MediaItemId == "success-item"), Arg.Any<CancellationToken>())
            .Returns(new PruneResult(true, "Pruned successfully", 5000, 1));
        mockPruneService.ExecutePruneAsync(Arg.Is<PruneCommand>(c => c.MediaItemId == "protected-item"), Arg.Any<CancellationToken>())
            .Returns(new PruneResult(false, "Item is protected from deletion", 0, 0));
        mockPruneService.ExecutePruneAsync(Arg.Is<PruneCommand>(c => c.MediaItemId == "error-item"), Arg.Any<CancellationToken>())
            .Returns(new PruneResult(false, "Radarr internal error", 0, 0));

        var client = _baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton(_ => mockPruneService);
            });
        }).CreateClient();

        // 1. Success -> 200
        var okRes = await client.PostAsJsonAsync("/api/v1/prune", new
        {
            mediaItemId = "success-item",
            targetConnectionIds = new[] { "conn-1" },
            addImportExclusion = false,
            actor = "Test"
        });
        okRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Protected -> 400
        var badRes = await client.PostAsJsonAsync("/api/v1/prune", new
        {
            mediaItemId = "protected-item",
            targetConnectionIds = new[] { "conn-1" },
            addImportExclusion = false
        });
        badRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // 3. Error -> 500 Problem
        var errRes = await client.PostAsJsonAsync("/api/v1/prune", new
        {
            mediaItemId = "error-item",
            targetConnectionIds = new[] { "conn-1" },
            addImportExclusion = false
        });
        errRes.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task AuditAndSyncEndpoints_ShouldReturnSuccess()
    {
        var mockAuditRepo = Substitute.For<IAuditRepository>();
        mockAuditRepo.GetRecentAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([new AuditLogEntry { Id = "a1", Title = "Movie 1", BytesFreed = 1000 }]);
        mockAuditRepo.GetTotalBytesFreedAsync(Arg.Any<CancellationToken>())
            .Returns(1000L);

        var mockSyncService = Substitute.For<ICatalogSyncService>();
        mockSyncService.GetCurrentProgress()
            .Returns(new SyncProgress("Idle", 0, false, null, null));

        var client = _baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton(_ => mockAuditRepo);
                services.AddSingleton(_ => mockSyncService);
            });
        }).CreateClient();

        // Audit logs with and without limit
        var auditRes = await client.GetAsync("/api/v1/audit?limit=25");
        auditRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var auditResDefault = await client.GetAsync("/api/v1/audit");
        auditResDefault.StatusCode.Should().Be(HttpStatusCode.OK);

        // Sync endpoints
        var syncPost = await client.PostAsync("/api/v1/sync?fullSync=true", null);
        syncPost.StatusCode.Should().Be(HttpStatusCode.OK);

        var syncPostDefault = await client.PostAsync("/api/v1/sync", null);
        syncPostDefault.StatusCode.Should().Be(HttpStatusCode.OK);

        var syncStatus = await client.GetAsync("/api/v1/sync/status");
        syncStatus.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task PlexRefreshEndpoint_ShouldHandleNoPlexConn_Success_And_Errors()
    {
        var mockConnRepo = Substitute.For<IConnectionRepository>();
        var mockPlexClient = Substitute.For<IPlexClient>();

        var client = _baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton(_ => mockConnRepo);
                services.AddSingleton(_ => mockPlexClient);
            });
        }).CreateClient();

        // 1. No Plex connection configured -> 400
        mockConnRepo.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([]);
        var noPlexRes = await client.PostAsync("/api/v1/plex/refresh", null);
        noPlexRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // 1b. Disabled Plex connection -> 400
        mockConnRepo.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([
                new ServiceConnection
                {
                    Id = "plex-disabled",
                    ConnectionType = ConnectionType.Plex,
                    IsEnabled = false
                }
            ]);
        var disabledPlexRes = await client.PostAsync("/api/v1/plex/refresh", null);
        disabledPlexRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // 2. Active Plex connection configured -> 200
        var plexConn = new ServiceConnection
        {
            Id = "plex-1",
            ConnectionType = ConnectionType.Plex,
            IsEnabled = true,
            BaseUrl = "http://plex:32400",
            ApiKey = "token"
        };
        mockConnRepo.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([plexConn]);
        mockPlexClient.GetSectionsAsync(plexConn, Arg.Any<CancellationToken>())
            .Returns([new PlexSectionDto("1", "Movies", "movie", null)]);

        var okRes = await client.PostAsync("/api/v1/plex/refresh", null);
        okRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Exception thrown during refresh -> 500
        mockPlexClient.GetSectionsAsync(plexConn, Arg.Any<CancellationToken>())
            .Returns<IReadOnlyList<PlexSectionDto>>(_ => throw new HttpRequestException("Plex down"));

        var errRes = await client.PostAsync("/api/v1/plex/refresh", null);
        errRes.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
    }
}
