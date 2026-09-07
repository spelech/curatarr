using System.Text.Json;
using System.Text.Json.Serialization;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;

namespace Curatarr.Infrastructure.Adapters;

public class RadarrClient : IRadarrClient
{
    private readonly HttpClient _httpClient;

    public RadarrClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string url, string apiKey)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Add("X-Api-Key", apiKey);
        return req;
    }

    public async Task<IReadOnlyList<RadarrMovieDto>> GetMoviesAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/api/v3/movie", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<RadarrMovieDto>();
        foreach (var el in doc.RootElement.EnumerateArray())
        {
            var id = el.GetProperty("id").GetInt32();
            var title = el.GetProperty("title").GetString() ?? "";
            var sortTitle = el.TryGetProperty("sortTitle", out var st) ? st.GetString() : null;
            var tmdbId = el.TryGetProperty("tmdbId", out var tid) && tid.ValueKind == JsonValueKind.Number ? tid.GetInt32() : (int?)null;
            var imdbId = el.TryGetProperty("imdbId", out var iid) ? iid.GetString() : null;
            var year = el.TryGetProperty("year", out var yr) && yr.ValueKind == JsonValueKind.Number ? yr.GetInt32() : (int?)null;
            var hasFile = el.TryGetProperty("hasFile", out var hf) && hf.GetBoolean();
            var monitored = el.TryGetProperty("monitored", out var mon) && mon.GetBoolean();
            var path = el.TryGetProperty("path", out var pth) ? pth.GetString() : null;
            var qualityProfileId = el.TryGetProperty("qualityProfileId", out var qp) ? qp.GetInt32() : (int?)null;
            long sizeOnDisk = el.TryGetProperty("sizeOnDisk", out var sz) && sz.ValueKind == JsonValueKind.Number ? sz.GetInt64() : 0;

            string? resolution = null;
            if (hasFile && el.TryGetProperty("movieFile", out var mf) && mf.ValueKind == JsonValueKind.Object)
            {
                if (mf.TryGetProperty("quality", out var q) && q.TryGetProperty("quality", out var qq))
                {
                    int resNum = qq.TryGetProperty("resolution", out var r) && r.ValueKind == JsonValueKind.Number ? r.GetInt32() : 0;
                    string? qName = qq.TryGetProperty("name", out var n) ? n.GetString() : null;
                    if (resNum >= 2160 || (qName?.Contains("2160", StringComparison.OrdinalIgnoreCase) ?? false) || (qName?.Contains("4K", StringComparison.OrdinalIgnoreCase) ?? false))
                    {
                        resolution = "4K";
                    }
                    else if (resNum >= 1080 || (qName?.Contains("1080", StringComparison.OrdinalIgnoreCase) ?? false))
                    {
                        resolution = "1080p";
                    }
                    else if (resNum >= 720 || (qName?.Contains("720", StringComparison.OrdinalIgnoreCase) ?? false))
                    {
                        resolution = "720p";
                    }
                    else if (resNum > 0 || (qName != null && (qName.Contains("SD", StringComparison.OrdinalIgnoreCase) || qName.Contains("DVD", StringComparison.OrdinalIgnoreCase) || qName.Contains("480", StringComparison.OrdinalIgnoreCase) || qName.Contains("576", StringComparison.OrdinalIgnoreCase))))
                    {
                        resolution = "SD";
                    }
                }
            }

            list.Add(new RadarrMovieDto(id, title, sortTitle, tmdbId, imdbId, year, hasFile, monitored, path, sizeOnDisk, qualityProfileId, resolution));
        }

        return list;
    }

    public async Task<HashSet<int>> GetCutoffUnmetMovieIdsAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/api/v3/wanted/cutoff?page=1&pageSize=5000", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) return [];

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var set = new HashSet<int>();
        if (doc.RootElement.TryGetProperty("records", out var records) && records.ValueKind == JsonValueKind.Array)
        {
            foreach (var el in records.EnumerateArray())
            {
                if (el.TryGetProperty("id", out var idProp) && idProp.TryGetInt32(out var id))
                {
                    set.Add(id);
                }
            }
        }
        return set;
    }

    public async Task DeleteMovieAsync(ServiceConnection connection, int movieId, bool deleteFiles, bool addImportExclusion, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        var url = $"{baseUrl}/api/v3/movie/{movieId}?deleteFiles={deleteFiles.ToString().ToLowerInvariant()}&addImportExclusion={addImportExclusion.ToString().ToLowerInvariant()}";
        using var req = CreateRequest(HttpMethod.Delete, url, connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }
}
