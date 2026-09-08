using Curatarr.Core.Models;

namespace Curatarr.Core.Repositories;

public interface ISettingsRepository
{
    Task<CuratarrSettings> GetSettingsAsync(CancellationToken ct = default);
    Task SaveSettingsAsync(CuratarrSettings settings, CancellationToken ct = default);
}
