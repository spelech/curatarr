# REST API Reference

Curatarr exposes a RESTful API under the `/api/v1` namespace.

---

## Authentication & Session

### `GET /api/v1/auth/me`
Returns the active session state and user identity.
- **Response**:
  ```json
  {
    "authenticated": true,
    "initialized": true,
    "authEnabled": true,
    "user": {
      "id": "user-uuid",
      "username": "admin",
      "role": "Admin"
    }
  }
  ```

### `GET /api/v1/auth/users` (Admin)
Returns all registered Plex users with assigned roles.

### `PUT /api/v1/auth/users/{id}/role` (Admin)
Updates a user's permission role.
- **Request Body**:
  ```json
  {
    "role": "Admin"
  }
  ```

### `DELETE /api/v1/auth/users/{id}` (Admin)
Deletes a registered user from Curatarr.

---

## Plex Media Server Binding

### `GET /api/v1/plex/status`
Returns the current Plex binding state, machine identifier, and connection health.

### `GET /api/v1/plex/servers` (Admin)
Queries Plex.tv for all servers accessible to the administrator's token.

### `POST /api/v1/plex/bind` (Admin)
Binds Curatarr to a specific Plex Media Server and verifies network connectivity.
- **Request Body**:
  ```json
  {
    "machineIdentifier": "abcdef123456...",
    "name": "Tower Plex",
    "baseUrl": "http://10.0.0.10:32400",
    "apiKey": "plex-auth-token"
  }
  ```

---

## Catalog & Categories

### `GET /api/v1/categories`
Returns summary statistics for all smart categories.
- **Query Parameters**:
  - `userId` (optional): Filter calculations to a specific user's watch history.
- **Response**: Array of category objects with `count` and `reclaimableSizeBytes`.

### `GET /api/v1/catalog`
Returns a paginated list of media items matching active filter criteria.
- **Query Parameters**:
  - `category` (string, optional)
  - `userId` (string, optional)
  - `requestedBy` (string, optional)
  - `mediaType` (`"movie"` | `"series"`, optional)
  - `search` (string, optional)
  - `resolution` (`"SD"` | `"720p"` | `"1080p"` | `"4K"`, optional)
  - `cutoffUnmet` (boolean, optional)
  - `pre2017Filter` (`"all"` | `"exclude"` | `"only"`, optional)
  - `userCutoffYear` (integer, optional)
  - `sortBy` (`"size"` | `"title"` | `"plays"` | `"added"` | `"lastWatched"`, optional)
  - `sortDesc` (boolean, optional)
  - `limit` (integer, optional, default `50`)
  - `offset` (integer, optional, default `0`)

### `GET /api/v1/catalog/{id}`
Returns full details for a single media item, including instances, seasons, and user watch statistics.

---

## Pruning & Deletion

### `POST /api/v1/prune`
Deletes an approved item or season from one or more Arr instances.
- **Request Body**:
  ```json
  {
    "mediaItemId": "uuid-here",
    "seasonNumber": null,
    "targetConnectionIds": ["conn-uuid-1"],
    "addToImportExclusion": false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "bytesFreed": 15428901234,
    "message": "Full Movie pruned across: Radarr HD"
  }
  ```

---

## Protection & Whitelist

### `POST /api/v1/catalog/{id}/protect`
Locks an item against deletion.
- **Request Body**:
  ```json
  {
    "isProtected": true,
    "reason": "Family Favorite"
  }
  ```

### `POST /api/v1/catalog/{id}/request-protect`
Submits a protection request from a guest user account.
- **Request Body**:
  ```json
  {
    "reason": "Please keep, watching this weekend"
  }
  ```

---

## Audit Ledger

### `GET /api/v1/audit`
Returns historical deletion records.
- **Query Parameters**:
  - `limit` (integer, optional, default `250`)
- **Response**:
  ```json
  {
    "logs": [
      {
        "id": "audit-uuid",
        "title": "Little Italy",
        "mediaType": "Movie",
        "bytesFreed": 8215538064,
        "actor": "WebUI",
        "executedAt": "2026-09-21T04:36:46Z",
        "details": "Full Movie pruned across: Radarr HD"
      }
    ],
    "totalBytesFreed": 998721495000
  }
  ```
