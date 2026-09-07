namespace Curatarr.Core.Models;

public record DiscoveredService(
    string Id,
    ConnectionType ConnectionType,
    string Name,
    string BaseUrl,
    string DiscoverySource,
    bool IsConfigured,
    string? TierTag = null,
    string? ContainerName = null,
    string? Image = null,
    int? Port = null,
    string? Details = null
);
