using System.Diagnostics;
using System.Text.Json;
using Curatarr.Core.Adapters;
using Curatarr.Core.Models;

namespace Curatarr.Infrastructure.Adapters;

public class ConnectionTester : IConnectionTester
{
    private readonly HttpClient _httpClient;

    public ConnectionTester(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ConnectionTestResult> TestAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var baseUrl = connection.BaseUrl.TrimEnd('/');

        try
        {
            switch (connection.ConnectionType)
            {
                case ConnectionType.Sonarr:
                case ConnectionType.Radarr:
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/api/v3/system/status");
                    req.Headers.Add("X-Api-Key", connection.ApiKey);
                    using var res = await _httpClient.SendAsync(req, ct);
                    sw.Stop();

                    if (!res.IsSuccessStatusCode)
                    {
                        return new ConnectionTestResult(false, null, $"HTTP {(int)res.StatusCode}: {res.ReasonPhrase}", sw.ElapsedMilliseconds);
                    }

                    using var stream = await res.Content.ReadAsStreamAsync(ct);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                    var version = doc.RootElement.TryGetProperty("version", out var v) ? v.GetString() : null;
                    return new ConnectionTestResult(true, version, "Connected successfully", sw.ElapsedMilliseconds);
                }

                case ConnectionType.Tautulli:
                {
                    var url = $"{baseUrl}/api/v2?apikey={connection.ApiKey}&cmd=status";
                    using var res = await _httpClient.GetAsync(url, ct);
                    sw.Stop();

                    if (!res.IsSuccessStatusCode)
                    {
                        return new ConnectionTestResult(false, null, $"HTTP {(int)res.StatusCode}: {res.ReasonPhrase}", sw.ElapsedMilliseconds);
                    }

                    using var stream = await res.Content.ReadAsStreamAsync(ct);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                    var resultStr = doc.RootElement.GetProperty("response").GetProperty("result").GetString();
                    if (resultStr == "error")
                    {
                        var msg = doc.RootElement.GetProperty("response").TryGetProperty("message", out var m) ? m.GetString() : "Tautulli error";
                        return new ConnectionTestResult(false, null, msg, sw.ElapsedMilliseconds);
                    }

                    return new ConnectionTestResult(true, "v2", "Connected successfully", sw.ElapsedMilliseconds);
                }

                case ConnectionType.Plex:
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/identity");
                    req.Headers.Add("X-Plex-Token", connection.ApiKey);
                    req.Headers.Add("Accept", "application/json");
                    using var res = await _httpClient.SendAsync(req, ct);
                    sw.Stop();

                    if (!res.IsSuccessStatusCode)
                    {
                        return new ConnectionTestResult(false, null, $"HTTP {(int)res.StatusCode}: {res.ReasonPhrase}", sw.ElapsedMilliseconds);
                    }

                    using var stream = await res.Content.ReadAsStreamAsync(ct);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                    var version = doc.RootElement.TryGetProperty("MediaContainer", out var mc) && mc.TryGetProperty("version", out var v) ? v.GetString() : "Plex Media Server";
                    return new ConnectionTestResult(true, version, "Connected successfully", sw.ElapsedMilliseconds);
                }

                case ConnectionType.Overseerr:
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}/api/v1/status");
                    req.Headers.Add("X-Api-Key", connection.ApiKey);
                    using var res = await _httpClient.SendAsync(req, ct);
                    sw.Stop();

                    if (!res.IsSuccessStatusCode)
                    {
                        return new ConnectionTestResult(false, null, $"HTTP {(int)res.StatusCode}: {res.ReasonPhrase}", sw.ElapsedMilliseconds);
                    }

                    using var stream = await res.Content.ReadAsStreamAsync(ct);
                    using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
                    var version = doc.RootElement.TryGetProperty("version", out var v) ? v.GetString() : null;
                    return new ConnectionTestResult(true, version, "Connected successfully", sw.ElapsedMilliseconds);
                }

                default:
                    return new ConnectionTestResult(false, null, "Unknown connection type", 0);
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            return new ConnectionTestResult(false, null, ex.Message, sw.ElapsedMilliseconds);
        }
    }
}
