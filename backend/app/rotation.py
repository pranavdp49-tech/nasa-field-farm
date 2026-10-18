from __future__ import annotations
from itertools import combinations
from statistics import mean

# Regional starter profiles are screening heuristics, not locally validated prescriptions.
# rainfall_mm refers to broad annual-climate screening, never crop-season water balance.
CROPS = {
    "pearl_millet": {"name": "Pearl millet (bajra)", "family": "cereal", "rainfall_mm": (250, 650), "temp_c": (20, 35), "ph": (5.5, 8.0), "water": 1, "legume": False, "cover": 2, "budget": 1, "season": "Kharif", "notes": "Drought-tolerant cereal; residue retention can support soil cover."},
    "sorghum": {"name": "Sorghum (jowar)", "family": "cereal", "rainfall_mm": (300, 800), "temp_c": (20, 35), "ph": (5.5, 8.5), "water": 1, "legume": False, "cover": 2, "budget": 1, "season": "Kharif / Rabi", "notes": "Often suitable for semi-arid systems; cultivar and season matter."},
    "chickpea": {"name": "Chickpea (chana)", "family": "legume", "rainfall_mm": (250, 650), "temp_c": (15, 30), "ph": (5.5, 8.0), "water": 1, "legume": True, "cover": 1, "budget": 1, "season": "Rabi", "notes": "Pulse crop; may contribute biologically fixed nitrogen when nodulation and management are effective."},
    "pigeon_pea": {"name": "Pigeon pea (tur)", "family": "legume", "rainfall_mm": (400, 1000), "temp_c": (20, 35), "ph": (5.0, 8.0), "water": 2, "legume": True, "cover": 2, "budget": 2, "season": "Kharif", "notes": "Deep-rooted pulse; duration and rainfall distribution are important."},
    "soybean": {"name": "Soybean", "family": "oilseed-legume", "rainfall_mm": (500, 1000), "temp_c": (20, 32), "ph": (5.5, 7.5), "water": 3, "legume": True, "cover": 2, "budget": 2, "season": "Kharif", "notes": "Requires suitable drainage and a well-matched monsoon window."},
    "groundnut": {"name": "Groundnut", "family": "oilseed-legume", "rainfall_mm": (400, 900), "temp_c": (20, 32), "ph": (5.5, 7.5), "water": 2, "legume": True, "cover": 1, "budget": 2, "season": "Kharif / Summer", "notes": "Legume; soil calcium, drainage and harvesting conditions can be decisive."},
    "maize": {"name": "Maize", "family": "cereal", "rainfall_mm": (500, 1000), "temp_c": (18, 32), "ph": (5.5, 7.5), "water": 3, "legume": False, "cover": 2, "budget": 2, "season": "Kharif / Rabi", "notes": "Water and nutrient demand varies strongly by variety and season."},
    "cotton": {"name": "Cotton", "family": "fibre", "rainfall_mm": (500, 1000), "temp_c": (21, 35), "ph": (5.5, 8.0), "water": 3, "legume": False, "cover": 2, "budget": 3, "season": "Kharif", "notes": "Long-duration crop; pest history and market volatility need local review."},
    "mungbean": {"name": "Green gram (moong)", "family": "legume", "rainfall_mm": (250, 700), "temp_c": (25, 35), "ph": (5.5, 7.5), "water": 1, "legume": True, "cover": 1, "budget": 1, "season": "Kharif / Summer", "notes": "Short-duration pulse; a suitable window and seed availability are required."},
    "wheat": {"name": "Wheat", "family": "cereal", "rainfall_mm": (350, 900), "temp_c": (10, 25), "ph": (6.0, 8.0), "water": 3, "legume": False, "cover": 2, "budget": 2, "season": "Rabi", "notes": "Heat stress near grain filling and irrigation access need local assessment."},
    "rice": {"name": "Rice", "family": "cereal", "rainfall_mm": (1000, 2500), "temp_c": (20, 35), "ph": (5.0, 7.5), "water": 4, "legume": False, "cover": 2, "budget": 3, "season": "Kharif", "notes": "Requires suitable water management; not a default choice for water-limited fields."},
}

ROTATIONS = [
    {"id": "dryland-diverse", "name": "Dryland diversity", "crops": ["pearl_millet", "pigeon_pea", "chickpea"], "region": "Semi-arid screening", "description": "Alternates drought-tolerant cereals and pulses across years."},
    {"id": "soy-chickpea-sorghum", "name": "Soybean → chickpea → sorghum", "crops": ["soybean", "chickpea", "sorghum"], "region": "Monsoon / dry-season screening", "description": "Combines a monsoon oilseed legume, a cool-season pulse and a robust cereal."},
    {"id": "cotton-pulse-millet", "name": "Cotton → chickpea → pearl millet", "crops": ["cotton", "chickpea", "pearl_millet"], "region": "Cotton belt screening", "description": "Keeps a pulse break within a cotton-focused farm system."},
    {"id": "sorghum-groundnut-chickpea", "name": "Sorghum → groundnut → chickpea", "crops": ["sorghum", "groundnut", "chickpea"], "region": "Dryland / oilseed screening", "description": "Uses cereal and pulse/oilseed diversity with water needs that still require seasonal checking."},
    {"id": "maize-mungbean-sorghum", "name": "Maize → green gram → sorghum", "crops": ["maize", "mungbean", "sorghum"], "region": "Warm-season screening", "description": "Adds a short-duration pulse between cereal years; maize suitability must be checked carefully."},
    {"id": "chickpea-millet-pigeonpea", "name": "Chickpea → pearl millet → pigeon pea", "crops": ["chickpea", "pearl_millet", "pigeon_pea"], "region": "Rainfall-risk screening", "description": "Starts with a pulse and then shifts crop family and rooting pattern."},
]

PRIORITY_WEIGHTS = {
    "balanced": {"climate": 0.25, "water": 0.20, "soil": 0.25, "diversity": 0.20, "budget": 0.10},
    "soil_health": {"climate": 0.18, "water": 0.12, "soil": 0.25, "diversity": 0.35, "budget": 0.10},
    "water_saving": {"climate": 0.20, "water": 0.38, "soil": 0.18, "diversity": 0.16, "budget": 0.08},
    "market_stability": {"climate": 0.22, "water": 0.16, "soil": 0.18, "diversity": 0.16, "budget": 0.28},
    "climate_resilience": {"climate": 0.36, "water": 0.25, "soil": 0.17, "diversity": 0.17, "budget": 0.05},
}


def _range_fit(value: float | None, bounds: tuple[float, float], tolerance: float) -> float | None:
    if value is None:
        return None
    lo, hi = bounds
    if lo <= value <= hi:
        return 100.0
    distance = lo - value if value < lo else value - hi
    return max(0.0, 100.0 - (distance / tolerance) * 100.0)


def recommend_rotations(farm: dict, climate: dict | None = None) -> dict:
    climate = climate or {}
    summary = climate.get("summary", {}) if isinstance(climate, dict) else {}
    mean_temp = summary.get("mean_temperature_c")
    annual_rain = summary.get("mean_annual_precipitation_mm")
    weights = PRIORITY_WEIGHTS.get(farm.get("priority", "balanced"), PRIORITY_WEIGHTS["balanced"])
    items = []
    for rotation in ROTATIONS:
        profiles = [CROPS[key] for key in rotation["crops"]]
        temp_fits = [_range_fit(mean_temp, crop["temp_c"], 12) for crop in profiles]
        rain_fits = [_range_fit(annual_rain, crop["rainfall_mm"], 600) for crop in profiles]
        soil_fits = [_range_fit(farm.get("soil_ph"), crop["ph"], 2) for crop in profiles]

        climate_parts = [v for v in temp_fits + rain_fits if v is not None]
        climate_score = mean(climate_parts) if climate_parts else 55.0
        water_need = mean(c["water"] for c in profiles)
        water_score = min(100, max(0, 100 - (water_need - (1 if farm.get("irrigation") == "rainfed" else 2 if farm.get("irrigation") == "limited" else 3)) * 25))
        if farm.get("irrigation") == "rainfed":
            water_score = mean(min(100, max(0, 100 - (c["water"] - 1) * 30)) for c in profiles)
        soil_score = mean(soil_fits) if any(v is not None for v in soil_fits) else 60.0
        unique_families = len({c["family"] for c in profiles})
        legume_count = sum(c["legume"] for c in profiles)
        diversity_score = min(100, 45 + (unique_families - 1) * 22 + min(legume_count, 2) * 8)
        if farm.get("organic_matter_pct") is not None and farm["organic_matter_pct"] < 1.5:
            diversity_score = min(100, diversity_score + mean(c["cover"] for c in profiles) * 3)
        budget_cap = {"low": 1, "medium": 2, "flexible": 3}.get(farm.get("budget", "low"), 1)
        budget_score = mean(max(25, 100 - max(0, c["budget"] - budget_cap) * 30) for c in profiles)
        component = {"climate": climate_score, "water": water_score, "soil": soil_score, "diversity": diversity_score, "budget": budget_score}
        raw_score = sum(component[k] * weights[k] for k in weights)
        current_crop = farm.get("current_crop")
        repeats_current = bool(current_crop and rotation["crops"][0] == current_crop)
        preferred = set(farm.get("preferred_crops") or [])
        matched_preferences = preferred.intersection(rotation["crops"])
        preference_bonus = 5 if matched_preferences else 0
        continuity_penalty = 8 if repeats_current else 0
        score = round(max(0, min(100, raw_score + preference_bonus - continuity_penalty)))
        reasons = []
        if legume_count:
            reasons.append("Includes a pulse/legume; potential nitrogen contribution depends on nodulation, harvest removal and residue management.")
        if matched_preferences:
            names = ", ".join(CROPS[key]["name"] for key in sorted(matched_preferences) if key in CROPS)
            reasons.append(f"Includes farmer-prioritized crop(s): {names}.")
        if repeats_current:
            reasons.append("The sequence begins with the current main crop; check disease history and whether a crop-family break is needed.")
        if unique_families >= 3:
            reasons.append("Uses three crop families across the sequence, improving crop-family diversity.")
        if farm.get("irrigation") == "rainfed" and water_need <= 2:
            reasons.append("Relative water demand is lower than the candidate set's more water-intensive rotations.")
        if farm.get("soil_ph") is None:
            reasons.append("Soil pH is unknown; obtain a soil test before treating this as a field-specific recommendation.")
        if mean_temp is None or annual_rain is None:
            reasons.append("Climate inputs are incomplete; climate fit remains a broad placeholder and confidence is reduced.")
        risks = []
        if any(c["water"] >= 3 for c in profiles) and farm.get("irrigation") == "rainfed":
            risks.append("One or more crops can be water-demanding; verify in-season rainfall and local varieties.")
        if farm.get("soil_texture") == "sandy" and any(c["water"] >= 3 for c in profiles):
            risks.append("Sandy soil may have limited water storage; consider soil cover and field-specific water planning.")
        if farm.get("drainage") == "poor" and any(key in {"soybean", "groundnut", "chickpea"} for key in rotation["crops"]):
            risks.append("Poor drainage can be unsuitable for some crops in this sequence; verify field drainage and local variety guidance.")
        if mean_temp is None or annual_rain is None:
            risks.append("No complete NASA climate summary is available for this ranking.")
        if not risks:
            risks.append("Confirm crop calendars, pests, market access and soil-test results with a local agronomist.")
        confidence = "Low" if mean_temp is None or annual_rain is None or farm.get("soil_ph") is None else "Moderate screening confidence"
        items.append({
            **rotation,
            "score": score,
            "score_label": "Relative fit score (heuristic, not a yield forecast)",
            "confidence": confidence,
            "components": {k: round(v) for k, v in component.items()},
            "crops_detail": [{"id": key, **CROPS[key]} for key in rotation["crops"]],
            "reasons": reasons,
            "risks": risks,
        })
    items.sort(key=lambda item: item["score"], reverse=True)
    return {
        "ranked_rotations": items,
        "method": "Transparent weighted screening model. Scores rank options within this candidate set and are not measured crop performance, yield, profit, or guaranteed soil-health outcomes.",
        "weights": weights,
        "crop_database_version": "starter-2026-01",
        "data_gaps": [msg for cond, msg in [
            (not climate, "Fetch NASA POWER climate data for a climate-informed comparison."),
            (farm.get("soil_ph") is None, "A lab soil pH result would improve soil-compatibility screening."),
            (farm.get("soil_texture") == "unknown", "Add soil texture from a reliable soil test or field assessment."),
        ] if cond],
    }
