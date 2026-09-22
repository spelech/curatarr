using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Core.Services;

namespace Curatarr.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth");

        group.MapPost("/plex/pin", async (IPlexAuthService authService, CancellationToken ct) =>
        {
            try
            {
                var pin = await authService.CreatePinAsync(ct);
                return Results.Ok(pin);
            }
            catch (Exception ex)
            {
                return Results.Problem($"Failed to create Plex PIN: {ex.Message}");
            }
        });

        group.MapPost("/plex/claim", async (
            HttpContext context,
            IPlexAuthService authService,
            ClaimPinRequest req,
            CancellationToken ct) =>
        {
            try
            {
                var result = await authService.ClaimPinAsync(req.PinId, ct);
                if (result.Claimed && result.User != null && !string.IsNullOrEmpty(result.Token))
                {
                    context.Response.Cookies.Append("curatarr_session", result.Token, new CookieOptions
                    {
                        HttpOnly = true,
                        SameSite = SameSiteMode.Lax,
                        Secure = context.Request.IsHttps,
                        Expires = DateTimeOffset.UtcNow.AddDays(30),
                        Path = "/"
                    });

                    return Results.Ok(new
                    {
                        success = true,
                        user = new
                        {
                            id = result.User.Id,
                            plexId = result.User.PlexId,
                            username = result.User.Username,
                            email = result.User.Email,
                            thumbUrl = result.User.ThumbUrl,
                            role = result.User.Role.ToString()
                        },
                        token = result.Token
                    });
                }

                if (!string.IsNullOrEmpty(result.Error))
                {
                    return Results.BadRequest(new { success = false, error = result.Error });
                }

                return Results.Ok(new { success = false, status = "waiting" });
            }
            catch (Exception ex)
            {
                return Results.Problem($"Error claiming Plex PIN: {ex.Message}");
            }
        });

        group.MapGet("/me", async (
            HttpContext context,
            IPlexAuthService authService,
            ISettingsRepository settingsRepo,
            IUserRepository userRepo,
            CancellationToken ct) =>
        {
            var userCount = await userRepo.GetCountAsync(ct);
            var isInitialized = userCount > 0;
            var settings = await settingsRepo.GetSettingsAsync(ct);

            if (!settings.AuthEnabled || context.Request.Headers.ContainsKey("X-Curatarr-Bypass-Auth"))
            {
                return Results.Ok(new
                {
                    authenticated = true,
                    initialized = isInitialized,
                    authEnabled = false,
                    user = new
                    {
                        id = "local-admin",
                        plexId = "0",
                        username = "Local Admin",
                        role = "Admin",
                        thumbUrl = (string?)null
                    }
                });
            }

            string? token = null;
            if (context.Request.Cookies.TryGetValue("curatarr_session", out var cookieToken) && !string.IsNullOrWhiteSpace(cookieToken))
            {
                token = cookieToken;
            }
            else if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
            {
                var headerVal = authHeader.ToString();
                if (headerVal.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                {
                    token = headerVal["Bearer ".Length..].Trim();
                }
            }

            if (!string.IsNullOrWhiteSpace(token))
            {
                var secret = await authService.GetOrCreateSessionSecretAsync(ct);
                var session = authService.ValidateSessionToken(token, secret);
                if (session != null)
                {
                    return Results.Ok(new
                    {
                        authenticated = true,
                        initialized = isInitialized,
                        authEnabled = true,
                        user = new
                        {
                            id = session.UserId,
                            plexId = session.PlexId,
                            username = session.Username,
                            role = session.Role.ToString(),
                            thumbUrl = session.ThumbUrl
                        }
                    });
                }
            }

            return Results.Ok(new
            {
                authenticated = false,
                initialized = isInitialized,
                authEnabled = true,
                user = (object?)null
            });
        });

        group.MapPost("/logout", (HttpContext context) =>
        {
            context.Response.Cookies.Delete("curatarr_session", new CookieOptions
            {
                Path = "/"
            });
            return Results.Ok(new { success = true });
        });

        // User Management (Admin Only)
        group.MapGet("/users", async (
            HttpContext context,
            IPlexAuthService authService,
            ISettingsRepository settingsRepo,
            IUserRepository userRepo,
            CancellationToken ct) =>
        {
            var session = await ResolveSessionAsync(context, authService, settingsRepo, userRepo, ct);
            if (session == null || session.Role != UserRole.Admin)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            var users = await userRepo.GetAllAsync(ct);
            return Results.Ok(users.Select(u => new
            {
                id = u.Id,
                plexId = u.PlexId,
                username = u.Username,
                email = u.Email,
                thumbUrl = u.ThumbUrl,
                role = u.Role.ToString(),
                createdAt = u.CreatedAt,
                updatedAt = u.UpdatedAt
            }));
        });

        group.MapPut("/users/{id}/role", async (
            HttpContext context,
            IPlexAuthService authService,
            ISettingsRepository settingsRepo,
            IUserRepository userRepo,
            string id,
            UpdateUserRoleRequest req,
            CancellationToken ct) =>
        {
            var session = await ResolveSessionAsync(context, authService, settingsRepo, userRepo, ct);
            if (session == null || session.Role != UserRole.Admin)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            if (!Enum.TryParse<UserRole>(req.Role, true, out var newRole))
            {
                return Results.BadRequest(new { error = "Invalid role. Must be Admin or Guest" });
            }

            await userRepo.UpdateRoleAsync(id, newRole, ct);
            return Results.Ok(new { success = true });
        });

        group.MapDelete("/users/{id}", async (
            HttpContext context,
            IPlexAuthService authService,
            ISettingsRepository settingsRepo,
            IUserRepository userRepo,
            string id,
            CancellationToken ct) =>
        {
            var session = await ResolveSessionAsync(context, authService, settingsRepo, userRepo, ct);
            if (session == null || session.Role != UserRole.Admin)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            await userRepo.DeleteAsync(id, ct);
            return Results.Ok(new { success = true });
        });
    }

    public static async Task<UserSession?> ResolveSessionAsync(
        HttpContext context,
        IPlexAuthService authService,
        ISettingsRepository settingsRepo,
        IUserRepository userRepo,
        CancellationToken ct = default)
    {
        var settings = await settingsRepo.GetSettingsAsync(ct);
        if (!settings.AuthEnabled || context.Request.Headers.ContainsKey("X-Curatarr-Bypass-Auth"))
        {
            return new UserSession("local-admin", "0", "Local Admin", UserRole.Admin, null);
        }

        string? token = null;
        if (context.Request.Cookies.TryGetValue("curatarr_session", out var cookieToken) && !string.IsNullOrWhiteSpace(cookieToken))
        {
            token = cookieToken;
        }
        else if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
        {
            var headerVal = authHeader.ToString();
            if (headerVal.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                token = headerVal["Bearer ".Length..].Trim();
            }
        }

        if (!string.IsNullOrWhiteSpace(token))
        {
            var secret = await authService.GetOrCreateSessionSecretAsync(ct);
            var session = authService.ValidateSessionToken(token, secret);
            if (session != null) return session;
        }

        // If no users have been registered yet, allow initial setup as Admin
        var userCount = await userRepo.GetCountAsync(ct);
        if (userCount == 0)
        {
            return new UserSession("initial-admin", "0", "Setup Admin", UserRole.Admin, null);
        }

        return null;
    }

    public static RouteHandlerBuilder RequireCuratarrRole(this RouteHandlerBuilder builder, UserRole? requiredRole = null)
    {
        return builder.AddEndpointFilter(async (invocationContext, next) =>
        {
            var httpContext = invocationContext.HttpContext;
            var authService = httpContext.RequestServices.GetRequiredService<IPlexAuthService>();
            var settingsRepo = httpContext.RequestServices.GetRequiredService<ISettingsRepository>();
            var userRepo = httpContext.RequestServices.GetRequiredService<IUserRepository>();

            var session = await ResolveSessionAsync(httpContext, authService, settingsRepo, userRepo, httpContext.RequestAborted);
            if (session == null)
            {
                return Results.Unauthorized();
            }

            if (requiredRole == UserRole.Admin && session.Role != UserRole.Admin)
            {
                return Results.StatusCode(StatusCodes.Status403Forbidden);
            }

            httpContext.Items["CuratarrUser"] = session;
            return await next(invocationContext);
        });
    }

    public record ClaimPinRequest(int PinId);
    public record UpdateUserRoleRequest(string Role);
}
