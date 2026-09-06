using Curatarr.Core.Models;

namespace Curatarr.Core.Services;

public record CategoryCountSummary(string CategoryId, string Name, int Count, long ReclaimableSizeBytes);

public interface ISmartCategoryEngine
{
    Task<IReadOnlyList<CategoryCountSummary>> GetSummariesAsync(string? userIdFilter, CancellationToken ct = default);
}

public record PruneCommand(
    string MediaItemId,
    int? SeasonNumber,
    IReadOnlyList<string> TargetConnectionIds,
    bool AddImportExclusion,
    string Actor
);

public record PruneResult(
    bool Success,
    string Message,
    long BytesFreed,
    int InstancesAffected
);

public interface IPruneExecutionService
{
    Task<PruneResult> ExecutePruneAsync(PruneCommand command, CancellationToken ct = default);
}
