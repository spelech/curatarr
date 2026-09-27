# Implementation Plan: Dynamic Pre-History Tag, ASD-STE100 README, and Curatarr VitePress Docs

**Branch**: `feat/v2-arr-ui-refresh`  
**Goal**:
1. Make the "Pre-2017" / Pre-History tag turn on ONLY when a user has missing watch history and the item predates the cutoff year that applies to them (dynamic per-user history cutoff).
2. Sweep the repository and clean up outdated files, test artifacts, and legacy documentation.
3. Rewrite `README.md` according to ASD-STE100 (Simplified Technical English) principles with full feature descriptions and embedded UI screenshots captured live from Playwright.
4. Set up a modern VitePress documentation suite styled with Curatarr's obsidian/emerald theme (`#040705`, `#10b981`), full guides, and verify zero build warnings.

---

## Task 1: Dynamic User-Aware Pre-History Tracking & Tagging
### 1.1 Backend (`Curatarr.Core` & `Curatarr.Infrastructure`)
- In `TautulliUserDto` and `CatalogEndpoints.cs`:
  - Calculate `FirstWatchedAt` and `HistoryCutoffYear` for each user from `watch_stats` (`MIN(last_played_at)`), falling back to `users` table `created_at` or default library start year (`2017`).
  - In `MediaFilterOptions`: support `PreHistoryFilter` ("all", "exclude", "only") and respect `UserIdFilter` and `HistoryCutoffYear`.
  - In `MediaRepository.cs`: update `pre2017Condition` to evaluate `play_count` for the filtered `UserId` if provided, and use the user's cutoff date/year instead of hardcoded 2017 when filtering by user.
### 1.2 Frontend (`Curatarr.Web`)
- In `types/api.ts`: add `historyCutoffYear?: number` and `firstWatchedAt?: string` to user models.
- In `badgeUtils.ts`: update `itemPredatesWatchHistory(item, activeUserId?, userCutoffYear?, defaultYear = 2017)`:
  - If `activeUserId` is specified, check `watchStats.find(w => w.userId === activeUserId)?.playCount`. If > 0, return `false` (user watched it, history is not missing).
  - If 0 plays for this user, check if item added date is before user's cutoff date or `item.year <= userCutoffYear`.
  - If no user specified, check library total plays == 0 and pre-2017.
- In `MediaCard.tsx`, `TableView.tsx`, `MediaDetailModal.tsx`:
  - Pass the active user ID (`selectedUserId` or logged-in guest user ID) and active cutoff year.
  - Dynamically render badge: `Pre-${cutoffYear}` (e.g. `Pre-2017`, `Pre-2019`, etc.) with accurate informative tooltip.
  - In `ControlBar.tsx`: dynamic labels in dropdown ("Hide Pre-XXXX", "Only Pre-XXXX").
### 1.3 Unit & Integration Tests
- Update/add tests in `badgeUtils.test.ts`, `MediaCard.test.tsx`, `TableView.test.tsx`, `PersistenceTests.cs`, and `CatalogEndpointsTests.cs`.

---

## Task 2: Repository Sweep & Cleanup
- Audit repository tree for obsolete files, temporary test HTML/images, dead artifacts.
- Verify `.gitignore` covers Playwright test results, coverage directories, build caches.
- Ensure all markdown links across the repository are valid and verified by `scripts/verify_release.py`.

---

## Task 3: ASD-STE100 Simplified Technical English README with Live Screenshots
- **ASD-STE100 Principles**:
  - Direct, clear sentences (under 20-25 words where possible).
  - Unambiguous verbs and nouns; avoid passive voice and jargon.
  - One instruction per step.
  - Clear sections: Purpose, Key Features, Architecture, Prerequisites, Installation, Configuration, Verification.
- **Screenshots**:
  - Use Playwright script to capture crisp, high-resolution 1080p screenshots of the live UI:
    1. `curatarr_library_grid.png`: 2-Tier toolbar, Emerald theme, Curated Film Cell logo, and cards.
    2. `curatarr_table_view.png`: Compact table view with instance pills and badges.
    3. `curatarr_media_detail.png`: Media detail modal with quality upgrade, watch history, and protection.
    4. `curatarr_protected_items.png`: Dedicated Protected Items & Triage view.
    5. `curatarr_settings.png`: Arr connections and curation criteria rules.
  - Save to `docs/assets/screenshots/` and embed in `README.md`.

---

## Task 4: VitePress Documentation Site
- Initialize VitePress in `docs/` (`package.json`, `.vitepress/config.mts`, `.vitepress/theme/index.ts`).
- Customize VitePress theme with Curatarr design tokens:
  - Background: `#040705` and `#070c09` (obsidian slate).
  - Primary / Accent: `#10b981` (emerald green) and `#34d399` (mint).
  - Logo: Curated Film Cell SVG.
- Author comprehensive, structured documentation pages:
  - `index.md`: Hero landing page with feature badges and quickstart.
  - `guide/getting-started.md`: Overview, Docker compose configuration, first login.
  - `guide/connections.md`: Connecting Radarr, Sonarr, Plex, Tautulli, Overseerr.
  - `guide/curation-rules.md`: Space hogs, dormant media, unmonitored items, quality upgrades.
  - `guide/safe-pruning.md`: Dual-instance handling, disk deletion, import exclusions, Plex sync.
  - `guide/mcp-integration.md`: Embedded MCP server (`/mcp/sse`), AI tools, agent automation.
  - `reference/api.md`: REST API endpoint specification.
- Add npm script in root/docs and verify `npx vitepress build docs` succeeds with zero errors.

---

## Task 5: Verification & Container Recreation
- Run all backend tests (`dotnet test`).
- Run all frontend tests (`npm test`).
- Run Playwright layout audit tests (`npx playwright test`).
- Run `verify_release.py`.
- Rebuild Docker image cleanly and recreate container via `docker compose`.
- Verify curl endpoints and live app.
- Conventional atomic commits and push to `feat/v2-arr-ui-refresh`.
