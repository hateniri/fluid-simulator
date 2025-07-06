import { ShaderDefinition } from '../shaderUtils';

export const displayShader: ShaderDefinition = {
  vertex: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragment: `
    uniform sampler2D uDensity;
    uniform float uBrightness;
    uniform float uContrast;
    
    varying vec2 vUv;
    
    void main() {
      vec3 density = texture2D(uDensity, vUv).rgb;
      
      // Apply brightness and contrast
      density = (density - 0.5) * uContrast + 0.5;
      density *= uBrightness;
      
      // Clamp to valid range
      density = clamp(density, 0.0, 1.0);
      
      gl_FragColor = vec4(density, 1.0);
    }
  `,
  
  uniforms: {
    uDensity: { value: null },
    uBrightness: { value: 1.0 },
    uContrast: { value: 1.0 },
  },
};