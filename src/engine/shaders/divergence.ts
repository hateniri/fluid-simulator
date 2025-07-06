import { ShaderDefinition } from '../shaderUtils';

export const divergenceShader: ShaderDefinition = {
  vertex: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragment: `
    uniform sampler2D uVelocity;
    uniform vec2 uTexelSize;
    
    varying vec2 vUv;
    
    void main() {
      vec2 xLeft = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).xy;
      vec2 xRight = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).xy;
      vec2 yBottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).xy;
      vec2 yTop = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).xy;
      
      float divergence = ((xRight.x - xLeft.x) + (yTop.y - yBottom.y)) * 0.5;
      gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
    }
  `,
  
  uniforms: {
    uVelocity: { value: null },
    uTexelSize: { value: null },
  },
};