using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Curatarr.Api.Endpoints;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Curatarr.Tests;

public class AuthEndpointsIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly string _testDb;

    public AuthEndpointsIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _testDb = Path.Combine(Path.GetTempPath(), $"curatarr_auth_endpoint_test_{Guid.NewGuid():N}.db");
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(new SqliteConnectionFactory($"Data Source={_testDb}"));
            });
        });
    }

    private async Task SeedDataAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        await initializer.InitializeAsync();

        var userRepo = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var mediaRepo = scope.ServiceProvider.GetRequiredService<IMediaRepository>();

        // Ensure users exist: one Admin, one Guest
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

        var movie = new MediaItem
        {
            Id = "movie-matrix",
            MediaType = MediaType.Movie,
            Title = "The Matrix",
            SortTitle = "matrix",
            Year = 1999,
            TotalSizeBytes = 10_000_000_000
        };
        await mediaRepo.UpsertBatchAsync([movie]);
    }

    private string GetTokenForUser(string userId, string plexId, string username, UserRole role)
    {
        using var scope = _factory.Services.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<IPlexAuthService>();
        var settingsRepo = scope.ServiceProvider.GetRequiredService<ISettingsRepository>();

        var secret = authService.GetOrCreateSessionSecretAsync().GetAwaiter().GetResult();
        return authService.CreateSessionToken(new User
        {
            Id = userId,
            PlexId = plexId,
            Username = username,
            Role = role
        }, secret);
    }

    [Fact]
    public async Task AuthMe_WhenNotLoggedIn_ShouldReturnAuthenticatedFalse()
    {
        await SeedDataAsync();
        var client = _factory.CreateClient();

        var res = await client.GetAsync("/api/v1/auth/me");
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var doc = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        doc.GetProperty("authenticated").GetBoolean().Should().BeFalse();
        doc.GetProperty("initialized").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task AuthMe_WhenLoggedIn_ShouldReturnUserSession()
    {
        await SeedDataAsync();
        var client = _factory.CreateClient();
        var token = GetTokenForUser("guest-1", "plex-guest", "GuestUser", UserRole.Guest);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var res = await client.GetAsync("/api/v1/auth/me");
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var doc = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        doc.GetProperty("authenticated").GetBoolean().Should().BeTrue();
        var user = doc.GetProperty("user");
        user.GetProperty("username").GetString().Should().Be("GuestUser");
        user.GetProperty("role").GetString().Should().Be("Guest");
    }

    [Fact]
    public async Task Guest_CanRequestProtection_AndCountIncrements()
    {
        await SeedDataAsync();
        var client = _factory.CreateClient();
        var guestToken = GetTokenForUser("guest-1", "plex-guest", "GuestUser", UserRole.Guest);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", guestToken);

        // Guest submits protection request
        var postRes = await client.PostAsJsonAsync("/api/v1/protection-requests", new CatalogEndpoints.AddProtectionRequest("movie-matrix", "Classic favorite"));
        postRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Check catalog item has ProtectionRequestCount = 1
        var itemRes = await client.GetAsync("/api/v1/catalog/movie-matrix");
        itemRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var item = await itemRes.Content.ReadFromJsonAsync<MediaItem>();
        item.Should().NotBeNull();
        item!.ProtectionRequestCount.Should().Be(1);
        item.ProtectionRequests.Should().ContainSingle(r => r.Username == "GuestUser" && r.Reason == "Classic favorite");

        // Guest deletes their protection request
        var delRes = await client.DeleteAsync("/api/v1/protection-requests/movie-matrix");
        delRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var afterDel = await client.GetFromJsonAsync<MediaItem>("/api/v1/catalog/movie-matrix");
        afterDel!.ProtectionRequestCount.Should().Be(0);
    }

    [Fact]
    public async Task Guest_CannotHardProtect_OrPrune_OrModifySettings_Returns403()
    {
        await SeedDataAsync();
        var client = _factory.CreateClient();
        var guestToken = GetTokenForUser("guest-1", "plex-guest", "GuestUser", UserRole.Guest);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", guestToken);

        // 1. /protect should return 403
        var protectRes = await client.PostAsJsonAsync("/api/v1/protect", new CatalogEndpoints.ProtectRequest("movie-matrix", true, "admin reason"));
        protectRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 2. /prune should return 403
        var pruneRes = await client.PostAsJsonAsync("/api/v1/prune", new PruneAndSyncEndpoints.PruneRequest("movie-matrix", null, null, false, "guest"));
        pruneRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        // 3. /settings PUT should return 403
        var settingsRes = await client.PutAsJsonAsync("/api/v1/settings", new CuratarrSettings());
        settingsRes.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Admin_CanHardProtect_AndClearProtectionRequests()
    {
        await SeedDataAsync();
        var client = _factory.CreateClient();
        var adminToken = GetTokenForUser("admin-1", "plex-admin", "AdminUser", UserRole.Admin);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);

        // Admin hard protects
        var protectRes = await client.PostAsJsonAsync("/api/v1/protect", new CatalogEndpoints.ProtectRequest("movie-matrix", true, "Admin protected"));
        protectRes.StatusCode.Should().Be(HttpStatusCode.OK);

        var item = await client.GetFromJsonAsync<MediaItem>("/api/v1/catalog/movie-matrix");
        item!.IsProtected.Should().BeTrue();
        item.ProtectionReason.Should().Be("Admin protected");

        // Clear all requests
        var clearRes = await client.DeleteAsync("/api/v1/protection-requests/movie-matrix/all");
        clearRes.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
