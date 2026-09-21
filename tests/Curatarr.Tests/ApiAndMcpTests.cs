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

    [Fact]
    public async Task McpMessages_CallTool_ListCandidates_WithFilters_ShouldReturnFilteredResults()
    {
        var client = _factory.CreateClient();

        var requestBody = new
        {
            jsonrpc = "2.0",
            id = "8",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_list_candidates",
                arguments = new
                {
                    category = "never_watched",
                    mediaType = "movie",
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
    public async Task McpMessages_CallTool_ExecutePrune_And_UnknownTool_ShouldHandleGracefully()
    {
        var client = _factory.CreateClient();

        // 1. Execute prune
        var pruneBody = new
        {
            jsonrpc = "2.0",
            id = "9",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_execute_prune",
                arguments = new
                {
                    mediaItemId = "movie-1",
                    seasonNumber = (int?)null,
                    targetConnectionIds = new[] { "radarr-1" },
                    addImportExclusion = false
                }
            }
        };

        var pruneRes = await client.PostAsJsonAsync("/mcp/messages", pruneBody);
        pruneRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Unknown tool
        var unknownBody = new
        {
            jsonrpc = "2.0",
            id = "10",
            method = "tools/call",
            @params = new
            {
                name = "non_existent_tool",
                arguments = new { }
            }
        };

        var unknownRes = await client.PostAsJsonAsync("/mcp/messages", unknownBody);
        unknownRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var unknownJson = await unknownRes.Content.ReadAsStringAsync();
        unknownJson.Should().Contain("Unknown tool");
    }

    [Fact]
    public async Task McpMessages_ProtocolMethods_PingAndNotifications_ShouldSucceed()
    {
        var client = _factory.CreateClient();

        // Ping
        var pingBody = new { jsonrpc = "2.0", id = "p1", method = "ping" };
        var pingRes = await client.PostAsJsonAsync("/mcp/messages", pingBody);
        pingRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Notifications/initialized
        var notifBody = new { jsonrpc = "2.0", method = "notifications/initialized" };
        var notifRes = await client.PostAsJsonAsync("/mcp/messages", notifBody);
        notifRes.StatusCode.Should().Be(HttpStatusCode.OK);

        // Tools/call missing name property
        var noNameBody = new { jsonrpc = "2.0", id = "p2", method = "tools/call", @params = new { } };
        var noNameRes = await client.PostAsJsonAsync("/mcp/messages", noNameBody);
        noNameRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var noNameJson = await noNameRes.Content.ReadAsStringAsync();
        noNameJson.Should().Contain("Missing 'name'");

        // Unknown method
        var unkMethodBody = new { jsonrpc = "2.0", id = "p3", method = "unknown/method" };
        var unkMethodRes = await client.PostAsJsonAsync("/mcp/messages", unkMethodBody);
        unkMethodRes.StatusCode.Should().Be(HttpStatusCode.OK);
        var unkMethodJson = await unkMethodRes.Content.ReadAsStringAsync();
        unkMethodJson.Should().Contain("Method 'unknown/method' not found");

        // Empty body
        var emptyContent = new StringContent("", System.Text.Encoding.UTF8, "application/json");
        var emptyRes = await client.PostAsync("/mcp/messages", emptyContent);
        emptyRes.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Curatarr trigger sync tool call
        var syncBody = new
        {
            jsonrpc = "2.0",
            id = "sync1",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_trigger_sync",
                arguments = new { fullSync = true }
            }
        };
        var syncRes = await client.PostAsJsonAsync("/mcp/messages", syncBody);
        syncRes.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task McpSseEndpoint_ShouldEstablishStreamAndAcceptSseMessage()
    {
        var client = _factory.CreateClient();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        using var sseRequest = new HttpRequestMessage(HttpMethod.Get, "/mcp/sse");
        using var sseResponse = await client.SendAsync(sseRequest, HttpCompletionOption.ResponseHeadersRead, cts.Token);
        sseResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        sseResponse.Content.Headers.ContentType?.MediaType.Should().Be("text/event-stream");

        using var stream = await sseResponse.Content.ReadAsStreamAsync(cts.Token);
        using var reader = new StreamReader(stream);

        // Read initial event
        var line1 = await reader.ReadLineAsync(cts.Token);
        var line2 = await reader.ReadLineAsync(cts.Token);

        line1.Should().Be("event: endpoint");
        line2.Should().StartWith("data: /mcp/messages?sessionId=");

        var sessionId = line2!.Split("sessionId=")[1].Trim();

        // Send a message targetting this session
        var msgBody = new { jsonrpc = "2.0", id = "sse-test", method = "ping" };
        var msgRes = await client.PostAsJsonAsync($"/mcp/messages?sessionId={sessionId}", msgBody, cts.Token);
        msgRes.StatusCode.Should().Be(HttpStatusCode.Accepted);

        cts.Cancel(); // clean cancellation
    }

    [Fact]
    public async Task McpMessages_CallTool_Variations_ShouldCoverAllBranches()
    {
        var client = _factory.CreateClient();
        var mediaRepo = _factory.Services.GetRequiredService<IMediaRepository>();
        var item = new MediaItem
        {
            Id = "mcp-var-item",
            MediaType = MediaType.Series,
            Title = "Severance",
            IsProtected = false,
            Instances = [new MediaInstance { QualityProfileName = "HD" }],
            Seasons = [new Season { SeasonNumber = 1 }]
        };
        await mediaRepo.UpsertBatchAsync([item]);

        // 1. curatarr_get_library_stats with userId
        var resStats = await client.PostAsJsonAsync("/mcp/messages", new
        {
            jsonrpc = "2.0",
            id = "s1",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_get_library_stats",
                arguments = new { userId = "user1" }
            }
        });
        resStats.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. curatarr_list_candidates with series filter and user filter
        var resSeries = await client.PostAsJsonAsync("/mcp/messages", new
        {
            jsonrpc = "2.0",
            id = "s2",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_list_candidates",
                arguments = new { category = "never_watched", mediaType = "series", userId = "user1", limit = 5 }
            }
        });
        resSeries.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. curatarr_list_candidates with unrecognized mediaType
        var resUnknown = await client.PostAsJsonAsync("/mcp/messages", new
        {
            jsonrpc = "2.0",
            id = "s3",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_list_candidates",
                arguments = new { mediaType = "other" }
            }
        });
        resUnknown.StatusCode.Should().Be(HttpStatusCode.OK);

        // 4. curatarr_protect_item without reason
        var resProt = await client.PostAsJsonAsync("/mcp/messages", new
        {
            jsonrpc = "2.0",
            id = "s4",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_protect_item",
                arguments = new { mediaItemId = "mcp-var-item", isProtected = false }
            }
        });
        resProt.StatusCode.Should().Be(HttpStatusCode.OK);

        // 5. curatarr_execute_prune with seasonNumber, addImportExclusion, targetConnectionIds
        var resPrune = await client.PostAsJsonAsync("/mcp/messages", new
        {
            jsonrpc = "2.0",
            id = "s5",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_execute_prune",
                arguments = new
                {
                    mediaItemId = "mcp-var-item",
                    seasonNumber = 1,
                    addImportExclusion = true,
                    targetConnectionIds = new[] { "conn-1" }
                }
            }
        });
        resPrune.StatusCode.Should().Be(HttpStatusCode.OK);

        // 6. curatarr_execute_prune without optional arguments
        var resPruneMinimal = await client.PostAsJsonAsync("/mcp/messages", new
        {
            jsonrpc = "2.0",
            id = "s6",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_execute_prune",
                arguments = new { mediaItemId = "mcp-var-item" }
            }
        });
        resPruneMinimal.StatusCode.Should().Be(HttpStatusCode.OK);

        // 7. Tool execution error handling (missing required mediaItemId throws exception)
        var resErr = await client.PostAsJsonAsync("/mcp/messages", new
        {
            jsonrpc = "2.0",
            id = "s7",
            method = "tools/call",
            @params = new
            {
                name = "curatarr_protect_item",
                arguments = new { }
            }
        });
        resErr.StatusCode.Should().Be(HttpStatusCode.OK);
        var errJson = await resErr.Content.ReadAsStringAsync();
        errJson.Should().Contain("isError");
    }
}

