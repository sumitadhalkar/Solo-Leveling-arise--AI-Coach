import { useFrame, useThree } from '@react-three/fiber'

export default function CameraRig() {
  const { camera } = useThree()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    camera.position.x += (state.mouse.x * 0.7 - camera.position.x) * 0.04
    camera.position.y += (state.mouse.y * 0.4 - camera.position.y) * 0.04
    camera.position.z = 8 + Math.sin(t * 0.3) * 0.3
    camera.lookAt(0, 0, 0)
  })
  return null
}
