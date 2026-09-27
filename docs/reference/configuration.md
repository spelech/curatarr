# Configuration & Schema

This document outlines environment variables, runtime options, and SQLite database schemas used by Curatarr.

---

## Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `TZ` | `Etc/UTC` | Container local time zone for scheduling and display. |
| `ASPNETCORE_ENVIRONMENT` | `Production` | .NET runtime hosting mode (`Development` or `Production`). |
| `CURATARR_DATA_DIR` | `/app/data` | Path to persistent storage containing `curatarr.db`. |
| `PORT` | `8080` | Internal listening port for Kestrel web server. |

---

## SQLite Database Schema

Curatarr persists all configuration and library state in a local SQLite database (`curatarr.db`) using **WAL (Write-Ahead Logging)** mode.

### Key Tables

- **`connections`**: Configured Radarr, Sonarr, Plex, Tautulli, and Overseerr service records with encrypted API credentials.
- **`media_items`**: Aggregated library items (movies and series) with release year, overview, and TMDB/IMDB/TVDB keys.
- **`media_instances`**: Bindings between media items and physical Arr servers (includes file size, resolution, path, cutoff status, and quality profile).
- **`seasons`**: Episodic metadata for television series, tracking season numbers and on-disk file counts.
- **`watch_stats`**: Telemetry rows correlating user IDs, total play counts, and timestamps of last playback sessions.
- **`protected_items`**: Whitelist records marking items immune to deletion, with administrator notes.
- **`protection_requests`**: Guest user requests awaiting administrative triage and approval.
- **`audit_logs`**: Append-only forensic ledger recording all completed deletions, reclaimed bytes, and actor identities.
- **`settings`**: Global retention thresholds and interface preferences.
