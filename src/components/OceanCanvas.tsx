import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OceanFluidEngine } from '../engine/OceanFluidEngine';

export function OceanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const engineRef = useRef<OceanFluidEngine | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('Initializing Ocean Simulation...');
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    sceneRef.current = scene;
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 1;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    
    // Initialize ocean engine
    const engine = new OceanFluidEngine(renderer, 512, 512);
    engineRef.current = engine;
    
    // Create display plane
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ 
      map: engine.getTexture(),
      transparent: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;
    
    console.log('Ocean simulation initialized');
    
    // Mouse tracking
    let mouseX = 0.5;
    let mouseY = 0.5;
    let isMouseDown = false;
    
    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX / window.innerWidth;
      mouseY = 1.0 - event.clientY / window.innerHeight;
      
      if (isMouseDown) {
        // Create waves with mouse movement
        engine.addWave(mouseX, mouseY, 0.05);
      }
    };
    
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        isMouseDown = true;
        // Create a stronger wave on click
        engine.addWave(mouseX, mouseY, 0.15);
      }
    };
    
    const handleMouseUp = () => {
      isMouseDown = false;
    };
    
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        console.log('Resetting ocean simulation');
        engine.reset();
      } else if (event.key === ' ') {
        // Space bar creates random waves
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            engine.addWave(
              Math.random(),
              Math.random(),
              0.05 + Math.random() * 0.1
            );
          }, i * 100);
        }
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keypress', handleKeyPress);
    
    // Touch support
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        const x = touch.clientX / window.innerWidth;
        const y = 1.0 - touch.clientY / window.innerHeight;
        engine.addWave(x, y, 0.08);
      }
    };
    
    window.addEventListener('touchmove', handleTouchMove);
    
    // Animation loop
    let lastTime = performance.now();
    let frameCount = 0;
    
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Calculate FPS
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime > 1000) {
        setFps(Math.round(frameCount * 1000 / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      // Update simulation
      engine.update(0.016);
      
      // Update texture
      if (meshRef.current) {
        const mat = meshRef.current.material as THREE.MeshBasicMaterial;
        mat.map = engine.getTexture();
        mat.needsUpdate = true;
      }
      
      renderer.render(scene, camera);
    };
    animate();
    
    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    
    // Add some initial waves for ambiance
    const createAmbientWaves = () => {
      engine.addWave(
        0.2 + Math.random() * 0.6,
        0.2 + Math.random() * 0.6,
        0.03 + Math.random() * 0.05
      );
    };
    
    // Create ambient waves periodically
    const ambientInterval = setInterval(createAmbientWaves, 2000);
    createAmbientWaves(); // Initial wave
    
    return () => {
      clearInterval(ambientInterval);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('touchmove', handleTouchMove);
      engine.dispose();
      renderer.dispose();
    };
  }, []);
  
  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div className="performance">
        FPS: {fps}
      </div>
      <div className="info" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
        <strong>Ocean Simulation</strong><br />
        Click to create waves<br />
        Space for random waves • R to reset
      </div>
    </>
  );
}