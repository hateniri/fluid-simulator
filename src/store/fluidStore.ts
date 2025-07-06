import { create } from 'zustand';
import * as THREE from 'three';

interface FluidConfig {
  viscosity: number;
  diffusion: number;
  pressure: number;
  vorticity: number;
  colorMode: string;
  brightness: number;
  contrast: number;
}

interface FluidStore {
  config: FluidConfig;
  mousePosition: THREE.Vector2;
  lastMousePosition: THREE.Vector2;
  mouseVelocity: THREE.Vector2;
  isMouseDown: boolean;
  brushSize: number;
  
  updateMousePosition: (x: number, y: number) => void;
  setMouseDown: (down: boolean) => void;
  setBrushSize: (size: number) => void;
  reset: () => void;
  randomSplats: (count: number) => void;
  
  // Callbacks for fluid simulation
  onReset?: () => void;
  onRandomSplats?: (count: number) => void;
  setCallbacks: (callbacks: { onReset?: () => void; onRandomSplats?: (count: number) => void }) => void;
}

export const useFluidStore = create<FluidStore>((set, get) => ({
  config: {
    viscosity: 0.0001,
    diffusion: 0.00001,
    pressure: 0.8,
    vorticity: 30,
    colorMode: 'rainbow',
    brightness: 1,
    contrast: 1,
  },
  
  mousePosition: new THREE.Vector2(0.5, 0.5),
  lastMousePosition: new THREE.Vector2(0.5, 0.5),
  mouseVelocity: new THREE.Vector2(0, 0),
  isMouseDown: false,
  brushSize: 0.05,
  
  updateMousePosition: (x, y) => {
    const state = get();
    state.lastMousePosition.copy(state.mousePosition);
    state.mousePosition.set(x, y);
    state.mouseVelocity.subVectors(state.mousePosition, state.lastMousePosition);
    set({ mouseVelocity: state.mouseVelocity.clone() });
  },
  
  setMouseDown: (down) => set({ isMouseDown: down }),
  
  setBrushSize: (size) => set({ brushSize: Math.max(0.01, Math.min(0.2, size)) }),
  
  reset: () => {
    const state = get();
    if (state.onReset) state.onReset();
  },
  
  randomSplats: (count) => {
    const state = get();
    if (state.onRandomSplats) state.onRandomSplats(count);
  },
  
  setCallbacks: (callbacks) => set(callbacks),
}));