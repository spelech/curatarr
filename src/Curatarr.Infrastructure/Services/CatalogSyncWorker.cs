using Curatarr.Core.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Curatarr.Infrastructure.Services;

public class CatalogSyncWorker : BackgroundService
{
    private readonly ICatalogSyncService _syncService;
    private readonly ILogger<CatalogSyncWorker> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromHours(1);

    public CatalogSyncWorker(ICatalogSyncService syncService, ILogger<CatalogSyncWorker> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Curatarr Catalog Sync Worker started.");

        // Initial brief delay before starting first background sync
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            await _syncService.TriggerSyncAsync(fullSync: false, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during initial catalog sync.");
        }

        using var timer = new PeriodicTimer(_interval);
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                _logger.LogInformation("Triggering scheduled catalog synchronization...");
                await _syncService.TriggerSyncAsync(fullSync: false, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during scheduled catalog sync.");
            }
        }
    }
}
