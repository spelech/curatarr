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

    public async Task<IReadOnlyList<TautulliHistoryItemDto>> GetHistoryAsync(ServiceConnection connection, int length = 0, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        var list = new List<TautulliHistoryItemDto>();
        var pageSize = 25000;
        var start = 0;
        var totalRecords = int.MaxValue;

        while (start < totalRecords)
        {
            var fetchLength = (length > 0 && length < pageSize) ? length : pageSize;
            var url = $"{baseUrl}/api/v2?apikey={connection.ApiKey}&cmd=get_history&start={start}&length={fetchLength}";
            using var res = await _httpClient.GetAsync(url, ct);
            res.EnsureSuccessStatusCode();

            using var stream = await res.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

            if (!doc.RootElement.TryGetProperty("response", out var resp) ||
                !resp.TryGetProperty("data", out var respData))
            {
                break;
            }

            if (respData.TryGetProperty("recordsFiltered", out var rfProp))
            {
                if (rfProp.ValueKind == JsonValueKind.Number && rfProp.TryGetInt32(out var rfVal))
                {
                    totalRecords = rfVal;
                }
                else if (rfProp.ValueKind == JsonValueKind.String && int.TryParse(rfProp.GetString(), out var rfParsed))
                {
                    totalRecords = rfParsed;
                }
            }

            if (!respData.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
            {
                break;
            }

            int batchCount = 0;
            foreach (var el in data.EnumerateArray())
            {
                batchCount++;
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

                long dateUnix = 0;
                if (el.TryGetProperty("date", out var d))
                {
                    if (d.ValueKind == JsonValueKind.Number) dateUnix = d.GetInt64();
                    else if (d.ValueKind == JsonValueKind.String && long.TryParse(d.GetString(), out var dParsed)) dateUnix = dParsed;
                }
                var date = DateTimeOffset.FromUnixTimeSeconds(dateUnix).UtcDateTime;

                var mediaType = el.TryGetProperty("media_type", out var mt) && mt.ValueKind == JsonValueKind.String ? mt.GetString() : null;
                int? year = null;
                if (el.TryGetProperty("year", out var yr))
                {
                    if (yr.ValueKind == JsonValueKind.Number && yr.TryGetInt32(out var yrVal)) year = yrVal;
                    else if (yr.ValueKind == JsonValueKind.String && int.TryParse(yr.GetString(), out var yrParsed)) year = yrParsed;
                }

                var guid = el.TryGetProperty("guid", out var gd) && gd.ValueKind == JsonValueKind.String ? gd.GetString() : null;

                list.Add(new TautulliHistoryItemDto(rk, gprk, prk, title, gpTitle, userId, username, season, date, mediaType, year, guid));
            }

            if (batchCount == 0)
            {
                break;
            }

            start += batchCount;

            if (length > 0 && list.Count >= length)
            {
                break;
            }
        }

        return list;
    }
}
