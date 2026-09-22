using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Infrastructure.Services;

public class PlexAuthService : IPlexAuthService
{
    private readonly HttpClient _httpClient;
    private readonly IUserRepository _userRepo;
    private readonly ISettingsRepository _settingsRepo;
    private readonly IConnectionRepository _connRepo;

    public PlexAuthService(
        HttpClient httpClient,
        IUserRepository userRepo,
        ISettingsRepository settingsRepo,
        IConnectionRepository connRepo)
    {
        _httpClient = httpClient;
        _userRepo = userRepo;
        _settingsRepo = settingsRepo;
        _connRepo = connRepo;
    }

    public async Task<string> GetOrCreateClientIdAsync(CancellationToken ct = default)
    {
        var settings = await _settingsRepo.GetSettingsAsync(ct);
        if (!string.IsNullOrWhiteSpace(settings.PlexClientId))
        {
            return settings.PlexClientId;
        }

        var newClientId = Guid.NewGuid().ToString("N");
        var updated = settings with { PlexClientId = newClientId };
        await _settingsRepo.SaveSettingsAsync(updated, ct);
        return newClientId;
    }

    public async Task<string> GetOrCreateSessionSecretAsync(CancellationToken ct = default)
    {
        var settings = await _settingsRepo.GetSettingsAsync(ct);
        if (!string.IsNullOrWhiteSpace(settings.SessionSecret))
        {
            return settings.SessionSecret;
        }

        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        var newSecret = Convert.ToHexString(bytes).ToLowerInvariant();
        var updated = settings with { SessionSecret = newSecret };
        await _settingsRepo.SaveSettingsAsync(updated, ct);
        return newSecret;
    }

    public async Task<PlexPinResponse> CreatePinAsync(CancellationToken ct = default)
    {
        var clientId = await GetOrCreateClientIdAsync(ct);
        using var req = new HttpRequestMessage(HttpMethod.Post, "https://plex.tv/api/v2/pins?strong=true");
        req.Headers.Add("X-Plex-Product", "Curatarr");
        req.Headers.Add("X-Plex-Client-Identifier", clientId);
        req.Headers.Add("Accept", "application/json");

        using var res = await _httpClient.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();

        using var stream = await res.Content.ReadAsStreamAsync(ct);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        var id = doc.RootElement.GetProperty("id").GetInt32();
        var code = doc.RootElement.GetProperty("code").GetString() ?? "";

        var authUrl = $"https://app.plex.tv/auth/#!?clientID={clientId}&code={code}&context%5Bdevice%5D%5Bproduct%5D=Curatarr";
        return new PlexPinResponse(id, code, authUrl);
    }

    public async Task<PlexClaimResult> ClaimPinAsync(int pinId, CancellationToken ct = default)
    {
        var clientId = await GetOrCreateClientIdAsync(ct);
        using var pinReq = new HttpRequestMessage(HttpMethod.Get, $"https://plex.tv/api/v2/pins/{pinId}");
        pinReq.Headers.Add("X-Plex-Product", "Curatarr");
        pinReq.Headers.Add("X-Plex-Client-Identifier", clientId);
        pinReq.Headers.Add("Accept", "application/json");

        using var pinRes = await _httpClient.SendAsync(pinReq, ct);
        if (!pinRes.IsSuccessStatusCode)
        {
            return new PlexClaimResult(false, null, null, $"Plex PIN request returned status {(int)pinRes.StatusCode}");
        }

        using var pinStream = await pinRes.Content.ReadAsStreamAsync(ct);
        using var pinDoc = await JsonDocument.ParseAsync(pinStream, cancellationToken: ct);

        if (!pinDoc.RootElement.TryGetProperty("authToken", out var tokenProp) || tokenProp.ValueKind == JsonValueKind.Null)
        {
            return new PlexClaimResult(false, null, null);
        }

        var authToken = tokenProp.GetString();
        if (string.IsNullOrWhiteSpace(authToken))
        {
            return new PlexClaimResult(false, null, null);
        }

        // Fetch user profile from Plex using authToken
        using var userReq = new HttpRequestMessage(HttpMethod.Get, "https://plex.tv/api/v2/user");
        userReq.Headers.Add("X-Plex-Token", authToken);
        userReq.Headers.Add("X-Plex-Client-Identifier", clientId);
        userReq.Headers.Add("Accept", "application/json");

        using var userRes = await _httpClient.SendAsync(userReq, ct);
        userRes.EnsureSuccessStatusCode();

        using var userStream = await userRes.Content.ReadAsStreamAsync(ct);
        using var userDoc = await JsonDocument.ParseAsync(userStream, cancellationToken: ct);

        var root = userDoc.RootElement;
        var plexId = root.TryGetProperty("id", out var idProp)
            ? (idProp.ValueKind == JsonValueKind.Number ? idProp.GetInt64().ToString() : idProp.GetString() ?? "")
            : "";
        var username = root.TryGetProperty("username", out var uProp) ? uProp.GetString() ?? "" : "";
        var email = root.TryGetProperty("email", out var eProp) ? eProp.GetString() : null;
        var thumb = root.TryGetProperty("thumb", out var tProp) ? tProp.GetString() : null;

        if (string.IsNullOrWhiteSpace(plexId) || string.IsNullOrWhiteSpace(username))
        {
            return new PlexClaimResult(false, null, null, "Failed to resolve Plex user profile");
        }

        // Determine Role
        var settings = await _settingsRepo.GetSettingsAsync(ct);
        var totalUsers = await _userRepo.GetCountAsync(ct);
        var determinedRole = UserRole.Guest;

        if (totalUsers == 0)
        {
            // First user to log in is automatically Admin
            determinedRole = UserRole.Admin;
        }
        else
        {
            // Check AdminUsernames setting
            var adminList = (settings.AdminUsernames ?? "")
                .Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (adminList.Any(a => string.Equals(a, username, StringComparison.OrdinalIgnoreCase) ||
                                  (!string.IsNullOrEmpty(email) && string.Equals(a, email, StringComparison.OrdinalIgnoreCase))))
            {
                determinedRole = UserRole.Admin;
            }
            else
            {
                // Check if user owns the configured Plex server
                try
                {
                    using var resReq = new HttpRequestMessage(HttpMethod.Get, "https://plex.tv/api/v2/resources?includeHttps=1");
                    resReq.Headers.Add("X-Plex-Token", authToken);
                    resReq.Headers.Add("X-Plex-Client-Identifier", clientId);
                    resReq.Headers.Add("Accept", "application/json");

                    using var resRes = await _httpClient.SendAsync(resReq, ct);
                    if (resRes.IsSuccessStatusCode)
                    {
                        using var resStream = await resRes.Content.ReadAsStreamAsync(ct);
                        using var resDoc = await JsonDocument.ParseAsync(resStream, cancellationToken: ct);
                        if (resDoc.RootElement.ValueKind == JsonValueKind.Array)
                        {
                            var connections = await _connRepo.GetAllAsync(ct);
                            var plexConns = connections.Where(c => c.ConnectionType == ConnectionType.Plex && c.IsEnabled).ToList();

                            foreach (var item in resDoc.RootElement.EnumerateArray())
                            {
                                var provides = item.TryGetProperty("provides", out var p) ? p.GetString() : null;
                                var owned = item.TryGetProperty("owned", out var o) && o.GetBoolean();
                                if (provides == "server" && owned)
                                {
                                    // If Curatarr has no Plex connections yet or matches server name/clientIdentifier
                                    var clientIdentifier = item.TryGetProperty("clientIdentifier", out var ci) ? ci.GetString() : null;
                                    var serverName = item.TryGetProperty("name", out var sn) ? sn.GetString() : null;

                                    if (plexConns.Count == 0 || plexConns.Any(pc =>
                                        (!string.IsNullOrEmpty(clientIdentifier) && pc.ApiKey == clientIdentifier) ||
                                        (!string.IsNullOrEmpty(serverName) && string.Equals(pc.Name, serverName, StringComparison.OrdinalIgnoreCase))))
                                    {
                                        determinedRole = UserRole.Admin;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // Fallback to guest if resource check fails
                }
            }
        }

        // Upsert User
        var existing = await _userRepo.GetByPlexIdAsync(plexId, ct);
        User finalUser;
        if (existing != null)
        {
            existing.Username = username;
            existing.Email = email;
            existing.ThumbUrl = thumb;
            existing.UpdatedAt = DateTime.UtcNow;
            if (determinedRole == UserRole.Admin)
            {
                existing.Role = UserRole.Admin;
            }
            await _userRepo.UpsertAsync(existing, ct);
            finalUser = existing;
        }
        else
        {
            finalUser = new User
            {
                PlexId = plexId,
                Username = username,
                Email = email,
                ThumbUrl = thumb,
                Role = determinedRole,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await _userRepo.UpsertAsync(finalUser, ct);
        }

        var secret = await GetOrCreateSessionSecretAsync(ct);
        var token = CreateSessionToken(finalUser, secret);

        return new PlexClaimResult(true, finalUser, token);
    }

    public string CreateSessionToken(User user, string secret)
    {
        var header = JsonSerializer.Serialize(new { alg = "HS256", typ = "JWT" });
        var payload = JsonSerializer.Serialize(new
        {
            sub = user.Id,
            plexId = user.PlexId,
            name = user.Username,
            role = user.Role.ToString(),
            thumb = user.ThumbUrl,
            exp = DateTimeOffset.UtcNow.AddDays(30).ToUnixTimeSeconds()
        });

        var headerB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(header));
        var payloadB64 = Base64UrlEncode(Encoding.UTF8.GetBytes(payload));
        var toSign = $"{headerB64}.{payloadB64}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var signature = Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(toSign)));

        return $"{toSign}.{signature}";
    }

    public UserSession? ValidateSessionToken(string token, string secret)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        var toSign = $"{parts[0]}.{parts[1]}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expectedSig = Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(toSign)));

        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(parts[2]), Encoding.UTF8.GetBytes(expectedSig)))
        {
            return null;
        }

        try
        {
            var payloadBytes = Base64UrlDecode(parts[1]);
            using var doc = JsonDocument.Parse(payloadBytes);
            var root = doc.RootElement;

            var exp = root.GetProperty("exp").GetInt64();
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp)
            {
                return null;
            }

            var sub = root.GetProperty("sub").GetString() ?? "";
            var plexId = root.TryGetProperty("plexId", out var p) ? p.GetString() ?? "" : "";
            var name = root.GetProperty("name").GetString() ?? "";
            var roleStr = root.GetProperty("role").GetString() ?? "Guest";
            var thumb = root.TryGetProperty("thumb", out var th) ? th.GetString() : null;

            var role = Enum.TryParse<UserRole>(roleStr, true, out var r) ? r : UserRole.Guest;
            return new UserSession(sub, plexId, name, role, thumb);
        }
        catch
        {
            return null;
        }
    }

    private static string Base64UrlEncode(byte[] input)
    {
        return Convert.ToBase64String(input)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var output = input.Replace('-', '+').Replace('_', '/');
        switch (output.Length % 4)
        {
            case 2: output += "=="; break;
            case 3: output += "="; break;
        }
        return Convert.FromBase64String(output);
    }
}
