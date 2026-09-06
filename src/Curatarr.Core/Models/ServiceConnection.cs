namespace Curatarr.Core.Models;

public enum ConnectionType
{
    Sonarr,
    Radarr,
    Tautulli,
    Plex,
    Overseerr
}

public class ServiceConnection
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public ConnectionType ConnectionType { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string? TierTag { get; set; }
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastSyncAt { get; set; }
    public string LastStatus { get; set; } = "Unknown";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
