using System.Collections.Concurrent;
using System.Text.Json;
using Curatarr.Api.Endpoints;
using Curatarr.Api.Mcp;
using Curatarr.Core.Adapters;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Curatarr.Infrastructure.Adapters;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Curatarr.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// Database path & SQLite connection
var dataDir = builder.Configuration["CURATARR__DATA_DIR"] ?? Path.Combine(AppContext.BaseDirectory, "data");
Directory.CreateDirectory(dataDir);
var dbPath = Path.Combine(dataDir, "curatarr.db");
var defaultConnectionString = $"Data Source={dbPath}";

builder.Services.AddSingleton(new SqliteConnectionFactory(defaultConnectionString));
builder.Services.AddSingleton<DatabaseInitializer>();

// Repositories
builder.Services.AddSingleton<ISettingsRepository, SettingsRepository>();
builder.Services.AddSingleton<IConnectionRepository, ConnectionRepository>();
builder.Services.AddSingleton<IMediaRepository, MediaRepository>();
builder.Services.AddSingleton<IAuditRepository, AuditRepository>();

// HTTP Clients & Adapters
builder.Services.AddHttpClient<ISonarrClient, SonarrClient>(client => client.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient<IRadarrClient, RadarrClient>(client => client.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient<ITautulliClient, TautulliClient>(client => client.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient<IPlexClient, PlexClient>(client => client.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient<IOverseerrClient, OverseerrClient>(client => client.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient<IConnectionTester, ConnectionTester>(client => client.Timeout = TimeSpan.FromSeconds(15));

// Domain Services
builder.Services.AddSingleton<ISmartCategoryEngine, SmartCategoryEngine>();
builder.Services.AddSingleton<IPruneExecutionService, PruneExecutionService>();
builder.Services.AddSingleton<ICatalogSyncService, CatalogSyncService>();
builder.Services.AddSingleton<IServiceDiscoveryService, ServiceDiscoveryService>();
builder.Services.AddSingleton<CuratarrMcpRegistry>();

// Background Sync Worker
builder.Services.AddHostedService<CatalogSyncWorker>();

// CORS for Vite dev server
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Auto-initialize SQLite database in WAL mode
using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await initializer.InitializeAsync();
}

app.UseCors();
app.UseStaticFiles();

// Active SSE Connections tracking for MCP
var sseClients = new ConcurrentDictionary<string, HttpResponse>();

// 1. Health Endpoint
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "curatarr",
    version = "1.1.0",
    timestamp = DateTime.UtcNow
}));

// 2. Core JSON-RPC MCP Dispatcher
async Task<JsonRpcResponse> HandleJsonRpcAsync(JsonRpcRequest req, CuratarrMcpRegistry registry, CancellationToken ct)
{
    var response = new JsonRpcResponse { Id = req.Id };

    switch (req.Method)
    {
        case "initialize":
            response.Result = new
            {
                protocolVersion = "2024-11-05",
                capabilities = new
                {
                    tools = new { listChanged = false }
                },
                serverInfo = new
                {
                    name = "curatarr",
                    version = "1.1.0"
                }
            };
            break;

        case "notifications/initialized":
            break;

        case "ping":
            response.Result = new { };
            break;

        case "tools/list":
            response.Result = new
            {
                tools = registry.GetTools()
            };
            break;

        case "tools/call":
            if (req.Params.HasValue && req.Params.Value.TryGetProperty("name", out var nameProp))
            {
                var toolName = nameProp.GetString() ?? "";
                req.Params.Value.TryGetProperty("arguments", out var argsProp);
                var callResult = await registry.ExecuteToolAsync(toolName, argsProp, ct);
                response.Result = callResult;
            }
            else
            {
                response.Error = new JsonRpcError
                {
                    Code = -32602,
                    Message = "Missing 'name' in tools/call parameters"
                };
            }
            break;

        default:
            response.Error = new JsonRpcError
            {
                Code = -32601,
                Message = $"Method '{req.Method}' not found"
            };
            break;
    }

    return response;
}

// 3. MCP SSE Endpoint (GET /mcp/sse)
app.MapGet("/mcp/sse", async (HttpContext context) =>
{
    context.Response.Headers.ContentType = "text/event-stream";
    context.Response.Headers.CacheControl = "no-cache";
    context.Response.Headers.Connection = "keep-alive";

    var sessionId = Guid.NewGuid().ToString("N");
    sseClients[sessionId] = context.Response;

    await context.Response.WriteAsync($"event: endpoint\ndata: /mcp/messages?sessionId={sessionId}\n\n");
    await context.Response.Body.FlushAsync();

    try
    {
        await Task.Delay(Timeout.Infinite, context.RequestAborted);
    }
    finally
    {
        sseClients.TryRemove(sessionId, out _);
    }
});

// 4. MCP Messages Endpoint (POST /mcp/messages or POST /mcp)
app.MapPost("/mcp/messages", async (HttpContext context, CuratarrMcpRegistry registry) =>
{
    using var reader = new StreamReader(context.Request.Body);
    var body = await reader.ReadToEndAsync();
    if (string.IsNullOrWhiteSpace(body))
    {
        return Results.BadRequest(new JsonRpcResponse
        {
            Error = new JsonRpcError { Code = -32700, Message = "Parse error: empty request" }
        });
    }

    try
    {
        var req = JsonSerializer.Deserialize<JsonRpcRequest>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (req == null)
        {
            return Results.BadRequest(new JsonRpcResponse
            {
                Error = new JsonRpcError { Code = -32700, Message = "Parse error" }
            });
        }

        var res = await HandleJsonRpcAsync(req, registry, context.RequestAborted);

        var sessionId = context.Request.Query["sessionId"].ToString();
        if (!string.IsNullOrEmpty(sessionId) && sseClients.TryGetValue(sessionId, out var sseResponse))
        {
            var json = JsonSerializer.Serialize(res);
            await sseResponse.WriteAsync($"event: message\ndata: {json}\n\n");
            await sseResponse.Body.FlushAsync();
            return Results.Accepted();
        }

        return Results.Ok(res);
    }
    catch (Exception ex)
    {
        return Results.Ok(new JsonRpcResponse
        {
            Error = new JsonRpcError { Code = -32603, Message = $"Internal error: {ex.Message}" }
        });
    }
});

// Map REST API Endpoints
app.MapCatalogEndpoints();
app.MapConnectionEndpoints();
app.MapSettingsEndpoints();
app.MapPruneAndSyncEndpoints();
app.MapDiscoveryEndpoints();

// SPA Fallback for React UI
app.MapFallbackToFile("index.html");

app.Run();

// Make Program accessible to WebApplicationFactory in tests
public partial class Program;
