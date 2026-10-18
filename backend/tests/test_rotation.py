from app.rotation import recommend_rotations, CROPS
from app.climate import summarize_power_payload


def test_recommendations_return_ranked_explainable_candidates():
    farm = {"farm_name":"Test","latitude":19.2,"longitude":73.1,"region":"Maharashtra","area_hectares":2,"soil_texture":"loamy","soil_ph":6.7,"organic_matter_pct":1.2,"drainage":"good","current_crop":"soybean","irrigation":"rainfed","priority":"water_saving","budget":"low","preferred_crops":[]}
    climate = {"summary":{"mean_temperature_c":27,"mean_annual_precipitation_mm":720}}
    result = recommend_rotations(farm, climate)
    assert len(result["ranked_rotations"]) >= 3
    assert all(0 <= item["score"] <= 100 for item in result["ranked_rotations"])
    assert all(item["reasons"] and item["risks"] for item in result["ranked_rotations"])
    assert result["ranked_rotations"][0]["score"] >= result["ranked_rotations"][-1]["score"]


def test_missing_data_is_disclosed():
    farm = {"priority":"balanced","irrigation":"rainfed","soil_ph":None,"soil_texture":"unknown","organic_matter_pct":None,"budget":"low"}
    result = recommend_rotations(farm, None)
    assert result["data_gaps"]
    assert all(item["confidence"] == "Low" for item in result["ranked_rotations"])


def test_climate_normalizer_handles_missing_values_and_month_aggregates():
    payload = {"properties":{"parameter":{
        "T2M":{"20250101":25.0,"20250102":-999},
        "T2M_MAX":{"20250101":31.0,"20250102":-999},
        "T2M_MIN":{"20250101":19.0,"20250102":-999},
        "PRECTOTCORR":{"20250101":2.0,"20250102":3.0}
    }}}
    result = summarize_power_payload(payload, {"latitude":19.2,"longitude":73.1,"start_date":"2025-01-01","end_date":"2025-01-02"})
    assert result["summary"]["mean_temperature_c"] == 25.0
    assert result["summary"]["total_precipitation_mm"] == 5.0
    assert result["monthly"][0]["month"] == "2025-01"
    assert result["summary"]["temperature_coverage_pct"] == 50.0


def test_crop_database_has_core_properties():
    assert "soybean" in CROPS
    assert "ph" in CROPS["soybean"]


def test_rotation_scores_stay_bounded_for_reliable_irrigation():
    farm = {"priority":"balanced","irrigation":"reliable","soil_ph":6.8,"soil_texture":"loamy","organic_matter_pct":2.0,"budget":"flexible"}
    climate = {"summary":{"mean_temperature_c":25,"mean_annual_precipitation_mm":700}}
    scores = [item["score"] for item in recommend_rotations(farm, climate)["ranked_rotations"]]
    assert all(0 <= score <= 100 for score in scores)


def test_farmer_preference_is_reflected_in_reasoning():
    farm = {"priority":"balanced","irrigation":"rainfed","soil_ph":6.8,"soil_texture":"loamy","organic_matter_pct":1.8,"budget":"low","current_crop":"soybean","preferred_crops":["cotton"]}
    climate = {"summary":{"mean_temperature_c":27,"mean_annual_precipitation_mm":650}}
    result = recommend_rotations(farm, climate)
    cotton_rotation = next(item for item in result["ranked_rotations"] if item["id"] == "cotton-pulse-millet")
    assert any("farmer-prioritized" in reason for reason in cotton_rotation["reasons"])
