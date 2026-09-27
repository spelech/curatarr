# Smart Categories

Curatarr evaluates your media collection against deterministic curation criteria. It categorizes titles into actionable buckets to help you find candidates for deletion.

---

## Category Specifications

### 1. Never Watched (>90d)
- **Criteria**: Item has been in your library for $\ge$ 90 days, and total recorded plays equals 0 across all tracked users.
- **Goal**: Reclaim storage from impulse downloads that were never consumed.
- **Exception**: Titles predating your watch history tracking start date display a `Pre-YYYY` warning badge so they are not deleted by mistake.

### 2. Stale (>365d)
- **Criteria**: The most recent recorded watch session was more than 365 days ago.
- **Goal**: Highlight media that has not been re-watched for over a year.

### 3. Abandoned TV (>365d)
- **Criteria**: Television series where all monitored episodes have been unplayed for over 365 days, or where viewing stopped mid-series.
- **Goal**: Clean up incomplete series or drop older seasons while preserving newer seasons.

### 4. Sub-720p (>=2000)
- **Criteria**: Media release year is 2000 or newer, but resolution is standard definition (SD / 480p / 576p).
- **Goal**: Identify low-resolution files that should be upgraded to 1080p/4K or deleted.

### 5. Cutoff Unmet
- **Criteria**: In Radarr or Sonarr, the quality profile cutoff has not been satisfied.
- **Goal**: Surface media waiting for higher-quality releases. You can trigger in-app quality upgrades directly from Curatarr.

### 6. Space Hogs
- **Criteria**: Items sorted by total disk usage in descending order.
- **Goal**: Identify heavy 4K REMUXes or multi-season series consuming disproportionate drive space.

### 7. Missing / Stalled
- **Criteria**: Media item is monitored in Sonarr or Radarr, but has no files on disk.
- **Goal**: Clean up phantom database records and unfulfilled grab requests.

---

## Category Summary API

Curatarr calculates reclaimable disk space in real time. The category engine runs relational SQLite aggregations:

```json
[
  {
    "categoryId": "never_watched",
    "name": "Never Watched (>90d)",
    "count": 308,
    "reclaimableSizeBytes": 2960374431137
  },
  {
    "categoryId": "stale",
    "name": "Stale (>365d)",
    "count": 974,
    "reclaimableSizeBytes": 13934168179673
  }
]
```

## Customizing Category Thresholds

Administrators can customize days-to-stale and age thresholds under **Settings & Rules** -> **Rules & Thresholds**.
