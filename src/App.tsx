import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowDownRight, ArrowRight, BarChart3, Check, ChevronDown, ChevronRight,
  CircleHelp, CloudRain, Compass, Download, Droplets, ExternalLink,
  FlaskConical, Gauge, Globe2, Leaf, LoaderCircle, MapPin, Menu, RefreshCw,
  Satellite, Settings2, ShieldCheck, Sprout, ThermometerSun, TrendingUp, Waves, X, Moon, Sun,
} from 'lucide-react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { FarmProfile, ClimateData, RecommendationData, Rotation } from './types'
import { fetchClimate, fetchHealth, fetchRecommendations, fetchReport } from './api'

const defaultFarm: FarmProfile = {
  farm_name: 'Monsoon Field 01', latitude: 19.076, longitude: 72.8777, region: 'Maharashtra, India',
  area_hectares: 2.4, soil_texture: 'unknown', soil_ph: null, organic_matter_pct: null, drainage: 'unknown',
  current_crop: 'soybean', irrigation: 'rainfed', priority: 'balanced', budget: 'low', preferred_crops: [],
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'farm', label: 'Farm profile', icon: Sprout },
  { id: 'climate', label: 'Climate signals', icon: Satellite },
  { id: 'rotations', label: 'Rotation planner', icon: Compass },
] as const

type View = typeof navItems[number]['id']

function fmt(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}
function humanCrop(id: string) {
  const labels: Record<string, string> = { pearl_millet: 'Pearl millet', sorghum: 'Sorghum', chickpea: 'Chickpea', pigeon_pea: 'Pigeon pea', soybean: 'Soybean', groundnut: 'Groundnut', maize: 'Maize', cotton: 'Cotton', mungbean: 'Green gram', wheat: 'Wheat', rice: 'Rice' }
  return labels[id] ?? id.replaceAll('_', ' ')
}
function initials(value: string) { return value.split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || 'FS' }

function MapClickPicker({ onPick, latitude, longitude, theme }: { onPick: (lat: number, lon: number) => void; latitude: number; longitude: number; theme: 'light' | 'dark' }) {
  const map = useMap()
  useEffect(() => { map.setView([latitude, longitude], Math.max(map.getZoom(), 7), { animate: true }) }, [latitude, longitude, map])
  useMapEvents({ click(event) { onPick(Number(event.latlng.lat.toFixed(5)), Number(event.latlng.lng.toFixed(5))) } })
  return <CircleMarker center={[latitude, longitude]} radius={8} pathOptions={{ color: theme === 'dark' ? '#102017' : '#fbfcf8', weight: 3, fillColor: theme === 'dark' ? '#8dc997' : '#28674b', fillOpacity: 1 }}><Popup>Selected farm location</Popup></CircleMarker>
}

function MetricCard({ label, value, unit, note, icon: Icon, tone }: { label: string; value: string; unit?: string; note: string; icon: typeof ThermometerSun; tone: string }) {
  return <div className="metric-card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-note">{note}</div>
  </div>
}

function EmptyClimate({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  return <div className="empty-state">
    <div className="empty-icon">{loading ? <LoaderCircle className="spin" size={26} /> : <Satellite size={26} />}</div>
    <h3>{loading ? 'Connecting to NASA POWER…' : 'Climate data is not loaded yet'}</h3>
    <p>{loading ? 'Requesting daily temperature and precipitation records for your selected coordinates.' : error || 'Load observations for the farm location to unlock climate indicators and climate-aware rotation screening.'}</p>
    {!loading && <button className="button button-secondary" onClick={onRetry}><RefreshCw size={15} /> Retry live data</button>}
  </div>
}

export default function App() {
  const [activeView, setActiveView] = useState<View>('overview')
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
  const [mobileNav, setMobileNav] = useState(false)
  const [showLimitations, setShowLimitations] = useState(false)

  const updateFarm = useCallback(<K extends keyof FarmProfile>(key: K, value: FarmProfile[K]) => {
    setFarm(old => ({ ...old, [key]: value }))
    setRecommendations(null)
    if (key === 'latitude' || key === 'longitude') {
      setClimate(null)
      setClimateError(null)
      setClimateMessage(null)
    }
  }, [])

  const loadClimate = useCallback(async (): Promise<ClimateData | null> => {
    setClimateLoading(true); setClimateError(null); setClimateMessage(null)
    try {
      const data = await fetchClimate(farm, climateStart, climateEnd)
      setClimate(data)
      setClimateMessage(data.cache === 'hit' ? 'Loaded from short-term cache' : 'Fresh response from NASA POWER')
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

  const runRecommendations = useCallback(async (climateOverride?: ClimateData | null) => {
    setRecommendLoading(true); setRecommendError(null)
    try {
      const result = await fetchRecommendations(farm, climateOverride === undefined ? climate : climateOverride)
      setRecommendations(result)
      setActiveView('rotations')
    } catch (error) {
      setRecommendError(error instanceof Error ? error.message : 'Could not generate rotation options.')
    } finally { setRecommendLoading(false) }
  }, [farm, climate])

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
  useEffect(() => { fetchHealth().then(() => setHealth('online')).catch(() => setHealth('offline')) }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void loadClimate() }, 450); return () => window.clearTimeout(timer) }, [])

  const summary = climate?.summary
  const annualRainChart = useMemo(() => climate?.summary.annual_precipitation ?? [], [climate])
  const formattedFarm = `${farm.latitude.toFixed(3)}°, ${farm.longitude.toFixed(3)}°`
  const topRotation = recommendations?.ranked_rotations[0]

  function navTo(view: View) { setActiveView(view); setMobileNav(false) }
  function renderSidebar() {
    return <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Sprout size={22} strokeWidth={2.2} /></div><div><div className="brand-name">field<span>shift</span></div><div className="brand-caption">EARTH OPS / FARM INTELLIGENCE</div></div><button className="mobile-close" aria-label="Close menu" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="nav-stack">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${activeView === id ? 'nav-active' : ''}`} onClick={() => navTo(id)}><Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === 'rotations' && recommendations && <span className="nav-count">{recommendations.ranked_rotations.length}</span>}</button>)}</div>
      <div className="sidebar-appearance">
        <div className="workspace-label appearance-label">APPEARANCE</div>
        <button className={`sidebar-theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`} type="button" aria-label={`AMOLED black mode is ${theme === 'dark' ? 'on' : 'off'}. Switch to ${theme === 'dark' ? 'light' : 'AMOLED black'} mode`} aria-pressed={theme === 'dark'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>
          <span className="sidebar-theme-icon">{theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}</span>
          <span className="sidebar-theme-copy"><strong>AMOLED BLACK</strong><small>{theme === 'dark' ? 'Pure black · Enabled' : 'Tap to enable black UI'}</small></span>
          <span className="sidebar-theme-state">{theme === 'dark' ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      <div className="sidebar-grow" />
      <div className="sidebar-dataset"><div className="data-chip-icon"><Satellite size={17} /></div><div><strong>NASA POWER</strong><span>Daily climate data</span><span className={`connection-state ${health}`}><i />{health === 'online' ? 'API reachable' : health === 'offline' ? 'Not connected' : 'Checking API'}</span></div></div>
      <div className="sidebar-footer"><div className="avatar">{initials(farm.farm_name)}</div><div className="farm-identity"><strong>{farm.farm_name || 'My farm'}</strong><span>{farm.region}</span></div><button className="icon-button subtle-button" title="Edit farm profile" onClick={() => navTo('farm')}><Settings2 size={16} /></button></div>
    </aside>
  }

  return <div className="app-shell">
    {renderSidebar()}
    {mobileNav && <button className="mobile-overlay" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
        <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{navItems.find(x => x.id === activeView)?.label}</strong></div>
        <div className="topbar-right"><div className={`live-badge ${health === 'online' ? 'live' : health === 'offline' ? 'offline' : ''}`}><span />{health === 'online' ? 'DATA SERVICES ONLINE' : health === 'offline' ? 'DATA OFFLINE' : 'CHECKING DATA'}</div><button className="theme-toggle" type="button" title={`Switch to ${theme === 'dark' ? 'light' : 'AMOLED black'} mode`} aria-label={`AMOLED black mode is ${theme === 'dark' ? 'on' : 'off'}. Switch to ${theme === 'dark' ? 'light' : 'AMOLED black'} mode`} aria-pressed={theme === 'dark'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}><span className="theme-toggle-icon">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</span><span className="theme-toggle-label">{theme === 'dark' ? 'AMOLED ON' : 'AMOLED BLACK'}</span></button><button className="top-icon" title="Data information" aria-label="Data information" onClick={() => setShowLimitations(v => !v)}><CircleHelp size={18} /></button><div className="top-avatar">FS</div></div>
      </header>

      <div className="page-content" key={activeView} data-view={activeView}>
        {activeView === 'overview' && <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> FARM INTELLIGENCE / OVERVIEW</div><h1>Good decisions start<br className="desktop-break" /> <span>with the ground.</span></h1><p className="lead-copy">Turn Earth observations into smarter crop-rotation choices for your farm.</p></div><div className="welcome-actions"><button className="button button-secondary" onClick={() => navTo('farm')}><Settings2 size={16} /> Farm settings</button><button className="button button-primary" onClick={() => runRecommendations()} disabled={recommendLoading}>{recommendLoading ? <LoaderCircle size={16} className="spin" /> : <Compass size={16} />}{recommendLoading ? 'Analysing…' : 'Explore rotations'}<ArrowRight size={16} /></button></div></section>
          <section className="location-strip"><div className="location-left"><div className="location-pin"><MapPin size={17} /></div><div><span className="micro-label">ACTIVE FARM · {farm.region.toUpperCase()}</span><strong>{farm.farm_name}</strong><span className="location-coords">{formattedFarm} <span>·</span> {fmt(farm.area_hectares, 2)} hectares</span></div></div><button className="text-action" onClick={() => navTo('farm')}>Edit farm <ArrowRight size={15} /></button></section>
          <section className="metric-grid">
            <MetricCard label="MEAN AIR TEMP." value={fmt(summary?.mean_temperature_c)} unit="°C" note={summary ? `${climate?.period.start} — ${climate?.period.end}` : climateLoading ? 'Fetching live climate data' : 'No climate data loaded'} icon={ThermometerSun} tone="amber" />
            <MetricCard label="MEAN ANNUAL RAIN" value={fmt(summary?.mean_annual_precipitation_mm, 0)} unit="mm" note={summary ? 'Mean of selected calendar years' : 'Waiting for precipitation data'} icon={CloudRain} tone="blue" />
            <MetricCard label="TEMPERATURE COVERAGE" value={summary ? fmt(summary.temperature_coverage_pct, 0) : '—'} unit="%" note={summary ? `${fmt(summary.valid_temperature_days, 0)} valid daily values` : 'Data coverage indicator'} icon={Gauge} tone="violet" />
            <MetricCard label="CANDIDATE ROTATIONS" value={recommendations ? String(recommendations.ranked_rotations.length) : '—'} note={recommendations ? 'Ranked with transparent rules' : 'Run the rotation analysis'} icon={Leaf} tone="green" />
          </section>
          <section className="dashboard-grid">
            <div className="panel climate-panel"><div className="panel-heading"><div><div className="section-kicker">CLIMATE SIGNALS</div><h2>Reading the seasons</h2><p>Monthly climate patterns from NASA POWER</p></div><button className="square-action" onClick={() => navTo('climate')} title="Open climate details"><ArrowRight size={17} /></button></div>
              {climate ? <><div className="chart-legend"><span><i className="legend-temp" /> Mean temperature</span><span><i className="legend-rain" /> Precipitation</span><span className="chart-units">°C · mm/month</span></div><div className="chart-wrap"><ClimateChart data={climate.monthly.slice(-24)} /></div><div className="chart-footnote"><span><span className="tiny-dot green-dot" /> Live API response</span><button onClick={() => navTo('climate')}>View full climate record <ArrowRight size={13} /></button></div></> : <EmptyClimate loading={climateLoading} error={climateError} onRetry={loadClimate} />}
            </div>
            <div className="panel signal-panel"><div className="panel-heading"><div><div className="section-kicker">FIELD SNAPSHOT</div><h2>Current context</h2><p>What we know about this field</p></div><div className="soft-icon"><Sprout size={19} /></div></div>
              <div className="signal-list"><SignalRow icon={FlaskConical} label="Soil profile" value={farm.soil_ph !== null ? `pH ${farm.soil_ph} · ${farm.soil_texture}` : `${farm.soil_texture === 'unknown' ? 'Not tested yet' : farm.soil_texture}`} sub={farm.organic_matter_pct !== null ? `${farm.organic_matter_pct}% organic matter entered` : 'Soil values are farmer-provided'} /><SignalRow icon={Droplets} label="Water access" value={farm.irrigation === 'rainfed' ? 'Rain-fed' : farm.irrigation === 'limited' ? 'Limited irrigation' : 'Reliable irrigation'} sub="Used to screen relative water demand" /><SignalRow icon={Sprout} label="Current crop" value={humanCrop(farm.current_crop)} sub="Rotation context, not a yield forecast" /><SignalRow icon={Compass} label="Decision priority" value={farm.priority.replaceAll('_', ' ')} sub="Changes the recommendation weights" /></div>
              <button className="wide-link" onClick={() => navTo('farm')}>Complete farm profile <ArrowRight size={15} /></button>
            </div>
          </section>
          <section className="bottom-grid"><div className="panel insight-panel"><div className="panel-heading"><div><div className="section-kicker">ROTATION INTELLIGENCE</div><h2>{topRotation ? 'Leading candidate' : 'Explore possible rotations'}</h2></div><span className="outlined-badge">RULE-BASED</span></div>{topRotation ? <div className="leading-rotation"><div className="rotation-score"><span>{topRotation.score}</span><small>/100</small></div><div className="leading-copy"><h3>{topRotation.name}</h3><p>{topRotation.description}</p><div className="crop-chips">{topRotation.crops.map((crop, i) => <span key={crop}>{i > 0 && <ArrowRight size={11} />}{humanCrop(crop)}</span>)}</div></div></div> : <div className="discover-row"><div className="discover-art"><Sprout size={28} /></div><div><strong>Compare a few ways forward</strong><p>Evaluate crop family diversity, broad climate fit, relative water demand and soil inputs.</p></div><button className="button button-primary" onClick={() => runRecommendations()} disabled={recommendLoading}>{recommendLoading ? 'Scoring…' : 'Run analysis'} <ArrowRight size={15} /></button></div>}
              {recommendError && <div className="inline-error">{recommendError}</div>}
              {topRotation && <button className="wide-link" onClick={() => navTo('rotations')}>Open full comparison <ArrowRight size={15} /></button>}
            </div><div className="panel source-panel"><div className="source-orbit"><Satellite size={21} /></div><div className="section-kicker">BUILT ON EARTH DATA</div><h3>NASA POWER</h3><p>Gridded meteorological observations and estimates, paired with your local farm context.</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noreferrer">Explore the data source <ExternalLink size={13} /></a><div className="source-separator" /><div className="source-foot"><ShieldCheck size={15} /> Traceable inputs. Explainable outputs.</div></div></section>
          <section className="mission-roadmap">
            <div className="roadmap-heading"><div><div className="section-kicker">MISSION ROADMAP / NEXT UP</div><h2>From farm signals to field action.</h2><p>Planned upgrades for the next development phase. These are roadmap items, not live features yet.</p></div><span className="roadmap-status"><i /> 05 MODULES PLANNED</span></div>
            <div className="roadmap-grid">
              <button className="roadmap-card" style={{ animationDelay: '40ms' }} onClick={() => navTo('farm')}><span className="roadmap-icon cyan"><Satellite size={18} /></span><span className="roadmap-copy"><strong>Live satellite imagery</strong><small>Explore selected farms from above.</small></span><span className="roadmap-tag">PLANNED</span></button>
              <button className="roadmap-card" style={{ animationDelay: '100ms' }} onClick={() => navTo('climate')}><span className="roadmap-icon blue"><CloudRain size={18} /></span><span className="roadmap-copy"><strong>Climate-risk alerts</strong><small>Rainfall anomalies and dry-spell signals.</small></span><span className="roadmap-tag">PLANNED</span></button>
              <button className="roadmap-card" style={{ animationDelay: '160ms' }} onClick={() => navTo('rotations')}><span className="roadmap-icon green"><Sprout size={18} /></span><span className="roadmap-copy"><strong>Regional agronomy</strong><small>More locally validated rotation logic.</small></span><span className="roadmap-tag">PLANNED</span></button>
              <button className="roadmap-card" style={{ animationDelay: '220ms' }} onClick={() => navTo('climate')}><span className="roadmap-icon violet"><TrendingUp size={18} /></span><span className="roadmap-copy"><strong>Climate comparisons</strong><small>Historical baselines versus recent conditions.</small></span><span className="roadmap-tag">PLANNED</span></button>
              <div className="roadmap-card roadmap-card-static" style={{ animationDelay: '280ms' }}><span className="roadmap-icon lime"><Globe2 size={18} /></span><span className="roadmap-copy"><strong>Public deployment</strong><small>Shareable access for judges and farmers.</small></span><span className="roadmap-tag">PLANNED</span></div>
            </div>
          </section>
        </>}

        {activeView === 'farm' && <>
          <PageHeading eyebrow="FARM SETUP / CONTEXT" title="Know your field." description="Add the local details that turn regional climate data into a more useful rotation comparison." />
          <div className="farm-layout"><section className="panel form-panel"><div className="form-section-heading"><span className="form-number">01</span><div><h2>Farm details</h2><p>Used to identify and size your assessment.</p></div></div>
              <div className="field-grid"><FormField label="Farm name"><input value={farm.farm_name} onChange={e => updateFarm('farm_name', e.target.value)} placeholder="e.g. North Field" /></FormField><FormField label="Region / district"><input value={farm.region} onChange={e => updateFarm('region', e.target.value)} placeholder="District, state, country" /></FormField><FormField label="Field area (hectares)"><input type="number" min="0.01" step="0.1" value={farm.area_hectares} onChange={e => updateFarm('area_hectares', Math.max(0.01, Number(e.target.value)))} /></FormField><FormField label="Current main crop"><select value={farm.current_crop} onChange={e => updateFarm('current_crop', e.target.value)}>{[['soybean','Soybean'],['cotton','Cotton'],['sorghum','Sorghum'],['pearl_millet','Pearl millet (bajra)'],['pigeon_pea','Pigeon pea (tur)'],['chickpea','Chickpea (chana)'],['groundnut','Groundnut'],['maize','Maize'],['rice','Rice'],['wheat','Wheat'],['mungbean','Green gram (moong)']].map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></FormField></div>
              <div className="form-section-heading second-heading"><span className="form-number">02</span><div><h2>Location</h2><p>Click the map or enter coordinates. Climate data is requested for this point.</p></div></div>
              <div className="field-grid coordinates-grid"><FormField label="Latitude"><input type="number" min="-90" max="90" step="0.0001" value={farm.latitude} onChange={e => updateFarm('latitude', Math.max(-90, Math.min(90, Number(e.target.value))))} /></FormField><FormField label="Longitude"><input type="number" min="-180" max="180" step="0.0001" value={farm.longitude} onChange={e => updateFarm('longitude', Math.max(-180, Math.min(180, Number(e.target.value))))} /></FormField></div>
              <div className="farm-map-wrap"><MapContainer center={[farm.latitude, farm.longitude]} zoom={7} scrollWheelZoom={true} className="farm-map"><TileLayer attribution={theme === 'dark' ? '&copy; OpenStreetMap contributors &copy; CARTO' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} url={theme === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} /><MapClickPicker latitude={farm.latitude} longitude={farm.longitude} theme={theme} onPick={(latitude, longitude) => { updateFarm('latitude', latitude); updateFarm('longitude', longitude) }} /></MapContainer><div className="map-hint"><MapPin size={14} /> Click anywhere on the map to set the farm point</div></div>
              <div className="form-section-heading second-heading"><span className="form-number">03</span><div><h2>Soil & water</h2><p>Leave values unknown rather than guessing. Soil testing improves relevance.</p></div></div>
              <div className="field-grid"><FormField label="Soil texture"><select value={farm.soil_texture} onChange={e => updateFarm('soil_texture', e.target.value as FarmProfile['soil_texture'])}><option value="unknown">Not known</option><option value="sandy">Sandy</option><option value="loamy">Loamy</option><option value="clay">Clay</option><option value="silty">Silty</option><option value="black-cotton">Black cotton soil</option></select></FormField><FormField label="Soil pH (optional)"><input type="number" min="0" max="14" step="0.1" placeholder="e.g. 6.8" value={farm.soil_ph ?? ''} onChange={e => updateFarm('soil_ph', e.target.value === '' ? null : Math.min(14, Math.max(0, Number(e.target.value))))} /></FormField><FormField label="Organic matter % (optional)"><input type="number" min="0" max="100" step="0.1" placeholder="e.g. 1.4" value={farm.organic_matter_pct ?? ''} onChange={e => updateFarm('organic_matter_pct', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} /></FormField><FormField label="Drainage"><select value={farm.drainage} onChange={e => updateFarm('drainage', e.target.value as FarmProfile['drainage'])}><option value="unknown">Not known</option><option value="poor">Poor</option><option value="moderate">Moderate</option><option value="good">Good</option></select></FormField><FormField label="Water access"><select value={farm.irrigation} onChange={e => updateFarm('irrigation', e.target.value as FarmProfile['irrigation'])}><option value="rainfed">Rain-fed / no reliable irrigation</option><option value="limited">Limited irrigation</option><option value="reliable">Reliable irrigation</option></select></FormField></div>
              <div className="form-section-heading second-heading"><span className="form-number">04</span><div><h2>Farmer priorities</h2><p>Choose what matters most; scores will reweight around your priorities.</p></div></div>
              <div className="form-field"><span>Primary decision priority</span><div className="priority-options">{[{v:'balanced',label:'Balanced',desc:'A mix of the main factors',icon:Compass},{v:'soil_health',label:'Soil health',desc:'Diversity and soil-care potential',icon:Sprout},{v:'water_saving',label:'Save water',desc:'Favor lower relative water demand',icon:Waves},{v:'climate_resilience',label:'Climate resilience',desc:'Prioritize broad climate fit',icon:CloudRain},{v:'market_stability',label:'Budget fit',desc:'Emphasize input and seed costs',icon:TrendingUp}].map(({v,label,desc,icon:Icon}) => <button key={v} type="button" className={`priority-card ${farm.priority === v ? 'priority-selected' : ''}`} onClick={() => updateFarm('priority', v as FarmProfile['priority'])}><Icon size={19} /><span><strong>{label}</strong><small>{desc}</small></span>{farm.priority === v && <Check size={16} className="priority-check" />}</button>)}</div></div>
              <div className="preferred-crops-section"><div className="preferred-label">Crops to prioritize <span>OPTIONAL</span></div><p>Candidate rotations receive a small preference bonus when they include one of these crops.</p><div className="crop-preference-grid">{[['pearl_millet','Pearl millet'],['sorghum','Sorghum'],['chickpea','Chickpea'],['pigeon_pea','Pigeon pea'],['soybean','Soybean'],['groundnut','Groundnut'],['maize','Maize'],['cotton','Cotton'],['mungbean','Green gram'],['wheat','Wheat'],['rice','Rice']].map(([value, label]) => { const selected = farm.preferred_crops.includes(value); return <button key={value} type="button" className={`crop-preference ${selected ? 'crop-preference-selected' : ''}`} aria-pressed={selected} onClick={() => updateFarm('preferred_crops', selected ? farm.preferred_crops.filter(c => c !== value) : [...farm.preferred_crops, value])}>{selected && <Check size={12} />}{label}</button> })}</div></div>
              <div className="field-grid single-column"><FormField label="Input / seed budget"><select value={farm.budget} onChange={e => updateFarm('budget', e.target.value as FarmProfile['budget'])}><option value="low">Cost-sensitive</option><option value="medium">Moderate flexibility</option><option value="flexible">Flexible</option></select></FormField></div>
              <div className="form-actions"><span><ShieldCheck size={15} /> Profile is saved in this browser; the backend does not store it.</span><button className="button button-primary" onClick={async () => { const latest = await loadClimate(); await runRecommendations(latest) }} disabled={climateLoading || recommendLoading}>{climateLoading || recommendLoading ? <LoaderCircle size={16} className="spin" /> : <Satellite size={16} />} Update climate & analyse <ArrowRight size={15} /></button></div>
            </section>
            <aside className="farm-side-column"><div className="panel map-data-card"><div className="mini-orbit"><Globe2 size={19} /></div><div className="section-kicker">LOCATION SELECTED</div><h3>{farm.region}</h3><p>{formattedFarm}</p><div className="divider" /><div className="data-kv"><span>Location precision</span><strong>Point coordinates</strong></div><div className="data-kv"><span>Soil data</span><strong>{farm.soil_ph !== null ? 'User provided' : 'Not provided'}</strong></div><div className="data-kv"><span>Climate source</span><strong>NASA POWER</strong></div><button className="button button-secondary full-button" onClick={loadClimate} disabled={climateLoading}>{climateLoading ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} Refresh climate data</button></div><div className="notice-card"><div className="notice-icon"><FlaskConical size={17} /></div><div><strong>One soil test goes a long way.</strong><p>Soil pH, texture and organic matter are not measured by this NASA POWER endpoint. Add tested values when available.</p></div></div></aside></div>
        </>}

        {activeView === 'climate' && <>
          <PageHeading eyebrow="EARTH OBSERVATIONS / CLIMATE" title="Read the climate signals." description="Explore historical temperature and precipitation patterns for the selected farm point." actions={<button className="button button-secondary" onClick={loadClimate} disabled={climateLoading}>{climateLoading ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} Refresh data</button>} />
          <section className="panel climate-controls"><div className="control-copy"><div className="data-symbol"><Satellite size={20} /></div><div><strong>NASA POWER · Daily point service</strong><p>Choose the historical window for your farm's climate summary.</p></div></div><div className="date-controls"><FormField label="Start date"><input type="date" min="1981-01-01" value={climateStart} max={climateEnd} onChange={e => setClimateStart(e.target.value)} /></FormField><FormField label="End date"><input type="date" min={climateStart} value={climateEnd} onChange={e => setClimateEnd(e.target.value)} /></FormField><button className="button button-primary" onClick={loadClimate} disabled={climateLoading || !climateStart || !climateEnd}>{climateLoading ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />} Load period</button></div></section>
          {climate && <><div className="metric-grid climate-metrics"><MetricCard label="MEAN TEMP." value={fmt(summary?.mean_temperature_c)} unit="°C" note="Daily mean temperature average" icon={ThermometerSun} tone="amber" /><MetricCard label="AVERAGE DAILY HIGH" value={fmt(summary?.mean_daily_max_c)} unit="°C" note="Average of daily maximums" icon={TrendingUp} tone="rose" /><MetricCard label="AVERAGE DAILY LOW" value={fmt(summary?.mean_daily_min_c)} unit="°C" note="Average of daily minimums" icon={ArrowDownRight} tone="blue" /><MetricCard label="PERIOD PRECIPITATION" value={fmt(summary?.total_precipitation_mm, 0)} unit="mm" note="Sum of valid daily estimates" icon={CloudRain} tone="green" /></div>
            <div className="dashboard-grid climate-charts-grid"><div className="panel climate-panel"><div className="panel-heading"><div><div className="section-kicker">TEMPERATURE</div><h2>Monthly mean air temperature</h2><p>Mean of daily mean temperature values in each month</p></div><span className="chart-badge temp-badge">°C</span></div><div className="big-chart"><TemperatureChart data={climate.monthly} /></div></div><div className="panel climate-panel"><div className="panel-heading"><div><div className="section-kicker">PRECIPITATION</div><h2>Monthly rainfall estimates</h2><p>Sum of daily precipitation estimates for each month</p></div><span className="chart-badge rain-badge">mm</span></div><div className="big-chart"><RainChart data={climate.monthly} /></div></div></div>
            <div className="panel annual-panel"><div className="panel-heading"><div><div className="section-kicker">YEAR-TO-YEAR CONTEXT</div><h2>Annual precipitation</h2><p>Grouped by calendar year; edge years may be partial</p></div></div><div className="annual-bars">{annualRainChart.map(row => { const max = Math.max(...annualRainChart.map(x => x.precipitation_mm), 1); return <div className="annual-bar-row" key={row.year}><span>{row.year}</span><div className="annual-track"><div className="annual-fill" style={{ width: `${row.precipitation_mm / max * 100}%` }} /></div><strong>{fmt(row.precipitation_mm, 0)} <small>mm</small></strong></div> })}</div></div>
            <div className="source-disclosure"><div className="source-disclosure-icon"><ShieldCheck size={19} /></div><div><strong>Source & limitations</strong><p>Source: <a href={climate.source_url} target="_blank" rel="noreferrer">NASA POWER Daily Point API</a> · Community: {climate.community} · Period: {climate.period.start} to {climate.period.end} · Retrieved: {new Date(climate.retrieved_at).toLocaleString()}</p>{climate.limitations.map(x => <span key={x}>• {x}</span>)}</div></div>
          </>}
          {!climate && <div className="panel"><EmptyClimate loading={climateLoading} error={climateError} onRetry={loadClimate} /></div>}
          {climateMessage && <div className="soft-message"><Check size={14} /> {climateMessage}</div>}
        </>}

        {activeView === 'rotations' && <>
          <PageHeading eyebrow="DECISION SUPPORT / COMPARISON" title="Explore the next rotation." description="Compare plausible crop sequences using broad climate fit, water constraints, crop-family diversity, soil inputs and the priority you selected." actions={<button className="button button-secondary" onClick={downloadReport}><Download size={15} /> Export report</button>} />
          <div className="rotation-context"><div className="context-pill"><MapPin size={14} /> {farm.region}</div><div className="context-pill"><Droplets size={14} /> {farm.irrigation === 'rainfed' ? 'Rain-fed' : farm.irrigation === 'limited' ? 'Limited irrigation' : 'Reliable irrigation'}</div><div className="context-pill"><Compass size={14} /> {farm.priority.replaceAll('_', ' ')}</div><button className="text-action" onClick={() => navTo('farm')}>Adjust assumptions <ArrowRight size={14} /></button></div>
          <div className="rotation-banner"><div className="banner-mark"><Sprout size={24} /></div><div><strong>Screening options, not automatic prescriptions</strong><p>Scores are relative heuristic comparisons. Review seasonal rainfall, exact crop calendars, soil test results and local market conditions before changing practice.</p></div><button className="button button-secondary" onClick={() => runRecommendations()} disabled={recommendLoading}>{recommendLoading ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />} Recalculate</button></div>
          {recommendError && <div className="inline-error">{recommendError}</div>}
          {recommendLoading && <div className="panel loading-panel"><LoaderCircle size={20} className="spin" /> Scoring rotation candidates using the current farm profile…</div>}
          {!recommendations && !recommendLoading && <div className="panel first-run-panel"><div className="discover-art large-discover"><Compass size={32} /></div><h2>Generate your rotation shortlist</h2><p>Field Shift combines the current farm profile with available NASA climate summaries and transparent crop-rotation heuristics.</p><button className="button button-primary" onClick={() => runRecommendations()}><Compass size={16} /> Generate comparison <ArrowRight size={15} /></button></div>}
          {recommendations && <><div className="rotation-summary-row"><div><div className="section-kicker">SHORTLIST</div><h2>{recommendations.ranked_rotations.length} candidate rotations</h2></div><div className="summary-status"><span className="status-dot" /> {climate ? 'Climate-informed screening' : 'Climate data missing · lower confidence'}</div></div>
            <div className="rotation-cards">{recommendations.ranked_rotations.map((rotation, index) => <RotationCard key={rotation.id} rotation={rotation} rank={index + 1} active={index === 0} />)}</div>
            <div className="dashboard-grid method-grid"><div className="panel method-panel"><div className="panel-heading"><div><div className="section-kicker">SCORING METHOD</div><h2>How options are compared</h2></div><div className="soft-icon"><Gauge size={18} /></div></div><p>{recommendations.method}</p><div className="weight-list">{Object.entries(recommendations.weights).map(([key, value]) => <div key={key} className="weight-row"><span>{key.replaceAll('_', ' ')}</span><div className="weight-track"><div style={{ width: `${value * 100}%` }} /></div><strong>{Math.round(value * 100)}%</strong></div>)}</div></div><div className="panel gaps-panel"><div className="panel-heading"><div><div className="section-kicker">NEXT BEST INPUTS</div><h2>Improve confidence</h2></div><div className="soft-icon"><FlaskConical size={18} /></div></div>{recommendations.data_gaps.length ? <div className="gap-list">{recommendations.data_gaps.map(gap => <div key={gap}><span className="gap-dot" />{gap}</div>)}</div> : <p>Core profile inputs are present. A locally validated crop calendar and laboratory soil report can further improve the assessment.</p>}<button className="wide-link" onClick={() => navTo('farm')}>Update farm profile <ArrowRight size={15} /></button></div></div>
          </>}
        </>}
        <footer className="page-footer"><span>FIELD SHIFT <span className="footer-dot">·</span> NASA SPACE APPS CONCEPT</span><span>Earth observations × local knowledge</span><button onClick={() => setShowLimitations(v => !v)}>Data notes <ChevronDown size={13} /></button></footer>
      </div>
    </main>
    {showLimitations && <div className="drawer-scrim" onClick={() => setShowLimitations(false)}><aside className="info-drawer" onClick={e => e.stopPropagation()}><button className="drawer-close" onClick={() => setShowLimitations(false)}><X size={18} /></button><div className="section-kicker">ABOUT THE DATA</div><h2>Evidence before assumptions.</h2><p>Field Shift is a decision-support prototype. It does not replace local agronomic advice.</p><div className="drawer-note"><Satellite size={17} /><div><strong>NASA POWER</strong><p>Gridded meteorological estimates for the selected point; not direct field measurements.</p><a href="https://power.larc.nasa.gov/docs/services/api/temporal/daily/" target="_blank" rel="noreferrer">Read official documentation <ExternalLink size={13} /></a></div></div><div className="drawer-note"><FlaskConical size={17} /><div><strong>Soil measurements</strong><p>pH, texture and organic matter are entered by the farmer. This build does not infer soil fertility from satellite data.</p></div></div><div className="drawer-note"><Compass size={17} /><div><strong>Rotation scores</strong><p>Weights create a relative screening score across a fixed candidate set. They are not yield, profit or measured soil-health forecasts.</p></div></div></aside></div>}
    {toast && <div className="toast"><Check size={16} /> {toast}</div>}
  </div>
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>
}
function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-heading-actions">{actions}</div>}</section>
}
function SignalRow({ icon: Icon, label, value, sub }: { icon: typeof Sprout; label: string; value: string; sub: string }) {
  return <div className="signal-row"><div className="signal-icon"><Icon size={17} /></div><div className="signal-content"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div><ChevronRight size={15} className="signal-chevron" /></div>
}
function ClimateChart({ data }: { data: ClimateData['monthly'] }) {
  const filtered = data.filter(d => d.temperature_c !== null || d.precipitation_mm !== null)
  return <div className="dual-chart">{filtered.map(d => { const max = Math.max(...filtered.map(x => x.precipitation_mm ?? 0), 10); const tempMin = Math.min(...filtered.map(x => x.temperature_c ?? 0), 0); const tempMax = Math.max(...filtered.map(x => x.temperature_c ?? 0), 1); return <div className="dual-chart-col" key={d.month} title={`${d.month}: ${fmt(d.temperature_c)}°C, ${fmt(d.precipitation_mm)} mm`}><div className="dual-chart-bars"><div className="bar-rain" style={{ height: `${Math.max(2, (d.precipitation_mm ?? 0) / max * 82)}%` }} /><div className="bar-temp" style={{ height: `${Math.max(4, ((d.temperature_c ?? tempMin) - tempMin + 1) / (tempMax - tempMin + 1) * 80)}%` }} /></div><span>{d.month.slice(5)}</span>{d.month.endsWith('-01') && <small>{d.month.slice(0,4)}</small>}</div> })}</div>
}
function TemperatureChart({ data }: { data: ClimateData['monthly'] }) {
  const rows = data.filter(d => d.temperature_c !== null)
  const min = Math.min(...rows.map(d => d.temperature_c ?? 0), 0)
  const max = Math.max(...rows.map(d => d.temperature_c ?? 0), 1)
  return <div className="vertical-chart">{rows.map(d => <div className="vertical-col" key={d.month} title={`${d.month}: ${fmt(d.temperature_c)} °C`}><span className="vertical-value">{fmt(d.temperature_c, 0)}</span><div className="vertical-track"><div className="vertical-temp-bar" style={{ height: `${Math.max(3, ((d.temperature_c ?? min) - min + 1) / (max - min + 1) * 100)}%` }} /></div><span className="vertical-label">{d.month.slice(5)}</span>{d.month.endsWith('-01') && <small>{d.month.slice(0,4)}</small>}</div>)}</div>
}
function RainChart({ data }: { data: ClimateData['monthly'] }) {
  const rows = data.filter(d => d.precipitation_mm !== null)
  const max = Math.max(...rows.map(d => d.precipitation_mm ?? 0), 1)
  return <div className="vertical-chart">{rows.map(d => <div className="vertical-col" key={d.month} title={`${d.month}: ${fmt(d.precipitation_mm)} mm`}><span className="vertical-value">{fmt(d.precipitation_mm, 0)}</span><div className="vertical-track"><div className="vertical-rain-bar" style={{ height: `${Math.max(2, (d.precipitation_mm ?? 0) / max * 100)}%` }} /></div><span className="vertical-label">{d.month.slice(5)}</span>{d.month.endsWith('-01') && <small>{d.month.slice(0,4)}</small>}</div>)}</div>
}
function RotationCard({ rotation, rank, active }: { rotation: Rotation; rank: number; active: boolean }) {
  const [expanded, setExpanded] = useState(false)
  return <article className={`rotation-card ${active ? 'rotation-card-active' : ''}`}><div className="rotation-card-top"><div className="rank-mark">{String(rank).padStart(2, '0')}</div><div className="rotation-title-group"><div className="rotation-tags"><span>{active ? 'TOP RELATIVE FIT' : rotation.region.toUpperCase()}</span><span className={`confidence-label ${rotation.confidence.toLowerCase().includes('low') ? 'confidence-low' : ''}`}>{rotation.confidence}</span></div><h3>{rotation.name}</h3><p>{rotation.description}</p></div><div className="score-ring"><strong>{rotation.score}</strong><span>/100</span></div></div>
    <div className="sequence-wrap"><span className="micro-label">3-YEAR MAIN-CROP SEQUENCE</span><div className="sequence">{rotation.crops.map((crop, index) => <div className="sequence-step" key={`${crop}-${index}`}><div className={`crop-symbol crop-${rotation.crops_detail[index]?.family.replaceAll('-', '') ?? 'default'}`}><Sprout size={16} /></div><div><strong>{humanCrop(crop)}</strong><small>Year {index + 1} · {rotation.crops_detail[index]?.season}</small></div>{index < rotation.crops.length - 1 && <ArrowRight className="sequence-arrow" size={15} />}</div>)}</div></div>
    <div className="component-metrics">{[['Climate fit', rotation.components.climate], ['Water fit', rotation.components.water], ['Soil fit', rotation.components.soil], ['Diversity', rotation.components.diversity]].map(([label, value]) => <div className="component-metric" key={label as string}><div><span>{label}</span><strong>{value}</strong></div><div className="component-track"><div style={{ width: `${value}%` }} /></div></div>)}</div>
    <div className="rotation-card-foot"><span><ShieldCheck size={14} /> Explainable score</span><button className="expand-button" onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide details' : 'Why this option?'} <ChevronDown size={14} className={expanded ? 'rotate-up' : ''} /></button></div>
    {expanded && <div className="rotation-details"><div><h4>Why it may fit</h4>{rotation.reasons.map(reason => <p key={reason}><span className="detail-bullet benefit" />{reason}</p>)}</div><div><h4>Risks to check</h4>{rotation.risks.map(risk => <p key={risk}><span className="detail-bullet risk" />{risk}</p>)}</div><div><h4>Crop notes</h4>{rotation.crops_detail.map(crop => <p key={crop.id}><strong>{crop.name}:</strong> {crop.notes}</p>)}</div></div>}
  </article>
}
