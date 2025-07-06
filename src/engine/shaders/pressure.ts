import { ShaderDefinition } from '../shaderUtils';

export const pressureShader: ShaderDefinition = {
  vertex: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragment: `
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;
    uniform vec2 uTexelSize;
    
    varying vec2 vUv;
    
    void main() {
      float divergence = texture2D(uDivergence, vUv).x;
      
      float pLeft = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
      float pRight = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
      float pBottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
      float pTop = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
      
      float pressure = (pLeft + pRight + pBottom + pTop - divergence) * 0.25;
      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
  `,
  
  uniforms: {
    uPressure: { value: null },
    uDivergence: { value: null },
    uTexelSize: { value: null },
  },
};