import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import CameraRig from './CameraRig'
import PortalRing from './PortalRing'
import VortexCore from './VortexCore'
import Particles from './Particles'
import Runes from './Runes'

function Scene({ isActive }) {
  return (
    <>
      <fog attach="fog" args={['#06060f', 14, 22]} />
      <CameraRig />

      <ambientLight intensity={0.03} />
      <pointLight position={[0, 0, 3]}  intensity={isActive ? 18 : 6}  color="#7c3aed" />
      <pointLight position={[0, 0, -4]} intensity={5}                  color="#1d4ed8" />
      <pointLight position={[1, 2, 2]}  intensity={3}                  color="#0ea5e9" />

      <Particles isActive={isActive} />
      <Runes     isActive={isActive} />
      <PortalRing isActive={isActive} />
      <VortexCore isActive={isActive} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.05}
          luminanceSmoothing={0.9}
          intensity={isActive ? 3.8 : 1.8}
          kernelSize={4}
          height={480}
        />
      </EffectComposer>
    </>
  )
}

export default function PortalScene({ isActive }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Scene isActive={isActive} />
        </Suspense>
      </Canvas>
    </div>
  )
}
