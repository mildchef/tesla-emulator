import { Environment, Html, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useStore } from '../state/store'
import { Bolt, Lock } from '../icons'
import { AXLE_FRONT, AXLE_REAR, CarModel, MODEL_URL, TRACK_HALF } from './CarModel'
import { CarPlaceholder } from './CarPlaceholder'
import { SafeBoundary } from '../screen/SafeBoundary'
import styles from './CarStage.module.css'

type Mode = 'park' | 'drive'

/** Park: 3/4 front-left view like the car's UI; the target sits low so the car rides high in the pane. */
const PARK_TARGET = new THREE.Vector3(0, -0.2, 0)
const PARK_POLAR = 1.2
/** How far the car tilts, as in the car: from a steep view from above down to just over the floor. */
const PARK_POLAR_MIN = 0.35
const PARK_POLAR_MAX = 1.45
const PARK_AZIMUTH = 0.95
const PARK_DISTANCE = 19.5
const PARK_CAMERA = new THREE.Vector3().setFromSphericalCoords(PARK_DISTANCE, PARK_POLAR, Math.PI / 2 + PARK_AZIMUTH).add(PARK_TARGET)
/** Drive: chase view from behind and above, road running away from the camera. */
const DRIVE_CAMERA = new THREE.Vector3(-15, 5.6, 0)
const DRIVE_TARGET = new THREE.Vector3(9, -1.2, 0)

/** Tap targets and labels that ride on the car (frunk, trunk, lock, charge port). */
function ParkLabels() {
  const { locked, frunkOpen, trunkOpen } = useStore((s) => s.vehicle)
  const patchVehicle = useStore((s) => s.patchVehicle)
  return (
    <>
      <Html position={[1.75, 0.95, 0]} zIndexRange={[5, 0]}>
        <button className={styles.label} style={{ height: 150 }} onClick={() => patchVehicle({ frunkOpen: !frunkOpen })} data-testid="label-frunk">
          <span>{frunkOpen ? 'Close' : 'Open'}</span>
          <b>Frunk</b>
        </button>
      </Html>
      <Html position={[-0.35, 1.46, 0]} zIndexRange={[5, 0]}>
        <button className={styles.lock} style={{ height: 150 }} onClick={() => patchVehicle({ locked: !locked })} data-testid="car-lock" aria-label={locked ? 'Unlock' : 'Lock'}>
          <Lock size={34} open={!locked} />
        </button>
      </Html>
      <Html position={[-2.05, 1.12, 0]} zIndexRange={[5, 0]}>
        <button className={styles.label} style={{ height: 170 }} onClick={() => patchVehicle({ trunkOpen: !trunkOpen })} data-testid="label-trunk">
          <span>{trunkOpen ? 'Close' : 'Open'}</span>
          <b>Trunk</b>
        </button>
      </Html>
      <Html position={[-1.93, 0.92, -0.95]} zIndexRange={[5, 0]}>
        <span className={styles.bolt}>
          <Bolt size={36} />
        </span>
      </Html>
    </>
  )
}

/**
 * Eases the camera between the park (3/4 front) and drive (chase) viewpoints,
 * then hands control to the orbit controls (spin and tilt) once parked.
 */
function CameraRig({ mode, onSettled }: { mode: Mode; onSettled: (settled: boolean) => void }) {
  const { camera } = useThree()
  const look = useRef(mode === 'park' ? PARK_TARGET.clone() : DRIVE_TARGET.clone())
  const settling = useRef(true)
  useEffect(() => {
    settling.current = true
    onSettled(false)
  }, [mode, onSettled])
  useFrame((_, dt) => {
    if (!settling.current) return
    const k = 1 - Math.exp(-dt * 4)
    const pos = mode === 'park' ? PARK_CAMERA : DRIVE_CAMERA
    const target = mode === 'park' ? PARK_TARGET : DRIVE_TARGET
    camera.position.lerp(pos, k)
    look.current.lerp(target, k)
    camera.lookAt(look.current)
    if (camera.position.distanceTo(pos) < 0.02) {
      camera.position.copy(pos)
      camera.lookAt(target)
      settling.current = false
      onSettled(true)
    }
  })
  return null
}

/** Dashed lane lines that scroll with vehicle speed. */
function Road() {
  const speed = useStore((s) => s.vehicle.speedMph)
  const line = useStore((s) => (s.settings.theme === 'dark' ? '#d9d9dc' : '#8e8e94'))
  const dashes = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!dashes.current) return
    const mps = speed * 0.447
    dashes.current.position.x = (dashes.current.position.x - mps * dt) % 12
  })
  const lane = 3.7
  return (
    <group>
      <group ref={dashes}>
        {Array.from({ length: 14 }, (_, i) =>
          [-lane / 2, lane / 2].map((z) => (
            <mesh key={`${i}-${z}`} position={[-24 + i * 12, 0.012, z]} rotation-x={-Math.PI / 2}>
              <planeGeometry args={[3, 0.13]} />
              <meshBasicMaterial color={line} transparent opacity={0.85} />
            </mesh>
          ))
        )}
      </group>
      {[-lane * 1.5, lane * 1.5].map((z) => (
        <mesh key={z} position={[40, 0.011, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[140, 0.13]} />
          <meshBasicMaterial color={line} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** Vertical gradient for the studio dome: dark floor, bright horizon band, softer ceiling. */
const DOME_SHADER = {
  uniforms: {
    ground: { value: new THREE.Color('#060607') },
    horizon: { value: new THREE.Color('#9a9da3') },
    sky: { value: new THREE.Color('#5c6068') }
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 ground;
    uniform vec3 horizon;
    uniform vec3 sky;
    varying vec3 vDir;
    void main() {
      float y = vDir.y;
      vec3 c = mix(ground, horizon, smoothstep(-0.12, 0.02, y));
      c = mix(c, sky, smoothstep(0.08, 0.6, y));
      gl_FragColor = vec4(c, 1.0);
    }`
}

/**
 * A photo-studio environment, rendered once into the reflection map: a gradient
 * dome so every panel reflects something, an overhead softbox for the hood and
 * roof, and long strip lights at shoulder height that draw the crisp highlight
 * lines along the doors that make car paint read as paint.
 */
function Studio({ dark }: { dark: boolean }) {
  // The overhead light fades out towards its edges, like a diffused softbox,
  // so the glass roof shows a soft glow instead of a hard rectangle.
  const softbox = useMemo(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.5, '#a0a0a0')
    g.addColorStop(1, '#000000')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(canvas)
  }, [])
  useEffect(() => () => softbox.dispose(), [softbox])
  return (
    <Environment resolution={512} frames={1} environmentIntensity={dark ? 0.95 : 1.1}>
      <mesh scale={80}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial args={[DOME_SHADER]} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <Lightformer form="rect" intensity={6} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[22, 11, 1]} map={softbox} />
      <Lightformer form="rect" intensity={6} position={[1, 2.4, 13]} scale={[46, 0.9, 1]} />
      <Lightformer form="rect" intensity={6} position={[1, 2.4, -13]} scale={[46, 0.9, 1]} />
      <Lightformer form="rect" intensity={2.5} position={[3, 5.5, 11]} scale={[30, 2.5, 1]} />
      <Lightformer form="rect" intensity={2.5} position={[3, 5.5, -11]} scale={[30, 2.5, 1]} />
      <Lightformer form="rect" intensity={2} position={[15, 4, 0]} scale={[14, 5, 1]} />
      <Lightformer form="rect" intensity={1.2} position={[-15, 4, 0]} scale={[14, 5, 1]} />
    </Environment>
  )
}

/** A pool of light on the floor around the parked car, so its shadow has something to fall on. */
function FloorGlow({ dark }: { dark: boolean }) {
  const texture = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    const rgb = dark ? '74, 74, 80' : '255, 255, 255'
    g.addColorStop(0, `rgba(${rgb}, ${dark ? 0.75 : 0.9})`)
    g.addColorStop(0.45, `rgba(${rgb}, ${dark ? 0.32 : 0.45})`)
    g.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [dark])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} renderOrder={-1}>
      <planeGeometry args={[17, 11]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  )
}

/**
 * The car's ground shadow, painted rather than rendered: a soft footprint, a
 * tighter core under the sills and dark contact patches under the tyres.
 */
function CarShadow({ strength }: { strength: number }) {
  const SIZE: [number, number] = [7, 3.5]
  const texture = useMemo(() => {
    const W = 1024
    const H = 512
    const px = W / SIZE[0]
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const box = (x0: number, x1: number, z: number, r: number, blur: number, alpha: number): void => {
      ctx.filter = `blur(${blur * px}px)`
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`
      ctx.beginPath()
      ctx.roundRect(W / 2 + x0 * px, H / 2 - z * px, (x1 - x0) * px, 2 * z * px, r * px)
      ctx.fill()
    }
    box(-2.3, 2.35, 0.95, 0.6, 0.32, 0.5)
    box(-2.05, 2.1, 0.78, 0.4, 0.12, 0.45)
    ctx.filter = `blur(${0.045 * px}px)`
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'
    for (const x of [AXLE_FRONT, AXLE_REAR]) {
      for (const z of [TRACK_HALF, -TRACK_HALF]) {
        ctx.beginPath()
        ctx.ellipse(W / 2 + x * px, H / 2 - z * px, 0.3 * px, 0.11 * px, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const t = new THREE.CanvasTexture(canvas)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]}>
      <planeGeometry args={SIZE} />
      <meshBasicMaterial map={texture} transparent opacity={strength} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  )
}

function Scene({ mode }: { mode: Mode }) {
  const theme = useStore((s) => s.settings.theme)
  const paint = useStore((s) => s.settings.paint)
  const trim = useStore((s) => s.settings.trim)
  const { frunkOpen, trunkOpen, gear } = useStore((s) => s.vehicle)
  const [settled, setSettled] = useState(false)
  const dark = theme === 'dark'
  const fog = dark ? '#0b0b0c' : '#e6e6e8'

  return (
    <>
      <fog attach="fog" args={[fog, mode === 'park' ? 24 : 22, mode === 'park' ? 42 : 75]} />
      <Studio dark={dark} />
      {/* A little direct light for the tyres and sills the dome barely reaches. */}
      <hemisphereLight args={['#ffffff', dark ? '#111113' : '#9a9aa0', 0.35]} />

      <CarModel paintId={paint} trim={trim} frunkOpen={frunkOpen} trunkOpen={trunkOpen} reversing={gear === 'R'} />

      {/* Parked, the car sits on the pane's own backdrop in a pool of light. */}
      {mode === 'park' && <FloorGlow dark={dark} />}
      {mode === 'drive' && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
          <planeGeometry args={[80, 80]} />
          <meshBasicMaterial color={dark ? '#141416' : '#d2d2d6'} />
        </mesh>
      )}
      <CarShadow strength={dark ? 1 : 0.75} />
      {mode === 'drive' && <Road />}

      {mode === 'park' && <ParkLabels />}

      {mode === 'park' && settled && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.9}
          minPolarAngle={PARK_POLAR_MIN}
          maxPolarAngle={PARK_POLAR_MAX}
          target={PARK_TARGET.toArray()}
        />
      )}
      <CameraRig mode={mode} onSettled={setSettled} />
    </>
  )
}

function hasWebGL(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

function useModelAvailable(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    if (!hasWebGL()) {
      setOk(false)
      return
    }
    fetch(MODEL_URL, { method: 'HEAD' })
      .then((r) => alive && setOk(r.ok))
      .catch(() => alive && setOk(false))
    return () => {
      alive = false
    }
  }, [])
  return ok
}

/** Left-pane car: Tesla's 3D model when it has been built, a 2D stand-in otherwise. */
export function CarStage({ mode }: { mode: Mode }) {
  const available = useModelAvailable()
  const stageScale = useStore((s) => s.stageScale)
  const dpr = useMemo(() => Math.min(2, Math.max(1, stageScale * window.devicePixelRatio)), [stageScale])
  const fallback = <CarPlaceholder mode={mode} />
  if (available === null) return null
  if (!available) return fallback
  return (
    <div className={styles.stage} data-testid="car-3d">
      <SafeBoundary name="car-3d" fallback={fallback}>
        <Canvas
          dpr={dpr}
          resize={{ offsetSize: true }}
          camera={{ fov: 24, near: 0.1, far: 140, position: (mode === 'park' ? PARK_CAMERA : DRIVE_CAMERA).toArray() }}
          gl={{ antialias: true, alpha: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.1 }}
        >
          <Suspense fallback={null}>
            <Scene mode={mode} />
          </Suspense>
        </Canvas>
      </SafeBoundary>
    </div>
  )
}
