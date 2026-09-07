# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
