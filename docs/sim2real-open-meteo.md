# Sim2Real — Open-Meteo environmental bridge

## Data flow

```
Open-Meteo API (keyless)
    ↓ sensor_bridge.fetch_open_meteo()  [every 12 Bellows ticks]
biosphere_bellows.apply_bellows_tick()
    ↓ hearth_firestore.push_world_state()
three_forge/world_state.sim2real
    ↓ onSnapshot (read-only)
/biosphere → BiosphereLighting, WindCatcher, WaterCatchmentTower
```

## Coordinates

Set before running heartbeat (defaults: San Francisco):

```powershell
$env:HEARTH_WEATHER_LAT = "37.7749"
$env:HEARTH_WEATHER_LON = "-122.4194"
```

## Verify

```powershell
python -c "from sensor_bridge import fetch_open_meteo; print(fetch_open_meteo())"
python scripts\bellows_tick_once.py --intent wait
```

Open `/biosphere` with Firebase configured. Status chip shows `21.6°C` (example). Wind vanes track `wind_angle`; terracotta petals open when `is_raining` is true (WMO 51–67, 80–82, 95/96/99).

## Failure modes

| Condition | Behavior |
|-----------|----------|
| API timeout | Keeps last `open-meteo-stale` cache or prior Firestore `sim2real` |
| No cache | `fallback` (20°C, no rain) — Bellows never crashes |
| No Firestore creds | `hearth_world_state.json` mirror still gets `sim2real` |

Growth logic (`plant` / `harvest` / bloom stages) is unchanged.
