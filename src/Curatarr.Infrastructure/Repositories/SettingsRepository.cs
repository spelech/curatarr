using System.Text.Json;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Dapper;

namespace Curatarr.Infrastructure.Repositories;

public class SettingsRepository : ISettingsRepository
{
    private const string SettingsKey = "curatarr_thresholds";
    private readonly SqliteConnectionFactory _factory;

    public SettingsRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<CuratarrSettings> GetSettingsAsync(CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "SELECT value FROM settings WHERE key = @Key LIMIT 1;";
        var json = await conn.QuerySingleOrDefaultAsync<string>(new CommandDefinition(sql, new { Key = SettingsKey }, cancellationToken: ct));

        if (string.IsNullOrWhiteSpace(json))
        {
            return new CuratarrSettings();
        }

        try
        {
            return JsonSerializer.Deserialize<CuratarrSettings>(json) ?? new CuratarrSettings();
        }
        catch
        {
            return new CuratarrSettings();
        }
    }

    public async Task SaveSettingsAsync(CuratarrSettings settings, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        var json = JsonSerializer.Serialize(settings);
        const string sql = @"
            INSERT INTO settings (key, value, updated_at)
            VALUES (@Key, @Value, @UpdatedAt)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at;";

        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Key = SettingsKey,
            Value = json,
            UpdatedAt = DateTime.UtcNow.ToString("o")
        }, cancellationToken: ct));
    }
}
