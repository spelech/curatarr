using System.Text.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;

namespace Curatarr.Infrastructure.Adapters;

public class OverseerrClient : IOverseerrClient
{
    private readonly HttpClient _httpClient;

    public OverseerrClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string url, string apiKey)
    {
        var req = new HttpRequestMessage(method, url);
        req.Headers.Add("X-Api-Key", apiKey);
        return req;
    }

    public async Task<IReadOnlyList<OverseerrRequestDto>> GetRequestsAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Get, $"{baseUrl}/api/v1/request?take=500", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var list = new List<OverseerrRequestDto>();
        if (doc.RootElement.TryGetProperty("results", out var results))
        {
            foreach (var el in results.EnumerateArray())
            {
                var id = el.GetProperty("id").GetInt32();
                var status = el.GetProperty("status").ToString();
                var type = el.GetProperty("type").GetString() ?? "";

                int? tmdbId = null;
                int? tvdbId = null;
                if (el.TryGetProperty("media", out var media))
                {
                    if (media.TryGetProperty("tmdbId", out var tmid) && tmid.ValueKind == JsonValueKind.Number) tmdbId = tmid.GetInt32();
                    if (media.TryGetProperty("tvdbId", out var tvid) && tvid.ValueKind == JsonValueKind.Number) tvdbId = tvid.GetInt32();
                }

                DateTime? requestedAt = null;
                if (el.TryGetProperty("createdAt", out var caProp) && caProp.ValueKind == JsonValueKind.String)
                {
                    if (DateTime.TryParse(caProp.GetString(), out var dt))
                    {
                        requestedAt = dt.ToUniversalTime();
                    }
                }

                string? requestedBy = null;
                if (el.TryGetProperty("requestedBy", out var rb) && rb.ValueKind == JsonValueKind.Object)
                {
                    if (rb.TryGetProperty("displayName", out var dn) && !string.IsNullOrWhiteSpace(dn.GetString()))
                        requestedBy = dn.GetString();
                    else if (rb.TryGetProperty("plexUsername", out var pu) && !string.IsNullOrWhiteSpace(pu.GetString()))
                        requestedBy = pu.GetString();
                    else if (rb.TryGetProperty("username", out var un) && !string.IsNullOrWhiteSpace(un.GetString()))
                        requestedBy = un.GetString();
                    else if (rb.TryGetProperty("email", out var em) && !string.IsNullOrWhiteSpace(em.GetString()))
                        requestedBy = em.GetString();
                }

                list.Add(new OverseerrRequestDto(id, status, type, tmdbId, tvdbId, requestedBy, requestedAt));
            }
        }

        return list;
    }

    public async Task DeleteRequestAsync(ServiceConnection connection, int requestId, CancellationToken ct = default)
    {
        var baseUrl = connection.BaseUrl.TrimEnd('/');
        using var req = CreateRequest(HttpMethod.Delete, $"{baseUrl}/api/v1/request/{requestId}", connection.ApiKey);
        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
    }
}
