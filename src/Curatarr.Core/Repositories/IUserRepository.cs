using Curatarr.Core.Models;

namespace Curatarr.Core.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<User?> GetByPlexIdAsync(string plexId, CancellationToken ct = default);
    Task<User?> GetByUsernameAsync(string username, CancellationToken ct = default);
    Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default);
    Task<int> GetCountAsync(CancellationToken ct = default);
    Task UpsertAsync(User user, CancellationToken ct = default);
    Task UpdateRoleAsync(string id, UserRole role, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}
