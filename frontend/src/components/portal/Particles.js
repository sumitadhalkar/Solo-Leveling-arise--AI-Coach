import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 160

export default function Particles({ isActive }) {
  const pointsRef = useRef()

  const geo = useMemo(() => {
    const pos = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = 3.5 + Math.random() * 4.5
      pos[i * 3]     = Math.cos(angle) * r
      pos[i * 3 + 1] = (Math.random() - 0.5) * 7
      pos[i * 3 + 2] = Math.sin(angle) * r * 0.35 - 0.5
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const attr = geo.attributes.position
    const arr = attr.array
    const speed = isActive ? 3.5 : 0.9

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3, iy = ix + 1, iz = ix + 2
      const x = arr[ix], y = arr[iy], z = arr[iz]
      const dist = Math.sqrt(x * x + y * y)

      if (dist < 0.7) {
        const angle = Math.random() * Math.PI * 2
        const r = 3.5 + Math.random() * 4.5
        arr[ix] = Math.cos(angle) * r
        arr[iy] = (Math.random() - 0.5) * 7
        arr[iz] = Math.sin(angle) * r * 0.35 - 0.5
      } else {
        arr[ix] -= (x / dist) * delta * speed * 0.1
        arr[iy] -= y * delta * 0.06
        arr[iz] -= (z / (Math.abs(z) + 0.1)) * delta * speed * 0.04
      }
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        color="#a855f7"
        size={0.055}
        transparent
        opacity={0.72}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
