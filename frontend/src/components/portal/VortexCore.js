import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function VortexCore({ isActive }) {
  const coreRef = useRef()
  const rimRef = useRef()
  const discRef = useRef()

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const speed = isActive ? 2.5 : 0.6

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * speed
      coreRef.current.rotation.x += delta * 0.4
      coreRef.current.scale.setScalar(1 + Math.sin(t * (isActive ? 3 : 1.5)) * 0.04)
    }
    if (rimRef.current) {
      rimRef.current.rotation.y -= delta * speed * 0.7
      rimRef.current.scale.setScalar(1 + Math.sin(t * 1.2 + 1) * 0.07)
    }
    if (discRef.current) {
      discRef.current.rotation.z += delta * speed * 0.3
      discRef.current.material.emissiveIntensity =
        (isActive ? 1.5 : 0.4) + Math.sin(t * 2) * 0.2
    }
  })

  return (
    <group>
      {/* Portal mouth disc */}
      <mesh ref={discRef} rotation={[Math.PI * 0.02, 0, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 0.015, 64]} />
        <meshStandardMaterial color="#06000f" emissive="#2d0060" emissiveIntensity={0.6} transparent opacity={0.92} />
      </mesh>

      {/* Void core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshStandardMaterial color="#08001a" emissive="#3b0072" emissiveIntensity={isActive ? 1.8 : 0.5} roughness={0.05} metalness={1} />
      </mesh>

      {/* Rim glow — rendered from inside */}
      <mesh ref={rimRef}>
        <sphereGeometry args={[1.55, 16, 16]} />
        <meshStandardMaterial
          color="#1a0040"
          emissive="#4c1d95"
          emissiveIntensity={isActive ? 1.2 : 0.35}
          transparent
          opacity={0.28}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  )
}
