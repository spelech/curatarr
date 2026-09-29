using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Curatarr.Api.Endpoints;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace Curatarr.Tests;

public class PlexEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _testDb;
    private readonly IPlexAuthService _mockPlexAuthService = Substitute.For<IPlexAuthService>();
    private readonly IConnectionTester _mockConnectionTester = Substitute.For<IConnectionTester>();

    public PlexEndpointsTests(WebApplicationFactory<Program> factory)
    {
        _testDb = Path.Combine(Path.GetTempPath(), $"curatarr_plex_endpoint_test_{Guid.NewGuid():N}.db");
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(new SqliteConnectionFactory($"Data Source={_testDb}"));
                services.AddSingleton(_mockPlexAuthService);
                services.AddSingleton(_mockConnectionTester);
            });
        });
    }

    private async Task SeedUsersAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        await initializer.InitializeAsync();

        var userRepo = scope.ServiceProvider.GetRequiredService<IUserRepository>();

        await userRepo.UpsertAsync(new User
        {
            Id = "admin-1",
            PlexId = "plex-admin",
            Username = "AdminUser",
            Role = UserRole.Admin
        });

        await userRepo.UpsertAsync(new User
        {
            Id = "guest-1",
            PlexId = "plex-guest",
            Username = "GuestUser",
            Role = UserRole.Guest
        });

        var secret = "test-secret-32-chars-long-abcdef0123456789";
        _mockPlexAuthService.GetOrCreateSessionSecretAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(secret));
        _mockPlexAuthService.ValidateSessionToken(Arg.Is<string>(t => t == "admin-token"), secret)
            .Returns(new UserSession("admin-1", "plex-admin", "AdminUser", UserRole.Admin, null));
        _mockPlexAuthService.ValidateSessionToken(Arg.Is<string>(t => t == "guest-token"), secret)
            .Returns(new UserSession("guest-1", "plex-guest", "GuestUser", UserRole.Guest, null));
    }

    [Fact]
    public async Task GetStatus_WhenFresh_ReturnsUnbound()
    {
        await SeedUsersAsync();
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/api/v1/plex/status");
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var data = await res.Content.ReadFromJsonAsync<PlexStatusResponse>();
        data.Should().NotBeNull();
        data!.IsBound.Should().BeFalse();
    }

    [Fact]
    public async Task GetServers_AsAdmin_ReturnsDiscoveredServers()
    {
        await SeedUsersAsync();
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "admin-token");

        var mockServers = new List<PlexServerResourceDto>
        {
            new("Titan Media Server", "machine-123", true, "server-token-abc", new List<PlexServerConnectionDto>
            {
                new("http://192.168.1.50:32400", "192.168.1.50", 32400, "http", true)
            })
        };
        _mockPlexAuthService.GetDiscoveredServersAsync(Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<PlexServerResourceDto>>(mockServers));

        var res = await client.GetAsync("/api/v1/plex/servers");
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await res.Content.ReadAsStringAsync();
        json.Should().Contain("Titan Media Server");
        json.Should().Contain("machine-123");
    }

    [Fact]
    public async Task GetServers_AsGuest_ReturnsForbidden()
    {
        await SeedUsersAsync();
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "guest-token");

        var res = await client.GetAsync("/api/v1/plex/servers");
        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task BindServer_AsAdmin_UpsertsConnectionAndSavesSettings()
    {
        await SeedUsersAsync();
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "admin-token");

        _mockConnectionTester.TestAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new ConnectionTestResult(true, "1.41.0", "Connected successfully", 15)));

        var bindReq = new PlexEndpoints.BindPlexServerRequest(
            MachineIdentifier: "machine-titan-999",
            Name: "Titan Media Server",
            BaseUrl: "http://192.168.1.50:32400",
            ApiKey: "server-token-xyz"
        );

        var res = await client.PostAsJsonAsync("/api/v1/plex/bind", bindReq);
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify status is now bound
        var statusRes = await client.GetAsync("/api/v1/plex/status");
        statusRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var status = await statusRes.Content.ReadFromJsonAsync<PlexStatusResponse>();
        status.Should().NotBeNull();
        status!.IsBound.Should().BeTrue();
        status.ServerName.Should().Be("Titan Media Server");
        status.MachineIdentifier.Should().Be("machine-titan-999");
    }

    [Fact]
    public async Task GetStatus_WithExistingPlexConnection_AutoHealsBindingAndMachineIdentifier()
    {
        await SeedUsersAsync();
        var client = _factory.CreateClient();

        var scope = _factory.Services.CreateScope();
        var connRepo = scope.ServiceProvider.GetRequiredService<IConnectionRepository>();
        await connRepo.UpsertAsync(new ServiceConnection
        {
            Id = "conn-plex-test",
            Name = "Living Room Plex",
            ConnectionType = ConnectionType.Plex,
            BaseUrl = "http://10.0.0.10:32400",
            ApiKey = "existing-token-abc",
            IsEnabled = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        _mockPlexAuthService.FetchMachineIdentifierAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<string?>("auto-healed-machine-id-777"));

        var res = await client.GetAsync("/api/v1/plex/status");
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var status = await res.Content.ReadFromJsonAsync<PlexStatusResponse>();
        status.Should().NotBeNull();
        status!.IsBound.Should().BeTrue();
        status.MachineIdentifier.Should().Be("auto-healed-machine-id-777");
        status.HasAdminToken.Should().BeTrue();
    }

    private record PlexStatusResponse(
        bool IsBound,
        string? ServerName,
        string? MachineIdentifier,
        bool HasAdminToken
    );
}
