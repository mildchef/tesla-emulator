import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Trim } from '@shared/types'
import { applyPaint, createMaterials, roleOf } from './materials'
import { getPaint } from './paints'
import { Wheel } from './Wheel'

export const MODEL_URL = './models/model3-highland.glb'

/** Measured from the body's wheel arches (2.875 m wheelbase, ~1.58 m track). */
export const AXLE_FRONT = 1.5
export const AXLE_REAR = -1.375
export const TRACK_HALF = 0.79
const WHEEL_Y = 0.336

const HOOD_HINGE = new THREE.Vector3(1.12, 0.9, 0)
const TRUNK_HINGE = new THREE.Vector3(-1.53, 1.22, 0)
const HOOD_PARTS = ['Hood']
const TRUNK_PARTS = ['Trunk', 'Lights_Trunk', 'Lights_Trunk_Glass', 'Headlights_Trunk', 'Spoiler1', 'Trunk_Card', 'Trunk_Bracket1', 'Trunk_Bracket2']

/**
 * The build script bakes ambient occlusion into a custom `_AO` attribute
 * (GLTFLoader names it `_ao`); the materials read it as `bakedAo`. A model
 * built before occlusion was baked gets a neutral value instead of rendering black.
 */
function useBakedAo(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute('bakedAo')) return
  const baked = geometry.getAttribute('_ao')
  if (baked) {
    geometry.setAttribute('bakedAo', baked)
    geometry.deleteAttribute('_ao')
  } else {
    geometry.setAttribute('bakedAo', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(1), 1))
  }
}

interface Props {
  paintId: string
  trim: Trim
  frunkOpen: boolean
  trunkOpen: boolean
}

/** Tesla's Model 3 Highland visualization mesh with generated wheels. */
export function CarModel({ paintId, trim, frunkOpen, trunkOpen }: Props) {
  const { scene } = useGLTF(MODEL_URL, false, true)

  const car = useMemo(() => {
    const root = scene.clone(true)
    const materials = createMaterials(getPaint(paintId))
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.material = materials[roleOf((mesh.material as THREE.Material).name)]
        useBakedAo(mesh.geometry)
      }
    })
    const hood = new THREE.Group()
    hood.position.copy(HOOD_HINGE)
    const trunk = new THREE.Group()
    trunk.position.copy(TRUNK_HINGE)
    root.add(hood, trunk)
    root.updateMatrixWorld(true)
    for (const name of HOOD_PARTS) {
      const n = root.getObjectByName(name)
      if (n) hood.attach(n)
    }
    for (const name of TRUNK_PARTS) {
      const n = root.getObjectByName(name)
      if (n) trunk.attach(n)
    }
    return { root, materials, hood, trunk, spoiler: root.getObjectByName('Spoiler1') }
    // Paint is applied by the effect below; the clone is built once per scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  useEffect(() => applyPaint(car.materials.paint, getPaint(paintId)), [car, paintId])
  useEffect(() => {
    if (car.spoiler) car.spoiler.visible = trim === 'performance'
  }, [car, trim])

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 4)
    car.hood.rotation.z += ((frunkOpen ? 0.8 : 0) - car.hood.rotation.z) * k
    car.trunk.rotation.z += ((trunkOpen ? -1.1 : 0) - car.trunk.rotation.z) * k
  })

  return (
    <group>
      <primitive object={car.root} />
      <Wheel trim={trim} position={[AXLE_FRONT, WHEEL_Y, TRACK_HALF]} mirrored={false} />
      <Wheel trim={trim} position={[AXLE_REAR, WHEEL_Y, TRACK_HALF]} mirrored={false} />
      <Wheel trim={trim} position={[AXLE_FRONT, WHEEL_Y, -TRACK_HALF]} mirrored />
      <Wheel trim={trim} position={[AXLE_REAR, WHEEL_Y, -TRACK_HALF]} mirrored />
    </group>
  )
}
