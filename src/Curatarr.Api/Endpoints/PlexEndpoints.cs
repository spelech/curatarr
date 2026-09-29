using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Api.Endpoints;

public static class PlexEndpoints
{
    public static void MapPlexEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/plex");

        // 1. Get Discovered Servers (Admin Only)
        group.MapGet("/servers", async (
            string? token,
            IPlexAuthService authService,
            ISettingsRepository settingsRepo,
            IConnectionRepository connRepo,
            CancellationToken ct) =>
        {
            var settings = await settingsRepo.GetSettingsAsync(ct);
            var servers = await authService.GetDiscoveredServersAsync(token, ct);
            var connections = await connRepo.GetAllAsync(ct);
            var plexConn = connections.FirstOrDefault(c => c.ConnectionType == ConnectionType.Plex && !string.IsNullOrWhiteSpace(c.ApiKey));
            var hasAdminToken = !string.IsNullOrWhiteSpace(token) ||
                                !string.IsNullOrWhiteSpace(settings.PlexAuthToken) ||
                                plexConn != null;

            return Results.Ok(new
            {
                hasAdminToken,
                servers
            });
        }).RequireCuratarrRole(UserRole.Admin);

        // 2. Bind Plex Media Server (Admin Only)
        group.MapPost("/bind", async (
            BindPlexServerRequest req,
            IConnectionRepository connRepo,
            ISettingsRepository settingsRepo,
            IConnectionTester tester,
            IPlexAuthService authService,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(req.BaseUrl) || string.IsNullOrWhiteSpace(req.ApiKey))
            {
                return Results.BadRequest(new { error = "BaseUrl and ApiKey are required to connect to Plex." });
            }

            var cleanUrl = req.BaseUrl.Trim().TrimEnd('/');
            var serverName = string.IsNullOrWhiteSpace(req.Name) ? "Plex Media Server" : req.Name.Trim();
            var machineId = req.MachineIdentifier?.Trim() ?? string.Empty;

            // Existing Plex connections
            var existing = await connRepo.GetAllAsync(ct);
            var plexConn = existing.FirstOrDefault(c => c.ConnectionType == ConnectionType.Plex) ?? new ServiceConnection
            {
                Id = Guid.NewGuid().ToString("N"),
                ConnectionType = ConnectionType.Plex,
                CreatedAt = DateTime.UtcNow
            };

            plexConn.Name = serverName;
            plexConn.BaseUrl = cleanUrl;
            plexConn.ApiKey = req.ApiKey.Trim();
            plexConn.IsEnabled = true;
            plexConn.UpdatedAt = DateTime.UtcNow;

            // If machineId is empty, try to fetch it automatically from the connection
            if (string.IsNullOrWhiteSpace(machineId))
            {
                machineId = await authService.FetchMachineIdentifierAsync(plexConn, ct) ?? string.Empty;
            }

            // Test connectivity
            var testResult = await tester.TestAsync(plexConn, ct);
            if (!testResult.Success)
            {
                plexConn.LastStatus = $"Warning: {testResult.Message}";
            }
            else
            {
                plexConn.LastStatus = "Connected";
            }

            await connRepo.UpsertAsync(plexConn, ct);

            // Update settings with bound server details
            var settings = await settingsRepo.GetSettingsAsync(ct);
            var updated = settings with
            {
                PlexServerMachineId = machineId,
                PlexServerName = serverName,
                PlexAuthToken = string.IsNullOrWhiteSpace(settings.PlexAuthToken) ? req.ApiKey.Trim() : settings.PlexAuthToken
            };
            await settingsRepo.SaveSettingsAsync(updated, ct);

            return Results.Ok(new
            {
                success = true,
                testResult,
                serverName,
                machineIdentifier = machineId,
                connection = plexConn
            });
        }).RequireCuratarrRole(UserRole.Admin);

        // 3. Get Current Plex Binding Status
        group.MapGet("/status", async (
            IConnectionRepository connRepo,
            ISettingsRepository settingsRepo,
            IPlexAuthService authService,
            CancellationToken ct) =>
        {
            var settings = await settingsRepo.GetSettingsAsync(ct);
            var connections = await connRepo.GetAllAsync(ct);
            var plexConn = connections.FirstOrDefault(c => c.ConnectionType == ConnectionType.Plex && c.IsEnabled);

            // Auto-heal / migrate existing Plex connection if settings.PlexServerMachineId is not set
            if (plexConn != null && string.IsNullOrWhiteSpace(settings.PlexServerMachineId))
            {
                var machineId = await authService.FetchMachineIdentifierAsync(plexConn, ct);
                if (!string.IsNullOrWhiteSpace(machineId))
                {
                    settings = settings with
                    {
                        PlexServerMachineId = machineId,
                        PlexServerName = string.IsNullOrWhiteSpace(settings.PlexServerName) ? plexConn.Name : settings.PlexServerName,
                        PlexAuthToken = string.IsNullOrWhiteSpace(settings.PlexAuthToken) ? plexConn.ApiKey : settings.PlexAuthToken
                    };
                    await settingsRepo.SaveSettingsAsync(settings, ct);
                }
            }

            var isBound = (!string.IsNullOrWhiteSpace(settings.PlexServerMachineId) || plexConn != null) && plexConn != null;

            return Results.Ok(new
            {
                isBound,
                serverName = string.IsNullOrWhiteSpace(settings.PlexServerName) ? plexConn?.Name ?? "" : settings.PlexServerName,
                machineIdentifier = settings.PlexServerMachineId,
                hasAdminToken = !string.IsNullOrWhiteSpace(settings.PlexAuthToken) || !string.IsNullOrWhiteSpace(plexConn?.ApiKey),
                connection = plexConn != null ? new
                {
                    id = plexConn.Id,
                    name = plexConn.Name,
                    baseUrl = plexConn.BaseUrl,
                    isEnabled = plexConn.IsEnabled,
                    lastSyncAt = plexConn.LastSyncAt,
                    lastStatus = plexConn.LastStatus
                } : null
            });
        });
    }

    public record BindPlexServerRequest(
        string? MachineIdentifier,
        string? Name,
        string BaseUrl,
        string ApiKey
    );
}
