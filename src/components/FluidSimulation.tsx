import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFluidStore } from '../store/fluidStore';
import { FluidEngine } from '../engine/FluidEngine';

export function FluidSimulation() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { gl, size } = useThree();
  const engineRef = useRef<FluidEngine>();
  
  const mousePosition = useFluidStore((state) => state.mousePosition);
  const mouseVelocity = useFluidStore((state) => state.mouseVelocity);
  const isMouseDown = useFluidStore((state) => state.isMouseDown);
  const brushSize = useFluidStore((state) => state.brushSize);
  const config = useFluidStore((state) => state.config);
  const setCallbacks = useFluidStore((state) => state.setCallbacks);
  
  // Initialize fluid engine
  useEffect(() => {
    const engine = new FluidEngine(gl, 512, 512);
    engineRef.current = engine;
    
    // Set callbacks
    setCallbacks({
      onReset: () => engine.reset(),
      onRandomSplats: (count) => engine.addRandomSplats(count),
    });
    
    // Add initial splats
    engine.addRandomSplats(5);
    
    return () => {
      engine.dispose();
    };
  }, [gl, setCallbacks]);
  
  // Update configuration
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateConfig(config);
    }
  }, [config]);
  
  // Handle mouse events
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = event.clientX / window.innerWidth;
      const y = 1.0 - event.clientY / window.innerHeight;
      useFluidStore.getState().updateMousePosition(x, y);
    };
    
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        useFluidStore.getState().setMouseDown(true);
      }
    };
    
    const handleMouseUp = () => {
      useFluidStore.getState().setMouseDown(false);
    };
    
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? 0.95 : 1.05;
      const currentSize = useFluidStore.getState().brushSize;
      useFluidStore.getState().setBrushSize(currentSize * delta);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);
  
  // Update simulation
  useFrame((state, delta) => {
    if (!engineRef.current) return;
    
    // Add splat on mouse interaction
    if (isMouseDown && mouseVelocity.length() > 0.001) {
      const color = new THREE.Color();
      color.setHSL(state.clock.elapsedTime * 0.1 % 1, 1, 0.5);
      
      engineRef.current.addSplat(
        mousePosition.x,
        mousePosition.y,
        mouseVelocity.x * 50,
        mouseVelocity.y * 50,
        color,
        brushSize
      );
    }
    
    // Update simulation
    engineRef.current.update(Math.min(delta, 0.016));
    
    // Update mesh texture
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshBasicMaterial;
      material.map = engineRef.current.getDisplayTexture();
      material.needsUpdate = true;
    }
  });
  
  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial />
    </mesh>
  );
}