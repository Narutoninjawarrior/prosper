"""
sensor_bridge.py
Sim2Real environmental input — Open-Meteo (keyless, no auth).

Env:
  HEARTH_WEATHER_LAT   default 37.7749
  HEARTH_WEATHER_LON   default -122.4194
  HEARTH_WEATHER_TIMEOUT_SEC  default 8
"""

from __future__ import annotations

import json
import math
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

# Liquid + shower WMO codes (Open-Meteo interpretation)
_RAIN_WMO_MIN = 51
_RAIN_WMO_MAX = 67
_SHOWER_WMO_MIN = 80
_SHOWER_WMO_MAX = 82

_cache: dict[str, Any] | None = None
_cache_tick: int = -1


def _coords() -> tuple[float, float]:
    lat = float(os.environ.get("HEARTH_WEATHER_LAT", "37.7749"))
    lon = float(os.environ.get("HEARTH_WEATHER_LON", "-122.4194"))
    return lat, lon


def _timeout() -> float:
    return float(os.environ.get("HEARTH_WEATHER_TIMEOUT_SEC", "8"))


def _is_raining(weathercode: int) -> bool:
    if _RAIN_WMO_MIN <= weathercode <= _RAIN_WMO_MAX:
        return True
    if _SHOWER_WMO_MIN <= weathercode <= _SHOWER_WMO_MAX:
        return True
    return weathercode in (95, 96, 99)


def fallback_sim2real() -> dict[str, Any]:
    lat, lon = _coords()
    return {
        "source": "fallback",
        "fetched_at": None,
        "latitude": lat,
        "longitude": lon,
        "temperature": 20.0,
        "windspeed_kmh": 0.0,
        "wind_direction_deg": 0,
        "wind_angle": 0.0,
        "is_raining": False,
        "weathercode": 0,
        "is_day": True,
        "error": None,
    }


def fetch_open_meteo() -> dict[str, Any] | None:
    """
    Synchronous Open-Meteo current weather. Returns sim2real dict or None on failure.
    """
    lat, lon = _coords()
    params = urllib.parse.urlencode({
        "latitude": lat,
        "longitude": lon,
        "current_weather": "true",
        "timezone": "GMT",
    })
    url = f"{OPEN_METEO_BASE}?{params}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Hearthlands-Bellows/1.0"})
        with urllib.request.urlopen(req, timeout=_timeout()) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError, OSError) as exc:
        print(f"[sensor_bridge] Open-Meteo failed: {exc}")
        return None

    cw = body.get("current_weather")
    if not isinstance(cw, dict):
        print("[sensor_bridge] Open-Meteo response missing current_weather")
        return None

    temp = float(cw.get("temperature", 20.0))
    wind_kmh = float(cw.get("windspeed", 0.0))
    wind_deg = float(cw.get("winddirection", 0.0))
    code = int(cw.get("weathercode", 0))
    is_day = bool(cw.get("is_day", 1))

    # Meteorological wind direction (degrees, wind FROM) → Three.js Y rotation (radians)
    wind_angle = math.radians(wind_deg)

    return {
        "source": "open-meteo",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "latitude": lat,
        "longitude": lon,
        "temperature": round(temp, 1),
        "windspeed_kmh": round(wind_kmh, 1),
        "wind_direction_deg": round(wind_deg, 1),
        "wind_angle": round(wind_angle, 4),
        "is_raining": _is_raining(code),
        "weathercode": code,
        "is_day": is_day,
        "error": None,
    }


def resolve_sim2real(
    tick: int,
    existing: dict[str, Any] | None,
    *,
    refresh_every_ticks: int = 12,
) -> dict[str, Any]:
    """
    Return sim2real for this Bellows tick. Refreshes Open-Meteo every N ticks (~1 min @ 5s).
    On failure, keeps last good reading or fallback — never raises.
    """
    global _cache, _cache_tick

    existing = existing if isinstance(existing, dict) else {}
    should_fetch = (
        tick <= 0
        or _cache is None
        or tick - _cache_tick >= refresh_every_ticks
    )

    if should_fetch:
        fresh = fetch_open_meteo()
        if fresh:
            _cache = fresh
            _cache_tick = tick
            return fresh
        if _cache:
            stale = {**_cache, "source": "open-meteo-stale", "error": "fetch_failed"}
            return stale
        if existing.get("temperature") is not None:
            return {**existing, "source": existing.get("source", "stale"), "error": "fetch_failed"}
        return fallback_sim2real()

    if _cache:
        return _cache
    if existing.get("temperature") is not None:
        return existing
    return fallback_sim2real()
