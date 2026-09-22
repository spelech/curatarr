namespace Curatarr.Core.Models;

public enum UserRole
{
    Admin,
    Guest
}

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string PlexId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? ThumbUrl { get; set; }
    public UserRole Role { get; set; } = UserRole.Guest;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
