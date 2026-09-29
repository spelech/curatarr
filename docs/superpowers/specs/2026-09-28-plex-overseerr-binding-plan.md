# Implementation Plan: Overseerr-Style Plex Server & Admin Binding

## 1. Overview
Align Curatarr with the Overseerr / Jellyseerr onboarding and access governance model:
- Primary Admin claiming on first Plex OAuth sign-in.
- Automatic discovery of Plex Media Servers owned/shared via `plex.tv/api/v2/resources` using the Admin's auth token.
- Seamless server selection dropdown with auto-configuration of connection endpoints, machine identifier, and server access tokens.
- Strict gatekeeping against the bound server's `machineIdentifier`.
- Standalone operation with native Plex watch history/activity when Tautulli/Overseerr are not present.
- Dedicated Plex Setup Wizard modal upon first login.
- Four-tab Settings structure:
  1. **Plex & Authentication**
  2. **Arr Connections**
  3. **Rules & Thresholds**
  4. **Users** (Full user management)

---

## 2. Architecture & Data Flow

### Backend Changes (.NET 10)
1. **`CuratarrSettings.cs`**:
   - `PlexAuthToken`: Persists Admin's Plex OAuth token for server discovery and friend/user verification.
   - `PlexServerMachineId`: Unique identifier for the bound Plex Media Server.
   - `PlexServerName`: Friendly display name for the bound Plex Media Server.
2. **`PlexEndpoints.cs`**:
   - `GET /api/v1/plex/servers`: Fetches discovered servers from `plex.tv/api/v2/resources?includeHttps=1` using the stored Admin token.
   - `POST /api/v1/plex/bind`: Binds the selected server, creating/updating the `ServiceConnection` (`ConnectionType.Plex`), testing identity (`/identity`), and saving settings.
   - `GET /api/v1/plex/status`: Returns current binding status (`isBound`, `serverName`, `machineIdentifier`, connection details).
3. **`PlexAuthService.cs`**:
   - On first user claim (`totalUsers == 0`), save the admin's `authToken` in `CuratarrSettings`.
   - On subsequent user logins, strictly verify server membership against `PlexServerMachineId`.
4. **`AuthEndpoints.cs`**:
   - Expose and verify `/api/v1/auth/users` endpoints for user management.

### Frontend Changes (React 19 + TypeScript + Zustand)
1. **`useAuthStore.ts` & `useSettingsStore.ts`**:
   - Add state and actions for Plex server discovery, binding, and status checking.
   - Add state and actions for user management (`fetchUsers`, `updateUserRole`, `deleteUser`).
2. **`PlexOnboardingModal.tsx`**:
   - Overseerr-style setup wizard. Prompts admin to choose their Plex Media Server from discovered servers.
   - Auto-selects owned/local connection; allows manual override and instant connection test.
3. **`SettingsPage.tsx`**:
   - Restructured into 4 tabs:
     - `Plex & Authentication`: Bound server card, re-scan/change server button, connection test, auth settings.
     - `Arr Connections`: Sonarr, Radarr, Tautulli, Overseerr with Docker auto-discovery and manual forms.
     - `Rules & Thresholds`: Governance and space hog thresholds.
     - `Users`: User management table with avatars, usernames, role toggle (Admin / Guest), and deletion.
4. **`App.tsx`**:
   - Shows `PlexOnboardingModal` for Admin if `isInitialized && !isPlexBound`.

---

## 3. Verification Protocol
1. **Backend Tests**:
   - Add tests for `PlexEndpoints` (`/api/v1/plex/servers`, `/api/v1/plex/bind`, `/api/v1/plex/status`).
   - Unit tests for `PlexAuthService` token retention and machine identifier matching.
2. **Frontend Tests**:
   - Tests for `PlexOnboardingModal`, new `SettingsPage` tabs, and user management actions.
3. **Build & Quality Gates**:
   - `./commit.sh` passing all 100+ backend and frontend tests with zero lint warnings.
   - Docker build and compose recreation.
4. **Documentation**:
   - Update `README.md` and VitePress documentation.
