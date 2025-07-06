import React from 'react';
import { useControls, button } from 'leva';
import { useFluidStore } from '../store/fluidStore';

export function Controls() {
  const reset = useFluidStore((state) => state.reset);
  const randomSplats = useFluidStore((state) => state.randomSplats);
  
  const [config, set] = useControls(() => ({
    'Simulation': {
      viscosity: { value: 0.0001, min: 0, max: 0.01, step: 0.0001 },
      diffusion: { value: 0.00001, min: 0, max: 0.001, step: 0.00001 },
      pressure: { value: 0.8, min: 0, max: 1, step: 0.01 },
      vorticity: { value: 30, min: 0, max: 100, step: 1 },
    },
    'Visuals': {
      colorMode: { value: 'rainbow', options: ['rainbow', 'heat', 'cool', 'gradient'] },
      brightness: { value: 1, min: 0.1, max: 2, step: 0.1 },
      contrast: { value: 1, min: 0.5, max: 2, step: 0.1 },
    },
    'Actions': {
      reset: button(() => reset()),
      randomSplats: button(() => randomSplats(10)),
    },
  }));
  
  useFluidStore.setState({ config });
  
  return null;
}