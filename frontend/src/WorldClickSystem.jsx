/**
 * Reliable click-to-move: raycast the scene, ignore portals/forge,
 * fall back to y=0 plane. Avoids invisible-mesh and portal-disc hijacks.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export default function WorldClickSystem({ onMove, orbitActiveRef }) {
  const { camera, gl, scene } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointer = useMemo(() => new THREE.Vector2(), [])
  const planeHit = useMemo(() => new THREE.Vector3(), [])
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    const el = gl.domElement

    const handlePointerDown = (event) => {
      if (event.button !== 0) return
      if (orbitActiveRef?.current) return

      const rect = el.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)

      const hits = raycaster.intersectObjects(scene.children, true)
      for (const hit of hits) {
        let o = hit.object
        while (o) {
          if (o.userData?.blocksMove) return
          o = o.parent
        }
      }

      // Always walk on flat y=0 — reflector floor at y=-0.5 skews hit points
      if (!raycaster.ray.intersectPlane(GROUND_PLANE, planeHit)) return

      const destination = planeHit.clone()
      destination.y = 0
      onMoveRef.current(destination)
    }

    el.addEventListener('pointerdown', handlePointerDown)
    return () => el.removeEventListener('pointerdown', handlePointerDown)
  }, [camera, gl, scene, raycaster, pointer, planeHit, orbitActiveRef])

  return null
}
