import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Compass, ChevronDown, ChevronUp, Orbit, Crosshair } from 'lucide-react'

interface Earth3DGlobeProps {
  latitude: number
  longitude: number
  theme: 'light' | 'dark'
  onPick: (lat: number, lon: number) => void
  compact?: boolean
}

// Pre-allocated math helpers outside render loop (Zero GC in tick)
const _targetCamPos = new THREE.Vector3()
const _pinNormal = new THREE.Vector3()
const _upVec = new THREE.Vector3(0, 1, 0)
const _quat = new THREE.Quaternion()

const GLOBE_RADIUS = 2.0

function latLonToVector3(lat: number, lon: number, radius: number, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lon + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return out.set(x, y, z)
}

function vector3ToLatLon(point: THREE.Vector3): { lat: number; lon: number } {
  const normalized = point.clone().normalize()
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(normalized.y, -1, 1)) * (180 / Math.PI)
  const theta = Math.atan2(normalized.z, -normalized.x)
  let lon = theta * (180 / Math.PI) - 180
  if (lon < -180) lon += 360
  if (lon > 180) lon -= 360
  return {
    lat: Number(THREE.MathUtils.clamp(lat, -90, 90).toFixed(5)),
    lon: Number(THREE.MathUtils.clamp(lon, -180, 180).toFixed(5)),
  }
}

// Procedural continent polygons in [lon, lat] for zero-404 crisp Earth rendering
const CONTINENT_POLYGONS: number[][][] = [
  // North America
  [[-165,64],[-140,70],[-110,72],[-80,68],[-60,52],[-75,35],[-81,25],[-90,18],[-84,10],[-78,8],[-95,16],[-105,22],[-117,32],[-124,48],[-140,58]],
  // South America
  [[-78,9],[-62,10],[-50,0],[-35,-6],[-38,-18],[-48,-28],[-58,-38],[-68,-54],[-74,-48],[-72,-30],[-70,-18],[-81,-4]],
  // Eurasia (Europe + Asia + India Subcontinent)
  [[-9,38],[-5,48],[10,58],[28,70],[65,72],[110,73],[165,66],[170,60],[142,45],[130,35],[121,23],[108,18],[104,2],[98,16],[88,22],[80,8],[77,8],[72,21],[67,25],[58,25],[48,30],[36,34],[26,38],[14,38],[4,42]],
  // Africa
  [[-17,15],[-6,35],[11,37],[32,31],[43,12],[51,11],[40,-10],[35,-25],[20,-35],[16,-28],[12,-6],[8,4],[-8,5]],
  // Australia
  [[114,-22],[128,-14],[142,-11],[153,-26],[147,-38],[132,-33],[115,-34]],
  // Greenland
  [[-55,60],[-45,60],[-20,72],[-35,82],[-62,78]],
  // UK & Japan & Indonesia islands
  [[-6,50],[2,52],[-2,58]],
  [[130,31],[136,34],[141,41],[139,35]],
  [[96,5],[105,-6],[106,-7],[95,3]],
  [[110,-1],[118,4],[117,-4],[111,-3]],
]

function createProceduralEarthTextures(maxAnisotropy: number, theme: 'light' | 'dark') {
  const width = 1024
  const height = 512

  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = width
  colorCanvas.height = height
  const ctx = colorCanvas.getContext('2d')!

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = width
  bumpCanvas.height = height
  const bCtx = bumpCanvas.getContext('2d')!

  // Ocean base gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height)
  if (theme === 'dark') {
    oceanGrad.addColorStop(0, '#04121f')
    oceanGrad.addColorStop(0.5, '#072238')
    oceanGrad.addColorStop(1, '#04121f')
  } else {
    oceanGrad.addColorStop(0, '#1e5b82')
    oceanGrad.addColorStop(0.5, '#26729e')
    oceanGrad.addColorStop(1, '#1e5b82')
  }
  ctx.fillStyle = oceanGrad
  ctx.fillRect(0, 0, width, height)

  bCtx.fillStyle = '#101010'
  bCtx.fillRect(0, 0, width, height)

  const lonToX = (lon: number) => ((lon + 180) / 360) * width
  const latToY = (lat: number) => ((90 - lat) / 180) * height

  // Draw continents
  ctx.save()
  for (const poly of CONTINENT_POLYGONS) {
    ctx.beginPath()
    bCtx.beginPath()
    poly.forEach(([lon, lat], i) => {
      const x = lonToX(lon)
      const y = latToY(lat)
      if (i === 0) {
        ctx.moveTo(x, y)
        bCtx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
        bCtx.lineTo(x, y)
      }
    })
    ctx.closePath()
    bCtx.closePath()

    ctx.fillStyle = theme === 'dark' ? '#123a26' : '#3a7d52'
    ctx.fill()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = theme === 'dark' ? '#49a069' : '#68ab78'
    ctx.stroke()

    bCtx.fillStyle = '#909090'
    bCtx.fill()
  }
  ctx.restore()

  // Vegetation & agro-climatic belt shading
  for (let i = 0; i < 650; i++) {
    const px = (Math.sin(i * 12.9898) * 0.5 + 0.5) * width
    const py = (Math.cos(i * 78.233) * 0.5 + 0.5) * height
    const r = 4 + (i % 14)
    ctx.fillStyle = theme === 'dark' ? 'rgba(183, 255, 112, 0.04)' : 'rgba(255, 255, 255, 0.04)'
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Subtle lat/lon telemetry graticule
  ctx.strokeStyle = theme === 'dark' ? 'rgba(96, 207, 255, 0.16)' : 'rgba(255, 255, 255, 0.22)'
  ctx.lineWidth = 1
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = latToY(lat)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  for (let lon = -150; lon <= 180; lon += 30) {
    const x = lonToX(lon)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  const colorTex = new THREE.CanvasTexture(colorCanvas)
  colorTex.colorSpace = THREE.SRGBColorSpace
  colorTex.anisotropy = maxAnisotropy
  colorTex.wrapS = THREE.RepeatWrapping
  colorTex.wrapT = THREE.ClampToEdgeWrapping

  const bumpTex = new THREE.CanvasTexture(bumpCanvas)
  bumpTex.anisotropy = maxAnisotropy
  bumpTex.wrapS = THREE.RepeatWrapping
  bumpTex.wrapT = THREE.ClampToEdgeWrapping

  return { colorTex, bumpTex }
}

function createSatelliteGroup(): THREE.Group {
  const satGroup = new THREE.Group()

  // 1. Primary silhouette: Gold-foil octagonal satellite bus
  const busGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.11, 8)
  const busMat = new THREE.MeshStandardMaterial({
    color: 0xe8b84b,
    metalness: 0.85,
    roughness: 0.22,
  })
  const busMesh = new THREE.Mesh(busGeo, busMat)
  busMesh.rotation.z = Math.PI / 2
  satGroup.add(busMesh)

  // 2. Secondary read: Dual photovoltaic solar wings
  const wingGeo = new THREE.BoxGeometry(0.01, 0.08, 0.36)
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x1b4f8c,
    metalness: 0.6,
    roughness: 0.5,
  })
  const leftWing = new THREE.Mesh(wingGeo, wingMat)
  leftWing.position.set(0, 0, 0.24)
  const rightWing = new THREE.Mesh(wingGeo, wingMat)
  rightWing.position.set(0, 0, -0.24)
  satGroup.add(leftWing, rightWing)

  // 3. Accent details: Parabolic dish & optical sensor dome
  const dishGeo = new THREE.ConeGeometry(0.038, 0.03, 16, 1, true)
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xdbe7f0,
    metalness: 0.4,
    roughness: 0.3,
    side: THREE.DoubleSide,
  })
  const dish = new THREE.Mesh(dishGeo, dishMat)
  dish.position.set(0, -0.065, 0)
  dish.rotation.x = Math.PI
  satGroup.add(dish)

  const lensGeo = new THREE.SphereGeometry(0.02, 12, 12)
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x60cfff,
    emissive: 0x60cfff,
    emissiveIntensity: 0.7,
    roughness: 0.1,
  })
  const lens = new THREE.Mesh(lensGeo, lensMat)
  lens.position.set(0.06, 0, 0)
  satGroup.add(lens)

  return satGroup
}

function createFarmBeaconGroup(): THREE.Group {
  const group = new THREE.Group()

  // Ground pad
  const padGeo = new THREE.CylinderGeometry(0.055, 0.07, 0.018, 20)
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x061006,
    metalness: 0.5,
    roughness: 0.4,
  })
  const pad = new THREE.Mesh(padGeo, padMat)
  pad.position.y = 0.009
  group.add(pad)

  // Telemetry spire
  const spireGeo = new THREE.CylinderGeometry(0.012, 0.022, 0.22, 12)
  const spireMat = new THREE.MeshStandardMaterial({
    color: 0xb7ff70,
    emissive: 0x5ab82e,
    emissiveIntensity: 0.5,
    metalness: 0.3,
    roughness: 0.2,
  })
  const spire = new THREE.Mesh(spireGeo, spireMat)
  spire.position.y = 0.11
  group.add(spire)

  // Apex beacon sphere
  const orbGeo = new THREE.SphereGeometry(0.042, 16, 16)
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xb7ff70,
    emissive: 0xb7ff70,
    emissiveIntensity: 0.9,
    roughness: 0.15,
  })
  const orb = new THREE.Mesh(orbGeo, orbMat)
  orb.position.y = 0.23
  group.add(orb)

  // Outer radar ring
  const ringGeo = new THREE.RingGeometry(0.085, 0.11, 28)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x60cfff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.015
  group.add(ring)

  return group
}

export default function Earth3DGlobe({
  latitude,
  longitude,
  theme,
  onPick,
  compact = false,
}: Earth3DGlobeProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  const coordsRef = useRef({ latitude, longitude })
  coordsRef.current = { latitude, longitude }

  const [autoOrbit, setAutoOrbit] = useState(false)
  const [showSatOrbit, setShowSatOrbit] = useState(true)
  const [dockCollapsed, setDockCollapsed] = useState(false)

  const autoOrbitRef = useRef(autoOrbit)
  autoOrbitRef.current = autoOrbit

  const showSatRef = useRef(showSatOrbit)
  showSatRef.current = showSatOrbit

  const focusTriggerRef = useRef(0)

  useEffect(() => {
    // Trigger smooth camera focus whenever coordinates change
    focusTriggerRef.current = 1.0
  }, [latitude, longitude])

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 600
    const height = container.clientHeight || 280

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(theme === 'dark' ? 0x02060a : 0xeaf2ec)
    scene.fog = new THREE.FogExp2(theme === 'dark' ? 0x02060a : 0xeaf2ec, 0.065)

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
    const initialDir = latLonToVector3(coordsRef.current.latitude, coordsRef.current.longitude, 1).normalize()
    camera.position.copy(initialDir.multiplyScalar(5.2))

    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Studio environment reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
    pmremGenerator.dispose()

    // 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x8be2ff, 0x102418, 0.85)
    scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight(0xfff4dc, 1.8)
    keyLight.position.set(6, 5, 6)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x60cfff, 1.1)
    rimLight.position.set(-6, -3, -5)
    scene.add(rimLight)

    // Earth Sphere
    const maxAniso = renderer.capabilities.getMaxAnisotropy()
    const { colorTex, bumpTex } = createProceduralEarthTextures(maxAniso, theme)

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48)
    const earthMat = new THREE.MeshStandardMaterial({
      map: colorTex,
      bumpMap: bumpTex,
      bumpScale: 0.035,
      roughness: 0.55,
      metalness: 0.12,
    })
    const earthMesh = new THREE.Mesh(earthGeo, earthMat)
    scene.add(earthMesh)

    // Atmospheric Outer Halo
    const haloGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 48, 32)
    const haloMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x60cfff : 0x4ca87a,
      transparent: true,
      opacity: theme === 'dark' ? 0.11 : 0.14,
      side: THREE.BackSide,
      depthWrite: false,
    })
    const haloMesh = new THREE.Mesh(haloGeo, haloMat)
    scene.add(haloMesh)

    // Farm Beacon Pin
    const beaconGroup = createFarmBeaconGroup()
    scene.add(beaconGroup)

    // NASA Satellite & Orbital Track
    const orbitContainer = new THREE.Group()
    orbitContainer.rotation.z = 0.42
    orbitContainer.rotation.x = 0.25
    scene.add(orbitContainer)

    const orbitRingGeo = new THREE.RingGeometry(GLOBE_RADIUS * 1.24, GLOBE_RADIUS * 1.248, 96)
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: theme === 'dark' ? 0x60cfff : 0x28674b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    })
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat)
    orbitRing.rotation.x = Math.PI / 2
    orbitContainer.add(orbitRing)

    const satellite = createSatelliteGroup()
    orbitContainer.add(satellite)

    // Starfield InstancedMesh (for dark mode depth)
    const starCount = 120
    const starGeo = new THREE.SphereGeometry(0.025, 6, 6)
    const starMat = new THREE.MeshBasicMaterial({ color: 0xd0eeff })
    const starInstanced = new THREE.InstancedMesh(starGeo, starMat, starCount)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < starCount; i++) {
      const r = 14 + (i % 8)
      const theta = i * 2.39996
      const phi = Math.acos(1 - (2 * (i + 0.5)) / starCount)
      dummy.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      )
      const s = 0.5 + (i % 5) * 0.2
      dummy.scale.set(s, s, s)
      dummy.updateMatrix()
      starInstanced.setMatrixAt(i, dummy.matrix)
    }
    starInstanced.computeBoundingSphere()
    starInstanced.visible = theme === 'dark'
    scene.add(starInstanced)

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 2.75
    controls.maxDistance = 8.5
    controls.rotateSpeed = 0.65

    // Raycasting for Click-to-Pick Farm Coordinates
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let pointerDownPos = { x: 0, y: 0 }

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY }
      focusTriggerRef.current = 0 // Stop camera auto-slerp when user grabs globe
    }

    const handlePointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x
      const dy = e.clientY - pointerDownPos.y
      if (Math.hypot(dx, dy) > 5) return // User dragged to orbit, not a click

      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObject(earthMesh, false)
      if (hits.length > 0) {
        const { lat, lon } = vector3ToLatLon(hits[0].point)
        onPickRef.current(lat, lon)
      }
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    renderer.domElement.addEventListener('pointerup', handlePointerUp)

    // Pre-warm shaders
    renderer.compile(scene, camera)

    const clock = new THREE.Clock()
    let animId = 0
    let satAngle = 0

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const delta = Math.min(clock.getDelta(), 0.1)

      // Update farm beacon position & orientation on sphere surface
      latLonToVector3(coordsRef.current.latitude, coordsRef.current.longitude, GLOBE_RADIUS, beaconGroup.position)
      _pinNormal.copy(beaconGroup.position).normalize()
      _quat.setFromUnitVectors(_upVec, _pinNormal)
      beaconGroup.quaternion.copy(_quat)

      // Smooth damped camera fly-to when coordinates change or Focus Farm is pressed
      if (focusTriggerRef.current > 0.01) {
        const camDist = camera.position.length()
        _targetCamPos.copy(_pinNormal).multiplyScalar(camDist)
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.5, delta)
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 4.5, delta)
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 4.5, delta)
        focusTriggerRef.current = Math.max(0, focusTriggerRef.current - delta * 0.8)
      }

      // Update orbiting NASA satellite
      orbitContainer.visible = showSatRef.current
      if (showSatRef.current) {
        satAngle += delta * 0.55
        const orbitR = GLOBE_RADIUS * 1.244
        satellite.position.set(Math.cos(satAngle) * orbitR, 0, Math.sin(satAngle) * orbitR)
        satellite.lookAt(0, 0, 0)
      }

      controls.autoRotate = autoOrbitRef.current
      controls.autoRotateSpeed = 1.0
      controls.update()

      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth || 600
      const h = container.clientHeight || 280
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      controls.dispose()
      colorTex.dispose()
      bumpTex.dispose()
      earthGeo.dispose()
      earthMat.dispose()
      haloGeo.dispose()
      haloMat.dispose()
      orbitRingGeo.dispose()
      orbitRingMat.dispose()
      starGeo.dispose()
      starMat.dispose()
      renderer.dispose()
    }
  }, [theme])

  return (
    <div className={`earth-3d-stage ${compact ? 'earth-3d-compact' : ''}`}>
      <div ref={mountRef} className="earth-3d-canvas" />

      {/* Top-Left Telemetry Readout */}
      <div className="earth-3d-hud-badge">
        <Orbit size={13} />
        <span>3D ORBITAL GLOBE · {latitude.toFixed(2)}°, {longitude.toFixed(2)}°</span>
      </div>

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className={`earth-3d-dock-wrap ${dockCollapsed ? 'is-collapsed' : ''}`}>
        <button
          type="button"
          className="earth-3d-dock-Collapse"
          onClick={() => setDockCollapsed(v => !v)}
          title={dockCollapsed ? 'Show 3D controls' : 'Hide 3D controls'}
        >
          {dockCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span>{dockCollapsed ? '3D Controls' : 'Hide Dock'}</span>
        </button>
        {!dockCollapsed && (
          <div className="earth-3d-dock">
            <button
              type="button"
              className="earth-dock-btn"
              onClick={() => { focusTriggerRef.current = 1.0 }}
            >
              <Crosshair size={12} />
              <span>Center Farm</span>
            </button>
            <button
              type="button"
              className={`earth-dock-btn ${autoOrbit ? 'is-on' : ''}`}
              onClick={() => setAutoOrbit(v => !v)}
            >
              <Compass size={12} />
              <span>{autoOrbit ? 'Orbiting' : 'Auto-Orbit'}</span>
            </button>
            <button
              type="button"
              className={`earth-dock-btn ${showSatOrbit ? 'is-on' : ''}`}
              onClick={() => setShowSatOrbit(v => !v)}
            >
              <Orbit size={12} />
              <span>NASA Sat Pass</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
