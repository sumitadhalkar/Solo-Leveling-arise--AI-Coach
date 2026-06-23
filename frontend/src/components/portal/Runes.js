import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const OUTER_COUNT = 10
const INNER_COUNT = 6
const OUTER_R = 3.5
const INNER_R = 3.2

export default function Runes({ isActive }) {
  const outerRef = useRef()
  const innerRef = useRef()

  useFrame((_, delta) => {
    const speed = isActive ? 0.5 : 0.14
    if (outerRef.current) outerRef.current.rotation.z += delta * speed
    if (innerRef.current) innerRef.current.rotation.z -= delta * speed * 0.6
  })

  const ei = isActive ? 4.5 : 1.8

  return (
    <>
      {/* Outer rune markers — octahedra, purple */}
      <group ref={outerRef} rotation={[0.2, 0, 0]}>
        {Array.from({ length: OUTER_COUNT }, (_, i) => {
          const a = (i / OUTER_COUNT) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * OUTER_R, Math.sin(a) * OUTER_R, 0]}>
              <octahedronGeometry args={[0.07, 0]} />
              <meshStandardMaterial color="#c084fc" emissive="#c084fc" emissiveIntensity={ei} />
            </mesh>
          )
        })}
      </group>

      {/* Inner sigil markers — tetrahedra, cyan */}
      <group ref={innerRef} rotation={[-0.15, 0, 0]}>
        {Array.from({ length: INNER_COUNT }, (_, i) => {
          const a = (i / INNER_COUNT) * Math.PI * 2 + 0.3
          return (
            <mesh key={i} position={[Math.cos(a) * INNER_R, Math.sin(a) * INNER_R, 0.3]}>
              <tetrahedronGeometry args={[0.055, 0]} />
              <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={ei * 0.8} />
            </mesh>
          )
        })}
      </group>
    </>
  )
}
