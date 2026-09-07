using Curatarr.Core.Models;

namespace Curatarr.Core.Adapters;

public interface IConnectionTester
{
    Task<ConnectionTestResult> TestAsync(ServiceConnection connection, CancellationToken ct = default);
}

public interface ISonarrClient
{
    Task<IReadOnlyList<SonarrSeriesDto>> GetSeriesAsync(ServiceConnection connection, CancellationToken ct = default);
    Task<IReadOnlyList<SonarrEpisodeFileDto>> GetEpisodeFilesAsync(ServiceConnection connection, int seriesId, CancellationToken ct = default);
    Task<HashSet<int>> GetCutoffUnmetSeriesIdsAsync(ServiceConnection connection, CancellationToken ct = default);
    Task DeleteSeriesAsync(ServiceConnection connection, int seriesId, bool deleteFiles, bool addImportExclusion, CancellationToken ct = default);
    Task DeleteEpisodeFilesAsync(ServiceConnection connection, IEnumerable<int> episodeFileIds, CancellationToken ct = default);
    Task UnmonitorSeasonAsync(ServiceConnection connection, int seriesId, int seasonNumber, CancellationToken ct = default);
}

public interface IRadarrClient
{
    Task<IReadOnlyList<RadarrMovieDto>> GetMoviesAsync(ServiceConnection connection, CancellationToken ct = default);
    Task<HashSet<int>> GetCutoffUnmetMovieIdsAsync(ServiceConnection connection, CancellationToken ct = default);
    Task DeleteMovieAsync(ServiceConnection connection, int movieId, bool deleteFiles, bool addImportExclusion, CancellationToken ct = default);
}

public interface ITautulliClient
{
    Task<IReadOnlyList<TautulliUserDto>> GetUsersAsync(ServiceConnection connection, CancellationToken ct = default);
    Task<IReadOnlyList<TautulliHistoryItemDto>> GetHistoryAsync(ServiceConnection connection, int length = 0, CancellationToken ct = default);
}

public interface IPlexClient
{
    Task<IReadOnlyList<PlexSectionDto>> GetSectionsAsync(ServiceConnection connection, CancellationToken ct = default);
    Task<IReadOnlyList<PlexMetadataItemDto>> GetSectionItemsAsync(ServiceConnection connection, string sectionKey, CancellationToken ct = default);
    Task RefreshSectionAsync(ServiceConnection connection, string sectionKey, CancellationToken ct = default);
}

public interface IOverseerrClient
{
    Task<IReadOnlyList<OverseerrRequestDto>> GetRequestsAsync(ServiceConnection connection, CancellationToken ct = default);
    Task DeleteRequestAsync(ServiceConnection connection, int requestId, CancellationToken ct = default);
}
