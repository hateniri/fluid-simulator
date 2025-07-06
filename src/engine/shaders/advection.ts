import { ShaderDefinition } from '../shaderUtils';

export const advectionShader: ShaderDefinition = {
  vertex: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragment: `
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 uTexelSize;
    uniform float uDt;
    uniform float uDissipation;
    
    varying vec2 vUv;
    
    void main() {
      vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexelSize;
      vec4 result = texture2D(uSource, coord);
      result *= uDissipation;
      gl_FragColor = result;
    }
  `,
  
  uniforms: {
    uVelocity: { value: null },
    uSource: { value: null },
    uTexelSize: { value: null },
    uDt: { value: 0.016 },
    uDissipation: { value: 0.98 },
  },
};