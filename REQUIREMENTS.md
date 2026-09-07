# 📋 Software Requirements Specification: Curatarr

This specification defines the functional requirements and automated test traceability matrix for **Curatarr**, conforming to the [Controls-Grade Fullstack Archetype](https://github.com/spelech/AgenticEngineeringToolbelt/blob/main/archetypes/controls-fullstack-dotnet-react.md).

---

## 🎯 Requirements & Traceability Matrix

| Requirement ID | Summary | Acceptance Criteria | Automated Test Proof |
| :--- | :--- | :--- | :--- |
| **`REQ-001`** | **Health Check Probe** | The service exposes `/health` returning HTTP 200 and healthy JSON status for orchestrators. | [`Curatarr.Tests/HealthEndpointTests.cs`](tests/Curatarr.Tests) |
| **`REQ-002`** | **Multi-Instance Catalog Sync** | Ingests media items, seasons, filesizes, added dates, posters, and play histories across multiple Sonarr, Radarr, Plex, and Tautulli nodes. | [`Curatarr.Tests/CatalogSyncServiceTests.cs`](tests/Curatarr.Tests) |
| **`REQ-003`** | **External GUID Matching** | Reconciles Plex/Tautulli watches with Arr media using external GUIDs (IMDB, TMDB, TVDB) before falling back to normalized title/year. | [`Curatarr.Tests/PlexGuidMatchingTests.cs`](tests/Curatarr.Tests) |
| **`REQ-004`** | **Smart Category Rule Engine** | Categorizes items into Never Watched, Stale, Abandoned TV, Cutoff Unmet, and Space Hogs based on deterministic criteria. | [`Curatarr.Tests/SmartCategoryEngineTests.cs`](tests/Curatarr.Tests) |
| **`REQ-005`** | **Safe Prune & Protection** | Supports item and season deletion with whitelist protection flags preventing accidental removal. | [`Curatarr.Tests/PruneExecutionServiceTests.cs`](tests/Curatarr.Tests) |
| **`REQ-006`** | **Embedded MCP Server** | Exposes SSE endpoints at `/mcp/sse` and `/mcp/messages` with tools for agentic inspection and management. | [`Curatarr.Tests/McpRegistryTests.cs`](tests/Curatarr.Tests) |
| **`REQ-007`** | **Dense Responsive Poster Layout** | Web UI renders a responsive 6–7 column poster grid with zero horizontal overflow and Grade A mobile fit. | [`Curatarr.E2E/layout.spec.ts`](tests/Curatarr.E2E/layout.spec.ts) |

---

## 📜 Requirement Definitions

### `[REQ-001]` Health Check Probe
- **Description**: The system must provide an unauthenticated `/health` probe endpoint for Docker healthchecks, reverse proxies, and uptime monitors.
- **Verification**: Integration test verifying HTTP 200 response.

### `[REQ-002]` Multi-Instance Catalog Sync
- **Description**: Support concurrent connections to multiple Arr instances (HD Sonarr, 4K Sonarr, HD Radarr, 4K Radarr) and media servers (Plex, Tautulli, Overseerr) via typed HTTP clients with Polly resilience.
- **Verification**: Unit and mock transport adapter tests.

### `[REQ-003]` External GUID Matching
- **Description**: Match Plex and Tautulli watch records to Sonarr/Radarr media items using immutable external GUIDs (IMDB, TMDB, TVDB IDs) to prevent false "Never Watched" classifications caused by localized or differing release titles.
- **Verification**: xUnit unit tests asserting GUID priority resolution.

### `[REQ-004]` Smart Category Rule Engine
- **Description**: Evaluates media candidates into distinct actionable categories:
  - *Never Watched*: Items with 0 lifetime plays across all users. For TV series, only considered never watched if 0 episodes across all seasons have been watched.
  - *Stale*: Items unwatched for $> 180$ days.
  - *Abandoned TV*: Series where early seasons/episodes were watched, but no new episodes watched in $> 90$ days.
  - *Space Hogs*: Media occupying excessive disk space.
  - *Cutoff Unmet*: Items below the configured quality profile cutoff in Sonarr/Radarr.
- **Verification**: Smart category engine unit tests.

### `[REQ-005]` Safe Prune & Whitelist Protection
- **Description**: Allows deleting unwanted media files from disk via Sonarr/Radarr APIs while respecting protection locks (`isProtected = true`). Series can be pruned at the individual season level.
- **Verification**: Prune execution unit tests verifying protected item deletion is rejected.

### `[REQ-006]` Embedded MCP Server
- **Description**: Implements Model Context Protocol (MCP) server endpoints (`/mcp/sse`, `/mcp/messages`) providing tools (`curatarr_get_library_stats`, `curatarr_list_candidates`, `curatarr_prune_items`, `curatarr_protect_item`, etc.) for AI agents.
- **Verification**: MCP registry tests and tool invocation schema tests.

### `[REQ-007]` Responsive Layout & UX Stability
- **Description**: UI must adapt cleanly across desktop (up to 4K / 1600px max container) and mobile viewports with zero horizontal overflow, touch-friendly targets, and high contrast typography.
- **Verification**: Playwright Layout Inspector automated 4-point audit.
