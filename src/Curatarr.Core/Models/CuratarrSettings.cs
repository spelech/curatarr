namespace Curatarr.Core.Models;

public record CuratarrSettings
{
    // Space Hogs thresholds (stored in bytes, exposed in GB)
    public long MovieSpaceHogThresholdBytes { get; init; } = 20L * 1024 * 1024 * 1024; // 20 GB default
    public long Movie4kSpaceHogThresholdBytes { get; init; } = 50L * 1024 * 1024 * 1024; // 50 GB default for 4K movies
    public long SeriesEpisodeSpaceHogThresholdBytes { get; init; } = (long)(2.5 * 1024 * 1024 * 1024); // 2.5 GB / episode default

    // Stale & Abandoned thresholds
    public int StaleDays { get; init; } = 180;
    public int AbandonedDays { get; init; } = 90;

    // Background Sync schedule & pagination defaults
    public int SyncIntervalHours { get; init; } = 1;
    public int CatalogBatchSize { get; init; } = 50;

    // Helper conversion properties for API serialization
    public double MovieSpaceHogGb
    {
        get => Math.Round((double)MovieSpaceHogThresholdBytes / (1024 * 1024 * 1024), 1);
        init => MovieSpaceHogThresholdBytes = (long)(value * 1024 * 1024 * 1024);
    }

    public double Movie4kSpaceHogGb
    {
        get => Math.Round((double)Movie4kSpaceHogThresholdBytes / (1024 * 1024 * 1024), 1);
        init => Movie4kSpaceHogThresholdBytes = (long)(value * 1024 * 1024 * 1024);
    }

    public double SeriesEpisodeSpaceHogGb
    {
        get => Math.Round((double)SeriesEpisodeSpaceHogThresholdBytes / (1024 * 1024 * 1024), 2);
        init => SeriesEpisodeSpaceHogThresholdBytes = (long)(value * 1024 * 1024 * 1024);
    }
}
