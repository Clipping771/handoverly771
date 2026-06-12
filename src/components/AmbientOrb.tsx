'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function LowPolyOrb() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Very slow rotation
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.05;
      meshRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Low-poly icosahedron for geometric feel */}
      <icosahedronGeometry args={[2, 1]} />
      <meshStandardMaterial
        color="#0F766E"
        transparent
        opacity={0.04}
        roughness={0.8}
        flatShading={true} // gives it the distinct low-poly look
      />
    </mesh>
  );
}

export default function AmbientOrb() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        {/* Soft directional light to catch the low-poly faces */}
        <directionalLight position={[2, 5, 2]} intensity={1.5} />
        <ambientLight intensity={0.5} />
        <LowPolyOrb />
      </Canvas>
    </div>
  );
}
