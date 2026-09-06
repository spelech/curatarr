# Curatarr 🎬🧹

**Intelligent media library auditing and decluttering platform for Plex, Tautulli, Sonarr, and Radarr.**

Curatarr brings human-in-the-loop curation to homelab and self-hosted media servers. It correlates watch history across users with library inventory, quality profiles, and disk usage to surface actionable **Smart Categories** (*Never Watched*, *Stale > 180 Days*, *Abandoned TV Series*, *Cutoff Unmet*, *Space Hogs*, and *Missing*).

---

## ✨ Features

- **Multi-Instance Aware**: Seamlessly connects to multiple Sonarr (HD, 4K, Anime) and Radarr (HD, 4K) instances simultaneously.
- **Granular Pruning**: Purge entire movies, complete TV series, or specific seasons across selected instances.
- **Tautulli & Plex Watch Integration**: Evaluate watch state across all server users combined, or filter to individual household members.
- **Whitelist Protection**: One-click protection flags items as permanent keeps so they are never accidentally purged.
- **Import Exclusion Toggle**: Optionally blacklist pruned titles in Sonarr/Radarr from future indexer grabs.
- **Forensic Audit Log**: Immutable record of every deletion, exact paths, bytes freed, and actor.
- **MCP Server First**: Native Model Context Protocol server (`/mcp/sse`) allowing AI coding agents to query candidates and automate audits.

---

## 🚀 Quick Start

### Docker Compose
```yaml
services:
  curatarr:
    image: curatarr:latest
    container_name: curatarr
    ports:
      - 8045:8080
    volumes:
      - ./data:/app/data
    environment:
      - TZ=America/Chicago
    restart: unless-stopped
```

### Local Development
```bash
# Build backend
dotnet build curatarr.slnx

# Run frontend dev server
cd src/Curatarr.Web
npm install
npm run dev
```
