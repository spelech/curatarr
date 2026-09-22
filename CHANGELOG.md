# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-09-21

### Added
- **Plex OAuth / PIN Authentication**: Integrated official Plex PIN authentication workflow with popup flow and automatic claim polling.
- **Role-Based Access Control**:
  - Primary Administrator account auto-claim on first login.
  - Server owner recognition and configurable `AdminUsernames` settings.
  - Non-admin library users automatically provisioned as `Guest`.
- **Guest View Mode**:
  - Safe, read-only catalog browsing for shared Plex library users.
  - Destructive prune controls, batch delete checkboxes, and administrative settings hidden for guests.
- **Protection Requests**:
  - Library users can submit "Ask to Protect" requests with custom notes and reasons.
  - Violet protection count badges displayed in poster grid and compact table views.
  - Administrator review panel with "Approve & Whitelist" and dismiss capabilities.
- **Overseerr / Seerr Attribution**: Detailed view displays original requester username and requested timestamp correlated from Overseerr.
- **Admin Guest Preview Switcher**: In-app toggle allowing administrators to preview the exact Guest experience in real time with an amber top banner and one-click exit.

### Changed
- Removed internal PIN code string from login popup to match standard Overseerr/Jellyseerr UX.

## [1.2.0] - 2026-09-20

### Added
- Pre-2017 watch history filter to isolate or exclude legacy playback data.
- Virtualized list optimizations with custom overscan and touch ergonomics.
- Playwright 4-point layout audit testing responsive viewports.

### Fixed
- Synced UI versioning across manifests.
- Branch coverage expanded to >= 80% across test suites.

## [1.1.0] - 2026-09-08

### Added
- TanStack Virtual (`@tanstack/react-virtual`) virtualized rendering for both responsive poster GridView and compact TableView.
- Infinite progressive batch loading in `useCatalogStore` with customizable page sizes, eliminating hardcoded candidate limits.
- Dynamic user-configurable threshold settings for Space Hogs (resolution-aware 4K/HD movies and per-episode series thresholds) and inactivity periods (Stale and Abandoned).
- Dynamic background sync scheduling with configurable intervals and transient error backoff.
- Dedicated System Schedule & Performance settings controls in the Web UI.

### Fixed
- Never Watched filter now accurately ignores shows with any watched episodes.
- Ingestion and display of added dates and poster URLs from Sonarr and Radarr.

## [1.0.0] - 2026-09-07

### Added
- Multi-instance media catalog management for Sonarr, Radarr, Plex, Tautulli, and Overseerr.
- Embedded Model Context Protocol (MCP) server exposing SSE tools (`curatarr_get_library_stats`, `curatarr_list_candidates`, `curatarr_prune_items`, `curatarr_protect_item`).
- High-performance SQLite WAL persistence using Dapper and custom UTC DateTime type handlers.
- External GUID matching (IMDB, TMDB, TVDB) for reliable Plex/Tautulli watch reconciliation.
- Added-date and poster image ingestion across Arr instances.
- Dense 6–7 column poster grid UI with compact media card controls and season drawer.
- 4-point Playwright Layout Inspector E2E test suite.
- 4-stage GitHub Actions CI quality gates with release integrity verification and coverage reporting.
