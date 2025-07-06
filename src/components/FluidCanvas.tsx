import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

export function FluidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    console.log('Initializing Three.js scene...');
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 2;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Create a simple colored plane
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      side: THREE.DoubleSide 
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    
    console.log('Scene created with red plane');
    setIsInitialized(true);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      mesh.rotation.z += 0.01;
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
      renderer.dispose();
    };
  }, []);
  
  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {isInitialized && (
        <div style={{ position: 'absolute', top: 20, left: 20, color: 'white' }}>
          Three.js initialized - You should see a rotating red square
        </div>
      )}
    </>
  );
}