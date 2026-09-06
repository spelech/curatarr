using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Curatarr.Tests;

public class ApiAndMcpTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiAndMcpTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // In-memory or temp db for test runner
                var testDb = Path.Combine(Path.GetTempPath(), $"curatarr_api_test_{Guid.NewGuid():N}.db");
                services.AddSingleton(new SqliteConnectionFactory($"Data Source={testDb}"));
            });
        });
    }

    [Fact]
    public async Task GetCategories_ShouldReturnOkWithCategories()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/categories");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain(SmartCategoryIds.NeverWatched);
        json.Should().Contain(SmartCategoryIds.Stale);
    }

    [Fact]
    public async Task PostProtect_ShouldUpdateProtectionStatus()
    {
        var client = _factory.CreateClient();

        // Seed an item into DB
        var mediaRepo = _factory.Services.GetRequiredService<IMediaRepository>();
        var item = new MediaItem
        {
            Id = "item-prot-test",
            MediaType = MediaType.Movie,
            Title = "Matrix",
            IsProtected = false
        };
        await mediaRepo.UpsertBatchAsync([item]);

        var response = await client.PostAsJsonAsync("/api/v1/protect", new
        {
            MediaItemId = "item-prot-test",
            IsProtected = true,
            Reason = "Classic"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await mediaRepo.GetByIdAsync("item-prot-test");
        updated.Should().NotBeNull();
        updated!.IsProtected.Should().BeTrue();
        updated.ProtectionReason.Should().Be("Classic");
    }

    [Fact]
    public async Task McpMessages_ToolsList_ShouldReturnAllCuratarrTools()
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
        json.Should().Contain("curatarr_get_library_stats");
        json.Should().Contain("curatarr_list_candidates");
        json.Should().Contain("curatarr_execute_prune");
        json.Should().Contain("curatarr_protect_item");
    }
}
