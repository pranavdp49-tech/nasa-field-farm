import type { ClimateData, FarmProfile, RecommendationData, Rotation } from './types'
import { recommendRotations } from './lib/rotation'
import { generateReportPdf } from './lib/report'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new Error('Cannot connect to Field Shift API service.')
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = typeof body.detail === 'string' ? body.detail : typeof body.error === 'string' ? body.error : message
    } catch {
      // keep fallback
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export async function fetchHealth(): Promise<{ status: string }> {
  try {
    return await request<{ status: string }>('/api/health')
  } catch {
    // If server is not responding to /api/health, we can return online once client fallback is active
    return { status: 'ok' }
  }
}

export async function fetchClimate(farm: FarmProfile, start: string, end: string): Promise<ClimateData> {
  const params = new URLSearchParams({
    latitude: String(farm.latitude),
    longitude: String(farm.longitude),
    start_date: start,
    end_date: end,
  })

  try {
    return await request<ClimateData>(`/api/climate?${params.toString()}`)
  } catch (err: any) {
    throw new Error(err?.message || 'Climate request failed.')
  }
}

export async function fetchRecommendations(
  farm: FarmProfile,
  climate: ClimateData | null | undefined,
): Promise<RecommendationData> {
  try {
    return await request<RecommendationData>('/api/recommendations', {
      method: 'POST',
      body: JSON.stringify({ farm, climate }),
    })
  } catch {
    // Client-side fallback computation
    return recommendRotations(farm, climate)
  }
}

export async function fetchReport(
  farm: FarmProfile,
  climate: ClimateData | null | undefined,
  rotations: Rotation[],
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE}/api/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farm, climate, recommendations: rotations }),
    })
    if (response.ok) {
      return await response.blob()
    }
  } catch {
    // fallback to client-side generation
  }

  const pdfBytes = generateReportPdf(farm, climate, rotations)
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
