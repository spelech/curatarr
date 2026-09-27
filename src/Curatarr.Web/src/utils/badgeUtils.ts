import { MediaItem, MediaInstance } from '../types/api';

export interface DisplayBadge {
  id: string;
  label: string;
  isMissing: boolean;
  style: string;
}

export function getBadgeStyle(label: string, isMissing?: boolean): string {
  if (isMissing) {
    return 'bg-slate-800/40 text-slate-400 border border-dashed border-slate-700';
  }
  if (label === '4K') {
    return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
  }
  if (label === '1080p') {
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  }
  if (label === '720p') {
    return 'bg-sky-500/20 text-sky-300 border border-sky-500/30';
  }
  if (label === 'SD') {
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  }
  if (label.toLowerCase().includes('4k')) {
    return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
  }
  return 'bg-slate-800 text-slate-300 border border-slate-700';
}

/**
 * Returns deduplicated, clean badges for a media item card.
 * Never produces duplicate [4K, 4K] or [HD, 1080p] badges.
 */
export function getItemBadges(item: MediaItem): DisplayBadge[] {
  const badges: DisplayBadge[] = [];
  const seenLabels = new Set<string>();

  // 1. Collect all instances with resolved media files
  for (const inst of item.instances) {
    if (inst.hasFile && inst.resolution) {
      const label = inst.resolution;
      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        badges.push({
          id: `res-${label}`,
          label,
          isMissing: false,
          style: getBadgeStyle(label, false),
        });
      }
    }
  }

  // 2. For instances missing files, display tier missing badge if not already covered
  for (const inst of item.instances) {
    if (!inst.hasFile || !inst.resolution) {
      const is4K =
        inst.qualityProfileName?.toLowerCase().includes('4k') ||
        inst.connectionId?.toLowerCase().includes('4k');
      const tierLabel = is4K ? '4K' : (inst.qualityProfileName || 'HD');
      const missingLabel = `${tierLabel} (Missing)`;

      if (!seenLabels.has(missingLabel)) {
        seenLabels.add(missingLabel);
        badges.push({
          id: `missing-${tierLabel}`,
          label: missingLabel,
          isMissing: true,
          style: getBadgeStyle(missingLabel, true),
        });
      }
    }
  }

  // 3. Fallback if item has no instances at all
  if (badges.length === 0 && item.instances.length === 0) {
    badges.push({
      id: 'no-instance',
      label: 'Unassigned',
      isMissing: true,
      style: getBadgeStyle('Unassigned', true),
    });
  }

  return badges;
}

/**
 * Returns the single clean badge for a specific instance row in TableView.
 */
export function getInstanceBadge(inst: MediaInstance): { label: string; isMissing: boolean; style: string } {
  if (inst.hasFile && inst.resolution) {
    return {
      label: inst.resolution,
      isMissing: false,
      style: getBadgeStyle(inst.resolution, false),
    };
  }

  const is4K =
    inst.qualityProfileName?.toLowerCase().includes('4k') ||
    inst.connectionId?.toLowerCase().includes('4k');
  const tierLabel = is4K ? '4K' : (inst.qualityProfileName || 'HD');
  const label = `${tierLabel} (Missing)`;

  return {
    label,
    isMissing: true,
    style: getBadgeStyle(label, true),
  };
}

/**
 * Formats a clean human-readable instance name for modals, e.g. "Radarr HD" or "Sonarr 4K".
 */
export function getInstanceTitle(inst: MediaInstance, isSeries?: boolean): string {
  const qp = inst.qualityProfileName || '';
  const connId = inst.connectionId.toLowerCase();

  const isRadarr = connId.includes('radarr') || (!isSeries && !connId.includes('sonarr'));
  const servicePrefix = isRadarr ? 'Radarr' : 'Sonarr';

  if (qp.toLowerCase().startsWith('radarr') || qp.toLowerCase().startsWith('sonarr')) {
    return qp;
  }

  const cleanTier = qp.replace(/^(radarr|sonarr)\s*/i, '').trim();
  if (cleanTier) {
    return `${servicePrefix} ${cleanTier}`;
  }

  const tierFromId = connId.includes('4k') ? '4K' : 'HD';
  return `${servicePrefix} ${tierFromId}`;
}

export const TAUTULLI_TRACKING_START_DATE = '2017-07-15T00:00:00Z';

export interface WatchHistoryCutoffOptions {
  activeUserId?: string | null;
  userCutoffYear?: number | null;
  defaultTrackingYear?: number;
}

/**
 * Checks if a media item predates recorded watch history for the active user (or entire library if no user selected).
 *
 * Rules:
 * 1. If activeUserId is provided:
 *    - If that user has recorded watch history on this item (playCount > 0), history is NOT missing -> returns false.
 *    - If that user has 0 plays (missing watch history), checks if item was added or released before that user's history cutoff year.
 * 2. If no user is selected:
 *    - If ANY user has recorded watch history (totalPlays > 0), history is NOT missing -> returns false.
 *    - If totalPlays === 0, checks if item was added before Tautulli tracking start date or released <= 2017.
 */
export function itemPredatesWatchHistory(
  item: MediaItem,
  options?: WatchHistoryCutoffOptions | string
): boolean {
  let activeUserId: string | null | undefined = null;
  let userCutoffYear: number | null | undefined = null;
  let trackingStartDate = TAUTULLI_TRACKING_START_DATE;

  if (typeof options === 'string') {
    trackingStartDate = options;
  } else if (options) {
    activeUserId = options.activeUserId;
    userCutoffYear = options.userCutoffYear;
  }

  // 1. If a specific user is active, check THAT user's watch history
  if (activeUserId) {
    const userStat = item.watchStats?.find((w) => w.userId === activeUserId);
    const userPlays = userStat?.playCount ?? 0;
    // If the user has watched it, watch history is recorded (not missing)
    if (userPlays > 0) return false;

    // User has missing watch history on this item.
    // Check if it predates their cutoff year
    const cutoffYear = userCutoffYear || 2017;
    if (item.addedAt) {
      const addedYear = new Date(item.addedAt).getUTCFullYear();
      return addedYear <= cutoffYear;
    }
    return !!(item.year && item.year <= cutoffYear);
  }

  // 2. No specific user active: check entire library watch history
  const totalPlays = item.watchStats?.reduce((sum, w) => sum + w.playCount, 0) ?? 0;
  // If anyone has watched it, history is recorded (not missing)
  if (totalPlays > 0) return false;

  if (item.addedAt) {
    return new Date(item.addedAt).getTime() < new Date(trackingStartDate).getTime();
  }

  return !!(item.year && item.year <= 2017);
}

/**
 * Returns the effective history cutoff year for badge rendering and tooltips.
 */
export function getHistoryCutoffYear(options?: WatchHistoryCutoffOptions | null): number {
  if (options && typeof options === 'object' && options.userCutoffYear) {
    return options.userCutoffYear;
  }
  return 2017;
}
