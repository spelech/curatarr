namespace Curatarr.Core.Adapters;

public record ConnectionTestResult(bool Success, string? Version, string? Message, long LatencyMs);

public record SonarrSeriesDto(
    int Id,
    string Title,
    string? SortTitle,
    int? TvdbId,
    string? ImdbId,
    int? Year,
    bool Monitored,
    string? Path,
    long SizeOnDisk,
    int EpisodeFileCount,
    int TotalEpisodeCount,
    int? QualityProfileId,
    IReadOnlyList<SonarrSeasonDto> Seasons,
    string? Resolution = null,
    DateTime? AddedAt = null,
    string? PosterUrl = null
);

public record SonarrSeasonDto(
    int SeasonNumber,
    bool Monitored,
    long SizeOnDisk,
    int EpisodeFileCount,
    int TotalEpisodeCount
);

public record SonarrEpisodeFileDto(
    int Id,
    int SeriesId,
    int SeasonNumber,
    string? RelativePath,
    long Size
);

public record RadarrMovieDto(
    int Id,
    string Title,
    string? SortTitle,
    int? TmdbId,
    string? ImdbId,
    int? Year,
    bool HasFile,
    bool Monitored,
    string? Path,
    long SizeOnDisk,
    int? QualityProfileId,
    string? Resolution = null,
    DateTime? AddedAt = null,
    string? PosterUrl = null
);

public record TautulliUserDto(
    string UserId,
    string Username,
    string? FriendlyName
);

public record TautulliHistoryItemDto(
    int? RatingKey,
    string? GrandparentRatingKey,
    string? ParentRatingKey,
    string? Title,
    string? GrandparentTitle,
    string UserId,
    string Username,
    int? SeasonNumber,
    DateTime Date,
    string? MediaType = null,
    int? Year = null,
    string? Guid = null
);

public record PlexSectionDto(
    string Key,
    string Title,
    string Type, // "movie" or "show"
    string? Agent
);

public record PlexMetadataItemDto(
    int RatingKey,
    string Title,
    string Type,
    string? Guid,
    int? Year,
    int ViewCount = 0,
    DateTime? LastViewedAt = null,
    IReadOnlyList<string>? Guids = null
);

public record OverseerrRequestDto(
    int Id,
    string Status,
    string MediaType,
    int? TmdbId,
    int? TvdbId
);
