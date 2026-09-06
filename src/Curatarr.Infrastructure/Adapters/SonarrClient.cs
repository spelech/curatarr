using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;

namespace Curatarr.Infrastructure.Adapters;

public class SonarrClient : ISonarrClient
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public SonarrClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string url, string apiKey)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Add("X-Api-Key", apiKey);
        return req;
    }

    public async Task<IReadOnlyList<SonarrSeriesDto>> GetSeriesAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/api/v3/series", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<SonarrSeriesDto>();
        foreach (var el in doc.RootElement.EnumerateArray())
        {
            var id = el.GetProperty("id").GetInt32();
            var title = el.GetProperty("title").GetString() ?? "";
            var sortTitle = el.TryGetProperty("sortTitle", out var st) ? st.GetString() : null;
            var tvdbId = el.TryGetProperty("tvdbId", out var tid) && tid.ValueKind == JsonValueKind.Number ? tid.GetInt32() : (int?)null;
            var imdbId = el.TryGetProperty("imdbId", out var iid) ? iid.GetString() : null;
            var year = el.TryGetProperty("year", out var yr) && yr.ValueKind == JsonValueKind.Number ? yr.GetInt32() : (int?)null;
            var monitored = el.TryGetProperty("monitored", out var mon) && mon.GetBoolean();
            var path = el.TryGetProperty("path", out var pth) ? pth.GetString() : null;
            var qualityProfileId = el.TryGetProperty("qualityProfileId", out var qp) ? qp.GetInt32() : (int?)null;

            long sizeOnDisk = 0;
            int episodeFileCount = 0;
            int totalEpisodeCount = 0;
            if (el.TryGetProperty("statistics", out var stats))
            {
                if (stats.TryGetProperty("sizeOnDisk", out var sz) && sz.ValueKind == JsonValueKind.Number) sizeOnDisk = sz.GetInt64();
                if (stats.TryGetProperty("episodeFileCount", out var efc) && efc.ValueKind == JsonValueKind.Number) episodeFileCount = efc.GetInt32();
                if (stats.TryGetProperty("totalEpisodeCount", out var tec) && tec.ValueKind == JsonValueKind.Number) totalEpisodeCount = tec.GetInt32();
            }

            var seasons = new List<SonarrSeasonDto>();
            if (el.TryGetProperty("seasons", out var seasArray) && seasArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var s in seasArray.EnumerateArray())
                {
                    var sNum = s.GetProperty("seasonNumber").GetInt32();
                    var sMon = s.TryGetProperty("monitored", out var smon) && smon.GetBoolean();
                    long sSize = 0;
                    int sFileCount = 0;
                    int sTotalCount = 0;

                    if (s.TryGetProperty("statistics", out var sStats))
                    {
                        if (sStats.TryGetProperty("sizeOnDisk", out var ssz) && ssz.ValueKind == JsonValueKind.Number) sSize = ssz.GetInt64();
                        if (sStats.TryGetProperty("episodeFileCount", out var sefc) && sefc.ValueKind == JsonValueKind.Number) sFileCount = sefc.GetInt32();
                        if (sStats.TryGetProperty("totalEpisodeCount", out var stec) && stec.ValueKind == JsonValueKind.Number) sTotalCount = stec.GetInt32();
                    }

                    seasons.Add(new SonarrSeasonDto(sNum, sMon, sSize, sFileCount, sTotalCount));
                }
            }

            list.Add(new SonarrSeriesDto(id, title, sortTitle, tvdbId, imdbId, year, monitored, path, sizeOnDisk, episodeFileCount, totalEpisodeCount, qualityProfileId, seasons));
        }

        return list;
    }

    public async Task<IReadOnlyList<SonarrEpisodeFileDto>> GetEpisodeFilesAsync(ServiceConnection connection, int seriesId, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/api/v3/episodefile?seriesId={seriesId}", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<SonarrEpisodeFileDto>();
        foreach (var el in doc.RootElement.EnumerateArray())
        {
            var id = el.GetProperty("id").GetInt32();
            var sId = el.GetProperty("seriesId").GetInt32();
            var seasonNumber = el.GetProperty("seasonNumber").GetInt32();
            var relativePath = el.TryGetProperty("relativePath", out var rp) ? rp.GetString() : null;
            var size = el.GetProperty("size").GetInt64();
            list.Add(new SonarrEpisodeFileDto(id, sId, seasonNumber, relativePath, size));
        }

        return list;
    }

    public async Task DeleteSeriesAsync(ServiceConnection connection, int seriesId, bool deleteFiles, bool addImportExclusion, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        var url = $"{baseUrl}/api/v3/series/{seriesId}?deleteFiles={deleteFiles.ToString().ToLowerInvariant()}&addImportExclusion={addImportExclusion.ToString().ToLowerInvariant()}";
        using var req = CreateRequest(HttpMethod.Delete, url, connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }

    public async Task DeleteEpisodeFilesAsync(ServiceConnection connection, IEnumerable<int> episodeFileIds, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        foreach (var id in episodeFileIds)
        {
            using var req = CreateRequest(HttpMethod.Delete, $"{baseUrl}/api/v3/episodefile/{id}", connection.ApiKey);
            using var res = await _httpClient.SendAsync(req, ct);
            res.EnsureSuccessStatusCode();
        }
    }

    public async Task UnmonitorSeasonAsync(ServiceConnection connection, int seriesId, int seasonNumber, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var getReq = CreateRequest(HttpMethod.Get, $"{baseUrl}/api/v3/series/{seriesId}", connection.ApiKey);
        using var getRes = await _httpClient.SendAsync(getReq, ct);
        getRes.EnsureSuccessStatusCode();

        using var stream = await getRes.Content.ReadAsStreamAsync(ct);
        var seriesJson = await JsonSerializer.DeserializeAsync<JsonElement>(stream, JsonOptions, ct);

        // Update season monitored flag
        var rawText = seriesJson.GetRawText();
        using var doc = JsonDocument.Parse(rawText);
        var root = doc.RootElement;

        // Clone element into dictionary / json node to update season
        var seasonsNode = new List<Dictionary<string, object?>>();
        if (root.TryGetProperty("seasons", out var seasons))
        {
            foreach (var s in seasons.EnumerateArray())
            {
                var sNum = s.GetProperty("seasonNumber").GetInt32();
                var sMon = s.GetProperty("monitored").GetBoolean();
                if (sNum == seasonNumber) sMon = false;

                seasonsNode.Add(new Dictionary<string, object?>
                {
                    ["seasonNumber"] = sNum,
                    ["monitored"] = sMon
                });
            }
        }

        // Put updated series
        using var putReq = CreateRequest(HttpMethod.Put, $"{baseUrl}/api/v3/series/{seriesId}", connection.ApiKey);
        putReq.Content = JsonContent.Create(root);
        using var putRes = await _httpClient.SendAsync(putReq, ct);
        putRes.EnsureSuccessStatusCode();
    }
}
