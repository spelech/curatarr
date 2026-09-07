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
}
