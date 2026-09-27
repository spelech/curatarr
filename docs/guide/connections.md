# Service Connections

Curatarr connects to your homelab media infrastructure to aggregate library inventory and playback telemetry.

![Service Connections Settings](../assets/screenshots/curatarr-settings-view.png)

---

## Supported Services

| Service | Protocol | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **Radarr** | REST API v3 | `7878` | Movie collection manager (HD, 4K, Anime instances) |
| **Sonarr** | REST API v3 | `8989` | TV series collection manager (HD, 4K instances) |
| **Plex Media Server** | HTTP / Token | `32400` | Playback statistics and library sections |
| **Tautulli** | REST API v2 | `8181` | Long-term historical watch activity ledger |
| **Overseerr / Jellyseerr** | REST API v1 | `5055` | Media request records and requester user mapping |

---

## Adding Service Connections

1. Open Curatarr and navigate to **Settings & Rules** -> **Service Connections**.
2. Click **+ Add Connection**.
3. Select the service type from the dropdown.

### 1. Radarr Configuration
- **Connection Name**: A friendly identifier (for example, `Radarr 4K` or `Radarr HD`).
- **Base URL**: The network address of Radarr (e.g. `http://radarr:7878` or `http://10.0.0.10:7878`).
- **API Key**: Found in Radarr under **Settings** -> **General** -> **Security** -> **API Key**.
- **Quality Profile Tier**: Choose `HD` or `4K`. This informs multi-instance badges and pruning targets.

### 2. Sonarr Configuration
- **Connection Name**: E.g. `Sonarr HD` or `Sonarr 4K`.
- **Base URL**: The network address of Sonarr (e.g. `http://sonarr:8989`).
- **API Key**: Found in Sonarr under **Settings** -> **General** -> **Security** -> **API Key**.
- **Quality Profile Tier**: Choose `HD` or `4K`.

### 3. Plex Media Server
- **Base URL**: The direct URL to your Plex server (e.g. `http://10.0.0.10:32400`).
- **Plex Token**: Your Plex `X-Plex-Token`.

### 4. Tautulli
- **Base URL**: The URL to Tautulli (e.g. `http://tautulli:8181`).
- **API Key**: Found in Tautulli under **Settings** -> **Web Interface** -> **API Key**.

### 5. Overseerr
- **Base URL**: The URL to Overseerr (e.g. `http://overseerr:5055`).
- **API Key**: Found in Overseerr under **Settings** -> **General** -> **API Key**.

---

## Automatic Docker Discovery

If Curatarr runs in the same Docker network as your media stack, you can use the **Auto-Discover Local Services** button. Curatarr scans the internal bridge network for standard ports (`7878`, `8989`, `8181`, `5055`) and pre-fills connection fields.

---

## Testing & Synchronization

1. On each connection card, click **Test Connection** to confirm network connectivity and authentication.
2. Click **Sync Now** in the top navigation bar or sidebar.
3. Curatarr queries all configured instances, downloads posters, calculates storage, correlates watch logs, and populates the catalog.
