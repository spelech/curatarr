export interface CategorySummary {
  categoryId: string;
  name: string;
  count: number;
  reclaimableSizeBytes: number;
}

export interface MediaInstance {
  id: string;
  mediaItemId: string;
  connectionId: string;
  externalId: number;
  qualityProfileName?: string;
  cutoffUnmet: boolean;
  isMonitored: boolean;
  diskPath?: string;
  sizeBytes: number;
  hasFile: boolean;
  resolution?: string;
}

export interface Season {
  id: string;
  mediaItemId: string;
  seasonNumber: number;
  isMonitored: boolean;
  episodeCount: number;
  episodeFileCount: number;
  sizeBytes: number;
}

export interface WatchStat {
  id: string;
  mediaItemId: string;
  seasonNumber?: number;
  userId: string;
  username: string;
  playCount: number;
  lastPlayedAt?: string;
}

export interface MediaItem {
  id: string;
  mediaType: number; // 0: Movie, 1: Series
  title: string;
  sortTitle: string;
  year?: number;
  tmdbId?: string;
  tvdbId?: string;
  imdbId?: string;
  plexRatingKey?: number;
  posterUrl?: string;
  addedAt?: string;
  totalSizeBytes: number;
  isProtected: boolean;
  protectionReason?: string;
  instances: MediaInstance[];
  seasons: Season[];
  watchStats: WatchStat[];
}

export interface ServiceConnection {
  id: string;
  connectionType: number; // 0: Sonarr, 1: Radarr, 2: Tautulli, 3: Plex, 4: Overseerr
  name: string;
  baseUrl: string;
  apiKey: string;
  tierTag?: string;
  isEnabled: boolean;
  lastSyncAt?: string;
  lastStatus: string;
}

export interface AuditLogEntry {
  id: string;
  mediaItemId?: string;
  title: string;
  mediaType: string;
  seasonNumber?: number;
  instancesAffectedJson: string;
  bytesFreed: number;
  addedToImportExclusion: boolean;
  actor: string;
  executedAt: string;
  details?: string;
}

export interface TautulliUser {
  userId: string;
  username: string;
  friendlyName?: string;
}

export interface DiscoveredService {
  id: string;
  connectionType: number; // 0: Sonarr, 1: Radarr, 2: Tautulli, 3: Plex, 4: Overseerr
  name: string;
  baseUrl: string;
  discoverySource: string; // "Docker" | "Network Probe"
  isConfigured: boolean;
  tierTag?: string;
  containerName?: string;
  image?: string;
  port?: number;
  details?: string;
}

export interface CuratarrSettings {
  movieSpaceHogThresholdBytes: number;
  movie4kSpaceHogThresholdBytes: number;
  seriesEpisodeSpaceHogThresholdBytes: number;
  staleDays: number;
  abandonedDays: number;
  movieSpaceHogGb: number;
  movie4kSpaceHogGb: number;
  seriesEpisodeSpaceHogGb: number;
}
