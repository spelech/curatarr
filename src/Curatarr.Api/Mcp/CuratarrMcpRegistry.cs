using System.Text.Json;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Api.Mcp;

public class CuratarrMcpRegistry
{
    private readonly ISmartCategoryEngine _categoryEngine;
    private readonly IMediaRepository _mediaRepo;
    private readonly IPruneExecutionService _pruneService;
    private readonly ICatalogSyncService _syncService;
    private readonly IConnectionRepository _connRepo;
    private readonly IServiceDiscoveryService _discoveryService;

    public CuratarrMcpRegistry(
        ISmartCategoryEngine categoryEngine,
        IMediaRepository mediaRepo,
        IPruneExecutionService pruneService,
        ICatalogSyncService syncService,
        IConnectionRepository connRepo,
        IServiceDiscoveryService discoveryService)
    {
        _categoryEngine = categoryEngine;
        _mediaRepo = mediaRepo;
        _pruneService = pruneService;
        _syncService = syncService;
        _connRepo = connRepo;
        _discoveryService = discoveryService;
    }

    public object[] GetTools()
    {
        return
        [
            new
            {
                name = "curatarr_get_library_stats",
                description = "Get total media library size, count of movies/series, and reclaimable space across all Smart Categories (Never Watched, Stale, Abandoned TV, Space Hogs, Cutoff Unmet).",
                inputSchema = new
                {
                    type = "object",
                    properties = new
                    {
                        userId = new { type = "string", description = "Optional user profile filter (Plex/Tautulli user ID)" }
                    }
                }
            },
            new
            {
                name = "curatarr_list_candidates",
                description = "List media items that are candidates for pruning within a smart category.",
                inputSchema = new
                {
                    type = "object",
                    properties = new
                    {
                        category = new { type = "string", description = "Category ID: 'never_watched', 'stale', 'abandoned', 'cutoff_unmet', 'space_hogs', 'missing', or 'protected'", @default = "never_watched" },
                        mediaType = new { type = "string", description = "'movie' or 'series'", @enum = new[] { "movie", "series" } },
                        userId = new { type = "string", description = "Optional user ID filter" },
                        limit = new { type = "integer", description = "Max results (default 50)", @default = 50 }
                    },
                    required = new[] { "category" }
                }
            },
            new
            {
                name = "curatarr_protect_item",
                description = "Protect (whitelist) or unprotect a media item to prevent it from ever being pruned.",
                inputSchema = new
                {
                    type = "object",
                    properties = new
                    {
                        mediaItemId = new { type = "string", description = "The Curatarr media item UUID" },
                        isProtected = new { type = "boolean", description = "True to protect, false to unprotect" },
                        reason = new { type = "string", description = "Optional protection reason (e.g. 'Family favorite')" }
                    },
                    required = new[] { "mediaItemId", "isProtected" }
                }
            },
            new
            {
                name = "curatarr_execute_prune",
                description = "Execute a verified prune on a movie, series, or season across selected instances (HD, 4K). Respects whitelist protection.",
                inputSchema = new
                {
                    type = "object",
                    properties = new
                    {
                        mediaItemId = new { type = "string", description = "The media item UUID" },
                        seasonNumber = new { type = "integer", description = "Optional season number. If provided, only this season is deleted." },
                        targetConnectionIds = new { type = "array", items = new { type = "string" }, description = "List of connection IDs to prune from (e.g. Sonarr HD, Sonarr 4K, Radarr)" },
                        addImportExclusion = new { type = "boolean", description = "Whether to add to Arr blocklist/import exclusion. Defaults to false.", @default = false }
                    },
                    required = new[] { "mediaItemId", "targetConnectionIds" }
                }
            },
            new
            {
                name = "curatarr_trigger_sync",
                description = "Trigger background catalog synchronization across Sonarr, Radarr, Tautulli, and Plex.",
                inputSchema = new
                {
                    type = "object",
                    properties = new
                    {
                        fullSync = new { type = "boolean", description = "Force full re-sync", @default = false }
                    }
                }
            },
            new
            {
                name = "curatarr_discover_services",
                description = "Auto-discover available Sonarr, Radarr, Tautulli, Plex, and Overseerr services across the Docker environment and network.",
                inputSchema = new
                {
                    type = "object",
                    properties = new { }
                }
            }
        ];
    }

    public async Task<object> ExecuteToolAsync(string toolName, JsonElement? arguments, CancellationToken ct)
    {
        try
        {
            switch (toolName)
            {
                case "curatarr_get_library_stats":
                {
                    string? userFilter = arguments.HasValue && arguments.Value.TryGetProperty("userId", out var u) ? u.GetString() : null;
                    var summaries = await _categoryEngine.GetSummariesAsync(userFilter, ct);
                    var totalSize = await _mediaRepo.GetTotalLibrarySizeBytesAsync(ct);
                    var totalCount = await _mediaRepo.GetTotalCountAsync(ct);

                    return new
                    {
                        content = new[]
                        {
                            new
                            {
                                type = "text",
                                text = JsonSerializer.Serialize(new
                                {
                                    totalLibrarySizeBytes = totalSize,
                                    totalItemCount = totalCount,
                                    categories = summaries
                                }, new JsonSerializerOptions { WriteIndented = true })
                            }
                        }
                    };
                }

                case "curatarr_list_candidates":
                {
                    var cat = arguments.HasValue && arguments.Value.TryGetProperty("category", out var c) ? c.GetString() ?? SmartCategoryIds.NeverWatched : SmartCategoryIds.NeverWatched;
                    var mediaTypeStr = arguments.HasValue && arguments.Value.TryGetProperty("mediaType", out var mt) ? mt.GetString() : null;
                    var userId = arguments.HasValue && arguments.Value.TryGetProperty("userId", out var u) ? u.GetString() : null;
                    var limit = arguments.HasValue && arguments.Value.TryGetProperty("limit", out var l) ? l.GetInt32() : 50;

                    MediaType? filterType = mediaTypeStr?.ToLowerInvariant() switch
                    {
                        "movie" => MediaType.Movie,
                        "series" => MediaType.Series,
                        _ => null
                    };

                    var items = await _mediaRepo.GetPagedAsync(new MediaFilterOptions(
                        CategoryId: cat,
                        UserIdFilter: userId,
                        MediaTypeFilter: filterType,
                        Limit: limit
                    ), ct);

                    var simplified = items.Select(i => new
                    {
                        i.Id,
                        Type = i.MediaType.ToString(),
                        i.Title,
                        i.Year,
                        TotalSizeGB = Math.Round((double)i.TotalSizeBytes / (1024 * 1024 * 1024), 2),
                        i.IsProtected,
                        Instances = i.Instances.Select(inst => inst.QualityProfileName).ToList(),
                        SeasonsCount = i.Seasons.Count,
                        TotalPlays = i.WatchStats.Sum(w => w.PlayCount)
                    });

                    return new
                    {
                        content = new[]
                        {
                            new
                            {
                                type = "text",
                                text = JsonSerializer.Serialize(simplified, new JsonSerializerOptions { WriteIndented = true })
                            }
                        }
                    };
                }

                case "curatarr_protect_item":
                {
                    var id = arguments!.Value.GetProperty("mediaItemId").GetString()!;
                    var isProtected = arguments.Value.GetProperty("isProtected").GetBoolean();
                    var reason = arguments.Value.TryGetProperty("reason", out var r) ? r.GetString() : null;

                    await _mediaRepo.SetProtectionAsync(id, isProtected, reason, ct);

                    return new
                    {
                        content = new[]
                        {
                            new
                            {
                                type = "text",
                                text = $"Media item {id} protection set to {isProtected} (reason: {reason ?? "none"})."
                            }
                        }
                    };
                }

                case "curatarr_execute_prune":
                {
                    var id = arguments!.Value.GetProperty("mediaItemId").GetString()!;
                    int? season = arguments.Value.TryGetProperty("seasonNumber", out var s) && s.ValueKind == JsonValueKind.Number ? s.GetInt32() : null;
                    var addExclusion = arguments.Value.TryGetProperty("addImportExclusion", out var ex) && ex.GetBoolean();
                    
                    var targetConns = new List<string>();
                    if (arguments.Value.TryGetProperty("targetConnectionIds", out var tc) && tc.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var el in tc.EnumerateArray())
                        {
                            var connId = el.GetString();
                            if (connId != null) targetConns.Add(connId);
                        }
                    }

                    var cmd = new PruneCommand(id, season, targetConns, addExclusion, "MCP_Agent");
                    var result = await _pruneService.ExecutePruneAsync(cmd, ct);

                    return new
                    {
                        content = new[]
                        {
                            new
                            {
                                type = "text",
                                text = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true })
                            }
                        }
                    };
                }

                case "curatarr_trigger_sync":
                {
                    var fullSync = arguments.HasValue && arguments.Value.TryGetProperty("fullSync", out var fs) && fs.GetBoolean();
                    _ = Task.Run(() => _syncService.TriggerSyncAsync(fullSync, CancellationToken.None));

                    return new
                    {
                        content = new[]
                        {
                            new
                            {
                                type = "text",
                                text = "Catalog synchronization triggered in background."
                            }
                        }
                    };
                }

                case "curatarr_discover_services":
                {
                    var services = await _discoveryService.DiscoverServicesAsync(ct);
                    return new
                    {
                        content = new[]
                        {
                            new
                            {
                                type = "text",
                                text = JsonSerializer.Serialize(services, new JsonSerializerOptions { WriteIndented = true })
                            }
                        }
                    };
                }

                default:
                    return new
                    {
                        isError = true,
                        content = new[] { new { type = "text", text = $"Unknown tool: {toolName}" } }
                    };
            }
        }
        catch (Exception ex)
        {
            return new
            {
                isError = true,
                content = new[] { new { type = "text", text = $"Error executing {toolName}: {ex.Message}" } }
            };
        }
    }
}
