/**
 * R3F primitives missing from core Three.js.
 * Import once from main.tsx so <ellipseGeometry /> works project-wide.
 */
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

class EllipseGeometry extends THREE.BufferGeometry {
  constructor(radiusX = 1, radiusY = 1, segments = 8) {
    super()
    const shape = new THREE.Shape()
    shape.absellipse(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, 0)
    const geom = new THREE.ShapeGeometry(shape, segments)
    this.copy(geom)
    geom.dispose()
  }
}

extend({ EllipseGeometry })
