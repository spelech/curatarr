namespace Curatarr.Core.Models;

public enum MediaType
{
    Movie,
    Series
}

public class MediaItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public MediaType MediaType { get; set; }
    public string Title { get; set; } = string.Empty;
    public string SortTitle { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? TmdbId { get; set; }
    public string? TvdbId { get; set; }
    public string? ImdbId { get; set; }
    public int? PlexRatingKey { get; set; }
    public string? PosterUrl { get; set; }
    public DateTime? AddedAt { get; set; }
    public long TotalSizeBytes { get; set; }
    public bool IsProtected { get; set; }
    public string? ProtectionReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<MediaInstance> Instances { get; set; } = [];
    public List<Season> Seasons { get; set; } = [];
    public List<WatchStat> WatchStats { get; set; } = [];
}

public class MediaInstance
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string MediaItemId { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public int ExternalId { get; set; }
    public string? QualityProfileName { get; set; }
    public string? Resolution { get; set; }
    public bool CutoffUnmet { get; set; }
    public bool IsMonitored { get; set; } = true;
    public string? DiskPath { get; set; }
    public long SizeBytes { get; set; }
    public bool HasFile { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Season
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string MediaItemId { get; set; } = string.Empty;
    public int SeasonNumber { get; set; }
    public bool IsMonitored { get; set; } = true;
    public int EpisodeCount { get; set; }
    public int EpisodeFileCount { get; set; }
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class WatchStat
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string MediaItemId { get; set; } = string.Empty;
    public int? SeasonNumber { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public int PlayCount { get; set; }
    public DateTime? LastPlayedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
