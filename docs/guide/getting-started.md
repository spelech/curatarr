# Getting Started

This guide explains how to install and start Curatarr with Docker Compose.

---

## Prerequisites

Before you start, verify that you have:
1. Docker Engine (version 24.0 or newer).
2. Docker Compose (version 2.20 or newer).
3. Network access from the Curatarr container to your media servers:
   - Radarr (default port: `7878`)
   - Sonarr (default port: `8989`)
   - Plex Media Server (default port: `32400`)
   - Tautulli (default port: `8181`)
   - Overseerr or Jellyseerr (default port: `5055`)

---

## Installation via Docker Compose

### 1. Create a Working Directory
Create a dedicated folder for Curatarr data:

```bash
mkdir -p /containers/curatarr/data
cd /containers/curatarr
```

### 2. Configure `docker-compose.yaml`
Save the following configuration as `docker-compose.yaml`:

```yaml
services:
  curatarr:
    image: ghcr.io/spelech/curatarr:latest
    container_name: curatarr
    ports:
      - "8909:8080"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=America/Chicago
      - ASPNETCORE_ENVIRONMENT=Production
    restart: unless-stopped
```

### 3. Start the Container
Run the following command to start Curatarr in the background:

```bash
docker compose up -d
```

### 4. Verify Container Health
Check the container logs to ensure the server started successfully:

```bash
docker compose logs -f curatarr
```

When started, Kestrel listens on port `8080` internally, accessible on host port `8909`:

```text
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://[::]:8080
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
```

---

## First Run and Initial Login

1. Open your web browser and navigate to:
   ```
   http://localhost:8909
   ```
2. If authentication is enabled, click **Sign In with Plex** to link your administrator account.
3. Once logged in, click **Settings & Rules** in the left sidebar to add your media service connections.

![Curatarr Grid Interface](../assets/screenshots/curatarr-grid-view.png)
