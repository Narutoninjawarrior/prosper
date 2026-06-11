/**
 * WelcomeCameraFocus — cinematic fly-to on first arrival from /welcome.
 */
import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { flowerOfLifeNodes } from './resonance'

export default function WelcomeCameraFocus({ plotId, nodeRadius = 3.5, duration = 2.8 }) {
  const { camera, controls } = useThree()
  const anim = useRef(null)

  useEffect(() => {
    if (plotId == null || !controls) return

    const nodes = flowerOfLifeNodes(nodeRadius)
    const node = nodes.find((n) => n.id === plotId)
    if (!node) return

    const startPos = camera.position.clone()
    const startTarget = controls.target.clone()
    const endTarget = new THREE.Vector3(node.x, 0.15, node.z)
    const endPos = new THREE.Vector3(node.x + 2.8, 7.5, node.z + 5.5)

    anim.current = {
      t: 0,
      startPos,
      startTarget,
      endPos,
      endTarget,
    }
  }, [plotId, nodeRadius, camera, controls])

  useFrame((_, delta) => {
    if (!anim.current || !controls) return
    const a = anim.current
    a.t = Math.min(a.t + delta / duration, 1)
    const ease = 1 - Math.pow(1 - a.t, 3)

    camera.position.lerpVectors(a.startPos, a.endPos, ease)
    controls.target.lerpVectors(a.startTarget, a.endTarget, ease)
    controls.update()

    if (a.t >= 1) anim.current = null
  })

  return null
}
