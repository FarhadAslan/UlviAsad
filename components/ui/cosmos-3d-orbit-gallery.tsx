"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"

interface ParticleSphereProps {
  images: string[]
}

export function ParticleSphere({ images }: ParticleSphereProps) {
  const PARTICLE_COUNT      = 1200
  const PARTICLE_SIZE_MIN   = 0.005
  const PARTICLE_SIZE_MAX   = 0.012
  const SPHERE_RADIUS       = 9
  const POSITION_RANDOMNESS = 3
  const ROTATION_SPEED_Y    = 0.0006
  const ROTATION_SPEED_X    = 0.0001
  const PARTICLE_OPACITY    = 0.9
  const IMAGE_COUNT         = images.length
  const IMAGE_SIZE          = 2.8

  const groupRef = useRef<THREE.Group>(null)
  const textures = useTexture(images)

  const particles = useMemo(() => {
    const pts = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi   = Math.acos(-1 + (2 * i) / PARTICLE_COUNT)
      const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi
      const r     = SPHERE_RADIUS + (Math.random() - 0.5) * POSITION_RANDOMNESS
      pts.push({
        position: [
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.cos(phi),
          r * Math.sin(theta) * Math.sin(phi),
        ],
        scale: Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN) + PARTICLE_SIZE_MIN,
        color: new THREE.Color().setHSL(
          0.55 + Math.random() * 0.15, // mavi-göy çalarlar
          0.7,
          0.55 + Math.random() * 0.3,
        ),
      })
    }
    return pts
  }, [])

  const orbitingImages = useMemo(() => {
    const imgs = []
    for (let i = 0; i < IMAGE_COUNT; i++) {
      // Fibonacci spiral ilə kürə səthi boyunca bərabər paylaşdır
      const phi   = Math.acos(1 - (2 * (i + 0.5)) / IMAGE_COUNT)
      const theta = Math.PI * (1 + Math.sqrt(5)) * i

      const x = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta)
      const y = SPHERE_RADIUS * Math.cos(phi)
      const z = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta)

      const position = new THREE.Vector3(x, y, z)
      const outward  = position.clone().normalize()
      const euler    = new THREE.Euler()
      const matrix   = new THREE.Matrix4()
      matrix.lookAt(position, position.clone().add(outward), new THREE.Vector3(0, 1, 0))
      euler.setFromRotationMatrix(matrix)

      imgs.push({
        position: [x, y, z] as [number, number, number],
        rotation: [euler.x, euler.y, euler.z] as [number, number, number],
        textureIndex: i % textures.length,
      })
    }
    return imgs
  }, [IMAGE_COUNT, textures.length])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += ROTATION_SPEED_Y
      groupRef.current.rotation.x += ROTATION_SPEED_X
    }
  })

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.position as [number, number, number]} scale={p.scale}>
          <sphereGeometry args={[1, 6, 5]} />
          <meshBasicMaterial color={p.color} transparent opacity={PARTICLE_OPACITY} />
        </mesh>
      ))}
      {orbitingImages.map((img, i) => (
        <mesh key={`img-${i}`} position={img.position} rotation={img.rotation}>
          <planeGeometry args={[IMAGE_SIZE, IMAGE_SIZE * 0.7]} />
          <meshBasicMaterial
            map={textures[img.textureIndex]}
            transparent
            opacity={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
