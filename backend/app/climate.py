from __future__ import annotations
from datetime import date, datetime, timezone
from statistics import mean
from typing import Any
import httpx

NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = ("T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR")
CACHE_SECONDS = 1800
_cache: dict[tuple, tuple[float, dict]] = {}


def _number(raw: Any) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if value <= -900 or value != value or abs(value) == float("inf"):
        return None
    return value


def summarize_power_payload(payload: dict, query: dict) -> dict:
    """Normalize NASA POWER daily JSON and calculate transparent summaries."""
    properties = payload.get("properties") or {}
    raw_params = properties.get("parameter") or {}
    if not raw_params:
        raise ValueError("NASA POWER returned no parameter data for this request")

    date_keys: set[str] = set()
    for values in raw_params.values():
        date_keys.update(values.keys())

    daily = []
    for day_key in sorted(date_keys):
        try:
            day = datetime.strptime(day_key, "%Y%m%d").date().isoformat()
        except ValueError:
            continue
        item = {"date": day}
        for param in PARAMETERS:
            value_map = raw_params.get(param) or {}
            item[param.lower()] = _number(value_map.get(day_key))
        if any(item[p.lower()] is not None for p in PARAMETERS):
            daily.append(item)

    if not daily:
        raise ValueError("NASA POWER returned no usable daily values for the selected period")

    valid_temps = [r["t2m"] for r in daily if r["t2m"] is not None]
    valid_max = [r["t2m_max"] for r in daily if r["t2m_max"] is not None]
    valid_min = [r["t2m_min"] for r in daily if r["t2m_min"] is not None]
    valid_rain = [r["prectotcorr"] for r in daily if r["prectotcorr"] is not None]

    grouped: dict[str, list[dict]] = {}
    for row in daily:
        grouped.setdefault(row["date"][:7], []).append(row)
    monthly = []
    for ym, rows in sorted(grouped.items()):
        temps = [r["t2m"] for r in rows if r["t2m"] is not None]
        maxes = [r["t2m_max"] for r in rows if r["t2m_max"] is not None]
        mins = [r["t2m_min"] for r in rows if r["t2m_min"] is not None]
        rains = [r["prectotcorr"] for r in rows if r["prectotcorr"] is not None]
        monthly.append({
            "month": ym,
            "temperature_c": round(mean(temps), 2) if temps else None,
            "temperature_max_c": round(mean(maxes), 2) if maxes else None,
            "temperature_min_c": round(mean(mins), 2) if mins else None,
            "precipitation_mm": round(sum(rains), 1) if rains else None,
            "valid_temperature_days": len(temps),
            "valid_precipitation_days": len(rains),
        })

    years: dict[str, list[float]] = {}
    for row in daily:
        if row["prectotcorr"] is not None:
            years.setdefault(row["date"][:4], []).append(row["prectotcorr"])
    annual = [{"year": year, "precipitation_mm": round(sum(vals), 1)} for year, vals in sorted(years.items())]

    requested_days = (date.fromisoformat(query["end_date"]) - date.fromisoformat(query["start_date"])).days + 1
    temperature_days = sum(r["t2m"] is not None for r in daily)
    precipitation_days = sum(r["prectotcorr"] is not None for r in daily)
    available_years = sorted({r["date"][:4] for r in daily})
    return {
        "source": "NASA POWER Daily Point API",
        "source_url": NASA_POWER_URL,
        "community": "AG (Agroclimatology)",
        "latitude": query["latitude"],
        "longitude": query["longitude"],
        "period": {"start": query["start_date"], "end": query["end_date"]},
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "units": {"t2m": "°C", "t2m_max": "°C", "t2m_min": "°C", "prectotcorr": "mm/day"},
        "parameter_descriptions": {
            "T2M": "Daily mean air temperature",
            "T2M_MAX": "Daily maximum air temperature",
            "T2M_MIN": "Daily minimum air temperature",
            "PRECTOTCORR": "Corrected precipitation estimate",
        },
        "summary": {
            "mean_temperature_c": round(mean(valid_temps), 2) if valid_temps else None,
            "mean_daily_max_c": round(mean(valid_max), 2) if valid_max else None,
            "mean_daily_min_c": round(mean(valid_min), 2) if valid_min else None,
            "total_precipitation_mm": round(sum(valid_rain), 1) if valid_rain else None,
            "mean_annual_precipitation_mm": round(mean([x["precipitation_mm"] for x in annual]), 1) if annual else None,
            "valid_temperature_days": len(valid_temps),
            "valid_precipitation_days": len(valid_rain),
            "requested_days": requested_days,
            "temperature_coverage_pct": round(100 * temperature_days / requested_days, 1),
            "precipitation_coverage_pct": round(100 * precipitation_days / requested_days, 1),
            "annual_precipitation": annual,
            "years_available": available_years,
        },
        "monthly": monthly,
        "daily": daily,
        "limitations": [
            "NASA POWER provides gridded, point-requested meteorological estimates; it is not a field rain gauge or direct soil-moisture/soil-fertility measurement.",
            "Precipitation and meteorological parameters have source-specific spatial resolution. Conditions within a small field may differ from the grid cell.",
            "Historical climate summaries describe the selected period and do not constitute a future climate forecast.",
        ],
    }


async def get_climate(query: dict) -> dict:
    import time
    cache_key = (round(query["latitude"], 4), round(query["longitude"], 4), query["start_date"], query["end_date"])
    cached = _cache.get(cache_key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        result = dict(cached[1])
        result["cache"] = "hit"
        return result

    params = {
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "longitude": query["longitude"],
        "latitude": query["latitude"],
        "start": query["start_date"].replace("-", ""),
        "end": query["end_date"].replace("-", ""),
        "format": "JSON",
        "time-standard": "UTC",
    }
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(35.0, connect=10.0), follow_redirects=True) as client:
            response = await client.get(NASA_POWER_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as exc:
        raise RuntimeError("NASA POWER request timed out. Try again shortly or select a shorter date range.") from exc
    except httpx.HTTPStatusError as exc:
        raise RuntimeError(f"NASA POWER returned HTTP {exc.response.status_code}. Check the date range and retry.") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise RuntimeError("Could not reach NASA POWER or parse its response. Check your internet connection and retry.") from exc

    messages = payload.get("messages") or []
    errors = payload.get("errors") or []
    if errors:
        raise RuntimeError("NASA POWER reported: " + "; ".join(str(e) for e in errors[:3]))
    try:
        result = summarize_power_payload(payload, query)
    except ValueError as exc:
        raise RuntimeError(str(exc)) from exc
    if messages:
        result["nasa_messages"] = messages
    _cache[cache_key] = (time.time(), result)
    result["cache"] = "miss"
    return result
