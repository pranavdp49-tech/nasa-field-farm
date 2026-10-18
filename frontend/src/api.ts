import type { ClimateData, FarmProfile, RecommendationData, Rotation } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  } catch {
    throw new Error('Cannot connect to Field Shift API. Start the backend at http://127.0.0.1:8000 and retry.')
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = typeof body.detail === 'string' ? body.detail : message
    } catch { /* keep fallback */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export function fetchHealth() { return request<{ status: string }>('/api/health') }
export function fetchClimate(farm: FarmProfile, start: string, end: string) {
  const params = new URLSearchParams({ latitude: String(farm.latitude), longitude: String(farm.longitude), start_date: start, end_date: end })
  return request<ClimateData>(`/api/climate?${params.toString()}`)
}
export function fetchRecommendations(farm: FarmProfile, climate: ClimateData | null) {
  return request<RecommendationData>('/api/recommendations', { method: 'POST', body: JSON.stringify({ farm, climate }) })
}
export async function fetchReport(farm: FarmProfile, climate: ClimateData | null, rotations: Rotation[]) {
  const response = await fetch(`${API_BASE}/api/report`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farm, climate, recommendations: rotations }),
  })
  if (!response.ok) {
    let message = `Report export failed (${response.status})`
    try { const body = await response.json(); message = body.detail || message } catch { /* ignored */ }
    throw new Error(message)
  }
  return response.blob()
}
