import { ShaderDefinition } from '../shaderUtils';

export const vorticityShader: ShaderDefinition = {
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
    uniform float uCurl;
    uniform float uDt;
    
    varying vec2 vUv;
    
    void main() {
      vec2 xLeft = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).xy;
      vec2 xRight = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).xy;
      vec2 yBottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).xy;
      vec2 yTop = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).xy;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      
      float vorticity = ((xRight.y - xLeft.y) - (yTop.x - yBottom.x)) * 0.5;
      
      vec2 direction = vec2(abs((yTop.x - yBottom.x) * 0.5), abs((xRight.y - xLeft.y) * 0.5));
      direction = normalize(direction + 0.00001);
      
      vec2 force = uCurl * vorticity * direction;
      velocity += force * uDt;
      
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `,
  
  uniforms: {
    uVelocity: { value: null },
    uTexelSize: { value: null },
    uCurl: { value: 30.0 },
    uDt: { value: 0.016 },
  },
};