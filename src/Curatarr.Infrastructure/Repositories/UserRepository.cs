using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Dapper;

namespace Curatarr.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly SqliteConnectionFactory _factory;

    public UserRepository(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    private class UserEntity
    {
        public string Id { get; set; } = string.Empty;
        public string PlexId { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? ThumbUrl { get; set; }
        public string Role { get; set; } = "Guest";
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public User ToModel() => new()
        {
            Id = Id,
            PlexId = PlexId,
            Username = Username,
            Email = Email,
            ThumbUrl = ThumbUrl,
            Role = Enum.TryParse<UserRole>(Role, true, out var r) ? r : UserRole.Guest,
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }

    public async Task<User?> GetByIdAsync(string id, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id as Id, plex_id as PlexId, username as Username, email as Email, 
                   thumb_url as ThumbUrl, role as Role, created_at as CreatedAt, updated_at as UpdatedAt
            FROM users
            WHERE id = @Id;";
        var entity = await conn.QuerySingleOrDefaultAsync<UserEntity>(new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
        return entity?.ToModel();
    }

    public async Task<User?> GetByPlexIdAsync(string plexId, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id as Id, plex_id as PlexId, username as Username, email as Email, 
                   thumb_url as ThumbUrl, role as Role, created_at as CreatedAt, updated_at as UpdatedAt
            FROM users
            WHERE plex_id = @PlexId;";
        var entity = await conn.QuerySingleOrDefaultAsync<UserEntity>(new CommandDefinition(sql, new { PlexId = plexId }, cancellationToken: ct));
        return entity?.ToModel();
    }

    public async Task<User?> GetByUsernameAsync(string username, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id as Id, plex_id as PlexId, username as Username, email as Email, 
                   thumb_url as ThumbUrl, role as Role, created_at as CreatedAt, updated_at as UpdatedAt
            FROM users
            WHERE LOWER(username) = LOWER(@Username);";
        var entity = await conn.QuerySingleOrDefaultAsync<UserEntity>(new CommandDefinition(sql, new { Username = username }, cancellationToken: ct));
        return entity?.ToModel();
    }

    public async Task<IReadOnlyList<User>> GetAllAsync(CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            SELECT id as Id, plex_id as PlexId, username as Username, email as Email, 
                   thumb_url as ThumbUrl, role as Role, created_at as CreatedAt, updated_at as UpdatedAt
            FROM users
            ORDER BY created_at ASC;";
        var entities = await conn.QueryAsync<UserEntity>(new CommandDefinition(sql, cancellationToken: ct));
        return entities.Select(e => e.ToModel()).ToList();
    }

    public async Task<int> GetCountAsync(CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "SELECT COUNT(*) FROM users;";
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql, cancellationToken: ct));
    }

    public async Task UpsertAsync(User user, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            INSERT INTO users (id, plex_id, username, email, thumb_url, role, created_at, updated_at)
            VALUES (@Id, @PlexId, @Username, @Email, @ThumbUrl, @Role, @CreatedAt, @UpdatedAt)
            ON CONFLICT(id) DO UPDATE SET
                plex_id = excluded.plex_id,
                username = excluded.username,
                email = excluded.email,
                thumb_url = excluded.thumb_url,
                role = excluded.role,
                updated_at = excluded.updated_at
            ON CONFLICT(plex_id) DO UPDATE SET
                username = excluded.username,
                email = excluded.email,
                thumb_url = excluded.thumb_url,
                role = excluded.role,
                updated_at = excluded.updated_at;";

        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            user.Id,
            user.PlexId,
            user.Username,
            user.Email,
            user.ThumbUrl,
            Role = user.Role.ToString(),
            CreatedAt = user.CreatedAt.ToString("o"),
            UpdatedAt = user.UpdatedAt.ToString("o")
        }, cancellationToken: ct));
    }

    public async Task UpdateRoleAsync(string id, UserRole role, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = @"
            UPDATE users 
            SET role = @Role, updated_at = @UpdatedAt
            WHERE id = @Id;";
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            Id = id,
            Role = role.ToString(),
            UpdatedAt = DateTime.UtcNow.ToString("o")
        }, cancellationToken: ct));
    }

    public async Task DeleteAsync(string id, CancellationToken ct = default)
    {
        using var conn = _factory.CreateConnection();
        const string sql = "DELETE FROM users WHERE id = @Id;";
        await conn.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: ct));
    }
}
