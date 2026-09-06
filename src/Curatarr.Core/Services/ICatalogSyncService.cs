namespace Curatarr.Core.Services;

public record SyncProgress(string Status, int TotalProcessed, bool IsRunning, DateTime? LastCompletedAt, string? LastError);

public interface ICatalogSyncService
{
    Task TriggerSyncAsync(bool fullSync = false, CancellationToken ct = default);
    SyncProgress GetCurrentProgress();
}
