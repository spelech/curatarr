using Curatarr.Core.Repositories;
using Curatarr.Core.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Curatarr.Infrastructure.Services;

public class CatalogSyncWorker : BackgroundService
{
    private readonly ICatalogSyncService _syncService;
    private readonly ISettingsRepository _settingsRepo;
    private readonly ILogger<CatalogSyncWorker> _logger;

    public CatalogSyncWorker(
        ICatalogSyncService syncService,
        ISettingsRepository settingsRepo,
        ILogger<CatalogSyncWorker> logger)
    {
        _syncService = syncService;
        _settingsRepo = settingsRepo;
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

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var settings = await _settingsRepo.GetSettingsAsync(stoppingToken);
                var intervalHours = Math.Clamp(settings.SyncIntervalHours, 1, 168);
                await Task.Delay(TimeSpan.FromHours(intervalHours), stoppingToken);

                _logger.LogInformation("Triggering scheduled catalog synchronization (configured interval: {Hours}h)...", intervalHours);
                await _syncService.TriggerSyncAsync(fullSync: false, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during scheduled catalog sync.");
                try
                {
                    // Delay before retry so we do not hot-loop on persistent errors
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
            }
        }
    }
}
