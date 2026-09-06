using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Dapper;

namespace Curatarr.Infrastructure.Repositories;

public class AuditRepository : IAuditRepository
{
    private readonly SqliteConnectionFactory _factory;

    public AuditRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task AddAsync(AuditLogEntry entry, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            INSERT INTO audit_logs (id, media_item_id, title, media_type, season_number, instances_affected_json, bytes_freed, added_to_import_exclusion, actor, executed_at, details)
            VALUES (@Id, @MediaItemId, @Title, @MediaType, @SeasonNumber, @InstancesAffectedJson, @BytesFreed, @AddedToImportExclusion, @Actor, @ExecutedAt, @Details);";

        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            entry.Id,
            entry.MediaItemId,
            entry.Title,
            entry.MediaType,
            entry.SeasonNumber,
            entry.InstancesAffectedJson,
            entry.BytesFreed,
            AddedToImportExclusion = entry.AddedToImportExclusion ? 1 : 0,
            entry.Actor,
            ExecutedAt = entry.ExecutedAt.ToString("o"),
            entry.Details
        }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<AuditLogEntry>> GetRecentAsync(int limit = 100, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id, media_item_id as MediaItemId, title, media_type as MediaType, 
                   season_number as SeasonNumber, instances_affected_json as InstancesAffectedJson, 
                   bytes_freed as BytesFreed, added_to_import_exclusion as AddedToImportExclusion, 
                   actor, executed_at as ExecutedAt, details
            FROM audit_logs
            ORDER BY executed_at DESC
            LIMIT @Limit;";

        var results = await conn.QueryAsync<AuditLogEntry>(new CommandDefinition(sql, new { Limit = limit }, cancellationToken: ct));
        return results.ToList();
    }

    public async Task<long> GetTotalBytesFreedAsync(CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "SELECT COALESCE(SUM(bytes_freed), 0) FROM audit_logs;";
        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(sql, cancellationToken: ct));
    }
}
