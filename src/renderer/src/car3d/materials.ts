import * as THREE from 'three'
import type { Paint } from './paints'

export type Role =
  | 'paint'
  | 'trim'
  | 'glass'
  | 'lens'
  | 'tailLens'
  | 'lightWhite'
  | 'lightRed'
  | 'lightAmber'
  | 'interior'
  | 'seat'
  | 'screen'
  | 'carbon'

/**
 * Which role each "<Part>:<index>" primitive of Tesla's mesh plays. The source
 * OBJ has no meaningful materials, so this was mapped by rendering every
 * sub-part highlighted. Sub-part order differs between doors.
 */
const BY_KEY: Record<string, Role> = {
  'Body:1': 'paint',
  'Hood:1': 'paint',
  'Trunk:1': 'paint',
  'Door_LF:0': 'paint',
  'Door_RF:0': 'paint',
  'Door_LR:1': 'paint',
  'Door_RR:1': 'paint',
  'Door_LF_Mirror:0': 'paint',
  'Door_RF_Mirror:0': 'paint',
  'Charge_Cap:0': 'paint',
  'Charge_Cap_Right:0': 'paint',
  'Lights_Glass:0': 'lens',
  'Screen_Front:0': 'screen'
}

const BY_PART: [RegExp, Role][] = [
  [/^(Windows_Top|Window_)/, 'glass'],
  [/^Lights_Trunk_Glass/, 'tailLens'],
  [/^Lights_Glass/, 'lens'],
  [/^(Headlights|DRL|Lights$|Reverse_Lights|Fog_Lights_Front)/, 'lightWhite'],
  [/^(Brake_Lights|Lights_Trunk$|Headlights_Trunk)/, 'lightRed'],
  [/Turn_Signal/, 'lightAmber'],
  [/^Spoiler/, 'carbon'],
  [/^Seat_.*_Color$/, 'seat'],
  [/^(Seat_|Interior_|Dashboard|Center_Console|Doorcard|Steering_Wheel|Screen_|Trunk_Card|Trunk_Bracket)/, 'interior']
]

export function roleOf(materialName: string): Role {
  const exact = BY_KEY[materialName]
  if (exact) return exact
  const part = materialName.split(':')[0]
  for (const [re, role] of BY_PART) if (re.test(part)) return role
  return 'trim'
}

/** Same occlusion terms as three's aoMap chunk, fed by the baked per-vertex value. */
const BAKED_AO_FRAGMENT = /* glsl */ `
  float ambientOcclusion = mix( 1.0, vBakedAo, bakedAoStrength );
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  #if defined( USE_CLEARCOAT )
    clearcoatSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_SHEEN )
    sheenSpecularIndirect *= ambientOcclusion;
  #endif
  #if defined( USE_ENVMAP ) && defined( STANDARD )
    float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
    reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
  #endif
`

/**
 * Applies the ambient occlusion that scripts/build-car-model.mjs bakes into
 * each vertex (the `bakedAo` attribute) to the material's environment and
 * ambient light, like an aoMap would.
 */
function withBakedAo<T extends THREE.Material>(material: T, strength = 1): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.bakedAoStrength = { value: strength }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float bakedAo;\nvarying float vBakedAo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBakedAo = bakedAo;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float bakedAoStrength;\nvarying float vBakedAo;')
      .replace('#include <aomap_fragment>', BAKED_AO_FRAGMENT)
  }
  material.customProgramCacheKey = () => 'baked-ao'
  return material
}

export function createMaterials(paint: Paint): Record<Role, THREE.Material> {
  const materials = createBaseMaterials(paint)
  for (const m of Object.values(materials)) withBakedAo(m)
  return materials
}

function createBaseMaterials(paint: Paint): Record<Role, THREE.Material> {
  return {
    // Metallic base coat under a glossy clear coat: the clear coat carries the sharp studio reflections.
    paint: new THREE.MeshPhysicalMaterial({
      color: paint.color,
      metalness: paint.metalness,
      roughness: paint.roughness,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      envMapIntensity: 1
    }),
    trim: new THREE.MeshPhysicalMaterial({ color: '#0c0c0e', roughness: 0.38, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    // Tinted glass: plain dielectric, so it mirrors the studio at grazing angles
    // and shows the cabin when seen from above, as the roof does in the car's UI.
    glass: new THREE.MeshPhysicalMaterial({
      color: '#0b0d11',
      metalness: 0,
      roughness: 0.04,
      transparent: true,
      opacity: 0.78,
      envMapIntensity: 1.3
    }),
    lens: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.02,
      transmission: 0,
      transparent: true,
      opacity: 0.22,
      clearcoat: 1,
      envMapIntensity: 2
    }),
    tailLens: new THREE.MeshPhysicalMaterial({
      color: '#3a0306',
      roughness: 0.05,
      clearcoat: 1,
      transparent: true,
      opacity: 0.85,
      emissive: '#7a0710',
      emissiveIntensity: 0.6
    }),
    lightWhite: new THREE.MeshStandardMaterial({ color: '#e9efff', emissive: '#dfe9ff', emissiveIntensity: 1.4 }),
    lightRed: new THREE.MeshStandardMaterial({ color: '#5a0006', emissive: '#ff1428', emissiveIntensity: 0.9 }),
    lightAmber: new THREE.MeshStandardMaterial({ color: '#4a2a00', emissive: '#ff8a00', emissiveIntensity: 0.25 }),
    // The cabin sits under the glass roof, so it catches little of the studio light.
    interior: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.9, metalness: 0.05, envMapIntensity: 0.35 }),
    seat: new THREE.MeshStandardMaterial({ color: '#1c1c1f', roughness: 0.75, envMapIntensity: 0.3 }),
    screen: new THREE.MeshStandardMaterial({ color: '#050608', roughness: 0.2, emissive: '#0b1a33', emissiveIntensity: 0.5 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: '#151618', metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 })
  }
}

export function applyPaint(material: THREE.Material, paint: Paint): void {
  const m = material as THREE.MeshPhysicalMaterial
  m.color.set(paint.color)
  m.metalness = paint.metalness
  m.roughness = paint.roughness
}
