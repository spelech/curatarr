using Curatarr.Core.Models;
using Curatarr.Core.Repositories;
using Curatarr.Infrastructure.Data;
using Curatarr.Infrastructure.Repositories;
using Curatarr.Infrastructure.Services;
using FluentAssertions;

namespace Curatarr.Tests;

public class SettingsAndThresholdTests : IDisposable
{
    private readonly string _dbPath;
    private readonly SqliteConnectionFactory _factory;
    private readonly DatabaseInitializer _initializer;
    private readonly ISettingsRepository _settingsRepo;
    private readonly IMediaRepository _mediaRepo;
    private readonly SmartCategoryEngine _categoryEngine;

    public SettingsAndThresholdTests()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"curatarr_settings_{Guid.NewGuid():N}.db");
        _factory = new SqliteConnectionFactory($"Data Source={_dbPath}");
        _initializer = new DatabaseInitializer(_factory);
        _settingsRepo = new SettingsRepository(_factory);
        _mediaRepo = new MediaRepository(_factory, _settingsRepo);
        _categoryEngine = new SmartCategoryEngine(_factory, _settingsRepo);
    }

    public void Dispose()
    {
        if (File.Exists(_dbPath))
        {
            try { File.Delete(_dbPath); } catch { /* best effort */ }
        }
    }

    [Fact]
    public async Task SettingsRepository_ShouldReturnDefaultsAndPersistUpdates()
    {
        await _initializer.InitializeAsync();

        // Default settings
        var defaults = await _settingsRepo.GetSettingsAsync();
        defaults.MovieSpaceHogGb.Should().Be(20.0);
        defaults.Movie4kSpaceHogGb.Should().Be(50.0);
        defaults.SeriesEpisodeSpaceHogGb.Should().Be(2.5);
        defaults.StaleDays.Should().Be(180);
        defaults.AbandonedDays.Should().Be(90);
        defaults.NeverWatchedMinAgeDays.Should().Be(60);
        defaults.SyncIntervalHours.Should().Be(1);
        defaults.CatalogBatchSize.Should().Be(50);

        // Update settings
        var updated = defaults with
        {
            MovieSpaceHogGb = 30.0,
            Movie4kSpaceHogGb = 60.0,
            SeriesEpisodeSpaceHogGb = 4.0,
            StaleDays = 365,
            AbandonedDays = 120,
            NeverWatchedMinAgeDays = 90,
            SyncIntervalHours = 4,
            CatalogBatchSize = 100
        };
        await _settingsRepo.SaveSettingsAsync(updated);

        // Retrieve saved settings
        var reloaded = await _settingsRepo.GetSettingsAsync();
        reloaded.MovieSpaceHogGb.Should().Be(30.0);
        reloaded.Movie4kSpaceHogGb.Should().Be(60.0);
        reloaded.SeriesEpisodeSpaceHogGb.Should().Be(4.0);
        reloaded.StaleDays.Should().Be(365);
        reloaded.AbandonedDays.Should().Be(120);
        reloaded.NeverWatchedMinAgeDays.Should().Be(90);
        reloaded.SyncIntervalHours.Should().Be(4);
        reloaded.CatalogBatchSize.Should().Be(100);
    }

    [Fact]
    public async Task SpaceHogs_ShouldUsePerEpisodeSizeForSeriesAndResolutionAwareThresholdsForMovies()
    {
        await _initializer.InitializeAsync();

        // 1. Series with 20 GB across 100 episodes (0.2 GB/ep) -> NOT a Space Hog
        var lightweightSeries = new MediaItem
        {
            Id = "series-cartoon",
            MediaType = MediaType.Series,
            Title = "Cartoons",
            SortTitle = "Cartoons",
            TotalSizeBytes = 20L * 1024 * 1024 * 1024, // 20 GB
            Seasons =
            [
                new Season { Id = "s1", SeasonNumber = 1, EpisodeCount = 100, EpisodeFileCount = 100, SizeBytes = 20L * 1024 * 1024 * 1024 }
            ]
        };

        // 2. Series with 20 GB across 4 episodes (5.0 GB/ep) -> IS a Space Hog (exceeds default 2.5 GB/ep)
        var heavyMiniSeries = new MediaItem
        {
            Id = "series-heavy",
            MediaType = MediaType.Series,
            Title = "4K Docuseries",
            SortTitle = "4K Docuseries",
            TotalSizeBytes = 20L * 1024 * 1024 * 1024, // 20 GB
            Seasons =
            [
                new Season { Id = "s2", SeasonNumber = 1, EpisodeCount = 4, EpisodeFileCount = 4, SizeBytes = 20L * 1024 * 1024 * 1024 }
            ]
        };

        // 3. 1080p Movie with 25 GB (exceeds default 20 GB movie threshold) -> IS a Space Hog
        var heavy1080pMovie = new MediaItem
        {
            Id = "movie-1080p-heavy",
            MediaType = MediaType.Movie,
            Title = "1080p Remux",
            SortTitle = "1080p Remux",
            TotalSizeBytes = 25L * 1024 * 1024 * 1024,
            Instances =
            [
                new MediaInstance { Id = "inst-1", ConnectionId = "conn-1", ExternalId = 1, Resolution = "1080p", SizeBytes = 25L * 1024 * 1024 * 1024 }
            ]
        };

        // 4. 4K Movie with 35 GB (under default 50 GB 4K threshold) -> NOT a Space Hog
        var normal4kMovie = new MediaItem
        {
            Id = "movie-4k-normal",
            MediaType = MediaType.Movie,
            Title = "Normal 4K Movie",
            SortTitle = "Normal 4K Movie",
            TotalSizeBytes = 35L * 1024 * 1024 * 1024,
            Instances =
            [
                new MediaInstance { Id = "inst-2", ConnectionId = "conn-2", ExternalId = 2, Resolution = "4K", SizeBytes = 35L * 1024 * 1024 * 1024 }
            ]
        };

        await _mediaRepo.UpsertBatchAsync([lightweightSeries, heavyMiniSeries, heavy1080pMovie, normal4kMovie]);

        // Summaries evaluation
        var summaries = await _categoryEngine.GetSummariesAsync(null);
        var spaceSummary = summaries.First(s => s.CategoryId == SmartCategoryIds.SpaceHogs);

        // Expected Space Hogs: heavyMiniSeries (20 GB) + heavy1080pMovie (25 GB) = 2 items, 45 GB
        spaceSummary.Count.Should().Be(2);

        // Paged items evaluation
        var spaceItems = await _mediaRepo.GetPagedAsync(new MediaFilterOptions(CategoryId: SmartCategoryIds.SpaceHogs));
        spaceItems.Should().HaveCount(2);
        spaceItems.Select(x => x.Id).Should().BeEquivalentTo(new[] { "series-heavy", "movie-1080p-heavy" });
    }

    [Fact]
    public async Task NeverWatched_ShouldRespectMinAgeDaysThresholdAndExcludeRecentlyAddedTitles()
    {
        await _initializer.InitializeAsync();

        // 1. Movie added 90 days ago with 0 plays -> SHOULD be in Never Watched (exceeds default 60d threshold)
        var oldUnwatchedMovie = new MediaItem
        {
            Id = "movie-old-unwatched",
            MediaType = MediaType.Movie,
            Title = "Old Unwatched Movie",
            SortTitle = "Old Unwatched Movie",
            AddedAt = DateTime.UtcNow.AddDays(-90),
            TotalSizeBytes = 10L * 1024 * 1024 * 1024
        };

        // 2. Movie added 10 days ago with 0 plays -> SHOULD NOT be in Never Watched (recently added)
        var newUnwatchedMovie = new MediaItem
        {
            Id = "movie-new-unwatched",
            MediaType = MediaType.Movie,
            Title = "Fresh Download Movie",
            SortTitle = "Fresh Download Movie",
            AddedAt = DateTime.UtcNow.AddDays(-10),
            TotalSizeBytes = 8L * 1024 * 1024 * 1024
        };

        // 3. Movie added 90 days ago but has watch stats -> SHOULD NOT be in Never Watched
        var oldWatchedMovie = new MediaItem
        {
            Id = "movie-old-watched",
            MediaType = MediaType.Movie,
            Title = "Old Watched Movie",
            SortTitle = "Old Watched Movie",
            AddedAt = DateTime.UtcNow.AddDays(-90),
            TotalSizeBytes = 12L * 1024 * 1024 * 1024,
            WatchStats =
            [
                new WatchStat
                {
                    Id = "ws-1",
                    MediaItemId = "movie-old-watched",
                    UserId = "user-1",
                    Username = "steve",
                    PlayCount = 2,
                    LastPlayedAt = DateTime.UtcNow.AddDays(-20)
                }
            ]
        };

        await _mediaRepo.UpsertBatchAsync([oldUnwatchedMovie, newUnwatchedMovie, oldWatchedMovie]);

        // Summaries evaluation
        var summaries = await _categoryEngine.GetSummariesAsync(null);
        var neverSummary = summaries.First(s => s.CategoryId == SmartCategoryIds.NeverWatched);

        // Expected: only oldUnwatchedMovie (1 item, 10 GB)
        neverSummary.Count.Should().Be(1);
        neverSummary.ReclaimableSizeBytes.Should().Be(10L * 1024 * 1024 * 1024);
        neverSummary.Name.Should().Be("Never Watched (>60d)");

        // Paged items evaluation
        var neverItems = await _mediaRepo.GetPagedAsync(new MediaFilterOptions(CategoryId: SmartCategoryIds.NeverWatched));
        neverItems.Should().HaveCount(1);
        neverItems[0].Id.Should().Be("movie-old-unwatched");
    }

    [Fact]
    public async Task Sub720p_ShouldRespectCutoffYearAndIncludeMultiInstanceItems()
    {
        await _initializer.InitializeAsync();

        // 1. Classic movie from 1985 with SD copy (1.5 GB) -> Below cutoff (2000), should NOT be surfaced
        var classicSdMovie = new MediaItem
        {
            Id = "movie-classic-sd",
            MediaType = MediaType.Movie,
            Title = "Back to the Future SD",
            SortTitle = "Back to the Future SD",
            Year = 1985,
            TotalSizeBytes = 1500000000L,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-classic-sd",
                    MediaItemId = "movie-classic-sd",
                    ConnectionId = "radarr-1",
                    ExternalId = 1,
                    Resolution = "SD",
                    HasFile = true,
                    SizeBytes = 1500000000L
                }
            ]
        };

        // 2. Modern movie from 2021 with SD copy (2 GB) -> >= 2000, SHOULD be surfaced
        var modernSdMovie = new MediaItem
        {
            Id = "movie-modern-sd",
            MediaType = MediaType.Movie,
            Title = "Modern Film SD",
            SortTitle = "Modern Film SD",
            Year = 2021,
            TotalSizeBytes = 2000000000L,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-modern-sd",
                    MediaItemId = "movie-modern-sd",
                    ConnectionId = "radarr-1",
                    ExternalId = 2,
                    Resolution = "SD",
                    HasFile = true,
                    SizeBytes = 2000000000L
                }
            ]
        };

        // 3. Modern movie from 2018 with dual instances: 4K (40 GB) AND SD (1.8 GB) -> SHOULD be surfaced, reclaimable size = 1.8 GB
        var dualInstanceMovie = new MediaItem
        {
            Id = "movie-dual-4k-sd",
            MediaType = MediaType.Movie,
            Title = "Dual Copy Movie",
            SortTitle = "Dual Copy Movie",
            Year = 2018,
            TotalSizeBytes = 41800000000L,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-dual-4k",
                    MediaItemId = "movie-dual-4k-sd",
                    ConnectionId = "radarr-4k",
                    ExternalId = 3,
                    Resolution = "4K",
                    HasFile = true,
                    SizeBytes = 40000000000L
                },
                new MediaInstance
                {
                    Id = "inst-dual-sd",
                    MediaItemId = "movie-dual-4k-sd",
                    ConnectionId = "radarr-sd",
                    ExternalId = 4,
                    Resolution = "SD",
                    HasFile = true,
                    SizeBytes = 1800000000L
                }
            ]
        };

        // 4. Modern movie from 2022 with 1080p only (8 GB) -> Should NOT be in Sub-720p
        var hdOnlyMovie = new MediaItem
        {
            Id = "movie-hd-only",
            MediaType = MediaType.Movie,
            Title = "HD Only Movie",
            SortTitle = "HD Only Movie",
            Year = 2022,
            TotalSizeBytes = 8000000000L,
            Instances =
            [
                new MediaInstance
                {
                    Id = "inst-hd",
                    MediaItemId = "movie-hd-only",
                    ConnectionId = "radarr-1",
                    ExternalId = 5,
                    Resolution = "1080p",
                    HasFile = true,
                    SizeBytes = 8000000000L
                }
            ]
        };

        await _mediaRepo.UpsertBatchAsync([classicSdMovie, modernSdMovie, dualInstanceMovie, hdOnlyMovie]);

        // Default cutoff year: 2000
        var summaries = await _categoryEngine.GetSummariesAsync(null);
        var subSummary = summaries.First(s => s.CategoryId == SmartCategoryIds.Sub720p);

        // Expected: modernSdMovie (2GB) + dualInstanceMovie (1.8GB SD instance) = 2 items, 3.8 GB reclaimable
        subSummary.Count.Should().Be(2);
        subSummary.ReclaimableSizeBytes.Should().Be(3800000000L);
        subSummary.Name.Should().Be("Sub-720p (>=2000)");

        // Verify paged query
        var subItems = await _mediaRepo.GetPagedAsync(new MediaFilterOptions(CategoryId: SmartCategoryIds.Sub720p));
        subItems.Should().HaveCount(2);
        subItems.Select(x => x.Id).Should().Contain(["movie-modern-sd", "movie-dual-4k-sd"]);
        subItems.Select(x => x.Id).Should().NotContain("movie-classic-sd");
        subItems.Select(x => x.Id).Should().NotContain("movie-hd-only");

        // Change cutoff year to 0 (all SD included)
        var settings = await _settingsRepo.GetSettingsAsync();
        await _settingsRepo.SaveSettingsAsync(settings with { Sub720pCutoffYear = 0 });

        var summariesAll = await _categoryEngine.GetSummariesAsync(null);
        var subSummaryAll = summariesAll.First(s => s.CategoryId == SmartCategoryIds.Sub720p);
        subSummaryAll.Count.Should().Be(3);
        subSummaryAll.ReclaimableSizeBytes.Should().Be(1500000000L + 2000000000L + 1800000000L);
        subSummaryAll.Name.Should().Be("Sub-720p");
    }
}
