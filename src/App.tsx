import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Loader } from '@react-three/drei';
import { Leva } from 'leva';
import { FluidSimulation } from './components/FluidSimulation';
import { Controls } from './components/Controls';
import { Info } from './components/Info';

export function App() {
  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 75 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
      >
        <Suspense fallback={null}>
          <FluidSimulation />
        </Suspense>
        <Stats />
      </Canvas>
      
      <Controls />
      <Info />
      <Leva 
        collapsed 
        theme={{
          sizes: {
            rootWidth: '320px',
            controlWidth: '120px',
          },
        }}
      />
      <Loader />
    </>
  );
}