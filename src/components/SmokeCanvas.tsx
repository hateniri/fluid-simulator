import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { SmokeFluidEngine } from '../engine/SmokeFluidEngine';

export function SmokeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const engineRef = useRef<SmokeFluidEngine | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('Initializing Smoke Simulation...');
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a); // Dark background for smoke
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
    
    // Initialize smoke engine
    const engine = new SmokeFluidEngine(renderer, 512, 512);
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
    
    console.log('Smoke simulation initialized');
    
    // Mouse tracking
    let mouseX = 0.5;
    let mouseY = 0.5;
    let isMouseDown = false;
    const customColors = [
      new THREE.Vector3(1, 0.5, 0),    // Orange
      new THREE.Vector3(1, 0, 1),      // Magenta
      new THREE.Vector3(0, 1, 1),      // Cyan
      new THREE.Vector3(1, 1, 0),      // Yellow
      new THREE.Vector3(0.5, 0, 1),    // Purple
    ];
    let colorIndex = 0;
    
    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX / window.innerWidth;
      mouseY = 1.0 - event.clientY / window.innerHeight;
      
      if (isMouseDown) {
        // Add custom colored smoke at mouse position
        engine.addCustomSmoke(mouseX, mouseY, customColors[colorIndex]);
      }
    };
    
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        isMouseDown = true;
        colorIndex = (colorIndex + 1) % customColors.length;
        engine.addCustomSmoke(mouseX, mouseY, customColors[colorIndex]);
      }
    };
    
    const handleMouseUp = () => {
      isMouseDown = false;
    };
    
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        console.log('Resetting smoke simulation');
        engine.reset();
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
        engine.addCustomSmoke(x, y, customColors[colorIndex]);
        colorIndex = (colorIndex + 1) % customColors.length;
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
    
    return () => {
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
      <div className="info">
        <strong>Smoke Simulation</strong><br />
        Three colored smoke streams mixing<br />
        Click to add colorful smoke • R to reset
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: '80px',
        left: '20px',
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: '10px 15px',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#ff3333',
            borderRadius: '50%',
            boxShadow: '0 0 10px rgba(255, 51, 51, 0.5)'
          }} />
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#33ff33',
            borderRadius: '50%',
            boxShadow: '0 0 10px rgba(51, 255, 51, 0.5)'
          }} />
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#3333ff',
            borderRadius: '50%',
            boxShadow: '0 0 10px rgba(51, 51, 255, 0.5)'
          }} />
          <span style={{ color: 'white', fontSize: '14px', marginLeft: '10px' }}>
            Primary smoke streams
          </span>
        </div>
      </div>
    </>
  );
}