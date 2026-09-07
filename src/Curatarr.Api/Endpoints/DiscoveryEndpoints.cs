using Curatarr.Core.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Curatarr.Api.Endpoints;

public static class DiscoveryEndpoints
{
    public static IEndpointRouteBuilder MapDiscoveryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/discovery").WithTags("Discovery");

        group.MapGet("/", async (IServiceDiscoveryService discoveryService, CancellationToken ct) =>
        {
            var services = await discoveryService.DiscoverServicesAsync(ct);
            return Results.Ok(services);
        });

        return app;
    }
}
