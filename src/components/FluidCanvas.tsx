import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { SimpleFluidEngine } from '../engine/SimpleFluidEngine';

export function FluidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const engineRef = useRef<SimpleFluidEngine | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('Initializing Fluid Simulation...');
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
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
    
    // Initialize fluid engine
    const engine = new SimpleFluidEngine(renderer, 256, 256);
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
    
    console.log('Fluid simulation initialized');
    
    // Mouse tracking
    let mouseX = 0.5;
    let mouseY = 0.5;
    let lastMouseX = 0.5;
    let lastMouseY = 0.5;
    let isMouseDown = false;
    
    const handleMouseMove = (event: MouseEvent) => {
      lastMouseX = mouseX;
      lastMouseY = mouseY;
      mouseX = event.clientX / window.innerWidth;
      mouseY = 1.0 - event.clientY / window.innerHeight;
      
      if (isMouseDown) {
        const dx = (mouseX - lastMouseX) * 100;
        const dy = (mouseY - lastMouseY) * 100;
        const color = new THREE.Color();
        color.setHSL(Date.now() * 0.0001 % 1, 1, 0.5);
        engine.addSplat(mouseX, mouseY, dx, dy, color);
      }
    };
    
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        isMouseDown = true;
        const color = new THREE.Color();
        color.setHSL(Math.random(), 1, 0.5);
        engine.addSplat(mouseX, mouseY, 0, 0, color);
      }
    };
    
    const handleMouseUp = () => {
      isMouseDown = false;
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
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
    
    // Add initial splats
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const color = new THREE.Color();
        color.setHSL(i * 0.3, 1, 0.5);
        engine.addSplat(
          0.3 + i * 0.2,
          0.5,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          color
        );
      }, i * 100);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
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
    </>
  );
}