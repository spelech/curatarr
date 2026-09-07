using Curatarr.Core.Models;

namespace Curatarr.Core.Repositories;

public interface IConnectionRepository
{
    Task<IReadOnlyList<ServiceConnection>> GetAllAsync(CancellationToken ct = default);
    Task<ServiceConnection?> GetByIdAsync(string id, CancellationToken ct = default);
    Task UpsertAsync(ServiceConnection connection, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

public record MediaFilterOptions(
    string? CategoryId = null,
    string? UserIdFilter = null,
    MediaType? MediaTypeFilter = null,
    string? SearchQuery = null,
    string? ResolutionFilter = null,
    bool? CutoffUnmetFilter = null,
    string? SortBy = "size", // "size", "added", "played", "title"
    bool SortDescending = true,
    int Limit = 50,
    int Offset = 0
);

public interface IMediaRepository
{
    Task<IReadOnlyList<MediaItem>> GetPagedAsync(MediaFilterOptions options, CancellationToken ct = default);
    Task<MediaItem?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<MediaItem?> FindByExternalIdAsync(string? tmdbId, string? tvdbId, string? imdbId, CancellationToken ct = default);
    Task UpsertBatchAsync(IEnumerable<MediaItem> items, CancellationToken ct = default);
    Task SetProtectionAsync(string id, bool isProtected, string? reason, CancellationToken ct = default);
    Task DeleteInstanceAsync(string instanceId, CancellationToken ct = default);
    Task DeleteSeasonAsync(string mediaItemId, int seasonNumber, CancellationToken ct = default);
    Task DeleteMediaItemAsync(string id, CancellationToken ct = default);
    Task<long> GetTotalLibrarySizeBytesAsync(CancellationToken ct = default);
    Task<int> GetTotalCountAsync(CancellationToken ct = default);
}

public interface IAuditRepository
{
    Task AddAsync(AuditLogEntry entry, CancellationToken ct = default);
    Task<IReadOnlyList<AuditLogEntry>> GetRecentAsync(int limit = 100, CancellationToken ct = default);
    Task<long> GetTotalBytesFreedAsync(CancellationToken ct = default);
}
