# Watch History & Dynamic Era Cutoff

Curatarr integrates with Plex Media Server and Tautulli to correlate viewing activity against physical media inventory.

---

## Standalone Plex vs. Tautulli Telemetry

Curatarr is engineered to operate completely standalone or enhanced with Tautulli:

- **Standalone Plex Mode**: Curatarr queries Plex library section endpoints directly. It ingests native `viewCount` and `lastViewedAt` timestamps per item. This provides full coverage for smart categories (Never Watched, Stale, Abandoned TV) without needing Tautulli or any external companion software.
- **Enhanced Tautulli Mode**: When Tautulli is configured, Curatarr supplements Plex's global activity with Tautulli's granular per-user stream history, play durations, and individual user playback timestamps.

---

## The Pre-Tracking History Problem

Home media servers often run for years before logging tools like Tautulli or Plex activity tracking are installed.

For example:
- A user started their Plex server in 2012.
- Tautulli was installed in July 2017.
- Movies added in 2014 might have been watched dozens of times between 2014 and 2016, but show `0 plays` in Tautulli's database.
- Naive pruning rules would flag these classic favorites as "Never Watched (>90d)", risking accidental deletion.

---

## Dynamic Per-User Cutoff Engine

Curatarr solves this problem using a dynamic era cutoff engine:

1. **Calculates Historical Origin**: During synchronization, Curatarr evaluates `MIN(last_played_at)` from `watch_stats` across your database:
   - Global server start date (e.g. 2017)
   - Individual user join dates (e.g. 2018 for fiveomustang, 2019 for Jordan, 2023 for Ginkel)
2. **Missing Watch History Condition**:
   - If an active user has watched the title (`playCount > 0`), watch history is recorded. The item does not receive a pre-history badge.
   - If the active user has 0 plays on the item, Curatarr checks whether the item was added or released before that user's cutoff year.
3. **Dynamic Badge Rendering**:
   - Items predating the cutoff receive a prominent amber `Pre-YYYY` badge (e.g. `Pre-2017`, `Pre-2019`).
   - Tooltips explain that the item predates watch history tracking for the selected user.

![Grid View with Pre-2017 Badge](../assets/screenshots/curatarr-grid-view.png)

---

## Filtering by Era in the UI

In the **Control Bar**, the history filter adapts dynamically:
- When viewing **All Users (Combined)**: Filter options display `Hide Pre-2017` and `Only Pre-2017`.
- When filtering by a user who joined in 2019: Filter options automatically update to `Hide Pre-2019` and `Only Pre-2019`.

```
[ All History ▼ ]
  • All History
  • Hide Pre-2019
  • Only Pre-2019
```

This ensures you can safely evaluate a user's unwatched requests without purging older titles that they watched before joining the server.
