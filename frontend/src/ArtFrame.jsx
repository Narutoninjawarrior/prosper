/**
 * ArtFrame.jsx — Hearthlands Generative Art Frame
 * Lives in: src/world/ArtFrame.jsx
 *
 * A 3D picture frame that renders deterministic generative art
 * seeded by a Forge chain_hash. Same hash → same art, always.
 * Designed to accept WASM module output as the seed source.
 *
 * Props:
 *   position   [x, y, z]   — world position (default: wall mount)
 *   hash       string      — Forge chain_hash (64 char hex)
 *   title      string      — artwork title
 *   artist     string      — agent or human who minted
 *   emberCost  number      — $EMBER spent to place
 *   onMint     function    — called when user clicks Mint
 *   minted     boolean     — true if NFT already claimed
 */

import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox, Text } from '@react-three/drei'
import * as THREE from 'three'

// ── Hearthlands palette ──────────────────────────────────────────
const PALETTE = {
  terracotta: '#C27C5A',
  sand:       '#F5E6C8',
  sage:       '#7A9E7E',
  cream:      '#FAF6EF',
  ember:      '#E8842A',
  charcoal:   '#2C2018',
  gold:       '#D4A853',
}

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// ── Generative art renderer ──────────────────────────────────────
function renderGenerativeArt(canvas, hash) {
  const ctx  = canvas.getContext('2d')
  const W    = canvas.width
  const H    = canvas.height

  // Derive numeric seed from first 8 hex chars of hash
  const seed = parseInt(hash.slice(0, 8), 16) || 0xDEADBEEF
  const rand = mulberry32(seed)

  // Derive palette indices from hash segments
  const paletteKeys = Object.keys(PALETTE)
  const bg   = PALETTE[paletteKeys[Math.floor(parseInt(hash.slice(8,  10), 16) / 255 * paletteKeys.length)]]
  const col1 = PALETTE[paletteKeys[Math.floor(parseInt(hash.slice(10, 12), 16) / 255 * paletteKeys.length)]]
  const col2 = PALETTE[paletteKeys[Math.floor(parseInt(hash.slice(12, 14), 16) / 255 * paletteKeys.length)]]
  const col3 = PALETTE[paletteKeys[Math.floor(parseInt(hash.slice(14, 16), 16) / 255 * paletteKeys.length)]]

  // Background
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Algorithm selector (first nibble of hash)
  const algo = parseInt(hash[0], 16) % 4

  if (algo === 0) {
    // ── Concentric polygons ──
    const sides = 3 + Math.floor(rand() * 5)
    const layers = 8 + Math.floor(rand() * 8)
    for (let i = layers; i > 0; i--) {
      const r    = (i / layers) * (W * 0.46)
      const rot  = (rand() * Math.PI * 2) + i * 0.15
      const cols = [col1, col2, col3]
      ctx.beginPath()
      ctx.strokeStyle = cols[i % 3]
      ctx.lineWidth = 1 + rand() * 2
      ctx.globalAlpha = 0.4 + rand() * 0.6
      for (let s = 0; s <= sides; s++) {
        const angle = (s / sides) * Math.PI * 2 + rot
        const x = W / 2 + Math.cos(angle) * r
        const y = H / 2 + Math.sin(angle) * r
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }
  } else if (algo === 1) {
    // ── Flow fields ──
    const lines = 40 + Math.floor(rand() * 40)
    ctx.globalAlpha = 0.55
    for (let i = 0; i < lines; i++) {
      const cols = [col1, col2, col3]
      ctx.strokeStyle = cols[i % 3]
      ctx.lineWidth = 0.8 + rand() * 2
      ctx.beginPath()
      let x = rand() * W
      let y = rand() * H
      ctx.moveTo(x, y)
      const steps = 20 + Math.floor(rand() * 30)
      for (let s = 0; s < steps; s++) {
        const angle = (Math.sin(x * 0.02 + seed * 0.001) + Math.cos(y * 0.02)) * Math.PI * 2
        x += Math.cos(angle) * 8
        y += Math.sin(angle) * 8
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else if (algo === 2) {
    // ── Geometric tiles ──
    const cols = [col1, col2, col3, bg]
    const tileSize = 20 + Math.floor(rand() * 40)
    ctx.globalAlpha = 0.85
    for (let x = 0; x < W; x += tileSize) {
      for (let y = 0; y < H; y += tileSize) {
        const t = Math.floor(rand() * 3)
        ctx.fillStyle = cols[Math.floor(rand() * cols.length)]
        if (t === 0) {
          ctx.fillRect(x, y, tileSize, tileSize)
        } else if (t === 1) {
          ctx.beginPath()
          ctx.arc(x + tileSize / 2, y + tileSize / 2, tileSize / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.moveTo(x + tileSize / 2, y)
          ctx.lineTo(x + tileSize, y + tileSize)
          ctx.lineTo(x, y + tileSize)
          ctx.closePath()
          ctx.fill()
        }
      }
    }
  } else {
    // ── Radial burst ──
    const spokes = 6 + Math.floor(rand() * 10)
    const cols = [col1, col2, col3]
    ctx.globalAlpha = 0.7
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * Math.PI * 2 + rand() * 0.3
      const len   = W * 0.3 + rand() * W * 0.2
      ctx.beginPath()
      ctx.strokeStyle = cols[i % 3]
      ctx.lineWidth = 2 + rand() * 6
      ctx.moveTo(W / 2, H / 2)
      ctx.lineTo(W / 2 + Math.cos(angle) * len, H / 2 + Math.sin(angle) * len)
      ctx.stroke()
    }
    // Center circle
    ctx.globalAlpha = 0.9
    ctx.fillStyle = PALETTE.ember
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 20 + rand() * 20, 0, Math.PI * 2)
    ctx.fill()
  }

  // Hash watermark (tiny, bottom right)
  ctx.globalAlpha = 0.3
  ctx.fillStyle = PALETTE.charcoal
  ctx.font = '10px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(hash.slice(0, 12) + '...', W - 6, H - 6)
  ctx.globalAlpha = 1
}

// ── Frame geometry (four box beams forming a border) ─────────────
function FrameBeams({ W = 2.4, H = 3.2, depth = 0.08, thickness = 0.14 }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: PALETTE.terracotta,
    roughness: 0.8,
    metalness: 0.05,
  }), [])

  return (
    <group>
      {/* Top */}
      <mesh position={[0, H / 2, 0]} material={mat}>
        <boxGeometry args={[W + thickness * 2, thickness, depth]} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -H / 2, 0]} material={mat}>
        <boxGeometry args={[W + thickness * 2, thickness, depth]} />
      </mesh>
      {/* Left */}
      <mesh position={[-W / 2, 0, 0]} material={mat}>
        <boxGeometry args={[thickness, H, depth]} />
      </mesh>
      {/* Right */}
      <mesh position={[W / 2, 0, 0]} material={mat}>
        <boxGeometry args={[thickness, H, depth]} />
      </mesh>
    </group>
  )
}

// ── Canvas texture panel ─────────────────────────────────────────
function ArtCanvas({ hash, W = 2.4, H = 3.2 }) {
  const meshRef   = useRef()
  const resolution = 512

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width  = resolution
    canvas.height = resolution
    renderGenerativeArt(canvas, hash || '0'.repeat(64))
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }, [hash])

  return (
    <mesh ref={meshRef} position={[0, 0, -0.01]}>
      <planeGeometry args={[W, H]} />
      <meshStandardMaterial map={texture} roughness={0.4} />
    </mesh>
  )
}

// ── Plaque (title + hash snippet) ───────────────────────────────
function Plaque({ title, artist, hash, minted }) {
  return (
    <group position={[0, -1.85, 0.01]}>
      <RoundedBox args={[2.0, 0.45, 0.04]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={PALETTE.sand} roughness={0.9} />
      </RoundedBox>
      <Text
        position={[0, 0.09, 0.03]}
        fontSize={0.12}
        color={PALETTE.charcoal}
        anchorX="center"
        anchorY="middle"
        font={undefined}
        maxWidth={1.8}
      >
        {title || 'Untitled'}
      </Text>
      <Text
        position={[0, -0.05, 0.03]}
        fontSize={0.08}
        color={PALETTE.terracotta}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.8}
      >
        {artist ? `by ${artist}` : ''}
        {minted ? '  ✦ minted' : ''}
      </Text>
      <Text
        position={[0, -0.16, 0.03]}
        fontSize={0.055}
        color={PALETTE.charcoal}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.8}
      >
        {hash ? hash.slice(0, 20) + '...' : ''}
      </Text>
    </group>
  )
}

// ── Mint overlay (HTML panel) ────────────────────────────────────
function MintOverlay({ hash, emberCost, minted, onMint }) {
  const [hover, setHover] = useState(false)

  if (minted) return (
    <Html position={[0, 2.0, 0.1]} center>
      <div style={{
        background: PALETTE.sage,
        color: '#fff',
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 11,
        fontFamily: 'monospace',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>✦ NFT minted on Solana</div>
    </Html>
  )

  return (
    <Html position={[0, 2.0, 0.1]} center>
      <button
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onClick={onMint}
        style={{
          background: hover ? PALETTE.ember : PALETTE.terracotta,
          color: PALETTE.cream,
          border: 'none',
          borderRadius: 20,
          padding: '5px 16px',
          fontSize: 11,
          fontFamily: 'monospace',
          cursor: 'pointer',
          transition: 'background 0.2s',
          whiteSpace: 'nowrap',
          boxShadow: hover ? `0 0 8px ${PALETTE.ember}88` : 'none',
        }}
      >
        ⬡ Mint NFT · {emberCost || 0} $EMBER
      </button>
    </Html>
  )
}

// ── Main ArtFrame component ──────────────────────────────────────
export default function ArtFrame({
  position  = [0, 1.6, -4],
  hash      = '0'.repeat(64),
  title     = 'Genesis Frame',
  artist    = 'Forge',
  emberCost = 50,
  onMint    = () => {},
  minted    = false,
}) {
  const groupRef  = useRef()
  const [hovered, setHovered] = useState(false)

  // Subtle idle float
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    groupRef.current.position.y =
      position[1] + Math.sin(clock.elapsedTime * 0.4) * 0.04
  })

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Backing panel (slight glow on hover) */}
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[2.9, 3.8]} />
        <meshStandardMaterial
          color={hovered ? '#3a2a1a' : '#1a0f08'}
          emissive={hovered ? PALETTE.ember : '#000'}
          emissiveIntensity={hovered ? 0.08 : 0}
          roughness={1}
        />
      </mesh>

      {/* Generative art canvas */}
      <ArtCanvas hash={hash} W={2.4} H={3.2} />

      {/* Wooden frame beams */}
      <FrameBeams W={2.4} H={3.2} />

      {/* Corner accents */}
      {[[-1.2, 1.6], [1.2, 1.6], [-1.2, -1.6], [1.2, -1.6]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.05]}>
          <boxGeometry args={[0.14, 0.14, 0.06]} />
          <meshStandardMaterial
            color={PALETTE.gold}
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>
      ))}

      {/* Title plaque */}
      <Plaque
        title={title}
        artist={artist}
        hash={hash}
        minted={minted}
      />

      {/* Mint button */}
      <MintOverlay
        hash={hash}
        emberCost={emberCost}
        minted={minted}
        onMint={onMint}
      />

      {/* Point light for warmth */}
      <pointLight
        position={[0, 0, 0.8]}
        intensity={hovered ? 0.6 : 0.25}
        color={PALETTE.ember}
        distance={4}
      />
    </group>
  )
}
