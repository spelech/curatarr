using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Curatarr.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace Curatarr.Tests;

public class AuthAndGuestViewTests : IDisposable
{
    private readonly string _dbPath;
    private readonly SqliteConnectionFactory _factory;
    private readonly DatabaseInitializer _initializer;
    private readonly IUserRepository _userRepo;
    private readonly ISettingsRepository _settingsRepo;
    private readonly IMediaRepository _mediaRepo;
    private readonly IConnectionRepository _connRepo;

    public AuthAndGuestViewTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"curatarr_auth_test_{Guid.NewGuid():N}.db");
        _factory = new SqliteConnectionFactory($"Data Source={_dbPath}");
        _initializer = new DatabaseInitializer(_factory);
        _userRepo = new UserRepository(_factory);
        _settingsRepo = new SettingsRepository(_factory);
        _mediaRepo = new MediaRepository(_factory, _settingsRepo);
        _connRepo = new ConnectionRepository(_factory);
    }

    public void Dispose()
    {
        if (File.Exists(_dbPath))
        {
            try { File.Delete(_dbPath); } catch { /* best effort */ }
        }
    }

    [Fact]
    public async Task UserRepository_CrudOperations_ShouldWorkCorrectly()
    {
        await _initializer.InitializeAsync();

        var user = new User
        {
            Id = "user-1",
            PlexId = "plex-123",
            Username = "Alice",
            Email = "alice@example.com",
            ThumbUrl = "https://plex.tv/avatar/alice.jpg",
            Role = UserRole.Guest
        };

        await _userRepo.UpsertAsync(user);

        var retrieved = await _userRepo.GetByIdAsync("user-1");
        retrieved.Should().NotBeNull();
        retrieved!.Username.Should().Be("Alice");
        retrieved.Role.Should().Be(UserRole.Guest);

        // Update role to Admin
        await _userRepo.UpdateRoleAsync("user-1", UserRole.Admin);
        var updated = await _userRepo.GetByPlexIdAsync("plex-123");
        updated.Should().NotBeNull();
        updated!.Role.Should().Be(UserRole.Admin);

        var byUsername = await _userRepo.GetByUsernameAsync("alice");
        byUsername.Should().NotBeNull();
        byUsername!.Id.Should().Be("user-1");

        var allUsers = await _userRepo.GetAllAsync();
        allUsers.Should().HaveCount(1);

        await _userRepo.DeleteAsync("user-1");
        var afterDelete = await _userRepo.GetByIdAsync("user-1");
        afterDelete.Should().BeNull();
    }

    [Fact]
    public void PlexAuthService_TokenCreationAndValidation_ShouldWorkAccurately()
    {
        var authService = new PlexAuthService(new HttpClient(), _userRepo, _settingsRepo, _connRepo);
        var secret = "super-secret-test-key-12345678901234567890";

        var user = new User
        {
            Id = "usr-test",
            PlexId = "plex-999",
            Username = "Bob",
            Role = UserRole.Admin,
            ThumbUrl = "https://example.com/bob.png"
        };

        var token = authService.CreateSessionToken(user, secret);
        token.Should().NotBeNullOrWhiteSpace();

        var session = authService.ValidateSessionToken(token, secret);
        session.Should().NotBeNull();
        session!.UserId.Should().Be("usr-test");
        session.PlexId.Should().Be("plex-999");
        session.Username.Should().Be("Bob");
        session.Role.Should().Be(UserRole.Admin);
        session.ThumbUrl.Should().Be("https://example.com/bob.png");

        // Invalid signature should fail
        var tampered = authService.ValidateSessionToken(token, "wrong-secret-key-00000000000000000000");
        tampered.Should().BeNull();

        // Empty token should fail
        authService.ValidateSessionToken("", secret).Should().BeNull();
    }

    [Fact]
    public async Task MediaRepository_ProtectionRequests_ShouldTrackRequestersAndCount()
    {
        await _initializer.InitializeAsync();

        var item = new MediaItem
        {
            Id = "movie-req-test",
            MediaType = MediaType.Movie,
            Title = "Dune",
            SortTitle = "dune",
            Year = 2021,
            TotalSizeBytes = 15000000000
        };
        await _mediaRepo.UpsertBatchAsync([item]);

        // Add protection request from user 1
        var req1 = new ProtectionRequest
        {
            Id = "pr-1",
            MediaItemId = "movie-req-test",
            UserId = "user-101",
            Username = "Charlie",
            UserThumb = "https://thumb/charlie",
            Reason = "Must keep for Dune part 2",
            CreatedAt = DateTime.UtcNow
        };
        await _mediaRepo.AddOrUpdateProtectionRequestAsync(req1);

        // Add protection request from user 2
        var req2 = new ProtectionRequest
        {
            Id = "pr-2",
            MediaItemId = "movie-req-test",
            UserId = "user-102",
            Username = "Diana",
            UserThumb = null,
            Reason = null,
            CreatedAt = DateTime.UtcNow
        };
        await _mediaRepo.AddOrUpdateProtectionRequestAsync(req2);

        var paged = await _mediaRepo.GetPagedAsync(new MediaFilterOptions { SearchQuery = "Dune" });
        paged.Should().ContainSingle();
        paged[0].ProtectionRequestCount.Should().Be(2);
        paged[0].ProtectionRequests.Should().HaveCount(2);

        var byId = await _mediaRepo.GetByIdAsync("movie-req-test");
        byId.Should().NotBeNull();
        byId!.ProtectionRequestCount.Should().Be(2);
        byId.ProtectionRequests.Should().Contain(r => r.Username == "Charlie" && r.Reason == "Must keep for Dune part 2");
        byId.ProtectionRequests.Should().Contain(r => r.Username == "Diana");

        // Remove Charlie's request
        await _mediaRepo.RemoveProtectionRequestAsync("movie-req-test", "user-101");
        var afterRemove = await _mediaRepo.GetByIdAsync("movie-req-test");
        afterRemove!.ProtectionRequestCount.Should().Be(1);
        afterRemove.ProtectionRequests.Should().ContainSingle(r => r.Username == "Diana");

        // Clear all
        await _mediaRepo.ClearProtectionRequestsAsync("movie-req-test");
        var afterClear = await _mediaRepo.GetByIdAsync("movie-req-test");
        afterClear!.ProtectionRequestCount.Should().Be(0);
        afterClear.ProtectionRequests.Should().BeEmpty();
    }

    [Fact]
    public async Task CatalogSyncService_WithOverseerr_ShouldPopulateRequestedByAndRequestedAt()
    {
        await _initializer.InitializeAsync();

        var radarrClient = Substitute.For<IRadarrClient>();
        var sonarrClient = Substitute.For<ISonarrClient>();
        var tautulliClient = Substitute.For<ITautulliClient>();
        var plexClient = Substitute.For<IPlexClient>();
        var overseerrClient = Substitute.For<IOverseerrClient>();

        // Setup Radarr Movie
        var movieConn = new ServiceConnection
        {
            Id = "radarr-main",
            ConnectionType = ConnectionType.Radarr,
            Name = "Radarr",
            BaseUrl = "http://radarr:7878",
            ApiKey = "key",
            IsEnabled = true
        };
        await _connRepo.UpsertAsync(movieConn);

        var movie = new RadarrMovieDto(1, "Oppenheimer", "oppenheimer", 872585, "tt15398776", 2023, true, true, "/movies/Oppenheimer", 20_000_000_000, 1, "4K", DateTime.UtcNow, null);
        radarrClient.GetMoviesAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<RadarrMovieDto>>([movie]));

        // Setup Overseerr Request
        var overseerrConn = new ServiceConnection
        {
            Id = "overseerr-main",
            ConnectionType = ConnectionType.Overseerr,
            Name = "Overseerr",
            BaseUrl = "http://overseerr:5055",
            ApiKey = "key",
            IsEnabled = true
        };
        await _connRepo.UpsertAsync(overseerrConn);

        var requestedTime = DateTime.SpecifyKind(DateTime.Parse("2024-02-10T15:30:00Z"), DateTimeKind.Utc);
        var overseerrReq = new OverseerrRequestDto(1, "2", "movie", 872585, null, "JohnDoe", requestedTime);
        overseerrClient.GetRequestsAsync(Arg.Any<ServiceConnection>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<OverseerrRequestDto>>([overseerrReq]));

        var syncService = new CatalogSyncService(_connRepo, _mediaRepo, sonarrClient, radarrClient, tautulliClient, plexClient, overseerrClient);
        await syncService.TriggerSyncAsync(fullSync: true);

        var items = await _mediaRepo.GetPagedAsync(new MediaFilterOptions { Limit = 10 });
        items.Should().ContainSingle();
        var opp = items[0];
        opp.Title.Should().Be("Oppenheimer");
        opp.RequestedBy.Should().Be("JohnDoe");
        opp.RequestedAt.Should().Be(requestedTime);
    }

    [Fact]
    public async Task MediaRepository_GetProtectionRequestsAsync_ShouldReturnRequesters()
    {
        await _initializer.InitializeAsync();

        var item = new MediaItem
        {
            Id = "item-req-test",
            MediaType = MediaType.Movie,
            Title = "Requester Test Movie",
            SortTitle = "Requester Test Movie",
            TotalSizeBytes = 1024,
            IsProtected = false
        };
        await _mediaRepo.UpsertBatchAsync([item]);

        var req1 = new ProtectionRequest
        {
            Id = "req-1",
            MediaItemId = "item-req-test",
            UserId = "user-alice",
            Username = "Alice",
            Reason = "Favorite film",
            CreatedAt = DateTime.UtcNow
        };
        var req2 = new ProtectionRequest
        {
            Id = "req-2",
            MediaItemId = "item-req-test",
            UserId = "user-bob",
            Username = "Bob",
            Reason = "Planning to watch",
            CreatedAt = DateTime.UtcNow
        };

        await _mediaRepo.AddOrUpdateProtectionRequestAsync(req1);
        await _mediaRepo.AddOrUpdateProtectionRequestAsync(req2);

        var requests = await _mediaRepo.GetProtectionRequestsAsync("item-req-test");
        requests.Should().HaveCount(2);
        requests.Select(r => r.Username).Should().Contain(["Alice", "Bob"]);
    }

    [Fact]
    public async Task PlexAuthService_CreatePinAndClaim_ShouldHandleLifecycle()
    {
        await _initializer.InitializeAsync();

        var mockHttp = new MockHttpMessageHandler(req =>
        {
            var url = req.RequestUri?.ToString() ?? "";
            if (url.Contains("/api/v2/pins?strong=true"))
            {
                return new HttpResponseMessage(HttpStatusCode.Created)
                {
                    Content = new StringContent("{\"id\": 9999, \"code\": \"WXYZ-5678\"}")
                };
            }
            if (url.Contains("/api/v2/pins/9999"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"id\": 9999, \"code\": \"WXYZ-5678\", \"authToken\": \"plex-token-secret\"}")
                };
            }
            if (url.Contains("/api/v2/user"))
            {
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"id\": 101, \"uuid\": \"uuid-101\", \"username\": \"PlexAdminUser\", \"email\": \"admin@plex.local\", \"thumb\": \"https://plex.tv/thumb.jpg\"}")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var httpClient = new HttpClient(mockHttp);
        var authService = new PlexAuthService(httpClient, _userRepo, _settingsRepo, _connRepo);

        // 1. Create PIN
        var pin = await authService.CreatePinAsync();
        pin.Id.Should().Be(9999);
        pin.Code.Should().Be("WXYZ-5678");
        pin.AuthUrl.Should().Contain("WXYZ-5678");

        // 2. Claim PIN (first user -> Admin)
        var claimResult = await authService.ClaimPinAsync(9999);
        claimResult.Claimed.Should().BeTrue();
        claimResult.User.Should().NotBeNull();
        claimResult.User!.Username.Should().Be("PlexAdminUser");
        claimResult.User.Role.Should().Be(UserRole.Admin);
        claimResult.Token.Should().NotBeNullOrEmpty();

        // 3. Verify Session
        var secret = await authService.GetOrCreateSessionSecretAsync();
        var verified = authService.ValidateSessionToken(claimResult.Token!, secret);
        verified.Should().NotBeNull();
        verified!.UserId.Should().Be(claimResult.User.Id);
        verified.Username.Should().Be("PlexAdminUser");
        verified.Role.Should().Be(UserRole.Admin);
    }

    private class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public MockHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_handler(request));
        }
    }
}
