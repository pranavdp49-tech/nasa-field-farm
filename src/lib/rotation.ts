import type { FarmProfile, ClimateData, CropInfo, RecommendationData, Rotation } from '../types'

export const CROPS: Record<string, CropInfo> = {
  pearl_millet: {
    name: 'Pearl millet (bajra)',
    family: 'cereal',
    rainfall_mm: [250, 650],
    temp_c: [20, 35],
    ph: [5.5, 8.0],
    water: 1,
    legume: false,
    cover: 2,
    budget: 1,
    season: 'Kharif',
    notes: 'Drought-tolerant cereal; residue retention can support soil cover.',
  },
  sorghum: {
    name: 'Sorghum (jowar)',
    family: 'cereal',
    rainfall_mm: [300, 800],
    temp_c: [20, 35],
    ph: [5.5, 8.5],
    water: 1,
    legume: false,
    cover: 2,
    budget: 1,
    season: 'Kharif / Rabi',
    notes: 'Often suitable for semi-arid systems; cultivar and season matter.',
  },
  chickpea: {
    name: 'Chickpea (chana)',
    family: 'legume',
    rainfall_mm: [250, 650],
    temp_c: [15, 30],
    ph: [5.5, 8.0],
    water: 1,
    legume: true,
    cover: 1,
    budget: 1,
    season: 'Rabi',
    notes: 'Pulse crop; may contribute biologically fixed nitrogen when nodulation and management are effective.',
  },
  pigeon_pea: {
    name: 'Pigeon pea (tur)',
    family: 'legume',
    rainfall_mm: [400, 1000],
    temp_c: [20, 35],
    ph: [5.0, 8.0],
    water: 2,
    legume: true,
    cover: 2,
    budget: 2,
    season: 'Kharif',
    notes: 'Deep-rooted pulse; duration and rainfall distribution are important.',
  },
  soybean: {
    name: 'Soybean',
    family: 'oilseed-legume',
    rainfall_mm: [500, 1000],
    temp_c: [20, 32],
    ph: [5.5, 7.5],
    water: 3,
    legume: true,
    cover: 2,
    budget: 2,
    season: 'Kharif',
    notes: 'Requires suitable drainage and a well-matched monsoon window.',
  },
  groundnut: {
    name: 'Groundnut',
    family: 'oilseed-legume',
    rainfall_mm: [400, 900],
    temp_c: [20, 32],
    ph: [5.5, 7.5],
    water: 2,
    legume: true,
    cover: 1,
    budget: 2,
    season: 'Kharif / Summer',
    notes: 'Legume; soil calcium, drainage and harvesting conditions can be decisive.',
  },
  maize: {
    name: 'Maize',
    family: 'cereal',
    rainfall_mm: [500, 1000],
    temp_c: [18, 32],
    ph: [5.5, 7.5],
    water: 3,
    legume: false,
    cover: 2,
    budget: 2,
    season: 'Kharif / Rabi',
    notes: 'Water and nutrient demand varies strongly by variety and season.',
  },
  cotton: {
    name: 'Cotton',
    family: 'fibre',
    rainfall_mm: [500, 1000],
    temp_c: [21, 35],
    ph: [5.5, 8.0],
    water: 3,
    legume: false,
    cover: 2,
    budget: 3,
    season: 'Kharif',
    notes: 'Long-duration crop; pest history and market volatility need local review.',
  },
  mungbean: {
    name: 'Green gram (moong)',
    family: 'legume',
    rainfall_mm: [250, 700],
    temp_c: [25, 35],
    ph: [5.5, 7.5],
    water: 1,
    legume: true,
    cover: 1,
    budget: 1,
    season: 'Kharif / Summer',
    notes: 'Short-duration pulse; a suitable window and seed availability are required.',
  },
  wheat: {
    name: 'Wheat',
    family: 'cereal',
    rainfall_mm: [350, 900],
    temp_c: [10, 25],
    ph: [6.0, 8.0],
    water: 3,
    legume: false,
    cover: 2,
    budget: 2,
    season: 'Rabi',
    notes: 'Heat stress near grain filling and irrigation access need local assessment.',
  },
  rice: {
    name: 'Rice',
    family: 'cereal',
    rainfall_mm: [1000, 2500],
    temp_c: [20, 35],
    ph: [5.0, 7.5],
    water: 4,
    legume: false,
    cover: 2,
    budget: 3,
    season: 'Kharif',
    notes: 'Requires suitable water management; not a default choice for water-limited fields.',
  },
}

export const ROTATIONS_LIST: { id: string; name: string; crops: string[]; region: string; description: string }[] = [
  {
    id: 'dryland-diverse',
    name: 'Dryland diversity',
    crops: ['pearl_millet', 'pigeon_pea', 'chickpea'],
    region: 'Semi-arid screening',
    description: 'Alternates drought-tolerant cereals and pulses across years.',
  },
  {
    id: 'soy-chickpea-sorghum',
    name: 'Soybean → chickpea → sorghum',
    crops: ['soybean', 'chickpea', 'sorghum'],
    region: 'Monsoon / dry-season screening',
    description: 'Combines a monsoon oilseed legume, a cool-season pulse and a robust cereal.',
  },
  {
    id: 'cotton-pulse-millet',
    name: 'Cotton → chickpea → pearl millet',
    crops: ['cotton', 'chickpea', 'pearl_millet'],
    region: 'Cotton belt screening',
    description: 'Keeps a pulse break within a cotton-focused farm system.',
  },
  {
    id: 'sorghum-groundnut-chickpea',
    name: 'Sorghum → groundnut → chickpea',
    crops: ['sorghum', 'groundnut', 'chickpea'],
    region: 'Dryland / oilseed screening',
    description: 'Uses cereal and pulse/oilseed diversity with water needs that still require seasonal checking.',
  },
  {
    id: 'maize-mungbean-sorghum',
    name: 'Maize → green gram → sorghum',
    crops: ['maize', 'mungbean', 'sorghum'],
    region: 'Warm-season screening',
    description: 'Adds a short-duration pulse between cereal years; maize suitability must be checked carefully.',
  },
  {
    id: 'chickpea-millet-pigeonpea',
    name: 'Chickpea → pearl millet → pigeon pea',
    crops: ['chickpea', 'pearl_millet', 'pigeon_pea'],
    region: 'Rainfall-risk screening',
    description: 'Starts with a pulse and then shifts crop family and rooting pattern.',
  },
]

export const PRIORITY_WEIGHTS: Record<string, Record<'climate' | 'water' | 'soil' | 'diversity' | 'budget', number>> = {
  balanced: { climate: 0.25, water: 0.20, soil: 0.25, diversity: 0.20, budget: 0.10 },
  soil_health: { climate: 0.18, water: 0.12, soil: 0.25, diversity: 0.35, budget: 0.10 },
  water_saving: { climate: 0.20, water: 0.38, soil: 0.18, diversity: 0.16, budget: 0.08 },
  market_stability: { climate: 0.22, water: 0.16, soil: 0.18, diversity: 0.16, budget: 0.28 },
  climate_resilience: { climate: 0.36, water: 0.25, soil: 0.17, diversity: 0.17, budget: 0.05 },
}

function mean(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function rangeFit(value: number | null | undefined, bounds: [number, number], tolerance: number): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null
  }
  const [lo, hi] = bounds
  if (value >= lo && value <= hi) {
    return 100.0
  }
  const distance = value < lo ? lo - value : value - hi
  return Math.max(0.0, 100.0 - (distance / tolerance) * 100.0)
}

export function recommendRotations(farm: FarmProfile, climate: ClimateData | null | undefined): RecommendationData {
  const summary = climate?.summary
  const meanTemp = summary?.mean_temperature_c ?? null
  const annualRain = summary?.mean_annual_precipitation_mm ?? null
  const weights = PRIORITY_WEIGHTS[farm.priority] || PRIORITY_WEIGHTS.balanced

  const items: Rotation[] = []

  for (const rotation of ROTATIONS_LIST) {
    const profiles = rotation.crops.map(key => CROPS[key]).filter(Boolean)
    const tempFits = profiles.map(crop => rangeFit(meanTemp, crop.temp_c, 12))
    const rainFits = profiles.map(crop => rangeFit(annualRain, crop.rainfall_mm, 600))
    const soilFits = profiles.map(crop => rangeFit(farm.soil_ph, crop.ph, 2))

    const climateParts = [...tempFits, ...rainFits].filter((v): v is number => v !== null)
    const climateScore = climateParts.length ? mean(climateParts) : 55.0

    const waterNeed = mean(profiles.map(c => c.water))
    const waterBaseOffset = farm.irrigation === 'rainfed' ? 1 : farm.irrigation === 'limited' ? 2 : 3
    let waterScore = Math.min(100, Math.max(0, 100 - (waterNeed - waterBaseOffset) * 25))
    if (farm.irrigation === 'rainfed') {
      waterScore = mean(profiles.map(c => Math.min(100, Math.max(0, 100 - (c.water - 1) * 30))))
    }

    const validSoilFits = soilFits.filter((v): v is number => v !== null)
    const soilScore = validSoilFits.length ? mean(validSoilFits) : 60.0

    const uniqueFamilies = new Set(profiles.map(c => c.family)).size
    const legumeCount = profiles.filter(c => c.legume).length
    let diversityScore = Math.min(100, 45 + (uniqueFamilies - 1) * 22 + Math.min(legumeCount, 2) * 8)
    if (farm.organic_matter_pct !== null && farm.organic_matter_pct < 1.5) {
      diversityScore = Math.min(100, diversityScore + mean(profiles.map(c => c.cover)) * 3)
    }

    const budgetCap = farm.budget === 'low' ? 1 : farm.budget === 'medium' ? 2 : 3
    const budgetScore = mean(profiles.map(c => Math.max(25, 100 - Math.max(0, c.budget - budgetCap) * 30)))

    const component = {
      climate: climateScore,
      water: waterScore,
      soil: soilScore,
      diversity: diversityScore,
      budget: budgetScore,
    }

    const rawScore =
      component.climate * weights.climate +
      component.water * weights.water +
      component.soil * weights.soil +
      component.diversity * weights.diversity +
      component.budget * weights.budget

    const currentCrop = farm.current_crop
    const repeatsCurrent = Boolean(currentCrop && rotation.crops[0] === currentCrop)
    const preferred = new Set(farm.preferred_crops || [])
    const matchedPreferences = rotation.crops.filter(c => preferred.has(c))
    const preferenceBonus = matchedPreferences.length > 0 ? 5 : 0
    const continuityPenalty = repeatsCurrent ? 8 : 0

    const score = Math.round(Math.max(0, Math.min(100, rawScore + preferenceBonus - continuityPenalty)))

    const reasons: string[] = []
    if (legumeCount > 0) {
      reasons.push(
        'Includes a pulse/legume; potential nitrogen contribution depends on nodulation, harvest removal and residue management.',
      )
    }
    if (matchedPreferences.length > 0) {
      const names = matchedPreferences.map(key => CROPS[key]?.name ?? key).join(', ')
      reasons.push(`Includes farmer-prioritized crop(s): ${names}.`)
    }
    if (repeatsCurrent) {
      reasons.push(
        'The sequence begins with the current main crop; check disease history and whether a crop-family break is needed.',
      )
    }
    if (uniqueFamilies >= 3) {
      reasons.push('Uses three crop families across the sequence, improving crop-family diversity.')
    }
    if (farm.irrigation === 'rainfed' && waterNeed <= 2) {
      reasons.push('Relative water demand is lower than the candidate set’s more water-intensive rotations.')
    }
    if (farm.soil_ph === null) {
      reasons.push('Soil pH is unknown; obtain a soil test before treating this as a field-specific recommendation.')
    }
    if (meanTemp === null || annualRain === null) {
      reasons.push(
        'Climate inputs are incomplete; climate fit remains a broad placeholder and confidence is reduced.',
      )
    }

    const risks: string[] = []
    if (profiles.some(c => c.water >= 3) && farm.irrigation === 'rainfed') {
      risks.push('One or more crops can be water-demanding; verify in-season rainfall and local varieties.')
    }
    if (farm.soil_texture === 'sandy' && profiles.some(c => c.water >= 3)) {
      risks.push('Sandy soil may have limited water storage; consider soil cover and field-specific water planning.')
    }
    if (
      farm.drainage === 'poor' &&
      rotation.crops.some(k => k === 'soybean' || k === 'groundnut' || k === 'chickpea')
    ) {
      risks.push(
        'Poor drainage can be unsuitable for some crops in this sequence; verify field drainage and local variety guidance.',
      )
    }
    if (meanTemp === null || annualRain === null) {
      risks.push('No complete NASA climate summary is available for this ranking.')
    }
    if (!risks.length) {
      risks.push('Confirm crop calendars, pests, market access and soil-test results with a local agronomist.')
    }

    const confidence =
      meanTemp === null || annualRain === null || farm.soil_ph === null
        ? 'Low'
        : 'Moderate screening confidence'

    items.push({
      ...rotation,
      score,
      score_label: 'Relative fit score (heuristic, not a yield forecast)',
      confidence,
      components: {
        climate: Math.round(component.climate),
        water: Math.round(component.water),
        soil: Math.round(component.soil),
        diversity: Math.round(component.diversity),
        budget: Math.round(component.budget),
      },
      crops_detail: rotation.crops.map(key => ({
        id: key,
        name: CROPS[key]?.name ?? key,
        family: CROPS[key]?.family ?? 'unknown',
        season: CROPS[key]?.season ?? '',
        notes: CROPS[key]?.notes ?? '',
        water: CROPS[key]?.water ?? 1,
      })),
      reasons,
      risks,
    })
  }

  items.sort((a, b) => b.score - a.score)

  const dataGaps: string[] = []
  if (!climate) {
    dataGaps.push('Fetch NASA POWER climate data for a climate-informed comparison.')
  }
  if (farm.soil_ph === null) {
    dataGaps.push('A lab soil pH result would improve soil-compatibility screening.')
  }
  if (farm.soil_texture === 'unknown') {
    dataGaps.push('Add soil texture from a reliable soil test or field assessment.')
  }

  return {
    ranked_rotations: items,
    method:
      'Transparent weighted screening model. Scores rank options within this candidate set and are not measured crop performance, yield, profit, or guaranteed soil-health outcomes.',
    weights: { ...weights },
    crop_database_version: 'starter-2026-01',
    data_gaps: dataGaps,
  }
}
