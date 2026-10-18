from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class ClimateQuery(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def valid_range(self):
        if self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        if (self.end_date - self.start_date).days > 365 * 15:
            raise ValueError("Please request no more than 15 years at a time")
        if self.start_date.year < 1981:
            raise ValueError("NASA POWER daily data starts in 1981; choose a later start date")
        return self


class FarmProfile(BaseModel):
    farm_name: str = Field(default="My farm", min_length=1, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    region: str = Field(default="Maharashtra, India", max_length=120)
    area_hectares: float = Field(default=1, gt=0, le=1000000)
    soil_texture: Literal["unknown", "sandy", "loamy", "clay", "silty", "black-cotton"] = "unknown"
    soil_ph: float | None = Field(default=None, ge=0, le=14)
    organic_matter_pct: float | None = Field(default=None, ge=0, le=100)
    drainage: Literal["unknown", "poor", "moderate", "good"] = "unknown"
    current_crop: str = "soybean"
    irrigation: Literal["rainfed", "limited", "reliable"] = "rainfed"
    priority: Literal["balanced", "soil_health", "water_saving", "market_stability", "climate_resilience"] = "balanced"
    budget: Literal["low", "medium", "flexible"] = "low"
    preferred_crops: list[str] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    farm: FarmProfile
    climate: dict | None = None


class ReportRequest(BaseModel):
    farm: FarmProfile
    climate: dict | None = None
    recommendations: list[dict] = Field(default_factory=list)
