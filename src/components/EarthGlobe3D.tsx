import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { SvgIcon } from './SvgIcon'

interface EarthGlobe3DProps {
  latitude: number
  longitude: number
  theme: 'light' | 'dark'
  onPick: (lat: number, lon: number) => void
  regionLabel?: string
  farmName?: string
  areaHectares?: number
  compact?: boolean
}

const GLOBE_RADIUS = 1

/**
 * Convert geographic (lat, lon) in degrees to 3D Cartesian vector on a sphere of radius R.
 * Matches Three.js SphereGeometry UV mapping:
 *   phi = (90 - lat) * DEG2RAD
 *   theta = (lon + 180) * DEG2RAD
 */
function latLonToVec3(lat: number, lon: number, radius = GLOBE_RADIUS): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

/**
 * Inverse conversion from a point on the sphere back to (lat, lon) in degrees.
 */
function vec3ToLatLon(point: THREE.Vector3): { lat: number; lon: number } {
  const normalized = point.clone().normalize()
  const lat = 90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(normalized.y, -1, 1)))
  const theta = Math.atan2(normalized.z, -normalized.x)
  let lon = THREE.MathUtils.radToDeg(theta) - 180
  if (lon < -180) lon += 360
  if (lon > 180) lon -= 360
  return {
    lat: Number(lat.toFixed(5)),
    lon: Number(lon.toFixed(5)),
  }
}

/**
 * Build a procedural high-contrast satellite fallback canvas texture so the 3D globe
 * always renders rich ocean and continent coloration immediately while high-res satellite textures stream in.
 */
function createProceduralEarthCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  oceanGrad.addColorStop(0, '#071b2e')
  oceanGrad.addColorStop(0.5, '#0a2942')
  oceanGrad.addColorStop(1, '#061829')
  ctx.fillStyle = oceanGrad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = 'rgba(96, 207, 255, 0.08)'
  ctx.lineWidth = 1
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }
  for (let y = 0; y <= canvas.height; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }
  return canvas
}

/**
 * Web Mercator tile helpers for draping curved Esri satellite patches on the 3D globe.
 */
function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z))
}
function latToTileY(lat: number, z: number): number {
  const rad = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(lat, -85.05, 85.05))
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z))
}
function tileXToLon(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180
}
function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z)
  return THREE.MathUtils.radToDeg(Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))))
}

function createSphericalPatchGeometry(
  north: number,
  south: number,
  west: number,
  east: number,
  radius: number,
  segments = 24,
): THREE.BufferGeometry {
  const phiStart = THREE.MathUtils.degToRad(90 - north)
  const phiLength = THREE.MathUtils.degToRad(Math.max(0.05, north - south))
  const thetaStart = THREE.MathUtils.degToRad(west + 180)
  const thetaLength = THREE.MathUtils.degToRad(Math.max(0.05, east - west))
  return new THREE.SphereGeometry(radius, segments, segments, thetaStart, thetaLength, phiStart, phiLength)
}

function FieldTerrainMapSync({
  latitude,
  longitude,
  zoom,
  onPick,
}: {
  latitude: number
  longitude: number
  zoom: number
  onPick: (lat: number, lon: number) => void
}) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], zoom, { animate: true })
  }, [latitude, longitude, zoom, map])

  useMapEvents({
    click(event) {
      onPick(Number(event.latlng.lat.toFixed(5)), Number(event.latlng.lng.toFixed(5)))
    },
  })

  return (
    <CircleMarker
      center={[latitude, longitude]}
      radius={9}
      pathOptions={{
        color: '#041208',
        weight: 3,
        fillColor: '#b7ff70',
        fillOpacity: 1,
      }}
    >
      <Popup>Selected land parcel ({latitude.toFixed(4)}°, {longitude.toFixed(4)}°)</Popup>
    </CircleMarker>
  )
}

export function EarthGlobe3D({
  latitude,
  longitude,
  onPick,
  farmName,
  areaHectares = 2.4,
  compact = false,
}: EarthGlobe3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const markerGroupRef = useRef<THREE.Group | null>(null)
  const pulseRingRef = useRef<THREE.Mesh | null>(null)
  const patchGroupRef = useRef<THREE.Group | null>(null)
  const targetCameraPosRef = useRef<THREE.Vector3 | null>(null)

  const [viewLevel, setViewLevel] = useState<'globe' | 'field'>('globe')
  const [fieldZoom, setFieldZoom] = useState(15)
  const [fieldTiltDeg, setFieldTiltDeg] = useState(32)
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>(null)

  // Initialize Three.js Photorealistic 3D Satellite Earth Globe
  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 640
    const height = container.clientHeight || (compact ? 300 : 360)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x02060b)

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.05, 100)
    const initialDist = compact ? 2.65 : 2.45
    const initialDir = latLonToVec3(latitude, longitude, 1).normalize()
    camera.position.copy(initialDir.multiplyScalar(initialDist))
    cameraRef.current = camera

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch {
      return
    }
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // OrbitControls around Earth origin
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.enablePan = false
    controls.minDistance = 1.18
    controls.maxDistance = 5.2
    controls.rotateSpeed = 0.65
    controls.zoomSpeed = 0.9
    controlsRef.current = controls

    const stopAutoFlight = () => {
      targetCameraPosRef.current = null
    }
    controls.addEventListener('start', stopAutoFlight)

    // Lighting rig for realistic sunlit satellite Earth
    const ambientLight = new THREE.AmbientLight(0xd9ecff, 1.35)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.95)
    sunLight.position.set(5, 3, 5)
    scene.add(sunLight)

    const rimLight = new THREE.DirectionalLight(0x60cfff, 0.55)
    rimLight.position.set(-5, -2, -4)
    scene.add(rimLight)

    // Deep-space starfield
    const starCount = 900
    const starPositions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 25
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      starPositions[i * 3 + 2] = r * Math.cos(phi)
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({
      color: 0xbfe6ff,
      size: 0.06,
      transparent: true,
      opacity: 0.75,
    })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // Main 3D Earth Sphere with Blue Marble satellite imagery + bump + specular
    const fallbackTexture = new THREE.CanvasTexture(createProceduralEarthCanvas())
    fallbackTexture.colorSpace = THREE.SRGBColorSpace

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 96, 96)
    const earthMat = new THREE.MeshPhongMaterial({
      map: fallbackTexture,
      specular: new THREE.Color(0x1f4b6e),
      shininess: 16,
    })
    const earthMesh = new THREE.Mesh(earthGeo, earthMat)
    scene.add(earthMesh)

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    loader.load(
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
        earthMat.map = tex
        earthMat.needsUpdate = true
      },
    )
    loader.load(
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png',
      bumpTex => {
        earthMat.bumpMap = bumpTex
        earthMat.bumpScale = 0.015
        earthMat.needsUpdate = true
      },
    )
    loader.load(
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-water.png',
      specTex => {
        earthMat.specularMap = specTex
        earthMat.needsUpdate = true
      },
    )

    // Subtle atmospheric Rayleigh halo
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.022, 64, 64)
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x60cfff,
      transparent: true,
      opacity: 0.11,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    })
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat)
    scene.add(atmosMesh)

    // Group for curved regional Esri satellite LOD patches
    const patchGroup = new THREE.Group()
    scene.add(patchGroup)
    patchGroupRef.current = patchGroup

    // Composite 3D Farm Beacon Marker (Pin Stem + Glowing Orb + Pulse Ring)
    const markerGroup = new THREE.Group()
    const stemGeo = new THREE.CylinderGeometry(0.0035, 0.0015, 0.075, 12)
    stemGeo.translate(0, 0.0375, 0)
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x60cfff,
      emissive: 0x60cfff,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.6,
    })
    const stemMesh = new THREE.Mesh(stemGeo, stemMat)
    markerGroup.add(stemMesh)

    const headGeo = new THREE.SphereGeometry(0.016, 20, 20)
    headGeo.translate(0, 0.08, 0)
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xb7ff70,
      emissive: 0xb7ff70,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.2,
    })
    const headMesh = new THREE.Mesh(headGeo, headMat)
    markerGroup.add(headMesh)

    const ringGeo = new THREE.RingGeometry(0.015, 0.028, 32)
    ringGeo.rotateX(-Math.PI / 2)
    ringGeo.translate(0, 0.004, 0)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xb7ff70,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
    const ringMesh = new THREE.Mesh(ringGeo, ringMat)
    markerGroup.add(ringMesh)
    pulseRingRef.current = ringMesh

    scene.add(markerGroup)
    markerGroupRef.current = markerGroup

    // Raycasting for click-to-pick land coordinates & pointer hover telemetry
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let downX = 0
    let downY = 0

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX
      downY = e.clientY
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObject(earthMesh, false)
      if (hits.length > 0) {
        const coords = vec3ToLatLon(hits[0].point)
        setHoverCoords(coords)
      } else {
        setHoverCoords(null)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const distMoved = Math.hypot(e.clientX - downX, e.clientY - downY)
      if (distMoved > 5) return
      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObject(earthMesh, false)
      if (hits.length > 0) {
        const picked = vec3ToLatLon(hits[0].point)
        onPickRef.current(picked.lat, picked.lon)
      }
    }

    const onPointerLeave = () => setHoverCoords(null)

    const domEl = renderer.domElement
    domEl.addEventListener('pointerdown', onPointerDown)
    domEl.addEventListener('pointermove', onPointerMove)
    domEl.addEventListener('pointerup', onPointerUp)
    domEl.addEventListener('pointerleave', onPointerLeave)

    // ResizeObserver for responsive container sizing
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        const h = entry.contentRect.height
        if (w > 0 && h > 0) {
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        }
      }
    })
    resizeObserver.observe(container)

    // Animation loop
    let animId = 0
    const clock = new THREE.Clock()
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      if (pulseRingRef.current) {
        const s = 1 + 0.55 * Math.sin(elapsed * 3.2)
        pulseRingRef.current.scale.set(s, 1, s)
        const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = 0.65 - 0.35 * Math.sin(elapsed * 3.2)
      }

      if (targetCameraPosRef.current) {
        camera.position.lerp(targetCameraPosRef.current, 0.08)
        if (camera.position.distanceTo(targetCameraPosRef.current) < 0.015) {
          targetCameraPosRef.current = null
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      domEl.removeEventListener('pointerdown', onPointerDown)
      domEl.removeEventListener('pointermove', onPointerMove)
      domEl.removeEventListener('pointerup', onPointerUp)
      domEl.removeEventListener('pointerleave', onPointerLeave)
      controls.dispose()
      earthGeo.dispose()
      earthMat.dispose()
      fallbackTexture.dispose()
      atmosGeo.dispose()
      atmosMat.dispose()
      starGeo.dispose()
      starMat.dispose()
      renderer.dispose()
    }
  }, [compact])

  // Update 3D Farm Beacon position, spherical satellite patch, and smooth camera flight on (latitude, longitude) change
  useEffect(() => {
    const surfacePos = latLonToVec3(latitude, longitude, GLOBE_RADIUS)
    const normal = surfacePos.clone().normalize()

    if (markerGroupRef.current) {
      markerGroupRef.current.position.copy(surfacePos)
      const up = new THREE.Vector3(0, 1, 0)
      markerGroupRef.current.quaternion.setFromUnitVectors(up, normal)
    }

    if (cameraRef.current) {
      const currentDist = THREE.MathUtils.clamp(
        cameraRef.current.position.length(),
        1.45,
        compact ? 2.65 : 2.45,
      )
      targetCameraPosRef.current = normal.clone().multiplyScalar(currentDist)
    }

    // Load curved regional high-res Esri World Imagery patch on the 3D sphere around the selected land
    const patchGroup = patchGroupRef.current
    if (!patchGroup) return

    while (patchGroup.children.length > 0) {
      const child = patchGroup.children[0] as THREE.Mesh
      patchGroup.remove(child)
      child.geometry?.dispose()
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose())
      else child.material?.dispose()
    }

    const z = 5
    const tx = lonToTileX(longitude, z)
    const ty = latToTileY(latitude, z)
    const north = tileYToLat(ty, z)
    const south = tileYToLat(ty + 1, z)
    const west = tileXToLon(tx, z)
    const east = tileXToLon(tx + 1, z)

    const patchGeo = createSphericalPatchGeometry(north, south, west, east, GLOBE_RADIUS * 1.0025, 24)
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`,
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace
        const patchMat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        })
        const patchMesh = new THREE.Mesh(patchGeo, patchMat)
        patchGroup.add(patchMesh)
      },
      undefined,
      () => {
        patchGeo.dispose()
      },
    )
  }, [latitude, longitude, compact])

  function handleFocusLand() {
    if (viewLevel === 'field') {
      setFieldZoom(16)
      setFieldTiltDeg(32)
      return
    }
    const normal = latLonToVec3(latitude, longitude, 1).normalize()
    targetCameraPosRef.current = normal.multiplyScalar(compact ? 1.85 : 1.72)
  }

  function handleToggleViewMode() {
    setViewLevel(prev => (prev === 'globe' ? 'field' : 'globe'))
  }

  function handleZoom(direction: 'in' | 'out') {
    if (viewLevel === 'field') {
      setFieldZoom(z => Math.max(5, Math.min(19, z + (direction === 'in' ? 1 : -1))))
      return
    }
    const cam = cameraRef.current
    if (!cam) return
    const currentDist = cam.position.length()
    const nextDist = THREE.MathUtils.clamp(
      currentDist * (direction === 'in' ? 0.78 : 1.28),
      1.22,
      4.8,
    )
    targetCameraPosRef.current = cam.position.clone().normalize().multiplyScalar(nextDist)
  }

  return (
    <div className={`earth-globe-stage google-3d-stage ${compact ? 'earth-globe-compact' : ''}`}>
      {/* 3D Satellite Globe Canvas (always mounted so transitions are instantaneous) */}
      <div
        ref={mountRef}
        className="google-3d-mount earth-canvas-mount"
        style={{ display: viewLevel === 'globe' ? 'block' : 'none' }}
      />

      {/* 3D-Tilted Photorealistic Field Satellite & Hybrid Boundary Stage when zoomed into Field Terrain */}
      {viewLevel === 'field' && (
        <div className="field-3d-terrain-stage">
          <div
            className="field-3d-tilted-plane"
            style={{
              transform: `perspective(1100px) rotateX(${fieldTiltDeg}deg) scale(1.08)`,
            }}
          >
            <MapContainer
              center={[latitude, longitude]}
              zoom={fieldZoom}
              maxZoom={20}
              scrollWheelZoom={true}
              zoomControl={false}
              className="farm-map field-3d-leaflet"
            >
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
                maxNativeZoom={16}
                maxZoom={20}
              />
              <TileLayer
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={16}
                maxZoom={20}
                pane="overlayPane"
              />
              <FieldTerrainMapSync
                latitude={latitude}
                longitude={longitude}
                zoom={fieldZoom}
                onPick={onPick}
              />
            </MapContainer>
          </div>
        </div>
      )}

      {/* Top Telemetry Bar with Borderless Lime/Cyan SVG Icons */}
      <div className="earth-top-spec real-glass-spec" onClick={e => e.stopPropagation()}>
        <span className="earth-spec-title">
          <SvgIcon name="globe-3d" size={18} tone="lime" />{' '}
          {viewLevel === 'globe' ? 'GOOGLE EARTH 3D GLOBE' : '3D FIELD TERRAIN'}
        </span>
        <span className="earth-spec-sep">·</span>
        <span className="earth-spec-coords">
          {farmName ? `${farmName} · ` : ''}
          {latitude.toFixed(3)}°, {longitude.toFixed(3)}° ({areaHectares} ha)
        </span>
        {hoverCoords && viewLevel === 'globe' && (
          <>
            <span className="earth-spec-sep">·</span>
            <span className="earth-spec-probe">
              <SvgIcon name="crosshair" size={18} tone="cyan" /> {hoverCoords.lat.toFixed(3)}°,{' '}
              {hoverCoords.lon.toFixed(3)}°
            </span>
          </>
        )}
      </div>

      {/* Bottom HUD Dock with Borderless Cyan/Lime SVG Icons */}
      <div className="earth-bottom-dock-wrap" onClick={e => e.stopPropagation()}>
        <div className="earth-bottom-dock real-glass-dock">
          <button
            type="button"
            className="earth-dock-btn"
            onClick={handleFocusLand}
            title="Focus camera directly on selected land"
          >
            <SvgIcon name="navigation" size={18} tone="cyan" />
            <span>Focus Land</span>
          </button>

          <button
            type="button"
            className={`earth-dock-btn ${viewLevel === 'field' ? 'is-active' : ''}`}
            onClick={handleToggleViewMode}
            title={
              viewLevel === 'field'
                ? 'Return to Global 3D Earth Globe'
                : 'Zoom into 3D Field Terrain'
            }
          >
            <SvgIcon
              name={viewLevel === 'field' ? 'minimize' : 'maximize'}
              size={18}
              tone={viewLevel === 'field' ? 'lime' : 'cyan'}
            />
            <span>{viewLevel === 'field' ? 'Global 3D Earth' : '3D Field Terrain'}</span>
          </button>

          {viewLevel === 'field' && (
            <button
              type="button"
              className="earth-dock-btn"
              onClick={() => setFieldTiltDeg(t => (t === 32 ? 0 : 32))}
              title="Toggle 3D perspective tilt"
            >
              <SvgIcon name="compass" size={18} tone={fieldTiltDeg > 0 ? 'lime' : 'cyan'} />
              <span>{fieldTiltDeg > 0 ? '3D Tilt On' : '2D Overhead'}</span>
            </button>
          )}

          <button
            type="button"
            className="earth-dock-btn"
            onClick={() => handleZoom('in')}
            title="Zoom in closer"
            aria-label="Zoom in closer"
          >
            <SvgIcon name="zoom-in" size={19} tone="cyan" />
          </button>

          <button
            type="button"
            className="earth-dock-btn"
            onClick={() => handleZoom('out')}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <SvgIcon name="zoom-out" size={19} tone="cyan" />
          </button>

          <div className="earth-dock-hint real-glass-hint">
            <span>
              {viewLevel === 'globe'
                ? 'Drag to rotate 3D Earth · Scroll to zoom · Click to pin land'
                : '3D Field Satellite · Scroll to zoom · Click anywhere to pin land'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
