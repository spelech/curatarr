using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Infrastructure.Services;

public class CatalogSyncService : ICatalogSyncService
{
    private readonly IConnectionRepository _connectionRepo;
    private readonly IMediaRepository _mediaRepo;
    private readonly ISonarrClient _sonarrClient;
    private readonly IRadarrClient _radarrClient;
    private readonly ITautulliClient _tautulliClient;
    private readonly IPlexClient _plexClient;

    private readonly SemaphoreSlim _syncLock = new(1, 1);
    private SyncProgress _currentProgress = new("Idle", 0, false, null, null);

    public CatalogSyncService(
        IConnectionRepository connectionRepo,
        IMediaRepository mediaRepo,
        ISonarrClient sonarrClient,
        IRadarrClient radarrClient,
        ITautulliClient tautulliClient,
        IPlexClient plexClient)
    {
        _connectionRepo = connectionRepo;
        _mediaRepo = mediaRepo;
        _sonarrClient = sonarrClient;
        _radarrClient = radarrClient;
        _tautulliClient = tautulliClient;
        _plexClient = plexClient;
    }

    public SyncProgress GetCurrentProgress() => _currentProgress;

    public async Task TriggerSyncAsync(bool fullSync = false, CancellationToken ct = default)
    {
        if (!await _syncLock.WaitAsync(0, ct))
        {
            // Already running
            return;
        }

        try
        {
            _currentProgress = _currentProgress with { Status = "Syncing", IsRunning = true, LastError = null };

            var connections = await _connectionRepo.GetAllAsync(ct);
            var enabledConnections = connections.Where(c => c.IsEnabled).ToList();

            // Cache existing items for fast lookup by external keys
            var itemMap = new ConcurrentDictionary<string, MediaItem>(); // key: tvdb:xxx or tmdb:yyy or imdb:zzz or title:year

            // 1. Process Sonarr instances
            var sonarrConns = enabledConnections.Where(c => c.ConnectionType == ConnectionType.Sonarr).ToList();
            foreach (var conn in sonarrConns)
            {
                try
                {
                    var seriesList = await _sonarrClient.GetSeriesAsync(conn, ct);
                    HashSet<int> cutoffIds;
                    try
                    {
                        cutoffIds = (await _sonarrClient.GetCutoffUnmetSeriesIdsAsync(conn, ct)) ?? [];
                    }
                    catch
                    {
                        cutoffIds = [];
                    }
                    foreach (var s in seriesList)
                    {
                        var key = s.TvdbId.HasValue ? $"tvdb:{s.TvdbId}" : (s.ImdbId != null ? $"imdb:{s.ImdbId}" : $"title:{s.Title.ToLowerInvariant()}:{s.Year}");

                        var item = itemMap.GetOrAdd(key, _ => new MediaItem
                        {
                            Id = ComputeDeterministicId($"series:{key}"),
                            MediaType = MediaType.Series,
                            Title = s.Title,
                            SortTitle = s.SortTitle ?? s.Title,
                            Year = s.Year,
                            TvdbId = s.TvdbId?.ToString(),
                            ImdbId = s.ImdbId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });

                        // Add instance (avoid duplicate instance from same connection/externalId)
                        var instanceId = ComputeDeterministicId($"inst:{conn.Id}:{s.Id}");
                        if (!item.Instances.Any(i => i.Id == instanceId))
                        {
                            item.Instances.Add(new MediaInstance
                            {
                                Id = instanceId,
                                MediaItemId = item.Id,
                                ConnectionId = conn.Id,
                                ExternalId = s.Id,
                                QualityProfileName = conn.Name ?? conn.TierTag ?? "Default",
                                CutoffUnmet = cutoffIds.Contains(s.Id),
                                IsMonitored = s.Monitored,
                                DiskPath = s.Path,
                                SizeBytes = s.SizeOnDisk,
                                HasFile = s.EpisodeFileCount > 0,
                                Resolution = s.Resolution,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            });
                        }

                        // Merge seasons
                        foreach (var seas in s.Seasons)
                        {
                            var seasonId = ComputeDeterministicId($"season:{item.Id}:{seas.SeasonNumber}");
                            var existingSeason = item.Seasons.FirstOrDefault(x => x.SeasonNumber == seas.SeasonNumber);
                            if (existingSeason == null)
                            {
                                item.Seasons.Add(new Season
                                {
                                    Id = seasonId,
                                    MediaItemId = item.Id,
                                    SeasonNumber = seas.SeasonNumber,
                                    IsMonitored = seas.Monitored,
                                    EpisodeCount = seas.TotalEpisodeCount,
                                    EpisodeFileCount = seas.EpisodeFileCount,
                                    SizeBytes = seas.SizeOnDisk,
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow
                                });
                            }
                            else
                            {
                                existingSeason.SizeBytes = Math.Max(existingSeason.SizeBytes, seas.SizeOnDisk);
                                existingSeason.EpisodeFileCount = Math.Max(existingSeason.EpisodeFileCount, seas.EpisodeFileCount);
                            }
                        }
                    }

                    conn.LastSyncAt = DateTime.UtcNow;
                    conn.LastStatus = "Synced";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
                catch (Exception ex)
                {
                    conn.LastStatus = $"Error: {ex.Message}";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
            }

            // 2. Process Radarr instances
            var radarrConns = enabledConnections.Where(c => c.ConnectionType == ConnectionType.Radarr).ToList();
            foreach (var conn in radarrConns)
            {
                try
                {
                    var movies = await _radarrClient.GetMoviesAsync(conn, ct);
                    HashSet<int> cutoffIds;
                    try
                    {
                        cutoffIds = (await _radarrClient.GetCutoffUnmetMovieIdsAsync(conn, ct)) ?? [];
                    }
                    catch
                    {
                        cutoffIds = [];
                    }
                    foreach (var m in movies)
                    {
                        var key = m.TmdbId.HasValue ? $"tmdb:{m.TmdbId}" : (m.ImdbId != null ? $"imdb:{m.ImdbId}" : $"title:{m.Title.ToLowerInvariant()}:{m.Year}");

                        var item = itemMap.GetOrAdd(key, _ => new MediaItem
                        {
                            Id = ComputeDeterministicId($"movie:{key}"),
                            MediaType = MediaType.Movie,
                            Title = m.Title,
                            SortTitle = m.SortTitle ?? m.Title,
                            Year = m.Year,
                            TmdbId = m.TmdbId?.ToString(),
                            ImdbId = m.ImdbId,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        });

                        var instanceId = ComputeDeterministicId($"inst:{conn.Id}:{m.Id}");
                        if (!item.Instances.Any(i => i.Id == instanceId))
                        {
                            item.Instances.Add(new MediaInstance
                            {
                                Id = instanceId,
                                MediaItemId = item.Id,
                                ConnectionId = conn.Id,
                                ExternalId = m.Id,
                                QualityProfileName = conn.Name ?? conn.TierTag ?? "Default",
                                CutoffUnmet = cutoffIds.Contains(m.Id),
                                IsMonitored = m.Monitored,
                                DiskPath = m.Path,
                                SizeBytes = m.SizeOnDisk,
                                HasFile = m.HasFile,
                                Resolution = m.Resolution,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            });
                        }
                    }

                    conn.LastSyncAt = DateTime.UtcNow;
                    conn.LastStatus = "Synced";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
                catch (Exception ex)
                {
                    conn.LastStatus = $"Error: {ex.Message}";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
            }

            // Calculate aggregate sizes
            foreach (var item in itemMap.Values)
            {
                item.TotalSizeBytes = item.Instances.Sum(i => i.SizeBytes);
            }

            // Build typed normalized lookup maps for fast title matching
            var exactItemMap = new Dictionary<string, MediaItem>(StringComparer.OrdinalIgnoreCase);
            var typeTitleItemMap = new Dictionary<string, MediaItem>(StringComparer.OrdinalIgnoreCase);
            var plexRatingKeyMap = new Dictionary<int, MediaItem>();

            foreach (var item in itemMap.Values)
            {
                var norm = NormalizeTitle(item.Title);
                if (!string.IsNullOrEmpty(norm))
                {
                    if (item.Year.HasValue)
                    {
                        exactItemMap[$"{(int)item.MediaType}:{norm}:{item.Year.Value}"] = item;
                    }
                    typeTitleItemMap.TryAdd($"{(int)item.MediaType}:{norm}", item);
                }

                if (item.PlexRatingKey.HasValue)
                {
                    plexRatingKeyMap[item.PlexRatingKey.Value] = item;
                }
            }

            // 3. Process Plex instances (link rating keys and metadata)
            var plexConns = enabledConnections.Where(c => c.ConnectionType == ConnectionType.Plex).ToList();
            foreach (var conn in plexConns)
            {
                try
                {
                    var sections = await _plexClient.GetSectionsAsync(conn, ct);
                    foreach (var section in sections)
                    {
                        var plexItems = await _plexClient.GetSectionItemsAsync(conn, section.Key, ct);
                        var isShowSection = string.Equals(section.Type, "show", StringComparison.OrdinalIgnoreCase);
                        var defaultType = isShowSection ? MediaType.Series : MediaType.Movie;

                        foreach (var pi in plexItems)
                        {
                            var norm = NormalizeTitle(pi.Title);
                            if (string.IsNullOrEmpty(norm)) continue;

                            var targetType = string.Equals(pi.Type, "show", StringComparison.OrdinalIgnoreCase)
                                ? MediaType.Series
                                : (string.Equals(pi.Type, "movie", StringComparison.OrdinalIgnoreCase) ? MediaType.Movie : defaultType);

                            MediaItem? matchedItem = null;
                            if (pi.Year.HasValue && exactItemMap.TryGetValue($"{(int)targetType}:{norm}:{pi.Year.Value}", out var exact))
                            {
                                matchedItem = exact;
                            }
                            else if (typeTitleItemMap.TryGetValue($"{(int)targetType}:{norm}", out var byType))
                            {
                                matchedItem = byType;
                            }

                            if (matchedItem != null)
                            {
                                matchedItem.PlexRatingKey = pi.RatingKey;
                                plexRatingKeyMap[pi.RatingKey] = matchedItem;

                                if (pi.ViewCount > 0)
                                {
                                    var stat = matchedItem.WatchStats.FirstOrDefault(ws => ws.UserId == "plex-server");
                                    if (stat == null)
                                    {
                                        matchedItem.WatchStats.Add(new WatchStat
                                        {
                                            Id = ComputeDeterministicId($"watch:{matchedItem.Id}:plex-server:0"),
                                            MediaItemId = matchedItem.Id,
                                            SeasonNumber = null,
                                            UserId = "plex-server",
                                            Username = "Plex Activity",
                                            PlayCount = pi.ViewCount,
                                            LastPlayedAt = pi.LastViewedAt,
                                            UpdatedAt = DateTime.UtcNow
                                        });
                                    }
                                }
                            }
                        }
                    }

                    conn.LastSyncAt = DateTime.UtcNow;
                    conn.LastStatus = "Synced";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
                catch (Exception ex)
                {
                    conn.LastStatus = $"Error: {ex.Message}";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
            }

            // 4. Process Tautulli Watch History
            var tautulliConns = enabledConnections.Where(c => c.ConnectionType == ConnectionType.Tautulli).ToList();
            foreach (var conn in tautulliConns)
            {
                try
                {
                    var history = await _tautulliClient.GetHistoryAsync(conn, length: 0, ct: ct);
                    foreach (var h in history)
                    {
                        var isEpisode = string.Equals(h.MediaType, "episode", StringComparison.OrdinalIgnoreCase)
                            || !string.IsNullOrEmpty(h.GrandparentTitle)
                            || h.SeasonNumber.HasValue;

                        var expectedType = isEpisode ? MediaType.Series : MediaType.Movie;
                        var showOrMovieTitle = isEpisode ? (h.GrandparentTitle ?? h.Title) : h.Title;
                        if (string.IsNullOrEmpty(showOrMovieTitle)) continue;

                        MediaItem? matchedItem = null;

                        // 1. Try match by rating key (grandparent rating key for episodes, or direct rating key)
                        if (isEpisode && !string.IsNullOrEmpty(h.GrandparentRatingKey) && int.TryParse(h.GrandparentRatingKey, out var gprkVal) && plexRatingKeyMap.TryGetValue(gprkVal, out var byGprk))
                        {
                            matchedItem = byGprk;
                        }
                        else if (h.RatingKey.HasValue && plexRatingKeyMap.TryGetValue(h.RatingKey.Value, out var byRk))
                        {
                            matchedItem = byRk;
                        }

                        // 2. Fallback to typed title match (for movies, match with year if available; for episodes, match show title)
                        if (matchedItem == null)
                        {
                            var norm = NormalizeTitle(showOrMovieTitle);
                            if (!isEpisode && h.Year.HasValue && exactItemMap.TryGetValue($"{(int)expectedType}:{norm}:{h.Year.Value}", out var exact))
                            {
                                matchedItem = exact;
                            }
                            else if (typeTitleItemMap.TryGetValue($"{(int)expectedType}:{norm}", out var byType))
                            {
                                matchedItem = byType;
                            }
                        }

                        if (matchedItem != null)
                        {
                            // Remove generic plex-server baseline if granular Tautulli stats are present
                            matchedItem.WatchStats.RemoveAll(ws => ws.UserId == "plex-server");

                            var stat = matchedItem.WatchStats.FirstOrDefault(ws => ws.UserId == h.UserId && ws.SeasonNumber == h.SeasonNumber);
                            if (stat == null)
                            {
                                matchedItem.WatchStats.Add(new WatchStat
                                {
                                    Id = ComputeDeterministicId($"watch:{matchedItem.Id}:{h.UserId}:{h.SeasonNumber ?? 0}"),
                                    MediaItemId = matchedItem.Id,
                                    SeasonNumber = h.SeasonNumber,
                                    UserId = h.UserId,
                                    Username = h.Username,
                                    PlayCount = 1,
                                    LastPlayedAt = h.Date,
                                    UpdatedAt = DateTime.UtcNow
                                });
                            }
                            else
                            {
                                stat.PlayCount++;
                                if (!stat.LastPlayedAt.HasValue || h.Date > stat.LastPlayedAt.Value)
                                {
                                    stat.LastPlayedAt = h.Date;
                                }
                            }
                        }
                    }

                    conn.LastSyncAt = DateTime.UtcNow;
                    conn.LastStatus = "Synced";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
                catch (Exception ex)
                {
                    conn.LastStatus = $"Error: {ex.Message}";
                    await _connectionRepo.UpsertAsync(conn, ct);
                }
            }

            // 5. Batch upsert everything
            var allItems = itemMap.Values.ToList();
            await _mediaRepo.UpsertBatchAsync(allItems, ct);

            _currentProgress = new SyncProgress("Completed", allItems.Count, false, DateTime.UtcNow, null);
        }
        catch (Exception ex)
        {
            _currentProgress = new SyncProgress("Failed", 0, false, DateTime.UtcNow, ex.Message);
        }
        finally
        {
            _syncLock.Release();
        }
    }

    private static string NormalizeTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;
        // Strip non-alphanumeric characters for fuzzy resilient title matching
        return Regex.Replace(title, @"[^a-zA-Z0-9]", "").ToLowerInvariant();
    }

    private static string ComputeDeterministicId(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant()[..32];
    }
}
