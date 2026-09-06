using System.Text.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;

namespace Curatarr.Infrastructure.Adapters;

public class TautulliClient : ITautulliClient
{
    private readonly HttpClient _httpClient;

    public TautulliClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<TautulliUserDto>> GetUsersAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        var url = $"{baseUrl}/api/v2?apikey={connection.ApiKey}&cmd=get_users";
        using var res = await _httpClient.GetAsync(url, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<TautulliUserDto>();
        var data = doc.RootElement.GetProperty("response").GetProperty("data");
        foreach (var el in data.EnumerateArray())
        {
            var userId = el.GetProperty("user_id").ToString();
            var username = el.GetProperty("username").GetString() ?? "";
            var friendly = el.TryGetProperty("friendly_name", out var fn) ? fn.GetString() : null;
            list.Add(new TautulliUserDto(userId, username, friendly));
        }

        return list;
    }

    public async Task<IReadOnlyList<TautulliHistoryItemDto>> GetHistoryAsync(ServiceConnection connection, int length = 5000, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        var url = $"{baseUrl}/api/v2?apikey={connection.ApiKey}&cmd=get_history&length={length}";
        using var res = await _httpClient.GetAsync(url, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<TautulliHistoryItemDto>();
        var data = doc.RootElement.GetProperty("response").GetProperty("data").GetProperty("data");
        foreach (var el in data.EnumerateArray())
        {
            int? rk = el.TryGetProperty("rating_key", out var r) && r.ValueKind == JsonValueKind.Number ? r.GetInt32() : (int?)null;
            var gprk = el.TryGetProperty("grandparent_rating_key", out var gp) ? gp.GetString() : null;
            var prk = el.TryGetProperty("parent_rating_key", out var p) ? p.GetString() : null;
            var title = el.TryGetProperty("title", out var t) ? t.GetString() : null;
            var gpTitle = el.TryGetProperty("grandparent_title", out var gpt) ? gpt.GetString() : null;
            var userId = el.TryGetProperty("user_id", out var uid) ? uid.ToString() : "";
            var username = el.TryGetProperty("user", out var u) ? u.GetString() ?? "" : "";
            int? season = el.TryGetProperty("parent_media_index", out var s) && s.ValueKind == JsonValueKind.Number ? s.GetInt32() : (int?)null;
            
            long dateUnix = el.TryGetProperty("date", out var d) && d.ValueKind == JsonValueKind.Number ? d.GetInt64() : 0;
            var date = DateTimeOffset.FromUnixTimeSeconds(dateUnix).UtcDateTime;

            list.Add(new TautulliHistoryItemDto(rk, gprk, prk, title, gpTitle, userId, username, season, date));
        }

        return list;
    }
}
