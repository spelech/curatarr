using Curatarr.Core.Adapters;
using Curatarr.Core.Models;
using Curatarr.Core.Repositories;

namespace Curatarr.Api.Endpoints;

public static class ConnectionEndpoints
{
    public static void MapConnectionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/connections");

        group.MapGet("/", async (IConnectionRepository repo, CancellationToken ct) =>
        {
            var connections = await repo.GetAllAsync(ct);
            return Results.Ok(connections);
        });

        group.MapPost("/", async (IConnectionRepository repo, ServiceConnection connection, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(connection.Id))
            {
                connection.Id = Guid.NewGuid().ToString("N");
            }
            connection.UpdatedAt = DateTime.UtcNow;
            await repo.UpsertAsync(connection, ct);
            return Results.Ok(connection);
        });

        group.MapDelete("/{id}", async (IConnectionRepository repo, string id, CancellationToken ct) =>
        {
            await repo.DeleteAsync(id, ct);
            return Results.Ok(new { success = true });
        });

        group.MapPost("/test", async (IConnectionTester tester, ServiceConnection connection, CancellationToken ct) =>
        {
            var result = await tester.TestAsync(connection, ct);
            return Results.Ok(result);
        });
    }
}
