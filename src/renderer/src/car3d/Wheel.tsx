import { useMemo } from 'react'
import * as THREE from 'three'
import type { Trim } from '@shared/types'

/** Wheel geometry is generated: Tesla's visualization mesh ships without wheels. */
interface Spec {
  rimRadius: number
  tireRadius: number
  width: number
  spokes: number
  sweep: number
  rimColor: string
  caliperColor: string
}

const SPECS: Record<Trim, Spec> = {
  // 20" Warp wheels on 235/35R20 tires, red Performance calipers.
  performance: { rimRadius: 0.254, tireRadius: 0.336, width: 0.235, spokes: 12, sweep: 0.42, rimColor: '#34363b', caliperColor: '#c8102e' },
  // 18" Photon aero wheels on 235/45R18 tires.
  premium: { rimRadius: 0.229, tireRadius: 0.335, width: 0.235, spokes: 10, sweep: 0.18, rimColor: '#3a3b3f', caliperColor: '#2b2b2e' }
}

function tireGeometry(s: Spec): THREE.BufferGeometry {
  const hw = s.width / 2
  const R = s.tireRadius
  const r = s.rimRadius + 0.006
  const pts = [
    new THREE.Vector2(r, -hw + 0.012),
    new THREE.Vector2(r + 0.03, -hw - 0.002),
    new THREE.Vector2(R - 0.035, -hw + 0.002),
    new THREE.Vector2(R - 0.008, -hw + 0.03),
    new THREE.Vector2(R, -hw + 0.06),
    new THREE.Vector2(R, hw - 0.06),
    new THREE.Vector2(R - 0.008, hw - 0.03),
    new THREE.Vector2(R - 0.035, hw - 0.002),
    new THREE.Vector2(r + 0.03, hw + 0.002),
    new THREE.Vector2(r, hw - 0.012)
  ]
  const g = new THREE.LatheGeometry(pts, 72)
  g.rotateX(Math.PI / 2) // axle along Z
  return g
}

function spokeGeometry(s: Spec): THREE.BufferGeometry {
  const inner = 0.075
  const outer = s.rimRadius - 0.012
  const steps = 10
  const left: THREE.Vector2[] = []
  const right: THREE.Vector2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const r = inner + (outer - inner) * t
    const a = s.sweep * t * t
    const half = (0.016 + 0.022 * t) / r // angular half-width
    left.push(new THREE.Vector2(r * Math.cos(a - half), r * Math.sin(a - half)))
    right.push(new THREE.Vector2(r * Math.cos(a + half), r * Math.sin(a + half)))
  }
  const shape = new THREE.Shape([...left, ...right.reverse()])
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 })
  return g
}

export function Wheel({ trim, position, mirrored }: { trim: Trim; position: [number, number, number]; mirrored: boolean }) {
  const s = SPECS[trim]
  const parts = useMemo(() => {
    const hw = s.width / 2
    const tire = tireGeometry(s)
    const spoke = spokeGeometry(s)
    const lip = new THREE.TorusGeometry(s.rimRadius - 0.004, 0.011, 10, 72)
    const barrel = new THREE.CylinderGeometry(s.rimRadius - 0.004, s.rimRadius - 0.004, s.width - 0.03, 64, 1, true)
    barrel.rotateX(Math.PI / 2)
    const hub = new THREE.CylinderGeometry(0.075, 0.08, 0.04, 40)
    hub.rotateX(Math.PI / 2)
    const disc = new THREE.CylinderGeometry(s.rimRadius - 0.06, s.rimRadius - 0.06, 0.028, 56)
    disc.rotateX(Math.PI / 2)
    const caliper = new THREE.TorusGeometry(s.rimRadius - 0.075, 0.03, 8, 20, 0.95)
    return {
      hw,
      tire,
      spoke,
      lip,
      barrel,
      hub,
      disc,
      caliper,
      rubber: new THREE.MeshStandardMaterial({ color: '#141415', roughness: 0.92, metalness: 0 }),
      rim: new THREE.MeshPhysicalMaterial({ color: s.rimColor, metalness: 0.8, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }),
      inner: new THREE.MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.7, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: '#77787c', metalness: 0.9, roughness: 0.45 }),
      paint: new THREE.MeshStandardMaterial({ color: s.caliperColor, roughness: 0.4, metalness: 0.2 })
    }
  }, [s])

  const face = parts.hw - 0.05
  return (
    <group position={position} rotation={[0, mirrored ? Math.PI : 0, 0]}>
      <mesh geometry={parts.tire} material={parts.rubber} />
      <mesh geometry={parts.barrel} material={parts.inner} />
      <mesh geometry={parts.lip} material={parts.rim} position={[0, 0, face + 0.02]} />
      {Array.from({ length: s.spokes }, (_, i) => (
        <mesh
          key={i}
          geometry={parts.spoke}
          material={parts.rim}
          position={[0, 0, face - 0.012]}
          rotation={[0, 0, (i / s.spokes) * Math.PI * 2]}
        />
      ))}
      <mesh geometry={parts.hub} material={parts.rim} position={[0, 0, face + 0.005]} />
      <mesh geometry={parts.disc} material={parts.metal} position={[0, 0, -0.01]} />
      <mesh geometry={parts.caliper} material={parts.paint} position={[0, 0, 0.03]} rotation={[0, 0, 0.6]} />
    </group>
  )
}
