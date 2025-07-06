import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFluidStore } from '../store/fluidStore';

// Simple test version first
export function FluidSimulation() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { gl, size } = useThree();
  
  // Create a simple gradient texture for testing
  useEffect(() => {
    console.log('FluidSimulation mounted');
    console.log('WebGL context:', gl);
    console.log('Canvas size:', size);
  }, [gl, size]);
  
  // Create test texture
  const texture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(1, '#0000ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
  
  // Animate rotation for visibility
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.z += delta * 0.5;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}