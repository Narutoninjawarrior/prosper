# `three_forge/world_state` — Bellows authority schema

The Hearthlands 3D surfaces (`/biosphere`, `/world`, ThreeForge) are **read-only dashboards**.  
`heartbeat.py` (the Bellows) is the only writer via Admin SDK (`hearth_firestore.py`).

## Document path

`three_forge` / `world_state`

## Root fields (economy + pulse)

| Field | Type | Writer | Description |
|-------|------|--------|-------------|
| `heat` | number | Bellows | Lodge $HEAT; drives lighting and forge modules |
| `ember_balance` | number | Bellows | Aggregate $EMBER (soulfile + mined) |
| `tick` | number | Bellows | Monotonic heartbeat counter |
| `heartbeat_at` | string (ISO-8601 UTC) | Bellows | Last successful pulse |
| `agent_id` | string | Bellows | Active soulfile agent id |
| `last_intent` | string | Bellows | Last World Brain intent (`plant`, `harvest`, `wait`, …) |
| `sim2real` | object | Bellows | Open-Meteo via `sensor_bridge.py` (see below) |

## `sim2real` (environmental bridge)

Written every Bellows tick; refreshed from Open-Meteo every **12 ticks** (~60s at 5s pulse).

| Field | Type | Notes |
|-------|------|-------|
| `source` | string | `open-meteo`, `open-meteo-stale`, `fallback` |
| `temperature` | number | °C — tints ambient / hemisphere in Biosphere |
| `wind_angle` | number | radians — `WindCatcher` vane target |
| `wind_direction_deg` | number | meteorological degrees (wind FROM) |
| `windspeed_kmh` | number | km/h |
| `is_raining` | boolean | WMO drizzle/rain/showers bands |
| `weathercode` | number | WMO code |
| `is_day` | boolean | dims lights at night |
| `fetched_at` | string | ISO UTC |
| `latitude` / `longitude` | number | from `HEARTH_WEATHER_LAT` / `LON` env |

Env (repo root):

```bash
set HEARTH_WEATHER_LAT=37.7749
set HEARTH_WEATHER_LON=-122.4194
python scripts\bellows_tick_once.py --intent wait
```

## `biosphere_nodes` (19 Flower of Life plots)

Array of exactly **19** entries, ids `0`–`18`. Bellows owns planting and growth.

```json
{
  "id": 1,
  "active": true,
  "bloom_stage": 2,
  "substance": null
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | 0 = Hearth center; 1–6 inner; 7–12 middle; 13–18 outer |
| `active` | boolean | Has a living plot |
| `bloom_stage` | number | 0–6; resonance requires `active && bloom_stage >= 1` |
| `substance` | string \| null | Future reagent key from IoT / dissolve |

## `nodes` (legacy Forge array)

Unchanged: placed Forge objects (`flora`, `water`, `lodge`, …) with `x`, `y`, `z`.  
Optional `biosphere_node_id` links a forge node to a biosphere plot for hybrid sync.

Bellows **must not** delete arbitrary forge nodes; it only updates `biosphere_nodes` and root economy fields unless a future bounty defines forge placement from Python.

## Read paths (frontend)

| Route | Reads |
|-------|--------|
| `BiosphereRoute` | `heat`, `ember_balance`, `biosphere_nodes`, status chip |
| `WorldRoute` / `ThreeForge` | `nodes`, `heat` from peak `heat_level` |
| `interactionEngine` | `nodes` (client tick — separate from Bellows; steward/server only long-term) |

## Credentials

```bash
# Repo root — same service account as npm run sync:firestore
set GOOGLE_APPLICATION_CREDENTIALS=D:\path\to\service-account.json
set FIREBASE_PROJECT_ID=fellowship-of-the-hearth   # optional if embedded in JSON
python heartbeat.py
```

Offline: without credentials, Bellows mirrors to `hearth_world_state.json` at repo root (gitignored in normal use).

## Intent → garden (Phase 1)

| World Brain `intent` | Bellows action |
|----------------------|----------------|
| `plant` | Activate lowest-id inactive **inner** node (1–6), `bloom_stage = 1`, costs 5 $EMBER |
| `harvest` | Deactivate highest `bloom_stage` inner node with `bloom_stage >= 4` |
| other / `wait` | Grow all active plots +1 stage per 3 ticks (cap 6) |

Resonance is computed **only in the frontend** from `biosphere_nodes` (`resonance.ts`).
