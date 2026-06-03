/**
 * Procedural FBM height field for ground displacementMap.
 * CPU-generated so meshStandardMaterial keeps correct normals + shadows.
 */
import * as THREE from 'three'

function hash2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453
  return n - Math.floor(n)
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = smoothstep(fx)
  const uy = smoothstep(fy)

  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)

  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy
}

function fbm(x, y, seed, octaves = 5, persistence = 0.5, lacunarity = 2) {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17.3)
    norm += amp
    amp *= persistence
    freq *= lacunarity
  }
  return sum / norm
}

/**
 * @param {object} opts
 * @returns {THREE.DataTexture}
 */
export function createFBMDisplacementTexture({
  size = 256,
  octaves = 5,
  persistence = 0.5,
  lacunarity = 2,
  seed = 42,
} = {}) {
  const data = new Uint8Array(size * size)
  const cx = size * 0.5
  const cy = size * 0.5
  const bowl = 0.35

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const nx = u * 4 - 2
      const ny = v * 4 - 2
      let h = fbm(nx, ny, seed, octaves, persistence, lacunarity)

      const dx = (x - cx) / cx
      const dy = (y - cy) / cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      h -= dist * dist * bowl * 0.12

      const i = y * size + x
      data[i] = Math.floor(Math.max(0, Math.min(1, h)) * 255)
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  texture.needsUpdate = true
  return texture
}
