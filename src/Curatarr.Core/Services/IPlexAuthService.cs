using Curatarr.Core.Models;

namespace Curatarr.Core.Services;

public record PlexPinResponse(int Id, string Code, string AuthUrl);

public record PlexClaimResult(bool Claimed, User? User, string? Token, string? Error = null);

public record UserSession(string UserId, string PlexId, string Username, UserRole Role, string? ThumbUrl);

public interface IPlexAuthService
{
    Task<PlexPinResponse> CreatePinAsync(CancellationToken ct = default);
    Task<PlexClaimResult> ClaimPinAsync(int pinId, CancellationToken ct = default);
    string CreateSessionToken(User user, string secret);
    UserSession? ValidateSessionToken(string token, string secret);
    Task<string> GetOrCreateSessionSecretAsync(CancellationToken ct = default);
    Task<string> GetOrCreateClientIdAsync(CancellationToken ct = default);
}
