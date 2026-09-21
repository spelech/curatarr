using System.Net;
using System.Net.Http.Json;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace Curatarr.Tests;

public class ServiceDiscoveryTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ServiceDiscoveryTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var testDb = Path.Combine(Path.GetTempPath(), $"curatarr_discovery_test_{Guid.NewGuid():N}.db");
                services.AddSingleton(new SqliteConnectionFactory($"Data Source={testDb}"));
            });
        });
    }

    [Fact]
    public async Task DiscoverServices_ReturnsList_WithoutThrowing()
    {
        var connRepo = Substitute.For<IConnectionRepository>();
        connRepo.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<ServiceConnection>>([]));

        var httpClientFactory = Substitute.For<IHttpClientFactory>();
        var discoveryService = new ServiceDiscoveryService(
            connRepo,
            httpClientFactory,
            NullLogger<ServiceDiscoveryService>.Instance,
            dockerSocketPath: "/nonexistent/docker.sock"
        );

        var result = await discoveryService.DiscoverServicesAsync();
        result.Should().NotBeNull();
    }

    [Fact]
    public async Task DiscoveryEndpoint_ReturnsOk()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/discovery");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var list = await response.Content.ReadFromJsonAsync<List<DiscoveredService>>();
        list.Should().NotBeNull();
    }

    [Fact]
    public async Task McpMessages_IncludesDiscoverServicesTool()
    {
        var client = _factory.CreateClient();

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "1",
            method = "tools/list",
            @params = new { }
        };

        var response = await client.PostAsJsonAsync("/mcp/messages", requestBody);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("curatarr_discover_services");
    }

    private class MockProbeHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var url = request.RequestUri?.ToString() ?? "";

            // Sonarr probes
            if (url.Contains("sonarrhd"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
            if (url.Contains("sonarr4k"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            if (url.Contains("sonarr:") || url.Contains("localhost:8989"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden));

            // Radarr probes
            if (url.Contains("radarrhd"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            if (url.Contains("radarr4k"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
            if (url.Contains("radarr:"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden));

            // Tautulli probes
            if (url.Contains("tautulli:8181"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
            if (url.Contains("localhost:8181"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            if (url.Contains("8900"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden));

            // Plex probes
            if (url.Contains("plex:32400"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            if (url.Contains("localhost:32400"))
            {
                var msg = new HttpResponseMessage(HttpStatusCode.InternalServerError);
                msg.Headers.Add("X-Plex-Protocol", "1.0");
                return Task.FromResult(msg);
            }

            // Overseerr probes
            if (url.Contains("seerr:5055"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
            if (url.Contains("overseerr:5055"))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));

            // Extra host probes (e.g. 10.0.0.99)
            if (url.Contains("10.0.0.99"))
            {
                if (url.Contains(":8700")) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
                if (url.Contains(":8800")) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
                throw new HttpRequestException("Simulated probe network timeout");
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }

    [Fact]
    public async Task DiscoverServices_WithNetworkProbes_CoversAllProbeBranchesAndConfiguredSorting()
    {
        var prevExtra = Environment.GetEnvironmentVariable("CURATARR__DISCOVERY__EXTRA_HOSTS");
        try
        {
            Environment.SetEnvironmentVariable("CURATARR__DISCOVERY__EXTRA_HOSTS", "10.0.0.99");

            var connRepo = Substitute.For<IConnectionRepository>();
            connRepo.GetAllAsync(Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<ServiceConnection>>([
                    new ServiceConnection
                    {
                        Id = "c1",
                        BaseUrl = "http://sonarrhd:8989",
                        ConnectionType = ConnectionType.Sonarr,
                        Name = "Sonarr HD"
                    }
                ]));

            var httpClientFactory = Substitute.For<IHttpClientFactory>();
            httpClientFactory.CreateClient(Arg.Any<string>()).Returns(_ => new HttpClient(new MockProbeHandler()));

            var discoveryService = new ServiceDiscoveryService(
                connRepo,
                httpClientFactory,
                NullLogger<ServiceDiscoveryService>.Instance,
                dockerSocketPath: "/nonexistent/docker.sock"
            );

            var services = await discoveryService.DiscoverServicesAsync();
            services.Should().NotBeEmpty();

            // Configured connection should have IsConfigured == true
            var sonarrHd = services.FirstOrDefault(s => s.BaseUrl.Contains("sonarrhd:8989"));
            sonarrHd.Should().NotBeNull();
            sonarrHd!.IsConfigured.Should().BeTrue();

            // Unconfigured found candidate should have IsConfigured == false
            var sonarr4k = services.FirstOrDefault(s => s.BaseUrl.Contains("sonarr4k:8989"));
            sonarr4k.Should().NotBeNull();
            sonarr4k!.IsConfigured.Should().BeFalse();

            // Plex with header
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Plex && s.BaseUrl.Contains("localhost:32400"));
            // Overseerr 401
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Overseerr && s.BaseUrl.Contains("overseerr:5055"));
            // Extra hosts
            services.Should().Contain(s => s.BaseUrl.Contains("10.0.0.99"));
        }
        finally
        {
            Environment.SetEnvironmentVariable("CURATARR__DISCOVERY__EXTRA_HOSTS", prevExtra);
        }
    }

    [Fact]
    public async Task DiscoverFromDockerSocketAsync_WithUnixSocket_ParsesAllServiceTypesAndErrorCodes()
    {
        var socketPath = Path.Combine(Path.GetTempPath(), $"docker_test_{Guid.NewGuid():N}.sock");
        if (File.Exists(socketPath)) File.Delete(socketPath);

        using var serverSocket = new System.Net.Sockets.Socket(
            System.Net.Sockets.AddressFamily.Unix,
            System.Net.Sockets.SocketType.Stream,
            System.Net.Sockets.ProtocolType.Unspecified);

        serverSocket.Bind(new System.Net.Sockets.UnixDomainSocketEndPoint(socketPath));
        serverSocket.Listen(10);

        var dockerContainersJson = @"[
            {
                ""Names"": [""/sonarr-4k""],
                ""Image"": ""linuxserver/sonarr:latest"",
                ""Ports"": [{ ""PrivatePort"": 8989, ""Type"": ""tcp"" }]
            },
            {
                ""Names"": [""/sonarr-hd""],
                ""Image"": ""linuxserver/sonarr:latest"",
                ""Ports"": [{ ""PrivatePort"": 8989, ""Type"": ""tcp"" }]
            },
            {
                ""Names"": [""/radarr-4k""],
                ""Image"": ""linuxserver/radarr:latest"",
                ""Ports"": [{ ""PrivatePort"": 7878, ""Type"": ""tcp"" }]
            },
            {
                ""Names"": [""/radarr-hd""],
                ""Image"": ""linuxserver/radarr:latest"",
                ""Ports"": [{ ""PrivatePort"": 7878, ""Type"": ""tcp"" }]
            },
            {
                ""Names"": [""/tautulli""],
                ""Image"": ""linuxserver/tautulli:latest"",
                ""Ports"": [{ ""PrivatePort"": 8181, ""Type"": ""tcp"" }]
            },
            {
                ""Names"": [""/plex""],
                ""Image"": ""linuxserver/plex:latest"",
                ""Ports"": [{ ""PrivatePort"": 32400, ""Type"": ""tcp"" }]
            },
            {
                ""Names"": [""/plex-auto-languages""],
                ""Image"": ""remirigal/plex-auto-languages:latest"",
                ""Ports"": []
            },
            {
                ""Names"": [""/overseerr""],
                ""Image"": ""sctx/overseerr:latest"",
                ""Ports"": [{ ""PrivatePort"": 5055, ""Type"": ""tcp"" }]
            },
            {
                ""Names"": [""/seerr""],
                ""Image"": ""fallenbagel/jellyseerr:latest"",
                ""Ports"": []
            },
            {
                ""Names"": [""/redis""],
                ""Image"": ""redis:alpine"",
                ""Ports"": []
            }
        ]";

        // Background server loop
        var serverTask = Task.Run(async () =>
        {
            try
            {
                // First request: return 200 OK with json
                using (var client = await serverSocket.AcceptAsync())
                using (var stream = new System.Net.Sockets.NetworkStream(client, ownsSocket: false))
                using (var reader = new StreamReader(stream))
                using (var writer = new StreamWriter(stream) { AutoFlush = true })
                {
                    while (!string.IsNullOrEmpty(await reader.ReadLineAsync())) { }
                    var bytes = System.Text.Encoding.UTF8.GetBytes(dockerContainersJson);
                    await writer.WriteAsync($"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {bytes.Length}\r\nConnection: close\r\n\r\n{dockerContainersJson}");
                }

                // Second request: return 500 error
                using (var client = await serverSocket.AcceptAsync())
                using (var stream = new System.Net.Sockets.NetworkStream(client, ownsSocket: false))
                using (var reader = new StreamReader(stream))
                using (var writer = new StreamWriter(stream) { AutoFlush = true })
                {
                    while (!string.IsNullOrEmpty(await reader.ReadLineAsync())) { }
                    await writer.WriteAsync("HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
                }
            }
            catch
            {
                // socket closed on cleanup
            }
        });

        try
        {
            var connRepo = Substitute.For<IConnectionRepository>();
            var httpClientFactory = Substitute.For<IHttpClientFactory>();

            var discoveryService = new ServiceDiscoveryService(
                connRepo,
                httpClientFactory,
                NullLogger<ServiceDiscoveryService>.Instance,
                dockerSocketPath: socketPath
            );

            // Test 1: Successful discovery from docker socket
            var services = await discoveryService.DiscoverFromDockerSocketAsync();
            services.Should().NotBeEmpty();
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Sonarr && s.TierTag == "4k");
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Sonarr && s.TierTag == "hd");
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Radarr && s.TierTag == "4k");
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Radarr && s.TierTag == "hd");
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Tautulli);
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Plex);
            services.Should().Contain(s => s.ConnectionType == ConnectionType.Overseerr);
            services.Should().NotContain(s => s.ContainerName == "plex-auto-languages");
            services.Should().NotContain(s => s.ContainerName == "redis");

            // Test 2: Error 500 from docker socket
            var failedServices = await discoveryService.DiscoverFromDockerSocketAsync();
            failedServices.Should().BeEmpty();
        }
        finally
        {
            try { serverSocket.Close(); } catch { }
            try { if (File.Exists(socketPath)) File.Delete(socketPath); } catch { }
            await Task.WhenAny(serverTask, Task.Delay(500));
        }
    }
}
