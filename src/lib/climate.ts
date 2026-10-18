import type { ClimateData, MonthlyClimate } from '../types'

export const NASA_POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point'
export const PARAMETERS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR'] as const
const CACHE_SECONDS = 1800

interface CacheEntry {
  timestamp: number
  data: ClimateData
}

const memoryCache = new Map<string, CacheEntry>()

function sanitizeNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const num = Number(raw)
  if (!Number.isFinite(num) || num <= -900) return null
  return num
}

function mean(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function summarizePowerPayload(
  payload: any,
  query: { latitude: number; longitude: number; start_date: string; end_date: string },
): ClimateData {
  const properties = payload?.properties ?? {}
  const rawParams = properties?.parameter ?? {}
  if (!rawParams || Object.keys(rawParams).length === 0) {
    throw new Error('NASA POWER returned no parameter data for this request')
  }

  const dateKeys = new Set<string>()
  for (const paramKey of Object.keys(rawParams)) {
    const valMap = rawParams[paramKey]
    if (valMap && typeof valMap === 'object') {
      for (const dKey of Object.keys(valMap)) {
        dateKeys.add(dKey)
      }
    }
  }

  const sortedDates = Array.from(dateKeys).sort()
  const daily: ClimateData['daily'] = []

  for (const dayKey of sortedDates) {
    if (dayKey.length !== 8) continue
    const year = dayKey.slice(0, 4)
    const month = dayKey.slice(4, 6)
    const day = dayKey.slice(6, 8)
    const isoDate = `${year}-${month}-${day}`

    const t2m = sanitizeNumber(rawParams.T2M?.[dayKey])
    const t2m_max = sanitizeNumber(rawParams.T2M_MAX?.[dayKey])
    const t2m_min = sanitizeNumber(rawParams.T2M_MIN?.[dayKey])
    const prectotcorr = sanitizeNumber(rawParams.PRECTOTCORR?.[dayKey])

    if (t2m !== null || t2m_max !== null || t2m_min !== null || prectotcorr !== null) {
      daily.push({
        date: isoDate,
        t2m,
        t2m_max,
        t2m_min,
        prectotcorr,
      })
    }
  }

  if (daily.length === 0) {
    throw new Error('NASA POWER returned no usable daily values for the selected period')
  }

  const validTemps = daily.map(d => d.t2m).filter((v): v is number => v !== null)
  const validMaxes = daily.map(d => d.t2m_max).filter((v): v is number => v !== null)
  const validMins = daily.map(d => d.t2m_min).filter((v): v is number => v !== null)
  const validRains = daily.map(d => d.prectotcorr).filter((v): v is number => v !== null)

  const monthGroups = new Map<string, typeof daily>()
  for (const row of daily) {
    const ym = row.date.slice(0, 7)
    let list = monthGroups.get(ym)
    if (!list) {
      list = []
      monthGroups.set(ym, list)
    }
    list.push(row)
  }

  const sortedMonths = Array.from(monthGroups.keys()).sort()
  const monthly: MonthlyClimate[] = sortedMonths.map(ym => {
    const rows = monthGroups.get(ym)!
    const temps = rows.map(r => r.t2m).filter((v): v is number => v !== null)
    const maxes = rows.map(r => r.t2m_max).filter((v): v is number => v !== null)
    const mins = rows.map(r => r.t2m_min).filter((v): v is number => v !== null)
    const rains = rows.map(r => r.prectotcorr).filter((v): v is number => v !== null)

    return {
      month: ym,
      temperature_c: temps.length ? Number(mean(temps).toFixed(2)) : null,
      temperature_max_c: maxes.length ? Number(mean(maxes).toFixed(2)) : null,
      temperature_min_c: mins.length ? Number(mean(mins).toFixed(2)) : null,
      precipitation_mm: rains.length ? Number(rains.reduce((a, b) => a + b, 0).toFixed(1)) : null,
      valid_temperature_days: temps.length,
      valid_precipitation_days: rains.length,
    }
  })

  const yearGroups = new Map<string, number[]>()
  for (const row of daily) {
    if (row.prectotcorr !== null) {
      const yr = row.date.slice(0, 4)
      let list = yearGroups.get(yr)
      if (!list) {
        list = []
        yearGroups.set(yr, list)
      }
      list.push(row.prectotcorr)
    }
  }

  const annual = Array.from(yearGroups.keys())
    .sort()
    .map(year => {
      const vals = yearGroups.get(year)!
      return {
        year,
        precipitation_mm: Number(vals.reduce((a, b) => a + b, 0).toFixed(1)),
      }
    })

  const startD = new Date(query.start_date)
  const endD = new Date(query.end_date)
  const requestedDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 3600 * 24)) + 1)
  const temperatureDays = validTemps.length
  const precipitationDays = validRains.length
  const availableYears = Array.from(new Set(daily.map(r => r.date.slice(0, 4)))).sort()

  return {
    source: 'NASA POWER Daily Point API',
    source_url: NASA_POWER_URL,
    community: 'AG (Agroclimatology)',
    latitude: query.latitude,
    longitude: query.longitude,
    period: { start: query.start_date, end: query.end_date },
    retrieved_at: new Date().toISOString(),
    units: { t2m: '°C', t2m_max: '°C', t2m_min: '°C', prectotcorr: 'mm/day' },
    parameter_descriptions: {
      T2M: 'Daily mean air temperature',
      T2M_MAX: 'Daily maximum air temperature',
      T2M_MIN: 'Daily minimum air temperature',
      PRECTOTCORR: 'Corrected precipitation estimate',
    },
    summary: {
      mean_temperature_c: validTemps.length ? Number(mean(validTemps).toFixed(2)) : null,
      mean_daily_max_c: validMaxes.length ? Number(mean(validMaxes).toFixed(2)) : null,
      mean_daily_min_c: validMins.length ? Number(mean(validMins).toFixed(2)) : null,
      total_precipitation_mm: validRains.length ? Number(validRains.reduce((a, b) => a + b, 0).toFixed(1)) : null,
      mean_annual_precipitation_mm: annual.length
        ? Number(mean(annual.map(x => x.precipitation_mm)).toFixed(1))
        : null,
      valid_temperature_days: temperatureDays,
      valid_precipitation_days: precipitationDays,
      requested_days: requestedDays,
      temperature_coverage_pct: Number(((100 * temperatureDays) / requestedDays).toFixed(1)),
      precipitation_coverage_pct: Number(((100 * precipitationDays) / requestedDays).toFixed(1)),
      annual_precipitation: annual,
      years_available: availableYears,
    },
    monthly,
    daily,
    limitations: [
      'NASA POWER provides gridded, point-requested meteorological estimates; it is not a field rain gauge or direct soil-moisture/soil-fertility measurement.',
      'Precipitation and meteorological parameters have source-specific spatial resolution. Conditions within a small field may differ from the grid cell.',
      'Historical climate summaries describe the selected period and do not constitute a future climate forecast.',
    ],
  }
}

export async function getClimate(query: {
  latitude: number
  longitude: number
  start_date: string
  end_date: string
}): Promise<ClimateData> {
  const cacheKey = `${query.latitude.toFixed(4)}_${query.longitude.toFixed(4)}_${query.start_date}_${query.end_date}`
  const now = Date.now() / 1000
  const cached = memoryCache.get(cacheKey)
  if (cached && now - cached.timestamp < CACHE_SECONDS) {
    return {
      ...cached.data,
      cache: 'hit',
    }
  }

  const params = new URLSearchParams({
    parameters: PARAMETERS.join(','),
    community: 'AG',
    longitude: String(query.longitude),
    latitude: String(query.latitude),
    start: query.start_date.replaceAll('-', ''),
    end: query.end_date.replaceAll('-', ''),
    format: 'JSON',
    'time-standard': 'UTC',
  })

  let response: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 35000)
    response = await fetch(`${NASA_POWER_URL}?${params.toString()}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('NASA POWER request timed out. Try again shortly or select a shorter date range.')
    }
    throw new Error('Could not reach NASA POWER. Check your internet connection and retry.')
  }

  if (!response.ok) {
    throw new Error(`NASA POWER returned HTTP ${response.status}. Check the date range and retry.`)
  }

  const payload = await response.json()
  const errors = payload?.errors ?? []
  if (Array.isArray(errors) && errors.length > 0) {
    throw new Error(`NASA POWER reported: ${errors.slice(0, 3).join('; ')}`)
  }

  const result = summarizePowerPayload(payload, query)
  const messages = payload?.messages
  if (Array.isArray(messages) && messages.length > 0) {
    result.nasa_messages = messages
  }

  memoryCache.set(cacheKey, { timestamp: now, data: result })
  return { ...result, cache: 'miss' }
}
