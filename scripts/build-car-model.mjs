#!/usr/bin/env node
/**
 * Converts Tesla's Model 3 Highland visualization mesh (from the custom-wraps
 * download) into an optimized GLB for the emulator's 3D car.
 *
 *   npm run build:car
 *
 * Reads vendor/tesla/model3-2024-base/vehicle.obj, copied from Tesla's
 * custom-wraps repo (github.com/teslamotors/custom-wraps). Like the GLB it
 * produces, it is Tesla's asset: git-ignored, not to be redistributed.
 *
 * The OBJ ships without useful materials, so every (object, material) pair
 * becomes its own primitive named "<Object>:<index>"; the app assigns paint,
 * glass, lights and trim by those names. Normals are rebuilt from the geometry
 * and ambient occlusion is baked into each vertex (about 30 s). The result is
 * Tesla's asset: it is git-ignored and must not be redistributed.
 */
import { Document, NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'vendor', 'tesla', 'model3-2024-base', 'vehicle.obj')
const OUT = join(ROOT, 'src', 'renderer', 'public', 'models', 'model3-highland.glb')

/** Variants the emulator never shows: right-hand drive, other markets, plates, alternate trims. */
const SKIP = /_RHD|_GLOBAL|^Plate_|_2_0/

async function parseObj(file) {
  const positions = []
  const uvs = []
  const normals = []
  /** @type {Map<string, Map<string, number[][]>>} object -> material -> face corner triplets */
  const objects = new Map()
  let object = 'default'
  let material = 'default'

  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  for await (const line of rl) {
    const tag = line.slice(0, 2)
    if (tag === 'v ') positions.push(line.slice(2).trim().split(/\s+/).map(Number))
    else if (tag === 'vt') uvs.push(line.slice(3).trim().split(/\s+/).map(Number))
    else if (tag === 'vn') normals.push(line.slice(3).trim().split(/\s+/).map(Number))
    else if (tag === 'o ') object = line.slice(2).trim()
    else if (line.startsWith('usemtl ')) material = line.slice(7).trim()
    else if (tag === 'f ') {
      if (SKIP.test(object)) continue
      const corners = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((c) => c.split('/').map((n) => (n ? Number(n) - 1 : -1)))
      if (!objects.has(object)) objects.set(object, new Map())
      const mats = objects.get(object)
      if (!mats.has(material)) mats.set(material, [])
      const list = mats.get(material)
      // Fan-triangulate (the source is already triangles).
      for (let i = 1; i + 1 < corners.length; i++) list.push(corners[0], corners[i], corners[i + 1])
    }
  }
  return { positions, uvs, normals, objects }
}

/** Parts that model the lamps at both ends of the car in one piece. */
const LAMP_PARTS = ['Headlights', 'Lights', 'Lights_Glass']
/** Below this height (m), rear lamp geometry is the bumper reflectors. */
const REFLECTOR_MAX_Y = 0.6

/**
 * Tesla's mesh puts the front and rear lamps in the same parts, so the tail
 * lights would get headlight materials. Moves their rear triangles into
 * "<Part>_Rear" (and the low bumper reflectors into "Lights_Reflector") so
 * the app can give them tail-light materials.
 */
function splitLamps(data) {
  const P = data.positions
  const take = (name) => {
    if (!data.objects.has(name)) data.objects.set(name, new Map())
    return data.objects.get(name)
  }
  for (const name of LAMP_PARTS) {
    const mats = data.objects.get(name)
    if (!mats) continue
    for (const [material, corners] of mats) {
      const front = []
      for (let i = 0; i < corners.length; i += 3) {
        const tri = corners.slice(i, i + 3)
        const x = (P[tri[0][0]][0] + P[tri[1][0]][0] + P[tri[2][0]][0]) / 3
        const y = (P[tri[0][0]][1] + P[tri[1][0]][1] + P[tri[2][0]][1]) / 3
        if (x >= 0) {
          front.push(...tri)
          continue
        }
        const target = take(y < REFLECTOR_MAX_Y ? 'Lights_Reflector' : `${name}_Rear`)
        if (!target.has(material)) target.set(material, [])
        target.get(material).push(...tri)
      }
      if (front.length) mats.set(material, front)
      else mats.delete(material)
    }
  }
}

/** Faces meeting at more than this angle keep a hard edge (panel gaps, creases). */
const CREASE_COS = Math.cos((40 * Math.PI) / 180)

/**
 * Tesla's OBJ ships with scrambled normals on most body panels (they barely
 * correlate with the faces, while the winding is consistent), so lighting came
 * out inverted in places. Rebuild them from the geometry, smoothing across a
 * vertex except where faces meet at a crease. Runs per part, across all of its
 * materials, so material boundaries stay seamless.
 */
function rebuildNormals(data, mats) {
  const P = data.positions
  const key = (vi) => P[vi].map((x) => Math.round(x * 1e5)).join(',')
  const faceN = []
  const byVertex = new Map()
  const lists = [...mats.values()]
  for (const corners of lists) {
    for (let i = 0; i < corners.length; i += 3) {
      const [a, b, c] = [P[corners[i][0]], P[corners[i + 1][0]], P[corners[i + 2][0]]]
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const f = faceN.length
      faceN.push([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]])
      for (let k = 0; k < 3; k++) {
        const vk = key(corners[i + k][0])
        if (!byVertex.has(vk)) byVertex.set(vk, [])
        byVertex.get(vk).push(f)
      }
    }
  }
  const unit = (n) => {
    const l = Math.hypot(n[0], n[1], n[2])
    return l > 0 ? [n[0] / l, n[1] / l, n[2] / l] : null
  }
  const faceU = faceN.map(unit)
  const reuse = new Map()
  let f = 0
  const out = new Map()
  for (const [material, corners] of mats) {
    const next = []
    for (let i = 0; i < corners.length; i += 3, f++) {
      for (let k = 0; k < 3; k++) {
        const [vi, ti] = corners[i + k]
        const own = faceU[f]
        const sum = [0, 0, 0]
        for (const g of byVertex.get(key(vi))) {
          const n = faceU[g]
          // Area-weighted: faceN is the cross product, twice the triangle area.
          if (!own || (n && n[0] * own[0] + n[1] * own[1] + n[2] * own[2] >= CREASE_COS)) {
            sum[0] += faceN[g][0]
            sum[1] += faceN[g][1]
            sum[2] += faceN[g][2]
          }
        }
        const n = unit(sum) ?? own ?? [0, 1, 0]
        const nk = `${vi}|${n.map((x) => Math.round(x * 1e4)).join(',')}`
        let ni = reuse.get(nk)
        if (ni === undefined) {
          ni = data.normals.length
          data.normals.push(n)
          reuse.set(nk, ni)
        }
        next.push([vi, ti, ni])
      }
    }
    out.set(material, next)
  }
  return out
}

/** Expands face corners into indexed vertex arrays for one primitive. */
function expand(data, corners) {
  const index = new Map()
  const pos = []
  const nrm = []
  const tex = []
  const indices = []
  for (const [vi, ti, ni] of corners) {
    const key = `${vi}/${ti}/${ni}`
    let id = index.get(key)
    if (id === undefined) {
      id = pos.length / 3
      index.set(key, id)
      pos.push(...data.positions[vi])
      nrm.push(...(ni >= 0 ? data.normals[ni] : [0, 1, 0]))
      const uv = ti >= 0 ? data.uvs[ti] : [0, 0]
      tex.push(uv[0], 1 - uv[1])
    }
    indices.push(id)
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), tex: new Float32Array(tex), indices }
}

/** Must match the generated wheels in src/renderer/src/car3d/CarModel.tsx. */
const WHEELS = { front: 1.5, rear: -1.375, trackHalf: 0.79, radius: 0.336, width: 0.235 }
const AO_RAYS = 32
const AO_DISTANCE = 0.9

/**
 * Bakes ambient occlusion into each vertex: the share of a cosine-weighted
 * hemisphere of rays that hit the car, its wheels or the floor within
 * AO_DISTANCE (closer hits count more). This darkens panel gaps, wheel arches,
 * the cabin and the lower body the way Tesla's own render does.
 */
function bakeAmbientOcclusion(prims) {
  const tris = []
  for (const p of prims) for (const i of p.indices) tris.push(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2])
  for (const x of [WHEELS.front, WHEELS.rear]) {
    for (const z of [WHEELS.trackHalf, -WHEELS.trackHalf]) {
      const wheel = new THREE.CylinderGeometry(WHEELS.radius, WHEELS.radius, WHEELS.width, 32).rotateX(Math.PI / 2).translate(x, WHEELS.radius, z).toNonIndexed()
      tris.push(...wheel.getAttribute('position').array)
    }
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tris, 3))
  const bvh = new MeshBVH(geometry)

  // Hammersley points mapped to a cosine-weighted hemisphere around +Z.
  const samples = []
  for (let i = 0; i < AO_RAYS; i++) {
    let bits = i
    bits = ((bits << 16) | (bits >>> 16)) >>> 0
    bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0
    bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0
    bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0
    bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0
    const u = (i + 0.5) / AO_RAYS
    const v = bits / 4294967296
    const r = Math.sqrt(u)
    samples.push([r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v), Math.sqrt(1 - u)])
  }

  const ray = new THREE.Ray()
  const n = new THREE.Vector3()
  const t1 = new THREE.Vector3()
  const t2 = new THREE.Vector3()
  const helper = new THREE.Vector3()
  let done = 0
  const total = prims.reduce((sum, p) => sum + p.pos.length / 3, 0)
  for (const p of prims) {
    const count = p.pos.length / 3
    p.ao = new Float32Array(count)
    for (let v = 0; v < count; v++) {
      n.fromArray(p.nrm, v * 3).normalize()
      helper.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0)
      t1.crossVectors(helper, n).normalize()
      t2.crossVectors(n, t1)
      // A per-vertex twist of the sample pattern trades banding for fine noise.
      const twist = ((v * 2654435761) % 4096) / 4096 * Math.PI * 2
      const c = Math.cos(twist)
      const sn = Math.sin(twist)
      let occlusion = 0
      for (const [sx, sy, sz] of samples) {
        const x = sx * c - sy * sn
        const y = sx * sn + sy * c
        ray.direction.set(t1.x * x + t2.x * y + n.x * sz, t1.y * x + t2.y * y + n.y * sz, t1.z * x + t2.z * y + n.z * sz)
        ray.origin.fromArray(p.pos, v * 3).addScaledVector(n, 0.002)
        let t = Infinity
        if (ray.direction.y < -1e-4) t = ray.origin.y / -ray.direction.y
        const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, Math.min(t, AO_DISTANCE))
        if (hit) t = hit.distance
        if (t < AO_DISTANCE) occlusion += 1 - (t / AO_DISTANCE) ** 2
      }
      p.ao[v] = 1 - occlusion / AO_RAYS
    }
    done += count
    process.stdout.write(`\r  ambient occlusion ${Math.round((done / total) * 100)}%`)
  }
  process.stdout.write('\n')
}

function createPrimitive(doc, buffer, p) {
  const accessor = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer)
  const count = p.pos.length / 3
  return doc
    .createPrimitive()
    .setAttribute('POSITION', accessor(p.pos, 'VEC3'))
    .setAttribute('NORMAL', accessor(p.nrm, 'VEC3'))
    .setAttribute('TEXCOORD_0', accessor(p.tex, 'VEC2'))
    .setAttribute('_AO', accessor(p.ao, 'SCALAR'))
    .setIndices(accessor(count > 65535 ? new Uint32Array(p.indices) : new Uint16Array(p.indices), 'SCALAR'))
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Tesla Model 3 Highland mesh not found at:\n  ${SOURCE}\n`)
    console.error('Copy model3-2024-base/vehicle.obj from Tesla\'s custom-wraps repo (with the 3D files) to that path.')
    process.exit(1)
  }
  console.log(`Reading ${SOURCE} (${(statSync(SOURCE).size / 1e6).toFixed(1)} MB)…`)
  const data = await parseObj(SOURCE)
  splitLamps(data)

  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene('Model3Highland')
  const root = doc.createNode('Model3Highland')
  scene.addChild(root)

  const parts = []
  let triangles = 0
  for (const [name, source] of data.objects) {
    const prims = [...rebuildNormals(data, source).values()].map((corners) => expand(data, corners))
    for (const p of prims) triangles += p.indices.length / 3
    parts.push({ name, prims })
  }
  console.log(`${data.objects.size} parts, ${triangles} triangles`)
  bakeAmbientOcclusion(parts.flatMap((part) => part.prims))

  for (const { name, prims } of parts) {
    const mesh = doc.createMesh(name)
    prims.forEach((p, k) => {
      const material = doc.createMaterial(`${name}:${k}`).setBaseColorFactor([0.8, 0.8, 0.8, 1])
      mesh.addPrimitive(createPrimitive(doc, buffer, p).setMaterial(material))
    })
    root.addChild(doc.createNode(name).setMesh(mesh))
  }

  await MeshoptEncoder.ready
  // Materials are only placeholders carrying part names, so they must not be merged.
  await doc.transform(
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }),
    weld(),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' })
  )

  mkdirSync(dirname(OUT), { recursive: true })
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  await io.write(OUT, doc)
  console.log(`Wrote ${OUT} (${(statSync(OUT).size / 1e6).toFixed(2)} MB)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
