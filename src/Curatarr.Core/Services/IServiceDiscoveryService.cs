using Curatarr.Core.Models;

namespace Curatarr.Core.Services;

public interface IServiceDiscoveryService
{
    Task<IReadOnlyList<DiscoveredService>> DiscoverServicesAsync(CancellationToken ct = default);
}
