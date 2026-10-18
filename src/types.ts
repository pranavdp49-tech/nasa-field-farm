export interface FarmProfile {
  farm_name: string
  latitude: number
  longitude: number
  region: string
  area_hectares: number
  soil_texture: 'unknown' | 'sandy' | 'loamy' | 'clay' | 'silty' | 'black-cotton'
  soil_ph: number | null
  organic_matter_pct: number | null
  drainage: 'unknown' | 'poor' | 'moderate' | 'good'
  current_crop: string
  irrigation: 'rainfed' | 'limited' | 'reliable'
  priority: 'balanced' | 'soil_health' | 'water_saving' | 'market_stability' | 'climate_resilience'
  budget: 'low' | 'medium' | 'flexible'
  preferred_crops: string[]
}

export interface MonthlyClimate {
  month: string
  temperature_c: number | null
  temperature_max_c: number | null
  temperature_min_c: number | null
  precipitation_mm: number | null
  valid_temperature_days: number
  valid_precipitation_days: number
}

export interface ClimateData {
  source: string
  source_url: string
  community: string
  latitude: number
  longitude: number
  period: { start: string; end: string }
  retrieved_at: string
  units: Record<string, string>
  parameter_descriptions: Record<string, string>
  summary: {
    mean_temperature_c: number | null
    mean_daily_max_c: number | null
    mean_daily_min_c: number | null
    total_precipitation_mm: number | null
    mean_annual_precipitation_mm: number | null
    valid_temperature_days: number
    valid_precipitation_days: number
    requested_days: number
    temperature_coverage_pct: number
    precipitation_coverage_pct: number
    annual_precipitation: { year: string; precipitation_mm: number }[]
    years_available: string[]
  }
  monthly: MonthlyClimate[]
  daily: { date: string; t2m: number | null; t2m_max: number | null; t2m_min: number | null; prectotcorr: number | null }[]
  limitations: string[]
  cache?: 'hit' | 'miss'
  nasa_messages?: string[]
}

export interface CropInfo {
  name: string
  family: string
  rainfall_mm: [number, number]
  temp_c: [number, number]
  ph: [number, number]
  water: number
  legume: boolean
  cover: number
  budget: number
  season: string
  notes: string
}

export interface Rotation {
  id: string
  name: string
  crops: string[]
  region: string
  description: string
  score: number
  score_label: string
  confidence: string
  components: {
    climate: number
    water: number
    soil: number
    diversity: number
    budget: number
  }
  crops_detail: { id: string; name: string; family: string; season: string; notes: string; water: number }[]
  reasons: string[]
  risks: string[]
}

export interface RecommendationData {
  ranked_rotations: Rotation[]
  method: string
  weights: Record<string, number>
  crop_database_version: string
  data_gaps: string[]
}
