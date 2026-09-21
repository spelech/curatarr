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

    [Fact]
    public async Task McpMessages_CallTool_GetLibraryStats_ShouldReturnStats()
    {
        var client = _factory.CreateClient();

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "2",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_get_library_stats",
                arguments = new { }
            }
        };

        var response = await client.PostAsJsonAsync("/mcp/messages", requestBody);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("totalLibrarySizeBytes");
        json.Should().Contain("totalItemCount");
        json.Should().Contain("categories");
    }

    [Fact]
    public async Task McpMessages_CallTool_ListCandidates_ShouldReturnItems()
    {
        var client = _factory.CreateClient();

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "3",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_list_candidates",
                arguments = new
                {
                    category = "never_watched",
                    limit = 10
                }
            }
        };

        var response = await client.PostAsJsonAsync("/mcp/messages", requestBody);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("content");
    }

    [Fact]
    public async Task McpMessages_CallTool_ProtectItem_ShouldUpdateProtection()
    {
        var client = _factory.CreateClient();
        var mediaRepo = _factory.Services.GetRequiredService<IMediaRepository>();
        var item = new MediaItem
        {
            Id = "mcp-prot-item",
            MediaType = MediaType.Movie,
            Title = "Inception",
            IsProtected = false
        };
        await mediaRepo.UpsertBatchAsync([item]);

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "4",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_protect_item",
                arguments = new
                {
                    mediaItemId = "mcp-prot-item",
                    isProtected = true,
                    reason = "Director favorite"
                }
            }
        };

        var response = await client.PostAsJsonAsync("/mcp/messages", requestBody);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var updated = await mediaRepo.GetByIdAsync("mcp-prot-item");
        updated.Should().NotBeNull();
        updated!.IsProtected.Should().BeTrue();
        updated.ProtectionReason.Should().Be("Director favorite");
    }

    [Fact]
    public async Task McpMessages_CallTool_UnknownTool_ShouldReturnError()
    {
        var client = _factory.CreateClient();

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "5",
            method = "tools/call",
            @params = new
            {
                name = "unknown_nonexistent_tool",
                arguments = new { }
            }
        };

        var response = await client.PostAsJsonAsync("/mcp/messages", requestBody);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("isError");
    }

    [Fact]
    public async Task McpMessages_CallTool_TriggerSync_ShouldInitiateSync()
    {
        var client = _factory.CreateClient();

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "6",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_trigger_sync",
                arguments = new { fullSync = false }
            }
        };

        var response = await client.PostAsJsonAsync("/mcp/messages", requestBody);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("synchronization triggered");
    }

    [Fact]
    public async Task McpMessages_CallTool_DiscoverServices_ShouldReturnResults()
    {
        var client = _factory.CreateClient();

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "7",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_discover_services",
                arguments = new { }
            }
        };

        var response = await client.PostAsJsonAsync("/mcp/messages", requestBody);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = await response.Content.ReadAsStringAsync();
        json.Should().Contain("content");
    }
}
