import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { FarmProfile, ClimateData, RecommendationData, Rotation } from './types'
import { fetchClimate, fetchHealth, fetchRecommendations, fetchReport } from './api'
import { EarthGlobe3D } from './components/EarthGlobe3D'
import { SvgIcon, type IconName, type IconTone } from './components/SvgIcon'

const defaultFarm: FarmProfile = {
  farm_name: 'Monsoon Field 01', latitude: 19.076, longitude: 72.8777, region: 'Maharashtra, India',
  area_hectares: 2.4, soil_texture: 'unknown', soil_ph: null, organic_matter_pct: null, drainage: 'unknown',
  current_crop: 'soybean', irrigation: 'rainfed', priority: 'balanced', budget: 'low', preferred_crops: [],
}

export interface SavedLandParcel {
  id: string
  name: string
  region: string
  latitude: number
  longitude: number
  area_hectares: number
  crop: string
  irrigation: FarmProfile['irrigation']
  soil: FarmProfile['soil_texture']
  tag: string
  isCustom?: boolean
}

const initialMyLands: SavedLandParcel[] = [
  {
    id: 'my-home-field',
    name: 'Monsoon Field 01',
    region: 'Maharashtra, India',
    latitude: 19.076,
    longitude: 72.8777,
    area_hectares: 2.4,
    crop: 'soybean',
    irrigation: 'rainfed',
    soil: 'black-cotton',
    tag: 'PRIMARY LAND',
  },
  {
    id: 'punjab',
    name: 'Alluvial North Plot',
    region: 'Punjab, India',
    latitude: 30.901,
    longitude: 75.8573,
    area_hectares: 3.8,
    crop: 'wheat',
    irrigation: 'reliable',
    soil: 'loamy',
    tag: 'IRRIGATED PLOT',
  },
  {
    id: 'rajasthan',
    name: 'Dryland Millet Plot',
    region: 'Jodhpur, Rajasthan',
    latitude: 26.2389,
    longitude: 73.0243,
    area_hectares: 1.9,
    crop: 'pearl_millet',
    irrigation: 'rainfed',
    soil: 'sandy',
    tag: 'ARID PARCEL',
  },
  {
    id: 'andhra',
    name: 'Coastal Delta Parcel',
    region: 'Guntur, Andhra Pradesh',
    latitude: 16.3067,
    longitude: 80.4365,
    area_hectares: 2.8,
    crop: 'rice',
    irrigation: 'limited',
    soil: 'clay',
    tag: 'DELTA LAND',
  },
]

const navItems: { id: 'overview' | 'farm' | 'climate' | 'rotations'; label: string; short: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', short: 'Command', icon: 'command' },
  { id: 'farm', label: 'My Land & 3D Earth', short: '3D Earth', icon: 'globe-3d' },
  { id: 'climate', label: 'Climate signals', short: 'Climate', icon: 'satellite' },
  { id: 'rotations', label: 'Rotation planner', short: 'Rotations', icon: 'compass' },
]

type View = typeof navItems[number]['id']
type MapLayerMode = '3d_earth' | 'satellite' | 'terrain' | 'map'

const mapLayerOptions: { id: MapLayerMode; label: string }[] = [
  { id: '3d_earth', label: 'Google Earth 3D' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'map', label: '2D Map' },
]

/**
 * Tile configuration with calibrated maxNativeZoom so zooming in deep to any map
 * smoothly scales the highest available imagery and NEVER displays "Map data not yet available".
 */
function resolveMapTileConfig(mode: MapLayerMode, theme: 'light' | 'dark') {
  if (mode === 'satellite') {
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      overlayUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxNativeZoom: 16,
      overlayMaxNativeZoom: 16,
      maxZoom: 20,
    }
  }
  if (mode === 'terrain') {
    return {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      overlayUrl: null,
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, USGS, FAO, NPS, NRCAN, GeoBase',
      maxNativeZoom: 15,
      overlayMaxNativeZoom: 15,
      maxZoom: 20,
    }
  }
  return {
    url: theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    overlayUrl: null,
    attribution: theme === 'dark'
      ? '&copy; OpenStreetMap contributors &copy; CARTO'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 18,
    overlayMaxNativeZoom: 18,
    maxZoom: 20,
  }
}

function fmt(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}
function humanCrop(id: string) {
  const labels: Record<string, string> = { pearl_millet: 'Pearl millet', sorghum: 'Sorghum', chickpea: 'Chickpea', pigeon_pea: 'Pigeon pea', soybean: 'Soybean', groundnut: 'Groundnut', maize: 'Maize', cotton: 'Cotton', mungbean: 'Green gram', wheat: 'Wheat', rice: 'Rice' }
  return labels[id] ?? id.replaceAll('_', ' ')
}

function MapClickPicker({ onPick, latitude, longitude, theme, mapLayer }: { onPick: (lat: number, lon: number) => void; latitude: number; longitude: number; theme: 'light' | 'dark'; mapLayer: MapLayerMode }) {
  const map = useMap()
  useEffect(() => { map.setView([latitude, longitude], Math.max(map.getZoom(), 7), { animate: true }) }, [latitude, longitude, map])
  useMapEvents({ click(event) { onPick(Number(event.latlng.lat.toFixed(5)), Number(event.latlng.lng.toFixed(5))) } })
  const isSatellite = mapLayer === 'satellite'
  const strokeColor = isSatellite ? '#061006' : theme === 'dark' ? '#102017' : '#fbfcf8'
  const fillColor = isSatellite ? '#b7ff70' : theme === 'dark' ? '#8dc997' : '#28674b'
  return <CircleMarker center={[latitude, longitude]} radius={8} pathOptions={{ color: strokeColor, weight: 3, fillColor, fillOpacity: 1 }}><Popup>Selected land location</Popup></CircleMarker>
}

function MetricCard({ label, value, unit, note, iconName, tone, index = 0 }: { label: string; value: string; unit?: string; note: string; iconName: IconName; tone: IconTone; index?: number }) {
  return <div className="metric-card" style={{ '--stagger-idx': index } as React.CSSProperties}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><SvgIcon name={iconName} size={20} tone={tone} /></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-note">{note}</div>
  </div>
}

function EmptyClimate({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  return <div className="empty-state">
    <div className="empty-icon">{loading ? <SvgIcon name="loader" className="spin" size={24} tone="cyan" /> : <SvgIcon name="satellite" size={24} tone="inactive" />}</div>
    <h3>{loading ? 'Connecting to NASA POWER…' : 'Climate data is not loaded yet'}</h3>
    <p>{loading ? 'Requesting daily temperature and precipitation records for your selected land coordinates.' : error || 'Load observations for your land location to unlock climate indicators and climate-aware rotation screening.'}</p>
    {!loading && <button className="button button-secondary liquid-glass-btn" onClick={onRetry}><SvgIcon name="refresh" size={18} tone="inactive" /> Retry live data</button>}
  </div>
}

export default function App() {
  const [activeView, setActiveView] = useState<View>('overview')
  const [transitionDir, setTransitionDir] = useState<'forward' | 'backward'>('forward')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('field-shift-theme-v4-amoled')
      if (saved === 'light' || saved === 'dark') return saved
      return 'dark'
    } catch { return 'dark' }
  })
  const [farm, setFarm] = useState<FarmProfile>(() => {
    try {
      const saved = window.localStorage.getItem('field-shift-farm-v1')
      return saved ? { ...defaultFarm, ...JSON.parse(saved) as Partial<FarmProfile> } : defaultFarm
    } catch { return defaultFarm }
  })
  const [myLands, setMyLands] = useState<SavedLandParcel[]>(() => {
    try {
      const saved = window.localStorage.getItem('field-shift-my-lands-v1')
      if (saved) {
        const parsed = JSON.parse(saved) as SavedLandParcel[]
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
      return initialMyLands
    } catch { return initialMyLands }
  })
  const [showAddLandModal, setShowAddLandModal] = useState(false)
  const [gpsLocating, setGpsLocating] = useState(false)
  const [newLandForm, setNewLandForm] = useState({
    name: '',
    region: '',
    latitude: farm.latitude,
    longitude: farm.longitude,
    area_hectares: 2.0,
    crop: 'soybean',
    irrigation: 'rainfed' as FarmProfile['irrigation'],
    soil: 'loamy' as FarmProfile['soil_texture'],
  })

  const [climate, setClimate] = useState<ClimateData | null>(null)
  const [climateStart, setClimateStart] = useState('2021-01-01')
  const [climateEnd, setClimateEnd] = useState('2025-12-31')
  const [climateLoading, setClimateLoading] = useState(false)
  const [climateError, setClimateError] = useState<string | null>(null)
  const [climateMessage, setClimateMessage] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null)
  const [recommendLoading, setRecommendLoading] = useState(false)
  const [recommendError, setRecommendError] = useState<string | null>(null)
  const [health, setHealth] = useState<'checking' | 'online' | 'offline'>('checking')
  const [toast, setToast] = useState<string | null>(null)
  const [showLimitations, setShowLimitations] = useState(false)
  const [mapLayer, setMapLayer] = useState<MapLayerMode>(() => {
    try {
      const saved = window.localStorage.getItem('field-shift-map-layer-v2')
      if (saved === '3d_earth' || saved === 'satellite' || saved === 'terrain' || saved === 'map') return saved
      return '3d_earth'
    } catch { return '3d_earth' }
  })

  const navTo = useCallback((nextView: View) => {
    setActiveView(prev => {
      const prevIdx = navItems.findIndex(x => x.id === prev)
      const nextIdx = navItems.findIndex(x => x.id === nextView)
      setTransitionDir(nextIdx >= prevIdx ? 'forward' : 'backward')
      return nextView
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const loadClimate = useCallback(async (farmOverride?: FarmProfile): Promise<ClimateData | null> => {
    const targetFarm = farmOverride ?? farm
    setClimateLoading(true); setClimateError(null); setClimateMessage(null)
    try {
      const data = await fetchClimate(targetFarm, climateStart, climateEnd)
      setClimate(data)
      setClimateMessage(data.cache === 'hit' ? 'Loaded live record from cache' : 'Fresh live response from NASA POWER')
      setHealth('online')
      setRecommendations(null)
      return data
    } catch (error) {
      setClimate(null)
      setClimateError(error instanceof Error ? error.message : 'Climate request failed.')
      setHealth('offline')
      return null
    } finally { setClimateLoading(false) }
  }, [farm, climateStart, climateEnd])

  const updateFarm = useCallback(<K extends keyof FarmProfile>(key: K, value: FarmProfile[K]) => {
    setFarm(old => ({ ...old, [key]: value }))
    setRecommendations(null)
    if (key === 'latitude' || key === 'longitude') {
      setClimate(null)
      setClimateError(null)
      setClimateMessage(null)
    }
  }, [])

  const selectSavedLand = useCallback((land: SavedLandParcel) => {
    const nextFarm: FarmProfile = {
      ...farm,
      farm_name: land.name,
      region: land.region,
      latitude: land.latitude,
      longitude: land.longitude,
      area_hectares: land.area_hectares,
      current_crop: land.crop,
      irrigation: land.irrigation,
      soil_texture: land.soil,
    }
    setFarm(nextFarm)
    setRecommendations(null)
    setToast(`Switched to ${land.name} · Fetching live NASA data…`)
    window.setTimeout(() => setToast(null), 3200)
    void loadClimate(nextFarm)
  }, [farm, loadClimate])

  const handleLocateMyLandGps = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setToast('Geolocation is not supported by this browser. Use Add My Land to enter coordinates.')
      window.setTimeout(() => setToast(null), 4000)
      return
    }
    setGpsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async position => {
        const lat = Number(position.coords.latitude.toFixed(5))
        const lon = Number(position.coords.longitude.toFixed(5))
        let resolvedRegion = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
            { headers: { Accept: 'application/json' } },
          )
          if (res.ok) {
            const geo = await res.json()
            const addr = geo?.address
            const city = addr?.county || addr?.state_district || addr?.city || addr?.town || addr?.village
            const state = addr?.state || addr?.country
            if (city && state) resolvedRegion = `${city}, ${state}`
            else if (state) resolvedRegion = state
          }
        } catch {
          // Keep coordinate label if reverse geocoding is offline
        }

        const gpsLand: SavedLandParcel = {
          id: `gps-land-${Date.now()}`,
          name: 'My Current Land (GPS)',
          region: resolvedRegion,
          latitude: lat,
          longitude: lon,
          area_hectares: farm.area_hectares,
          crop: farm.current_crop,
          irrigation: farm.irrigation,
          soil: farm.soil_texture,
          tag: 'LIVE GPS LOCATION',
          isCustom: true,
        }

        setMyLands(prev => {
          const withoutOldGps = prev.filter(item => item.tag !== 'LIVE GPS LOCATION')
          return [gpsLand, ...withoutOldGps]
        })

        const nextFarm: FarmProfile = {
          ...farm,
          farm_name: gpsLand.name,
          region: gpsLand.region,
          latitude: lat,
          longitude: lon,
        }
        setFarm(nextFarm)
        setGpsLocating(false)
        setToast(`Located your land in ${resolvedRegion} · Loading live NASA data…`)
        window.setTimeout(() => setToast(null), 3500)
        void loadClimate(nextFarm)
      },
      err => {
        setGpsLocating(false)
        setShowAddLandModal(true)
        setNewLandForm(f => ({
          ...f,
          name: f.name || 'My Home Land',
          region: f.region || farm.region,
          latitude: farm.latitude,
          longitude: farm.longitude,
        }))
        setToast(err.message ? `GPS unavailable (${err.message}). Enter or pick your land below.` : 'Enter or pick your land coordinates below.')
        window.setTimeout(() => setToast(null), 4000)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [farm, loadClimate])

  const handleSaveNewLand = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = newLandForm.name.trim() || `My Land ${myLands.length + 1}`
    const cleanRegion = newLandForm.region.trim() || `${newLandForm.latitude.toFixed(3)}°, ${newLandForm.longitude.toFixed(3)}°`
    const created: SavedLandParcel = {
      id: `land-${Date.now()}`,
      name: cleanName,
      region: cleanRegion,
      latitude: Number(newLandForm.latitude),
      longitude: Number(newLandForm.longitude),
      area_hectares: Math.max(0.01, Number(newLandForm.area_hectares) || 1),
      crop: newLandForm.crop,
      irrigation: newLandForm.irrigation,
      soil: newLandForm.soil,
      tag: 'MY SAVED LAND',
      isCustom: true,
    }
    setMyLands(prev => [created, ...prev])
    setShowAddLandModal(false)
    selectSavedLand(created)
  }, [newLandForm, myLands.length, selectSavedLand])

  const handleDeleteSavedLand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMyLands(prev => prev.length > 1 ? prev.filter(x => x.id !== id) : prev)
  }, [])

  const runRecommendations = useCallback(async (climateOverride?: ClimateData | null) => {
    setRecommendLoading(true); setRecommendError(null)
    try {
      const result = await fetchRecommendations(farm, climateOverride === undefined ? climate : climateOverride)
      setRecommendations(result)
      navTo('rotations')
    } catch (error) {
      setRecommendError(error instanceof Error ? error.message : 'Could not generate rotation options.')
    } finally { setRecommendLoading(false) }
  }, [farm, climate, navTo])

  const downloadReport = useCallback(async () => {
    try {
      let selected: Rotation[] = recommendations?.ranked_rotations ?? []
      if (!recommendations) {
        const result = await fetchRecommendations(farm, climate)
        setRecommendations(result)
        selected = result.ranked_rotations
      }
      const blob = await fetchReport(farm, climate, selected)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'field-shift-report.pdf'; anchor.click()
      URL.revokeObjectURL(url)
      setToast('Report downloaded'); window.setTimeout(() => setToast(null), 3000)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not export report')
      window.setTimeout(() => setToast(null), 5000)
    }
  }, [farm, climate, recommendations])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { window.localStorage.setItem('field-shift-theme-v4-amoled', theme) } catch { /* storage may be unavailable */ }
  }, [theme])

  useEffect(() => {
    try { window.localStorage.setItem('field-shift-farm-v1', JSON.stringify(farm)) } catch { /* local storage may be unavailable */ }
  }, [farm])
  useEffect(() => {
    try { window.localStorage.setItem('field-shift-my-lands-v1', JSON.stringify(myLands)) } catch { /* local storage may be unavailable */ }
  }, [myLands])
  useEffect(() => {
    try { window.localStorage.setItem('field-shift-map-layer-v2', mapLayer) } catch { /* local storage may be unavailable */ }
  }, [mapLayer])
  useEffect(() => { fetchHealth().then(() => setHealth('online')).catch(() => setHealth('offline')) }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void loadClimate() }, 350); return () => window.clearTimeout(timer) }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '1') navTo('overview')
      else if (e.key === '2') navTo('farm')
      else if (e.key === '3') navTo('climate')
      else if (e.key === '4') navTo('rotations')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navTo])

  const summary = climate?.summary
  const annualRainChart = useMemo(() => climate?.summary.annual_precipitation ?? [], [climate])
  const tileConfig = useMemo(() => resolveMapTileConfig(mapLayer, theme), [mapLayer, theme])
  const formattedFarm = `${farm.latitude.toFixed(3)}°, ${farm.longitude.toFixed(3)}°`
  const topRotation = recommendations?.ranked_rotations[0]
  const activeStageIndex = navItems.findIndex(x => x.id === activeView)

  function handlePointPick(latitude: number, longitude: number) {
    const nextFarm: FarmProfile = {
      ...farm,
      latitude,
      longitude,
    }
    setFarm(nextFarm)
    setNewLandForm(f => ({ ...f, latitude, longitude }))
    setRecommendations(null)
    void loadClimate(nextFarm)
  }

  function renderSpatialViewport(compact = false) {
    return (
      <div className={`farm-map-wrap ${compact ? 'farm-map-overview' : 'farm-map-full'} mode-${mapLayer}`}>
        <div
          className="map-layer-toggle liquid-glass-surface"
          role="group"
          aria-label="Base map layer"
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
        >
          {mapLayerOptions.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`map-layer-btn ${mapLayer === opt.id ? 'is-active liquid-glass-active' : ''}`}
              aria-pressed={mapLayer === opt.id}
              onClick={() => setMapLayer(opt.id)}
            >
              {opt.id === '3d_earth' && (
                <SvgIcon
                  name="globe-3d"
                  size={18}
                  tone={mapLayer === opt.id ? 'inherit' : 'cyan'}
                />
              )}
              {opt.label}
            </button>
          ))}
        </div>

        <div className="viewport-transition-stage" key={mapLayer}>
          {mapLayer === '3d_earth' ? (
            <EarthGlobe3D
              latitude={farm.latitude}
              longitude={farm.longitude}
              theme={theme}
              regionLabel={farm.region}
              farmName={farm.farm_name}
              areaHectares={farm.area_hectares}
              compact={compact}
              onPick={handlePointPick}
            />
          ) : (
            <>
              <MapContainer center={[farm.latitude, farm.longitude]} zoom={9} maxZoom={20} scrollWheelZoom={true} className="farm-map">
                <TileLayer
                  key={`${mapLayer}-${theme}`}
                  attribution={tileConfig.attribution}
                  url={tileConfig.url}
                  maxNativeZoom={tileConfig.maxNativeZoom}
                  maxZoom={tileConfig.maxZoom}
                />
                {tileConfig.overlayUrl && (
                  <TileLayer
                    key={`${mapLayer}-overlay`}
                    url={tileConfig.overlayUrl}
                    maxNativeZoom={tileConfig.overlayMaxNativeZoom}
                    maxZoom={tileConfig.maxZoom}
                    pane="overlayPane"
                  />
                )}
                <MapClickPicker
                  latitude={farm.latitude}
                  longitude={farm.longitude}
                  theme={theme}
                  mapLayer={mapLayer}
                  onPick={handlePointPick}
                />
              </MapContainer>
              <div className="map-hint">
                <SvgIcon name="map-pin" size={18} tone="cyan" /> Click anywhere on the map to set your land location & fetch live NASA data
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell spatial-shell">
      <main className="main-area spatial-main">
        {/* Top Bar Contract: 3 clean zones (Brand | Spatial Stage Switcher | Primary Actions) */}
        <header className="topbar spatial-topbar">
          <div className="brand-zone">
            <button type="button" className="brand-home-trigger" onClick={() => navTo('overview')}>
              <span className="brand-mark"><SvgIcon name="sprout" size={22} tone="lime" /></span>
              <span className="brand-name">field<span>shift</span></span>
            </button>
          </div>

          <nav className="stage-switcher liquid-glass-surface" aria-label="Workspace stages">
            <div
              className="stage-active-glider liquid-glass-active"
              style={{ transform: `translateX(${activeStageIndex * 100}%)` }}
              aria-hidden="true"
            />
            {navItems.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                className={`stage-pill nav-item ${activeView === id ? 'is-active nav-active' : ''}`}
                onClick={() => navTo(id)}
              >
                <SvgIcon
                  name={icon}
                  size={18}
                  tone={activeView === id ? 'lime' : 'inactive'}
                />
                <span>{label}</span>
                {id === 'rotations' && recommendations && (
                  <span className="stage-badge">{recommendations.ranked_rotations.length}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="topbar-right">
            <div className={`live-badge ${health === 'online' ? 'live' : health === 'offline' ? 'offline' : ''}`}>
              <span />
              {health === 'online' ? 'NASA POWER ONLINE' : health === 'offline' ? 'DATA OFFLINE' : 'SYNCING NASA'}
            </div>
            <button
              className="theme-toggle liquid-glass-btn"
              type="button"
              title={`Switch to ${theme === 'dark' ? 'light' : 'AMOLED black'} mode`}
              aria-label={`AMOLED black mode is ${theme === 'dark' ? 'on' : 'off'}. Switch to ${theme === 'dark' ? 'light' : 'AMOLED black'} mode`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}
            >
              <span className="theme-toggle-icon">
                <SvgIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} tone="inactive" />
              </span>
              <span className="theme-toggle-label">{theme === 'dark' ? 'AMOLED' : 'LIGHT'}</span>
            </button>
            <button
              className="top-icon liquid-glass-btn"
              title="Data provenance & limitations"
              aria-label="Data provenance & limitations"
              onClick={() => setShowLimitations(v => !v)}
            >
              <SvgIcon name="help" size={20} tone={showLimitations ? 'lime' : 'inactive'} />
            </button>
          </div>
        </header>

        {/* "MY LAND" Spatial Bar with Live GPS Location + "Add my land" */}
        <section className="spatial-bioregion-bar" aria-label="My Land locations">
          <div className="my-land-header-group">
            <div className="bioregion-bar-label">
              <SvgIcon name="map-pin" size={18} tone="cyan" />
              <span>MY LAND</span>
            </div>
            <div className="my-land-actions">
              <button
                type="button"
                className="liquid-glass-btn my-land-action-btn"
                onClick={handleLocateMyLandGps}
                disabled={gpsLocating}
                title="Use your current GPS coordinates as your land and load live NASA data"
              >
                {gpsLocating ? <SvgIcon name="loader" size={18} tone="cyan" className="spin" /> : <SvgIcon name="navigation" size={18} tone="cyan" />}
                <span>{gpsLocating ? 'Locating…' : 'Use my location'}</span>
              </button>
              <button
                type="button"
                className="liquid-glass-btn liquid-glass-accent my-land-action-btn"
                onClick={() => {
                  setNewLandForm({
                    name: '',
                    region: farm.region,
                    latitude: farm.latitude,
                    longitude: farm.longitude,
                    area_hectares: farm.area_hectares,
                    crop: farm.current_crop,
                    irrigation: farm.irrigation,
                    soil: farm.soil_texture,
                  })
                  setShowAddLandModal(v => !v)
                }}
              >
                <SvgIcon name="plus" size={18} tone="inherit" />
                <span>Add my land</span>
              </button>
            </div>
          </div>

          <div className="bioregion-scroller">
            {myLands.map(land => {
              const isSelected =
                Math.abs(farm.latitude - land.latitude) < 0.01 &&
                Math.abs(farm.longitude - land.longitude) < 0.01 &&
                farm.farm_name === land.name
              return (
                <div
                  key={land.id}
                  role="button"
                  tabIndex={0}
                  className={`bioregion-chip ${isSelected ? 'is-selected liquid-glass-active' : ''}`}
                  onClick={() => selectSavedLand(land)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSavedLand(land) } }}
                >
                  <div className="bioregion-chip-top">
                    <span className="bioregion-chip-tag">
                      <SvgIcon name="map-pin" size={18} tone={isSelected ? 'lime' : 'cyan'} />
                      {land.tag}
                    </span>
                    {land.isCustom && myLands.length > 1 && (
                      <button
                        type="button"
                        className="bioregion-delete-btn"
                        title="Remove saved land"
                        onClick={e => handleDeleteSavedLand(land.id, e)}
                      >
                        <SvgIcon name="trash" size={18} tone="inactive" />
                      </button>
                    )}
                  </div>
                  <strong>{land.name}</strong>
                  <small>{land.region} · {land.latitude.toFixed(2)}°, {land.longitude.toFixed(2)}°</small>
                </div>
              )
            })}
          </div>
        </section>

        {/* Inline "Add My Land" Creator Drawer */}
        {showAddLandModal && (
          <section className="add-land-drawer panel">
            <div className="add-land-drawer-header">
              <div>
                <div className="section-kicker">ADD MY LAND · LIVE TELEMETRY LINK</div>
                <h2>Register your land parcel</h2>
                <p>Enter your land details, use your live GPS coordinates, or click directly on the Google Earth 3D globe to pin your land.</p>
              </div>
              <div className="add-land-header-btns">
                <button
                  type="button"
                  className="button button-secondary liquid-glass-btn"
                  onClick={handleLocateMyLandGps}
                  disabled={gpsLocating}
                >
                  {gpsLocating ? <SvgIcon name="loader" size={18} tone="cyan" className="spin" /> : <SvgIcon name="crosshair" size={18} tone="cyan" />}
                  <span>Detect GPS coordinates</span>
                </button>
                <button
                  type="button"
                  className="square-action"
                  onClick={() => setShowAddLandModal(false)}
                  aria-label="Close Add My Land"
                >
                  <SvgIcon name="close" size={18} tone="inactive" />
                </button>
              </div>
            </div>
            <form className="add-land-form" onSubmit={handleSaveNewLand}>
              <div className="add-land-grid">
                <FormField label="Land / plot name">
                  <input
                    required
                    placeholder="e.g. Riverbend East Plot"
                    value={newLandForm.name}
                    onChange={e => setNewLandForm(f => ({ ...f, name: e.target.value }))}
                  />
                </FormField>
                <FormField label="Village / district / state">
                  <input
                    placeholder="e.g. Nashik, Maharashtra"
                    value={newLandForm.region}
                    onChange={e => setNewLandForm(f => ({ ...f, region: e.target.value }))}
                  />
                </FormField>
                <FormField label="Latitude">
                  <input
                    type="number"
                    step="0.0001"
                    min="-90"
                    max="90"
                    required
                    value={newLandForm.latitude}
                    onChange={e => setNewLandForm(f => ({ ...f, latitude: Number(e.target.value) }))}
                  />
                </FormField>
                <FormField label="Longitude">
                  <input
                    type="number"
                    step="0.0001"
                    min="-180"
                    max="180"
                    required
                    value={newLandForm.longitude}
                    onChange={e => setNewLandForm(f => ({ ...f, longitude: Number(e.target.value) }))}
                  />
                </FormField>
                <FormField label="Area (hectares)">
                  <input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={newLandForm.area_hectares}
                    onChange={e => setNewLandForm(f => ({ ...f, area_hectares: Number(e.target.value) }))}
                  />
                </FormField>
                <FormField label="Current crop on land">
                  <select
                    value={newLandForm.crop}
                    onChange={e => setNewLandForm(f => ({ ...f, crop: e.target.value }))}
                  >
                    {[['soybean','Soybean'],['cotton','Cotton'],['sorghum','Sorghum'],['pearl_millet','Pearl millet (bajra)'],['pigeon_pea','Pigeon pea (tur)'],['chickpea','Chickpea (chana)'],['groundnut','Groundnut'],['maize','Maize'],['rice','Rice'],['wheat','Wheat'],['mungbean','Green gram (moong)']].map(([v,l]) => <option value={v} key={v}>{l}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="add-land-footer">
                <span><SvgIcon name="satellite" size={18} tone="cyan" /> Saving immediately switches to this land and fetches live NASA POWER observations.</span>
                <div className="add-land-submit-group">
                  <button type="button" className="button button-secondary" onClick={() => setShowAddLandModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="button button-primary liquid-glass-btn liquid-glass-accent">
                    <SvgIcon name="check" size={18} tone="inherit" /> Save to My Land & load live data
                  </button>
                </div>
              </div>
            </form>
          </section>
        )}

        <div
          className={`page-content view-transition-${transitionDir}`}
          key={activeView}
          data-view={activeView}
        >
          {activeView === 'overview' && <>
            <section className="overview-hero-split">
              <div className="overview-hero-copy">
                <div className="eyebrow">
                  <span className="eyebrow-dot" /> EARTH OBSERVATIONS · LIVE LAND INTELLIGENCE
                </div>
                <h1>
                  Good decisions start<br className="desktop-break" /> <span>with your land.</span>
                </h1>
                <p className="lead-copy">
                  Explore your land on the photorealistic Google Earth 3D model (or zoom into 3D Field Terrain) to turn live NASA POWER daily meteorology and local soil context into explainable crop-rotation options.
                </p>

                <div className="hero-interactive-decks">
                  <button
                    type="button"
                    className="concept-action-card primary-action-card liquid-glass-card"
                    onClick={() => runRecommendations()}
                    disabled={recommendLoading}
                  >
                    <div className="concept-card-orb">
                      {recommendLoading ? <SvgIcon name="loader" size={22} tone="lime" className="spin" /> : <SvgIcon name="compass" size={22} tone="lime" />}
                    </div>
                    <div className="concept-card-body">
                      <span className="concept-kicker">ROTATION ENGINE</span>
                      <strong>{recommendLoading ? 'Scoring candidates…' : 'Explore rotation shortlist'}</strong>
                      <small>Evaluate climate fit, water demand & crop diversity for {farm.farm_name}</small>
                    </div>
                    <SvgIcon name="arrow-right" size={18} tone="lime" className="concept-card-arrow" />
                  </button>

                  <button
                    type="button"
                    className="concept-action-card liquid-glass-card"
                    onClick={() => navTo('farm')}
                  >
                    <div className="concept-card-orb secondary-orb">
                      <SvgIcon name="settings" size={22} tone="cyan" />
                    </div>
                    <div className="concept-card-body">
                      <span className="concept-kicker">MY LAND TELEMETRY</span>
                      <strong>Calibrate soil & field profile</strong>
                      <small>{farm.farm_name} · {fmt(farm.area_hectares, 2)} ha · {humanCrop(farm.current_crop)}</small>
                    </div>
                    <SvgIcon name="arrow-right" size={18} tone="inactive" className="concept-card-arrow" />
                  </button>
                </div>
              </div>

              <div className="overview-globe-portal panel">
                <div className="globe-portal-header">
                  <div>
                    <div className="section-kicker">LIVE LAND VIEWPORT · {climateLoading ? 'SYNCING NASA POWER…' : 'LIVE TELEMETRY'}</div>
                    <h2>{farm.farm_name} · {farm.region}</h2>
                  </div>
                  <button type="button" className="text-action" onClick={() => navTo('farm')}>
                    Expand 3D Earth <SvgIcon name="arrow-right" size={18} tone="cyan" />
                  </button>
                </div>
                {renderSpatialViewport(true)}
              </div>
            </section>

            <section className="metric-grid">
              <MetricCard index={0} label="MEAN AIR TEMP." value={fmt(summary?.mean_temperature_c)} unit="°C" note={summary ? `${climate?.period.start} — ${climate?.period.end}` : climateLoading ? 'Fetching live climate data' : 'No climate data loaded'} iconName="thermometer-sun" tone="inactive" />
              <MetricCard index={1} label="MEAN ANNUAL RAIN" value={fmt(summary?.mean_annual_precipitation_mm, 0)} unit="mm" note={summary ? 'Mean of selected calendar years' : 'Waiting for precipitation data'} iconName="cloud-rain" tone="cyan" />
              <MetricCard index={2} label="TEMPERATURE COVERAGE" value={summary ? fmt(summary.temperature_coverage_pct, 0) : '—'} unit="%" note={summary ? `${fmt(summary.valid_temperature_days, 0)} valid daily values` : 'Data coverage indicator'} iconName="gauge" tone="inactive" />
              <MetricCard index={3} label="CANDIDATE ROTATIONS" value={recommendations ? String(recommendations.ranked_rotations.length) : '—'} note={recommendations ? 'Ranked with transparent rules' : 'Run the rotation analysis'} iconName="leaf" tone="lime" />
            </section>

            <section className="dashboard-grid">
              <div className="panel climate-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">CLIMATE SIGNALS · {farm.farm_name.toUpperCase()}</div>
                    <h2>Reading the seasons</h2>
                    <p>Monthly climate patterns from NASA POWER for {formattedFarm}</p>
                  </div>
                  <button className="square-action liquid-glass-btn" onClick={() => navTo('climate')} title="Open climate details">
                    <SvgIcon name="arrow-right" size={18} tone="inactive" />
                  </button>
                </div>
                {climate ? <>
                  <div className="chart-legend">
                    <span><i className="legend-temp" /> Mean temperature</span>
                    <span><i className="legend-rain" /> Precipitation</span>
                    <span className="chart-units">°C · mm/month</span>
                  </div>
                  <div className="chart-wrap">
                    <ClimateChart data={climate.monthly.slice(-24)} />
                  </div>
                  <div className="chart-footnote">
                    <span><span className="tiny-dot green-dot" /> Live API response · {climate.cache === 'hit' ? 'Cached' : 'Fresh'}</span>
                    <button onClick={() => navTo('climate')}>View full climate record <SvgIcon name="arrow-right" size={18} tone="lime" /></button>
                  </div>
                </> : <EmptyClimate loading={climateLoading} error={climateError} onRetry={() => loadClimate()} />}
              </div>

              <div className="panel signal-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">MY LAND SNAPSHOT</div>
                    <h2>Current context</h2>
                    <p>Interactive field parameters driving the screening model</p>
                  </div>
                  <div className="soft-icon"><SvgIcon name="sprout" size={20} tone="lime" /></div>
                </div>
                <div className="signal-list">
                  <SignalRow onClick={() => navTo('farm')} iconName="flask" label="Soil profile" value={farm.soil_ph !== null ? `pH ${farm.soil_ph} · ${farm.soil_texture}` : `${farm.soil_texture === 'unknown' ? 'Not tested yet' : farm.soil_texture}`} sub={farm.organic_matter_pct !== null ? `${farm.organic_matter_pct}% organic matter entered` : 'Click to calibrate soil texture & pH'} />
                  <SignalRow onClick={() => navTo('farm')} iconName="droplets" label="Water access" value={farm.irrigation === 'rainfed' ? 'Rain-fed' : farm.irrigation === 'limited' ? 'Limited irrigation' : 'Reliable irrigation'} sub="Screens relative crop water demand" />
                  <SignalRow onClick={() => navTo('farm')} iconName="sprout" label="Current crop" value={humanCrop(farm.current_crop)} sub="Used to reward crop-family breaks" />
                  <SignalRow onClick={() => navTo('farm')} iconName="compass" label="Decision priority" value={farm.priority.replaceAll('_', ' ')} sub="Dynamically reweights heuristic components" />
                </div>
                <button className="wide-link" onClick={() => navTo('farm')}>Open interactive field calibrator <SvgIcon name="arrow-right" size={18} tone="cyan" /></button>
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel insight-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">ROTATION INTELLIGENCE</div>
                    <h2>{topRotation ? 'Leading candidate' : 'Explore possible rotations'}</h2>
                  </div>
                  <span className="outlined-badge">RULE-BASED</span>
                </div>
                {topRotation ? (
                  <div className="leading-rotation">
                    <div className="rotation-score">
                      <span>{topRotation.score}</span><small>/100</small>
                    </div>
                    <div className="leading-copy">
                      <h3>{topRotation.name}</h3>
                      <p>{topRotation.description}</p>
                      <div className="crop-chips">
                        {topRotation.crops.map((crop, i) => (
                          <span key={crop}>{i > 0 && <SvgIcon name="arrow-right" size={18} tone="lime" />}{humanCrop(crop)}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="discover-row">
                    <div className="discover-art"><SvgIcon name="sprout" size={24} tone="lime" /></div>
                    <div>
                      <strong>Compare a few ways forward</strong>
                      <p>Evaluate crop family diversity, broad climate fit, relative water demand and soil inputs.</p>
                    </div>
                    <button className="button button-primary liquid-glass-btn liquid-glass-accent" onClick={() => runRecommendations()} disabled={recommendLoading}>
                      {recommendLoading ? 'Scoring…' : 'Run analysis'} <SvgIcon name="arrow-right" size={18} tone="inherit" />
                    </button>
                  </div>
                )}
                {recommendError && <div className="inline-error">{recommendError}</div>}
                {topRotation && <button className="wide-link" onClick={() => navTo('rotations')}>Open full comparison <SvgIcon name="arrow-right" size={18} tone="lime" /></button>}
              </div>

              <div className="panel source-panel">
                <div className="source-orbit"><SvgIcon name="satellite" size={22} tone="cyan" /></div>
                <div className="section-kicker">BUILT ON EARTH DATA</div>
                <h3>NASA POWER</h3>
                <p>Gridded meteorological observations and estimates, paired with your local farm context.</p>
                <a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noreferrer">
                  Explore the data source <SvgIcon name="external-link" size={18} tone="cyan" />
                </a>
                <div className="source-separator" />
                <div className="source-foot"><SvgIcon name="shield-check" size={18} tone="lime" /> Traceable inputs. Explainable outputs.</div>
              </div>
            </section>
          </>}

          {activeView === 'farm' && <>
            <PageHeading
              eyebrow="MY LAND & GOOGLE EARTH 3D"
              title="Know your field."
              description="Interact with the Google Earth 3D satellite model (or switch to 3D Field Terrain, Satellite, Terrain, or 2D Map) to anchor your assessment."
              actions={
                <button className="button button-secondary liquid-glass-btn" onClick={handleLocateMyLandGps} disabled={gpsLocating}>
                  {gpsLocating ? <SvgIcon name="loader" size={18} tone="cyan" className="spin" /> : <SvgIcon name="navigation" size={18} tone="cyan" />} Use my current location
                </button>
              }
            />
            <div className="farm-layout">
              <section className="panel form-panel">
                <div className="form-section-heading">
                  <span className="form-number">01</span>
                  <div>
                    <h2>Google Earth 3D & Land Coordinates</h2>
                    <p>Click directly on the 3D Earth surface, tilt into 3D Field Terrain, or zoom into 2D map layers to set your land point.</p>
                  </div>
                </div>
                <div className="field-grid coordinates-grid">
                  <FormField label="Latitude">
                    <input type="number" min="-90" max="90" step="0.0001" value={farm.latitude} onChange={e => updateFarm('latitude', Math.max(-90, Math.min(90, Number(e.target.value))))} />
                  </FormField>
                  <FormField label="Longitude">
                    <input type="number" min="-180" max="180" step="0.0001" value={farm.longitude} onChange={e => updateFarm('longitude', Math.max(-180, Math.min(180, Number(e.target.value))))} />
                  </FormField>
                </div>

                {renderSpatialViewport(false)}

                <div className="form-section-heading second-heading">
                  <span className="form-number">02</span>
                  <div>
                    <h2>Land identity & current crop</h2>
                    <p>Used to identify your report and evaluate crop-family transitions.</p>
                  </div>
                </div>
                <div className="field-grid">
                  <FormField label="Land / farm name">
                    <input value={farm.farm_name} onChange={e => updateFarm('farm_name', e.target.value)} placeholder="e.g. North Field" />
                  </FormField>
                  <FormField label="Region / district">
                    <input value={farm.region} onChange={e => updateFarm('region', e.target.value)} placeholder="District, state, country" />
                  </FormField>
                  <FormField label="Field area (hectares)">
                    <input type="number" min="0.01" step="0.1" value={farm.area_hectares} onChange={e => updateFarm('area_hectares', Math.max(0.01, Number(e.target.value)))} />
                  </FormField>
                  <FormField label="Current main crop">
                    <select value={farm.current_crop} onChange={e => updateFarm('current_crop', e.target.value)}>
                      {[['soybean','Soybean'],['cotton','Cotton'],['sorghum','Sorghum'],['pearl_millet','Pearl millet (bajra)'],['pigeon_pea','Pigeon pea (tur)'],['chickpea','Chickpea (chana)'],['groundnut','Groundnut'],['maize','Maize'],['rice','Rice'],['wheat','Wheat'],['mungbean','Green gram (moong)']].map(([v,l]) => <option value={v} key={v}>{l}</option>)}
                    </select>
                  </FormField>
                </div>

                <div className="form-section-heading second-heading">
                  <span className="form-number">03</span>
                  <div>
                    <h2>Soil & water conditions</h2>
                    <p>Leave values unknown rather than guessing. Soil testing improves relevance.</p>
                  </div>
                </div>
                <div className="field-grid">
                  <FormField label="Soil texture">
                    <select value={farm.soil_texture} onChange={e => updateFarm('soil_texture', e.target.value as FarmProfile['soil_texture'])}>
                      <option value="unknown">Not known</option>
                      <option value="sandy">Sandy</option>
                      <option value="loamy">Loamy</option>
                      <option value="clay">Clay</option>
                      <option value="silty">Silty</option>
                      <option value="black-cotton">Black cotton soil</option>
                    </select>
                  </FormField>
                  <FormField label="Soil pH (optional)">
                    <input type="number" min="0" max="14" step="0.1" placeholder="e.g. 6.8" value={farm.soil_ph ?? ''} onChange={e => updateFarm('soil_ph', e.target.value === '' ? null : Math.min(14, Math.max(0, Number(e.target.value))))} />
                  </FormField>
                  <FormField label="Organic matter % (optional)">
                    <input type="number" min="0" max="100" step="0.1" placeholder="e.g. 1.4" value={farm.organic_matter_pct ?? ''} onChange={e => updateFarm('organic_matter_pct', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} />
                  </FormField>
                  <FormField label="Drainage">
                    <select value={farm.drainage} onChange={e => updateFarm('drainage', e.target.value as FarmProfile['drainage'])}>
                      <option value="unknown">Not known</option>
                      <option value="poor">Poor</option>
                      <option value="moderate">Moderate</option>
                      <option value="good">Good</option>
                    </select>
                  </FormField>
                  <FormField label="Water access">
                    <select value={farm.irrigation} onChange={e => updateFarm('irrigation', e.target.value as FarmProfile['irrigation'])}>
                      <option value="rainfed">Rain-fed / no reliable irrigation</option>
                      <option value="limited">Limited irrigation</option>
                      <option value="reliable">Reliable irrigation</option>
                    </select>
                  </FormField>
                </div>

                <div className="form-section-heading second-heading">
                  <span className="form-number">04</span>
                  <div>
                    <h2>Farmer priorities</h2>
                    <p>Choose what matters most; scores will reweight around your priorities.</p>
                  </div>
                </div>
                <div className="form-field">
                  <span>Primary decision priority</span>
                  <div className="priority-options">
                    {[
                      { v: 'balanced', label: 'Balanced', desc: 'A mix of the main factors', icon: 'compass' as IconName },
                      { v: 'soil_health', label: 'Soil health', desc: 'Diversity and soil-care potential', icon: 'sprout' as IconName },
                      { v: 'water_saving', label: 'Save water', desc: 'Favor lower relative water demand', icon: 'waves' as IconName },
                      { v: 'climate_resilience', label: 'Climate resilience', desc: 'Prioritize broad climate fit', icon: 'cloud-rain' as IconName },
                      { v: 'market_stability', label: 'Budget fit', desc: 'Emphasize input and seed costs', icon: 'trending-up' as IconName },
                    ].map(({ v, label, desc, icon }) => {
                      const isSel = farm.priority === v
                      return (
                        <button
                          key={v}
                          type="button"
                          className={`priority-card ${isSel ? 'priority-selected' : ''}`}
                          onClick={() => updateFarm('priority', v as FarmProfile['priority'])}
                        >
                          <SvgIcon name={icon} size={20} tone={isSel ? 'lime' : 'inactive'} />
                          <span><strong>{label}</strong><small>{desc}</small></span>
                          {isSel && <SvgIcon name="check" size={18} tone="lime" className="priority-check" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="preferred-crops-section">
                  <div className="preferred-label">Crops to prioritize <span>OPTIONAL</span></div>
                  <p>Candidate rotations receive a small preference bonus when they include one of these crops.</p>
                  <div className="crop-preference-grid">
                    {[['pearl_millet','Pearl millet'],['sorghum','Sorghum'],['chickpea','Chickpea'],['pigeon_pea','Pigeon pea'],['soybean','Soybean'],['groundnut','Groundnut'],['maize','Maize'],['cotton','Cotton'],['mungbean','Green gram'],['wheat','Wheat'],['rice','Rice']].map(([value, label]) => {
                      const selected = farm.preferred_crops.includes(value)
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`crop-preference ${selected ? 'crop-preference-selected' : ''}`}
                          aria-pressed={selected}
                          onClick={() => updateFarm('preferred_crops', selected ? farm.preferred_crops.filter(c => c !== value) : [...farm.preferred_crops, value])}
                        >
                          {selected && <SvgIcon name="check" size={18} tone="lime" />}{label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="field-grid single-column">
                  <FormField label="Input / seed budget">
                    <select value={farm.budget} onChange={e => updateFarm('budget', e.target.value as FarmProfile['budget'])}>
                      <option value="low">Cost-sensitive</option>
                      <option value="medium">Moderate flexibility</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </FormField>
                </div>

                <div className="form-actions">
                  <span><SvgIcon name="shield-check" size={18} tone="lime" /> Profile is saved in this browser; the backend does not store it.</span>
                  <button
                    className="button button-primary liquid-glass-btn liquid-glass-accent"
                    onClick={async () => {
                      const latest = await loadClimate()
                      await runRecommendations(latest)
                    }}
                    disabled={climateLoading || recommendLoading}
                  >
                    {climateLoading || recommendLoading ? <SvgIcon name="loader" size={18} tone="inherit" className="spin" /> : <SvgIcon name="satellite" size={18} tone="inherit" />}
                    Update climate & analyse <SvgIcon name="arrow-right" size={18} tone="inherit" />
                  </button>
                </div>
              </section>

              <aside className="farm-side-column">
                <div className="panel map-data-card">
                  <div className="mini-orbit"><SvgIcon name="globe-3d" size={22} tone="cyan" /></div>
                  <div className="section-kicker">MY LAND TELEMETRY</div>
                  <h3>{farm.farm_name}</h3>
                  <p>{farm.region} · {formattedFarm}</p>
                  <div className="divider" />
                  <div className="data-kv"><span>Location precision</span><strong>Point coordinates</strong></div>
                  <div className="data-kv">
                    <span>Active spatial mode</span>
                    <strong>
                      {mapLayer === '3d_earth'
                        ? 'Google Earth 3D'
                        : mapLayer === 'satellite'
                          ? 'Satellite (Hybrid)'
                          : mapLayer === 'terrain'
                            ? 'Terrain (Topo)'
                            : '2D Map (Theme)'}
                    </strong>
                  </div>
                  <div className="data-kv"><span>Mean temperature</span><strong>{summary ? `${fmt(summary.mean_temperature_c)} °C` : climateLoading ? 'Loading…' : '—'}</strong></div>
                  <div className="data-kv"><span>Mean annual rain</span><strong>{summary ? `${fmt(summary.mean_annual_precipitation_mm, 0)} mm` : climateLoading ? 'Loading…' : '—'}</strong></div>
                  <div className="data-kv"><span>Climate source</span><strong>NASA POWER Live</strong></div>
                  <button className="button button-secondary full-button liquid-glass-btn" onClick={() => loadClimate()} disabled={climateLoading}>
                    {climateLoading ? <SvgIcon name="loader" size={18} tone="cyan" className="spin" /> : <SvgIcon name="refresh" size={18} tone="inactive" />} Refresh live land data
                  </button>
                </div>
                <div className="notice-card">
                  <div className="notice-icon"><SvgIcon name="flask" size={20} tone="cyan" /></div>
                  <div>
                    <strong>One soil test goes a long way.</strong>
                    <p>Soil pH, texture and organic matter are not measured by this NASA POWER endpoint. Add tested values when available.</p>
                  </div>
                </div>
              </aside>
            </div>
          </>}

          {activeView === 'climate' && <>
            <PageHeading
              eyebrow="EARTH OBSERVATIONS · LIVE LAND DATA"
              title="Read the climate signals."
              description={`Explore historical temperature and precipitation patterns for ${farm.farm_name} (${formattedFarm}).`}
              actions={
                <button className="button button-secondary liquid-glass-btn" onClick={() => loadClimate()} disabled={climateLoading}>
                  {climateLoading ? <SvgIcon name="loader" size={18} tone="cyan" className="spin" /> : <SvgIcon name="refresh" size={18} tone="inactive" />} Refresh data
                </button>
              }
            />
            <section className="panel climate-controls">
              <div className="control-copy">
                <div className="data-symbol"><SvgIcon name="satellite" size={22} tone="cyan" /></div>
                <div>
                  <strong>NASA POWER · Daily point service for {farm.farm_name}</strong>
                  <p>Choose the historical window for your land's climate summary ({formattedFarm}).</p>
                </div>
              </div>
              <div className="date-controls">
                <FormField label="Start date">
                  <input type="date" min="1981-01-01" value={climateStart} max={climateEnd} onChange={e => setClimateStart(e.target.value)} />
                </FormField>
                <FormField label="End date">
                  <input type="date" min={climateStart} value={climateEnd} onChange={e => setClimateEnd(e.target.value)} />
                </FormField>
                <button className="button button-primary liquid-glass-btn liquid-glass-accent" onClick={() => loadClimate()} disabled={climateLoading || !climateStart || !climateEnd}>
                  {climateLoading ? <SvgIcon name="loader" size={18} tone="inherit" className="spin" /> : <SvgIcon name="arrow-right" size={18} tone="inherit" />} Load period
                </button>
              </div>
            </section>
            {climate && <>
              <div className="metric-grid climate-metrics">
                <MetricCard index={0} label="MEAN TEMP." value={fmt(summary?.mean_temperature_c)} unit="°C" note="Daily mean temperature average" iconName="thermometer-sun" tone="inactive" />
                <MetricCard index={1} label="AVERAGE DAILY HIGH" value={fmt(summary?.mean_daily_max_c)} unit="°C" note="Average of daily maximums" iconName="trending-up" tone="lime" />
                <MetricCard index={2} label="AVERAGE DAILY LOW" value={fmt(summary?.mean_daily_min_c)} unit="°C" note="Average of daily minimums" iconName="arrow-down-right" tone="cyan" />
                <MetricCard index={3} label="PERIOD PRECIPITATION" value={fmt(summary?.total_precipitation_mm, 0)} unit="mm" note="Sum of valid daily estimates" iconName="cloud-rain" tone="cyan" />
              </div>
              <div className="dashboard-grid climate-charts-grid">
                <div className="panel climate-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">TEMPERATURE</div>
                      <h2>Monthly mean air temperature</h2>
                      <p>Mean of daily mean temperature values in each month</p>
                    </div>
                    <span className="chart-badge temp-badge">°C</span>
                  </div>
                  <div className="big-chart"><TemperatureChart data={climate.monthly} /></div>
                </div>
                <div className="panel climate-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">PRECIPITATION</div>
                      <h2>Monthly rainfall estimates</h2>
                      <p>Sum of daily precipitation estimates for each month</p>
                    </div>
                    <span className="chart-badge rain-badge">mm</span>
                  </div>
                  <div className="big-chart"><RainChart data={climate.monthly} /></div>
                </div>
              </div>
              <div className="panel annual-panel">
                <div className="panel-heading">
                  <div>
                    <div className="section-kicker">YEAR-TO-YEAR CONTEXT</div>
                    <h2>Annual precipitation</h2>
                    <p>Grouped by calendar year; edge years may be partial</p>
                  </div>
                </div>
                <div className="annual-bars">
                  {annualRainChart.map((row, idx) => {
                    const max = Math.max(...annualRainChart.map(x => x.precipitation_mm), 1)
                    return (
                      <div className="annual-bar-row" key={row.year} style={{ '--stagger-idx': idx } as React.CSSProperties}>
                        <span>{row.year}</span>
                        <div className="annual-track">
                          <div className="annual-fill" style={{ width: `${row.precipitation_mm / max * 100}%` }} />
                        </div>
                        <strong>{fmt(row.precipitation_mm, 0)} <small>mm</small></strong>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="source-disclosure">
                <div className="source-disclosure-icon"><SvgIcon name="shield-check" size={20} tone="lime" /></div>
                <div>
                  <strong>Source & limitations</strong>
                  <p>Source: <a href={climate.source_url} target="_blank" rel="noreferrer">NASA POWER Daily Point API</a> · Community: {climate.community} · Period: {climate.period.start} to {climate.period.end} · Retrieved: {new Date(climate.retrieved_at).toLocaleString()}</p>
                  {climate.limitations.map(x => <span key={x}>• {x}</span>)}
                </div>
              </div>
            </>}
            {!climate && <div className="panel"><EmptyClimate loading={climateLoading} error={climateError} onRetry={() => loadClimate()} /></div>}
            {climateMessage && <div className="soft-message"><SvgIcon name="check" size={18} tone="lime" /> {climateMessage}</div>}
          </>}

          {activeView === 'rotations' && <>
            <PageHeading
              eyebrow="ROTATION DECISION MATRIX"
              title="Explore the next rotation."
              description="Compare plausible crop sequences using broad climate fit, water constraints, crop-family diversity, soil inputs and the priority you selected."
              actions={
                <button className="button button-secondary liquid-glass-btn" onClick={downloadReport}>
                  <SvgIcon name="download" size={18} tone="inactive" /> Export report
                </button>
              }
            />
            <div className="rotation-context">
              <div className="context-pill"><SvgIcon name="map-pin" size={18} tone="cyan" /> {farm.farm_name} · {farm.region}</div>
              <div className="context-pill"><SvgIcon name="droplets" size={18} tone="cyan" /> {farm.irrigation === 'rainfed' ? 'Rain-fed' : farm.irrigation === 'limited' ? 'Limited irrigation' : 'Reliable irrigation'}</div>
              <div className="context-pill"><SvgIcon name="compass" size={18} tone="lime" /> {farm.priority.replaceAll('_', ' ')}</div>
              <button className="text-action" onClick={() => navTo('farm')}>Adjust assumptions <SvgIcon name="arrow-right" size={18} tone="cyan" /></button>
            </div>
            <div className="rotation-banner">
              <div className="banner-mark"><SvgIcon name="sprout" size={24} tone="lime" /></div>
              <div>
                <strong>Screening options, not automatic prescriptions</strong>
                <p>Scores are relative heuristic comparisons. Review seasonal rainfall, exact crop calendars, soil test results and local market conditions before changing practice.</p>
              </div>
              <button className="button button-secondary liquid-glass-btn" onClick={() => runRecommendations()} disabled={recommendLoading}>
                {recommendLoading ? <SvgIcon name="loader" size={18} tone="cyan" className="spin" /> : <SvgIcon name="refresh" size={18} tone="inactive" />} Recalculate
              </button>
            </div>
            {recommendError && <div className="inline-error">{recommendError}</div>}
            {recommendLoading && <div className="panel loading-panel"><SvgIcon name="loader" size={20} tone="lime" className="spin" /> Scoring rotation candidates using the current land profile…</div>}
            {!recommendations && !recommendLoading && (
              <div className="panel first-run-panel">
                <div className="discover-art large-discover"><SvgIcon name="compass" size={24} tone="lime" /></div>
                <h2>Generate your rotation shortlist</h2>
                <p>Field Shift combines your current land profile with available NASA climate summaries and transparent crop-rotation heuristics.</p>
                <button className="button button-primary liquid-glass-btn liquid-glass-accent" onClick={() => runRecommendations()}>
                  <SvgIcon name="compass" size={18} tone="inherit" /> Generate comparison <SvgIcon name="arrow-right" size={18} tone="inherit" />
                </button>
              </div>
            )}
            {recommendations && <>
              <div className="rotation-summary-row">
                <div>
                  <div className="section-kicker">SHORTLIST</div>
                  <h2>{recommendations.ranked_rotations.length} candidate rotations</h2>
                </div>
                <div className="summary-status">
                  <span className="status-dot" /> {climate ? 'Climate-informed screening' : 'Climate data missing · lower confidence'}
                </div>
              </div>
              <div className="rotation-cards">
                {recommendations.ranked_rotations.map((rotation, index) => (
                  <RotationCard key={rotation.id} rotation={rotation} rank={index + 1} active={index === 0} />
                ))}
              </div>
              <div className="dashboard-grid method-grid">
                <div className="panel method-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">SCORING METHOD</div>
                      <h2>How options are compared</h2>
                    </div>
                    <div className="soft-icon"><SvgIcon name="gauge" size={20} tone="inactive" /></div>
                  </div>
                  <p>{recommendations.method}</p>
                  <div className="weight-list">
                    {Object.entries(recommendations.weights).map(([key, value]) => (
                      <div key={key} className="weight-row">
                        <span>{key.replaceAll('_', ' ')}</span>
                        <div className="weight-track"><div style={{ width: `${value * 100}%` }} /></div>
                        <strong>{Math.round(value * 100)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel gaps-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="section-kicker">NEXT BEST INPUTS</div>
                      <h2>Improve confidence</h2>
                    </div>
                    <div className="soft-icon"><SvgIcon name="flask" size={20} tone="cyan" /></div>
                  </div>
                  {recommendations.data_gaps.length ? (
                    <div className="gap-list">
                      {recommendations.data_gaps.map(gap => <div key={gap}><span className="gap-dot" />{gap}</div>)}
                    </div>
                  ) : (
                    <p>Core profile inputs are present. A locally validated crop calendar and laboratory soil report can further improve the assessment.</p>
                  )}
                  <button className="wide-link" onClick={() => navTo('farm')}>Update land profile <SvgIcon name="arrow-right" size={18} tone="lime" /></button>
                </div>
              </div>
            </>}
          </>}

          <footer className="page-footer">
            <span>FIELD SHIFT <span className="footer-dot">·</span> NASA SPACE APPS CONCEPT</span>
            <span>Earth observations × local knowledge</span>
            <button onClick={() => setShowLimitations(v => !v)}>Data notes <SvgIcon name="chevron-down" size={18} tone="inactive" /></button>
          </footer>
        </div>

        {/* Floating Spatial Command Dock with Borderless SVG Icons */}
        <div className="spatial-command-dock liquid-glass-dock" role="navigation" aria-label="Quick spatial dock">
          {navItems.map(({ id, short, icon }) => {
            const isActive = activeView === id
            return (
              <button
                key={id}
                type="button"
                className={`dock-node ${isActive ? 'is-active liquid-glass-active' : ''}`}
                onClick={() => navTo(id)}
              >
                <span className="dock-node-icon" data-dock-id={id}>
                  <SvgIcon
                    name={icon}
                    size={20}
                    tone={isActive ? 'lime' : id === 'farm' ? 'cyan' : 'inactive'}
                  />
                </span>
                <span className="dock-node-copy">
                  <strong>{short}</strong>
                </span>
              </button>
            )
          })}
          <div className="dock-divider" />
          <button
            type="button"
            className="dock-action-orb liquid-glass-btn liquid-glass-accent"
            onClick={() => runRecommendations()}
            disabled={recommendLoading}
            title="Run rotation screening"
          >
            {recommendLoading ? <SvgIcon name="loader" size={18} tone="inherit" className="spin" /> : <SvgIcon name="sparkles" size={18} tone="inherit" />}
            <span>{recommendLoading ? 'Scoring…' : 'Screen'}</span>
          </button>
        </div>
      </main>

      {showLimitations && (
        <div className="drawer-scrim" onClick={() => setShowLimitations(false)}>
          <aside className="info-drawer" onClick={e => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setShowLimitations(false)} aria-label="Close drawer">
              <SvgIcon name="close" size={18} tone="inactive" />
            </button>
            <div className="section-kicker">ABOUT THE DATA</div>
            <h2>Evidence before assumptions.</h2>
            <p>Field Shift is a decision-support prototype. It does not replace local agronomic advice.</p>
            <div className="drawer-note">
              <SvgIcon name="satellite" size={20} tone="cyan" />
              <div>
                <strong>NASA POWER</strong>
                <p>Gridded meteorological estimates for the selected point; not direct field measurements.</p>
                <a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noreferrer">
                  Read official documentation <SvgIcon name="external-link" size={18} tone="cyan" />
                </a>
              </div>
            </div>
            <div className="drawer-note">
              <SvgIcon name="flask" size={20} tone="inactive" />
              <div>
                <strong>Soil measurements</strong>
                <p>pH, texture and organic matter are entered by the farmer. This build does not infer soil fertility from satellite data.</p>
              </div>
            </div>
            <div className="drawer-note">
              <SvgIcon name="compass" size={20} tone="lime" />
              <div>
                <strong>Rotation scores</strong>
                <p>Weights create a relative screening score across a fixed candidate set. They are not yield, profit or measured soil-health forecasts.</p>
              </div>
            </div>
          </aside>
        </div>
      )}
      {toast && <div className="toast"><SvgIcon name="check" size={18} tone="lime" /> {toast}</div>}
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>
}
function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-heading-actions">{actions}</div>}</section>
}
function SignalRow({ iconName, label, value, sub, onClick }: { iconName: IconName; label: string; value: string; sub: string; onClick?: () => void }) {
  return (
    <button type="button" className="signal-row signal-row-interactive" onClick={onClick}>
      <div className="signal-icon"><SvgIcon name={iconName} size={20} tone="inactive" /></div>
      <div className="signal-content"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>
      <SvgIcon name="chevron-right" size={18} tone="inactive" className="signal-chevron" />
    </button>
  )
}
function ClimateChart({ data }: { data: ClimateData['monthly'] }) {
  const filtered = data.filter(d => d.temperature_c !== null || d.precipitation_mm !== null)
  return <div className="dual-chart">{filtered.map((d, idx) => { const max = Math.max(...filtered.map(x => x.precipitation_mm ?? 0), 10); const tempMin = Math.min(...filtered.map(x => x.temperature_c ?? 0), 0); const tempMax = Math.max(...filtered.map(x => x.temperature_c ?? 0), 1); return <div className="dual-chart-col" key={d.month} style={{ '--bar-idx': idx } as React.CSSProperties} title={`${d.month}: ${fmt(d.temperature_c)}°C, ${fmt(d.precipitation_mm)} mm`}><div className="dual-chart-bars"><div className="bar-rain" style={{ height: `${Math.max(2, (d.precipitation_mm ?? 0) / max * 82)}%` }} /><div className="bar-temp" style={{ height: `${Math.max(4, ((d.temperature_c ?? tempMin) - tempMin + 1) / (tempMax - tempMin + 1) * 80)}%` }} /></div><span>{d.month.slice(5)}</span>{d.month.endsWith('-01') && <small>{d.month.slice(0,4)}</small>}</div> })}</div>
}
function TemperatureChart({ data }: { data: ClimateData['monthly'] }) {
  const rows = data.filter(d => d.temperature_c !== null)
  const min = Math.min(...rows.map(d => d.temperature_c ?? 0), 0)
  const max = Math.max(...rows.map(d => d.temperature_c ?? 0), 1)
  return <div className="vertical-chart">{rows.map((d, idx) => <div className="vertical-col" key={d.month} style={{ '--bar-idx': idx } as React.CSSProperties} title={`${d.month}: ${fmt(d.temperature_c)} °C`}><span className="vertical-value">{fmt(d.temperature_c, 0)}</span><div className="vertical-track"><div className="vertical-temp-bar" style={{ height: `${Math.max(3, ((d.temperature_c ?? min) - min + 1) / (max - min + 1) * 100)}%` }} /></div><span className="vertical-label">{d.month.slice(5)}</span>{d.month.endsWith('-01') && <small>{d.month.slice(0,4)}</small>}</div>)}</div>
}
function RainChart({ data }: { data: ClimateData['monthly'] }) {
  const rows = data.filter(d => d.precipitation_mm !== null)
  const max = Math.max(...rows.map(d => d.precipitation_mm ?? 0), 1)
  return <div className="vertical-chart">{rows.map((d, idx) => <div className="vertical-col" key={d.month} style={{ '--bar-idx': idx } as React.CSSProperties} title={`${d.month}: ${fmt(d.precipitation_mm)} mm`}><span className="vertical-value">{fmt(d.precipitation_mm, 0)}</span><div className="vertical-track"><div className="vertical-rain-bar" style={{ height: `${Math.max(2, (d.precipitation_mm ?? 0) / max * 100)}%` }} /></div><span className="vertical-label">{d.month.slice(5)}</span>{d.month.endsWith('-01') && <small>{d.month.slice(0,4)}</small>}</div>)}</div>
}
function RotationCard({ rotation, rank, active }: { rotation: Rotation; rank: number; active: boolean }) {
  const [expanded, setExpanded] = useState(false)
  return <article className={`rotation-card ${active ? 'rotation-card-active' : ''}`} style={{ '--stagger-idx': rank - 1 } as React.CSSProperties}><div className="rotation-card-top"><div className="rank-mark">{String(rank).padStart(2, '0')}</div><div className="rotation-title-group"><div className="rotation-tags"><span>{active ? 'TOP RELATIVE FIT' : rotation.region.toUpperCase()}</span><span className={`confidence-label ${rotation.confidence.toLowerCase().includes('low') ? 'confidence-low' : ''}`}>{rotation.confidence}</span></div><h3>{rotation.name}</h3><p>{rotation.description}</p></div><div className="score-ring"><strong>{rotation.score}</strong><span>/100</span></div></div>
    <div className="sequence-wrap"><span className="micro-label">3-YEAR MAIN-CROP SEQUENCE</span><div className="sequence">{rotation.crops.map((crop, index) => <div className="sequence-step" key={`${crop}-${index}`}><div className={`crop-symbol crop-${rotation.crops_detail[index]?.family.replaceAll('-', '') ?? 'default'}`}><SvgIcon name="sprout" size={18} tone="lime" /></div><div><strong>{humanCrop(crop)}</strong><small>Year {index + 1} · {rotation.crops_detail[index]?.season}</small></div>{index < rotation.crops.length - 1 && <SvgIcon name="arrow-right" className="sequence-arrow" size={18} tone="inactive" />}</div>)}</div></div>
    <div className="component-metrics">{[['Climate fit', rotation.components.climate], ['Water fit', rotation.components.water], ['Soil fit', rotation.components.soil], ['Diversity', rotation.components.diversity]].map(([label, value]) => <div className="component-metric" key={label as string}><div><span>{label}</span><strong>{value}</strong></div><div className="component-track"><div style={{ width: `${value}%` }} /></div></div>)}</div>
    <div className="rotation-card-foot"><span><SvgIcon name="shield-check" size={18} tone="lime" /> Explainable score</span><button className="expand-button" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide details' : 'Why this option?'} <SvgIcon name="chevron-down" size={18} tone="cyan" className={expanded ? 'rotate-up' : ''} /></button></div>
    {expanded && <div className="rotation-details"><div><h4>Why it may fit</h4>{rotation.reasons.map(reason => <p key={reason}><span className="detail-bullet benefit" />{reason}</p>)}</div><div><h4>Risks to check</h4>{rotation.risks.map(risk => <p key={risk}><span className="detail-bullet risk" />{risk}</p>)}</div><div><h4>Crop notes</h4>{rotation.crops_detail.map(crop => <p key={crop.id}><strong>{crop.name}:</strong> {crop.notes}</p>)}</div></div>}
  </article>
}
