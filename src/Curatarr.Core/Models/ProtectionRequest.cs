namespace Curatarr.Core.Models;

public class ProtectionRequest
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string MediaItemId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? UserThumb { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PendingProtectionRequestDto
{
    public string Id { get; set; } = string.Empty;
    public string MediaItemId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? PosterUrl { get; set; }
    public MediaType MediaType { get; set; }
    public long TotalSizeBytes { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? UserThumb { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
}
