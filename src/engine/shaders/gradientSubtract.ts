import { ShaderDefinition } from '../shaderUtils';

export const gradientSubtractShader: ShaderDefinition = {
  vertex: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragment: `
    uniform sampler2D uVelocity;
    uniform sampler2D uPressure;
    uniform vec2 uTexelSize;
    
    varying vec2 vUv;
    
    void main() {
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      
      float pLeft = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
      float pRight = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
      float pBottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
      float pTop = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
      
      vec2 gradient = vec2(pRight - pLeft, pTop - pBottom) * 0.5;
      velocity -= gradient;
      
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `,
  
  uniforms: {
    uVelocity: { value: null },
    uPressure: { value: null },
    uTexelSize: { value: null },
  },
};