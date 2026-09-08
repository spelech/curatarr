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

        // Update settings
        var updated = defaults with
        {
            MovieSpaceHogGb = 30.0,
            Movie4kSpaceHogGb = 60.0,
            SeriesEpisodeSpaceHogGb = 4.0,
            StaleDays = 365,
            AbandonedDays = 120
        };
        await _settingsRepo.SaveSettingsAsync(updated);

        // Retrieve saved settings
        var reloaded = await _settingsRepo.GetSettingsAsync();
        reloaded.MovieSpaceHogGb.Should().Be(30.0);
        reloaded.Movie4kSpaceHogGb.Should().Be(60.0);
        reloaded.SeriesEpisodeSpaceHogGb.Should().Be(4.0);
        reloaded.StaleDays.Should().Be(365);
        reloaded.AbandonedDays.Should().Be(120);
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
}
