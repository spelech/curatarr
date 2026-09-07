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
            int? rk = null;
            if (el.TryGetProperty("rating_key", out var r))
            {
                if (r.ValueKind == JsonValueKind.Number && r.TryGetInt32(out var rkVal)) rk = rkVal;
                else if (r.ValueKind == JsonValueKind.String && int.TryParse(r.GetString(), out var rkParsed)) rk = rkParsed;
            }

            string? gprk = null;
            if (el.TryGetProperty("grandparent_rating_key", out var gp))
            {
                gprk = gp.ValueKind == JsonValueKind.String ? gp.GetString() : gp.ToString();
                if (string.IsNullOrWhiteSpace(gprk)) gprk = null;
            }

            string? prk = null;
            if (el.TryGetProperty("parent_rating_key", out var p))
            {
                prk = p.ValueKind == JsonValueKind.String ? p.GetString() : p.ToString();
                if (string.IsNullOrWhiteSpace(prk)) prk = null;
            }

            var title = el.TryGetProperty("title", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : null;
            var gpTitle = el.TryGetProperty("grandparent_title", out var gpt) && gpt.ValueKind == JsonValueKind.String ? gpt.GetString() : null;
            if (string.IsNullOrWhiteSpace(gpTitle)) gpTitle = null;

            var userId = "";
            if (el.TryGetProperty("user_id", out var uid))
            {
                userId = uid.ValueKind == JsonValueKind.String ? (uid.GetString() ?? "") : uid.ToString();
            }

            var username = el.TryGetProperty("user", out var u) && u.ValueKind == JsonValueKind.String ? (u.GetString() ?? "") : "";

            int? season = null;
            if (el.TryGetProperty("parent_media_index", out var s))
            {
                if (s.ValueKind == JsonValueKind.Number && s.TryGetInt32(out var sVal)) season = sVal;
                else if (s.ValueKind == JsonValueKind.String && int.TryParse(s.GetString(), out var sParsed)) season = sParsed;
            }
            
            long dateUnix = el.TryGetProperty("date", out var d) && d.ValueKind == JsonValueKind.Number ? d.GetInt64() : 0;
            var date = DateTimeOffset.FromUnixTimeSeconds(dateUnix).UtcDateTime;

            list.Add(new TautulliHistoryItemDto(rk, gprk, prk, title, gpTitle, userId, username, season, date));
        }

        return list;
    }
}
