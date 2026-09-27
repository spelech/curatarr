# Model Context Protocol (MCP) Integration

Curatarr embeds a native Model Context Protocol (MCP) server. This allows autonomous AI coding assistants (such as Claude Desktop, Antigravity, or Goose) to inspect media storage, evaluate candidate titles, and perform administrative cleanup tasks safely.

---

## Embedded MCP Endpoints

Curatarr exposes standards-compliant Server-Sent Events (SSE) and HTTP POST message transports:

- **SSE Transport**: `GET http://localhost:8909/mcp/sse`
- **Message Dispatch**: `POST http://localhost:8909/mcp/messages?sessionId=<sessionId>`

No secondary daemons or external gateway processes are required; the MCP server runs inside the Curatarr ASP.NET Core process.

---

## Tool Registry

Curatarr exposes the following MCP tools:

### `get_library_stats`
Returns high-level library analytics:
- Total movies and TV series counts
- Total disk usage (in bytes and gigabytes)
- Total reclaimable space across smart categories
- Total deletions and space freed historically

### `list_pruning_candidates`
Lists items belonging to an automated category.
- **Parameters**:
  - `category` (string, e.g. `"never_watched"`, `"stale"`, `"abandoned"`, `"cutoff_unmet"`, `"space_hogs"`)
  - `limit` (optional integer, default `50`)
- **Returns**: Array of candidate items with IDs, titles, sizes, watch counts, and connected instances.

### `get_item_details`
Retrieves forensic metadata for a specific media item.
- **Parameters**:
  - `mediaItemId` (string)
- **Returns**: Complete file paths, instance bindings, seasons, and user watch records.

### `execute_prune`
Executes safe deletion of an item or season.
- **Parameters**:
  - `mediaItemId` (string)
  - `seasonNumber` (optional integer)
  - `targetConnectionIds` (optional array of connection UUIDs)
  - `addToImportExclusion` (optional boolean, default `false`)
- **Returns**: Execution status and exact bytes freed. Records the action in the forensic audit ledger with actor marked as `MCP-Agent`.

---

## Client Configurations

### Claude Desktop
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "curatarr": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-proxy",
        "http://localhost:8909/mcp/sse"
      ]
    }
  }
}
```

### Antigravity & AI Agents
In your agent's MCP settings, add:

```json
{
  "curatarr": {
    "url": "http://localhost:8909/mcp/sse"
  }
}
```
