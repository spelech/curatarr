using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Dapper;

namespace Curatarr.Infrastructure.Repositories;

public class ConnectionRepository : IConnectionRepository
{
    private readonly SqliteConnectionFactory _factory;

    public ConnectionRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<IReadOnlyList<ServiceConnection>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id, connection_type as ConnectionType, name, base_url as BaseUrl, 
                   api_key as ApiKey, tier_tag as TierTag, is_enabled as IsEnabled, 
                   last_sync_at as LastSyncAt, last_status as LastStatus, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM service_connections
            ORDER BY name ASC;";
        var results = await conn.QueryAsync<ServiceConnection>(new CommandDefinition(sql, cancellationToken: ct));
        return results.ToList();
    }

    public async Task<ServiceConnection?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id, connection_type as ConnectionType, name, base_url as BaseUrl, 
                   api_key as ApiKey, tier_tag as TierTag, is_enabled as IsEnabled, 
                   last_sync_at as LastSyncAt, last_status as LastStatus, 
                   created_at as CreatedAt, updated_at as UpdatedAt
            FROM service_connections
            WHERE id = @Id;";
        return await conn.QuerySingleOrDefaultAsync<ServiceConnection>(new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
    }

    public async Task UpsertAsync(ServiceConnection connection, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            INSERT INTO service_connections (id, connection_type, name, base_url, api_key, tier_tag, is_enabled, last_sync_at, last_status, created_at, updated_at)
            VALUES (@Id, @ConnectionType, @Name, @BaseUrl, @ApiKey, @TierTag, @IsEnabled, @LastSyncAt, @LastStatus, @CreatedAt, @UpdatedAt)
            ON CONFLICT(id) DO UPDATE SET
                connection_type = excluded.connection_type,
                name = excluded.name,
                base_url = excluded.base_url,
                api_key = excluded.api_key,
                tier_tag = excluded.tier_tag,
                is_enabled = excluded.is_enabled,
                last_sync_at = excluded.last_sync_at,
                last_status = excluded.last_status,
                updated_at = excluded.updated_at;";
        
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            connection.Id,
            ConnectionType = (int)connection.ConnectionType,
            connection.Name,
            connection.BaseUrl,
            connection.ApiKey,
            connection.TierTag,
            connection.IsEnabled,
            LastSyncAt = connection.LastSyncAt?.ToString("o"),
            connection.LastStatus,
            CreatedAt = connection.CreatedAt.ToString("o"),
            UpdatedAt = connection.UpdatedAt.ToString("o")
        }, cancellationToken: ct));
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "DELETE FROM service_connections WHERE id = @Id;";
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
    }
}
