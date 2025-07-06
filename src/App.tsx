import React, { useState } from 'react';
import { FluidCanvas } from './components/FluidCanvas';
import { OceanCanvas } from './components/OceanCanvas';
import { SmokeCanvas } from './components/SmokeCanvas';

export function App() {
  const [mode, setMode] = useState<'fluid' | 'ocean' | 'smoke'>('smoke');
  
  return (
    <>
      {mode === 'fluid' && <FluidCanvas />}
      {mode === 'ocean' && <OceanCanvas />}
      {mode === 'smoke' && <SmokeCanvas />}
      
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        gap: '10px'
      }}>
        <button
          onClick={() => setMode('fluid')}
          style={{
            padding: '10px 20px',
            backgroundColor: mode === 'fluid' ? '#007bff' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Fluid Mode
        </button>
        <button
          onClick={() => setMode('ocean')}
          style={{
            padding: '10px 20px',
            backgroundColor: mode === 'ocean' ? '#007bff' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Ocean Mode
        </button>
        <button
          onClick={() => setMode('smoke')}
          style={{
            padding: '10px 20px',
            backgroundColor: mode === 'smoke' ? '#007bff' : '#333',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Smoke Mode
        </button>
      </div>
    </>
  );
}