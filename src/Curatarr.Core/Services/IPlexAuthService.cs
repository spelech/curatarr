using Curatarr.Core.Models;

namespace Curatarr.Core.Services;

public record PlexPinResponse(int Id, string Code, string AuthUrl);

public record PlexClaimResult(bool Claimed, User? User, string? Token, string? Error = null);

public record UserSession(string UserId, string PlexId, string Username, UserRole Role, string? ThumbUrl);

public record PlexServerConnectionDto(
    string Uri,
    string Address,
    int Port,
    string Protocol,
    bool Local
);

public record PlexServerResourceDto(
    string Name,
    string ClientIdentifier,
    bool Owned,
    string? AccessToken,
    IReadOnlyList<PlexServerConnectionDto> Connections
);

public interface IPlexAuthService
{
    Task<PlexPinResponse> CreatePinAsync(CancellationToken ct = default);
    Task<PlexClaimResult> ClaimPinAsync(int pinId, CancellationToken ct = default);
    Task<IReadOnlyList<PlexServerResourceDto>> GetDiscoveredServersAsync(string? authToken = null, CancellationToken ct = default);
    Task<string?> FetchMachineIdentifierAsync(ServiceConnection conn, CancellationToken ct = default);
    string CreateSessionToken(User user, string secret);
    UserSession? ValidateSessionToken(string token, string secret);
    Task<string> GetOrCreateSessionSecretAsync(CancellationToken ct = default);
    Task<string> GetOrCreateClientIdAsync(CancellationToken ct = default);
}
