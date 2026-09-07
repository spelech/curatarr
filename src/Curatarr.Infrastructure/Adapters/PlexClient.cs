using System.Text.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;

namespace Curatarr.Infrastructure.Adapters;

public class PlexClient : IPlexClient
{
    private readonly HttpClient _httpClient;

    public PlexClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string url, string token)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Add("X-Plex-Token", token);
        req.Headers.Add("Accept", "application/json");
        return req;
    }

    public async Task<IReadOnlyList<PlexSectionDto>> GetSectionsAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/library/sections", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<PlexSectionDto>();
        if (doc.RootElement.TryGetProperty("MediaContainer", out var mc) && mc.TryGetProperty("Directory", out var dirs))
        {
            foreach (var el in dirs.EnumerateArray())
            {
                var key = el.GetProperty("key").GetString() ?? "";
                var title = el.GetProperty("title").GetString() ?? "";
                var type = el.GetProperty("type").GetString() ?? "";
                var agent = el.TryGetProperty("agent", out var ag) ? ag.GetString() : null;
                list.Add(new PlexSectionDto(key, title, type, agent));
            }
        }

        return list;
    }

    public async Task<IReadOnlyList<PlexMetadataItemDto>> GetSectionItemsAsync(ServiceConnection connection, string sectionKey, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/library/sections/{sectionKey}/all", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<PlexMetadataItemDto>();
        if (doc.RootElement.TryGetProperty("MediaContainer", out var mc) && mc.TryGetProperty("Metadata", out var meta))
        {
            foreach (var el in meta.EnumerateArray())
            {
                int ratingKey = 0;
                if (el.TryGetProperty("ratingKey", out var rkProp))
                {
                    if (rkProp.ValueKind == JsonValueKind.Number) ratingKey = rkProp.GetInt32();
                    else if (rkProp.ValueKind == JsonValueKind.String) int.TryParse(rkProp.GetString(), out ratingKey);
                }

                var title = el.GetProperty("title").GetString() ?? "";
                var type = el.GetProperty("type").GetString() ?? "";
                var guid = el.TryGetProperty("guid", out var g) ? g.GetString() : null;
                var year = el.TryGetProperty("year", out var y) && y.ValueKind == JsonValueKind.Number ? y.GetInt32() : (int?)null;

                int viewCount = 0;
                if (el.TryGetProperty("viewCount", out var vc))
                {
                    if (vc.ValueKind == JsonValueKind.Number && vc.TryGetInt32(out var vcNum)) viewCount = vcNum;
                    else if (vc.ValueKind == JsonValueKind.String && int.TryParse(vc.GetString(), out var vcParsed)) viewCount = vcParsed;
                }

                if (viewCount == 0 && el.TryGetProperty("viewedLeafCount", out var vlc))
                {
                    if (vlc.ValueKind == JsonValueKind.Number && vlc.TryGetInt32(out var vlcNum)) viewCount = vlcNum;
                    else if (vlc.ValueKind == JsonValueKind.String && int.TryParse(vlc.GetString(), out var vlcParsed)) viewCount = vlcParsed;
                }

                DateTime? lastViewedAt = null;
                if (el.TryGetProperty("lastViewedAt", out var lva))
                {
                    if (lva.ValueKind == JsonValueKind.Number && lva.TryGetInt64(out var lvaNum))
                    {
                        lastViewedAt = DateTimeOffset.FromUnixTimeSeconds(lvaNum).UtcDateTime;
                    }
                    else if (lva.ValueKind == JsonValueKind.String && long.TryParse(lva.GetString(), out var lvaParsed))
                    {
                        lastViewedAt = DateTimeOffset.FromUnixTimeSeconds(lvaParsed).UtcDateTime;
                    }
                }

                list.Add(new PlexMetadataItemDto(ratingKey, title, type, guid, year, viewCount, lastViewedAt));
            }
        }

        return list;
    }

    public async Task RefreshSectionAsync(ServiceConnection connection, string sectionKey, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/library/sections/{sectionKey}/refresh", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }
}
