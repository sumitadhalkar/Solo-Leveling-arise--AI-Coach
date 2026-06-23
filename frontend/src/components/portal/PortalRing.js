import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function PortalRing({ isActive }) {
  const outerRef = useRef()
  const innerRef = useRef()
  const energyRef = useRef()
  const orbGroupRef = useRef()

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const speed = isActive ? 2.2 : 0.5

    if (outerRef.current) {
      outerRef.current.rotation.z += delta * speed * 0.4
      outerRef.current.rotation.x = Math.sin(t * 0.25) * 0.1
    }
    if (innerRef.current) {
      innerRef.current.rotation.z -= delta * speed * 0.65
      innerRef.current.rotation.y = Math.sin(t * 0.18) * 0.12
    }
    if (energyRef.current) {
      energyRef.current.rotation.z += delta * speed * 0.9
    }
    if (orbGroupRef.current) {
      orbGroupRef.current.rotation.z -= delta * speed * 0.25
    }
  })

  const ei = isActive ? 3.5 : 1.2

  return (
    <group>
      {/* Outer purple ring */}
      <mesh ref={outerRef}>
        <torusGeometry args={[2.8, 0.09, 16, 90]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={ei} roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Inner cyan ring — counter-rotates */}
      <mesh ref={innerRef}>
        <torusGeometry args={[2.15, 0.065, 16, 80]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={ei * 0.85} roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Thin blue energy ring */}
      <mesh ref={energyRef}>
        <torusGeometry args={[2.48, 0.032, 8, 64]} />
        <meshStandardMaterial color="#2563eb" emissive="#2563eb" emissiveIntensity={ei * 1.1} />
      </mesh>

      {/* Orbiting energy orbs */}
      <group ref={orbGroupRef}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 2.8, Math.sin(a) * 2.8, 0]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial color="#a855f7" emissive="#a855f7" emissiveIntensity={isActive ? 5 : 2} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
