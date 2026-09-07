using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Microsoft.Extensions.Logging;

namespace Curatarr.Infrastructure.Services;

public class ServiceDiscoveryService : IServiceDiscoveryService
{
    private readonly IConnectionRepository _connectionRepo;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ServiceDiscoveryService> _logger;
    private readonly string _dockerSocketPath;

    public ServiceDiscoveryService(
        IConnectionRepository connectionRepo,
        IHttpClientFactory httpClientFactory,
        ILogger<ServiceDiscoveryService> logger,
        string? dockerSocketPath = null)
    {
        _connectionRepo = connectionRepo;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _dockerSocketPath = dockerSocketPath ?? Environment.GetEnvironmentVariable("CURATARR__DOCKER_SOCKET_PATH") ?? "/var/run/docker.sock";
    }

    public async Task<IReadOnlyList<DiscoveredService>> DiscoverServicesAsync(CancellationToken ct = default)
    {
        var existingConnections = await _connectionRepo.GetAllAsync(ct);
        var existingUrls = existingConnections
            .Select(c => NormalizeUrl(c.BaseUrl))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var results = new Dictionary<string, DiscoveredService>(StringComparer.OrdinalIgnoreCase);

        // 1. Docker Socket Auto-Discovery
        try
        {
            var dockerServices = await DiscoverFromDockerSocketAsync(ct);
            foreach (var svc in dockerServices)
            {
                var key = $"{svc.ConnectionType}:{NormalizeUrl(svc.BaseUrl)}";
                results[key] = svc;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Docker socket discovery skipped or failed.");
        }

        // 2. Network & DNS Probe Auto-Discovery
        try
        {
            var probedServices = await DiscoverFromNetworkProbesAsync(ct);
            foreach (var svc in probedServices)
            {
                var key = $"{svc.ConnectionType}:{NormalizeUrl(svc.BaseUrl)}";
                if (!results.ContainsKey(key))
                {
                    results[key] = svc;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Network probe discovery encountered an error.");
        }

        // 3. Mark configured state & sort
        var finalServices = results.Values
            .Select(s => s with { IsConfigured = existingUrls.Contains(NormalizeUrl(s.BaseUrl)) })
            .OrderBy(s => s.IsConfigured)
            .ThenBy(s => s.ConnectionType)
            .ThenBy(s => s.Name)
            .ToList();

        return finalServices;
    }

    public async Task<IReadOnlyList<DiscoveredService>> DiscoverFromDockerSocketAsync(CancellationToken ct = default)
    {
        if (!File.Exists(_dockerSocketPath))
        {
            _logger.LogDebug("Docker socket not found at {SocketPath}", _dockerSocketPath);
            return Array.Empty<DiscoveredService>();
        }

        using var handler = new SocketsHttpHandler
        {
            ConnectCallback = async (context, token) =>
            {
                var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
                var endpoint = new UnixDomainSocketEndPoint(_dockerSocketPath);
                await socket.ConnectAsync(endpoint, token);
                return new NetworkStream(socket, ownsSocket: true);
            }
        };

        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(3) };
        var response = await client.GetAsync("http://localhost/containers/json?all=false", ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Docker API returned non-success code {StatusCode}", response.StatusCode);
            return Array.Empty<DiscoveredService>();
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        var list = new List<DiscoveredService>();

        foreach (var element in doc.RootElement.EnumerateArray())
        {
            var rawNames = element.TryGetProperty("Names", out var namesEl) && namesEl.GetArrayLength() > 0
                ? namesEl[0].GetString() ?? ""
                : "";
            var containerName = rawNames.TrimStart('/');
            var image = element.TryGetProperty("Image", out var imgEl) ? imgEl.GetString() ?? "" : "";

            var match = IdentifyService(containerName, image, element);
            if (match != null)
            {
                list.Add(match);
            }
        }

        return list;
    }

    private DiscoveredService? IdentifyService(string containerName, string image, JsonElement containerElement)
    {
        var lowerName = containerName.ToLowerInvariant();
        var lowerImage = image.ToLowerInvariant();

        ConnectionType? type = null;
        int defaultPort = 80;
        string? tierTag = null;

        if (lowerName.Contains("sonarr") || lowerImage.Contains("sonarr"))
        {
            type = ConnectionType.Sonarr;
            defaultPort = 8989;
            tierTag = lowerName.Contains("4k") ? "4k" : (lowerName.Contains("hd") ? "hd" : null);
        }
        else if (lowerName.Contains("radarr") || lowerImage.Contains("radarr"))
        {
            type = ConnectionType.Radarr;
            defaultPort = 7878;
            tierTag = lowerName.Contains("4k") ? "4k" : (lowerName.Contains("hd") ? "hd" : null);
        }
        else if (lowerName.Contains("tautulli") || lowerImage.Contains("tautulli"))
        {
            type = ConnectionType.Tautulli;
            defaultPort = 8181;
        }
        else if ((lowerName.Contains("plex") || lowerImage.Contains("plex")) &&
                 !lowerName.Contains("auto-languages") &&
                 !lowerName.Contains("shelflife") &&
                 !lowerName.Contains("plexvote"))
        {
            type = ConnectionType.Plex;
            defaultPort = 32400;
        }
        else if (lowerName == "seerr" || lowerName == "overseerr" || lowerImage.Contains("seerr") || lowerImage.Contains("overseerr"))
        {
            type = ConnectionType.Overseerr;
            defaultPort = 5055;
        }

        if (!type.HasValue) return null;

        // Try to get explicit port from Ports list
        int port = defaultPort;
        if (containerElement.TryGetProperty("Ports", out var portsEl))
        {
            foreach (var p in portsEl.EnumerateArray())
            {
                if (p.TryGetProperty("PrivatePort", out var privPort) && privPort.GetInt32() == defaultPort)
                {
                    port = defaultPort;
                    break;
                }
            }
        }

        var baseUrl = $"http://{containerName}:{port}";
        var displayName = tierTag != null
            ? $"{type.Value} ({tierTag.ToUpperInvariant()} - {containerName})"
            : $"{type.Value} ({containerName})";

        return new DiscoveredService(
            Id: $"docker:{containerName}",
            ConnectionType: type.Value,
            Name: displayName,
            BaseUrl: baseUrl,
            DiscoverySource: "docker_socket",
            IsConfigured: false,
            TierTag: tierTag,
            ContainerName: containerName,
            Image: image,
            Port: port,
            Details: $"Docker Container: {image}"
        );
    }

    public async Task<IReadOnlyList<DiscoveredService>> DiscoverFromNetworkProbesAsync(CancellationToken ct = default)
    {
        var candidates = GetProbeCandidates();
        var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromMilliseconds(1800);

        var tasks = candidates.Select(async candidate =>
        {
            try
            {
                var isLive = await ProbeEndpointAsync(client, candidate, ct);
                return isLive ? candidate : null;
            }
            catch
            {
                return null;
            }
        });

        var foundCandidates = (await Task.WhenAll(tasks)).Where(c => c != null).Select(c => c!).ToList();

        return foundCandidates.Select(c => new DiscoveredService(
            Id: $"probe:{c.ConnectionType}:{NormalizeUrl(c.Url)}",
            ConnectionType: c.ConnectionType,
            Name: c.Name,
            BaseUrl: c.Url,
            DiscoverySource: "network_probe",
            IsConfigured: false,
            TierTag: c.TierTag,
            Port: c.Port,
            Details: "Network HTTP Probe"
        )).ToList();
    }

    private async Task<bool> ProbeEndpointAsync(HttpClient client, ProbeCandidate candidate, CancellationToken ct)
    {
        try
        {
            var probeUrl = $"{candidate.Url.TrimEnd('/')}{candidate.ProbePath}";
            using var req = new HttpRequestMessage(HttpMethod.Get, probeUrl);
            using var res = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);

            // Sonarr / Radarr / Tautulli return 401 when unauthenticated
            if (candidate.ConnectionType is ConnectionType.Sonarr or ConnectionType.Radarr or ConnectionType.Tautulli)
            {
                return res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.OK or HttpStatusCode.Forbidden;
            }

            // Plex /identity returns 200 OK
            if (candidate.ConnectionType == ConnectionType.Plex)
            {
                return res.StatusCode == HttpStatusCode.OK || res.Headers.Contains("X-Plex-Protocol");
            }

            // Overseerr /api/v1/status returns 200 or 401
            if (candidate.ConnectionType == ConnectionType.Overseerr)
            {
                return res.StatusCode is HttpStatusCode.OK or HttpStatusCode.Unauthorized;
            }

            return res.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private List<ProbeCandidate> GetProbeCandidates()
    {
        var list = new List<ProbeCandidate>
        {
            // Sonarr
            new(ConnectionType.Sonarr, "Sonarr (sonarrhd)", "http://sonarrhd:8989", "/api/v3/system/status", 8989, "hd"),
            new(ConnectionType.Sonarr, "Sonarr (sonarr4k)", "http://sonarr4k:8989", "/api/v3/system/status", 8989, "4k"),
            new(ConnectionType.Sonarr, "Sonarr (sonarr)", "http://sonarr:8989", "/api/v3/system/status", 8989, null),
            new(ConnectionType.Sonarr, "Sonarr (Local 8989)", "http://localhost:8989", "/api/v3/system/status", 8989, null),
            new(ConnectionType.Sonarr, "Sonarr (Host 8700)", "http://host.docker.internal:8700", "/api/v3/system/status", 8700, "hd"),
            new(ConnectionType.Sonarr, "Sonarr (Host 8701)", "http://host.docker.internal:8701", "/api/v3/system/status", 8701, "4k"),

            // Radarr
            new(ConnectionType.Radarr, "Radarr (radarrhd)", "http://radarrhd:7878", "/api/v3/system/status", 7878, "hd"),
            new(ConnectionType.Radarr, "Radarr (radarr4k)", "http://radarr4k:7878", "/api/v3/system/status", 7878, "4k"),
            new(ConnectionType.Radarr, "Radarr (radarr)", "http://radarr:7878", "/api/v3/system/status", 7878, null),
            new(ConnectionType.Radarr, "Radarr (Local 7878)", "http://localhost:7878", "/api/v3/system/status", 7878, null),
            new(ConnectionType.Radarr, "Radarr (Host 8800)", "http://host.docker.internal:8800", "/api/v3/system/status", 8800, "hd"),
            new(ConnectionType.Radarr, "Radarr (Host 8801)", "http://host.docker.internal:8801", "/api/v3/system/status", 8801, "4k"),

            // Tautulli
            new(ConnectionType.Tautulli, "Tautulli (tautulli)", "http://tautulli:8181", "/api/v2", 8181, null),
            new(ConnectionType.Tautulli, "Tautulli (Local 8181)", "http://localhost:8181", "/api/v2", 8181, null),
            new(ConnectionType.Tautulli, "Tautulli (Host 8900)", "http://host.docker.internal:8900", "/api/v2", 8900, null),

            // Plex
            new(ConnectionType.Plex, "Plex (plex)", "http://plex:32400", "/identity", 32400, null),
            new(ConnectionType.Plex, "Plex (Local 32400)", "http://localhost:32400", "/identity", 32400, null),
            new(ConnectionType.Plex, "Plex (Host 32400)", "http://host.docker.internal:32400", "/identity", 32400, null),

            // Overseerr
            new(ConnectionType.Overseerr, "Overseerr (seerr)", "http://seerr:5055", "/api/v1/status", 5055, null),
            new(ConnectionType.Overseerr, "Overseerr (overseerr)", "http://overseerr:5055", "/api/v1/status", 5055, null),
            new(ConnectionType.Overseerr, "Overseerr (Host 8500)", "http://host.docker.internal:8500", "/api/v1/status", 8500, null),
        };

        // Add optional extra hosts (e.g. CURATARR__DISCOVERY__EXTRA_HOSTS="10.0.0.10")
        var extraHosts = Environment.GetEnvironmentVariable("CURATARR__DISCOVERY__EXTRA_HOSTS");
        if (!string.IsNullOrWhiteSpace(extraHosts))
        {
            foreach (var h in extraHosts.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                list.Add(new(ConnectionType.Sonarr, $"Sonarr ({h}:8700)", $"http://{h}:8700", "/api/v3/system/status", 8700, "hd"));
                list.Add(new(ConnectionType.Sonarr, $"Sonarr ({h}:8701)", $"http://{h}:8701", "/api/v3/system/status", 8701, "4k"));
                list.Add(new(ConnectionType.Radarr, $"Radarr ({h}:8800)", $"http://{h}:8800", "/api/v3/system/status", 8800, "hd"));
                list.Add(new(ConnectionType.Radarr, $"Radarr ({h}:8801)", $"http://{h}:8801", "/api/v3/system/status", 8801, "4k"));
                list.Add(new(ConnectionType.Tautulli, $"Tautulli ({h}:8900)", $"http://{h}:8900", "/api/v2", 8900, null));
                list.Add(new(ConnectionType.Plex, $"Plex ({h}:32400)", $"http://{h}:32400", "/identity", 32400, null));
                list.Add(new(ConnectionType.Overseerr, $"Overseerr ({h}:8500)", $"http://{h}:8500", "/api/v1/status", 8500, null));
            }
        }

        return list;
    }

    private static string NormalizeUrl(string url) => url.Trim().TrimEnd('/').ToLowerInvariant();

    private record ProbeCandidate(
        ConnectionType ConnectionType,
        string Name,
        string Url,
        string ProbePath,
        int Port,
        string? TierTag
    );
}
