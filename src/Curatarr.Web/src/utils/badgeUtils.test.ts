import { describe, it, expect } from 'vitest';
import { getItemBadges, getInstanceBadge, getInstanceTitle } from './badgeUtils';
import { MediaItem, MediaInstance } from '../types/api';

describe('badgeUtils', () => {
  const createInstance = (overrides: Partial<MediaInstance>): MediaInstance => ({
    id: 'inst-1',
    mediaItemId: 'item-1',
    connectionId: 'conn-radarr-hd',
    externalId: 100,
    qualityProfileName: 'HD',
    resolution: '1080p',
    cutoffUnmet: false,
    isMonitored: true,
    diskPath: '/movies/Test',
    sizeBytes: 5_000_000_000,
    hasFile: true,
    ...overrides,
  });

  const createItem = (instances: MediaInstance[]): MediaItem => ({
    id: 'item-1',
    mediaType: 0,
    title: 'Test Movie',
    sortTitle: 'Test Movie',
    totalSizeBytes: 5_000_000_000,
    isProtected: false,
    instances,
    seasons: [],
    watchStats: [],
  });

  describe('getItemBadges (MediaCard)', () => {
    it('should NOT produce duplicate [4K, 4K] badges for a single 4K instance', () => {
      const inst4K = createInstance({
        connectionId: 'conn-radarr-4k',
        qualityProfileName: '4K',
        resolution: '4K',
      });
      const item = createItem([inst4K]);

      const badges = getItemBadges(item);
      const labels = badges.map((b) => b.label);

      expect(labels).toEqual(['4K']);
      expect(labels).not.toContain('HD');
      expect(badges.filter((b) => b.label === '4K')).toHaveLength(1);
    });

    it('should NOT produce duplicate [HD, 1080p] badges for a single 1080p instance', () => {
      const instHd = createInstance({
        connectionId: 'conn-radarr-hd',
        qualityProfileName: 'HD',
        resolution: '1080p',
      });
      const item = createItem([instHd]);

      const badges = getItemBadges(item);
      const labels = badges.map((b) => b.label);

      expect(labels).toEqual(['1080p']);
      expect(labels).not.toContain('HD');
    });

    it('should NOT produce [HD, 720p] or [HD, SD] badges', () => {
      const inst720 = createInstance({
        connectionId: 'conn-radarr-hd',
        qualityProfileName: 'HD',
        resolution: '720p',
      });
      expect(getItemBadges(createItem([inst720])).map((b) => b.label)).toEqual(['720p']);

      const instSd = createInstance({
        connectionId: 'conn-radarr-hd',
        qualityProfileName: 'HD',
        resolution: 'SD',
      });
      expect(getItemBadges(createItem([instSd])).map((b) => b.label)).toEqual(['SD']);
    });

    it('should cleanly show distinct resolutions for dual-instance items (4K + 1080p)', () => {
      const inst4K = createInstance({
        id: 'inst-4k',
        connectionId: 'conn-radarr-4k',
        qualityProfileName: '4K',
        resolution: '4K',
      });
      const instHd = createInstance({
        id: 'inst-hd',
        connectionId: 'conn-radarr-hd',
        qualityProfileName: 'HD',
        resolution: '1080p',
      });
      const item = createItem([inst4K, instHd]);

      const badges = getItemBadges(item);
      const labels = badges.map((b) => b.label);

      expect(labels).toEqual(['4K', '1080p']);
    });

    it('should indicate missing status when an instance has no file', () => {
      const instMissing4K = createInstance({
        id: 'inst-4k',
        connectionId: 'conn-radarr-4k',
        qualityProfileName: '4K',
        resolution: undefined,
        hasFile: false,
      });
      const instHd = createInstance({
        id: 'inst-hd',
        connectionId: 'conn-radarr-hd',
        qualityProfileName: 'HD',
        resolution: '1080p',
        hasFile: true,
      });
      const item = createItem([instMissing4K, instHd]);

      const badges = getItemBadges(item);
      const labels = badges.map((b) => b.label);

      expect(labels).toEqual(['1080p', '4K (Missing)']);
      expect(badges.find((b) => b.label === '4K (Missing)')?.isMissing).toBe(true);
    });
  });

  describe('getInstanceBadge (TableView)', () => {
    it('should return resolution for instance with file without duplicating tier', () => {
      const inst = createInstance({ qualityProfileName: 'HD', resolution: '1080p' });
      expect(getInstanceBadge(inst)).toMatchObject({
        label: '1080p',
        isMissing: false,
      });

      const inst4k = createInstance({ qualityProfileName: '4K', resolution: '4K' });
      expect(getInstanceBadge(inst4k)).toMatchObject({
        label: '4K',
        isMissing: false,
      });
    });

    it('should return missing badge if no file or resolution', () => {
      const inst = createInstance({
        qualityProfileName: '4K',
        resolution: undefined,
        hasFile: false,
      });
      expect(getInstanceBadge(inst)).toMatchObject({
        label: '4K (Missing)',
        isMissing: true,
      });
    });
  });

  describe('getInstanceTitle (MediaDetailModal)', () => {
    it('should format clean instance names like Radarr HD or Sonarr 4K', () => {
      const instRadarrHd = createInstance({
        connectionId: 'conn-radarr-hd',
        qualityProfileName: 'HD',
      });
      expect(getInstanceTitle(instRadarrHd, false)).toBe('Radarr HD');

      const instSonarr4k = createInstance({
        connectionId: 'conn-sonarr-4k',
        qualityProfileName: '4K',
      });
      expect(getInstanceTitle(instSonarr4k, true)).toBe('Sonarr 4K');
    });
  });
});
