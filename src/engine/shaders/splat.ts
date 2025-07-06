import { ShaderDefinition } from '../shaderUtils';

export const splatShader: ShaderDefinition = {
  vertex: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragment: `
    uniform sampler2D uTarget;
    uniform vec3 uColor;
    uniform vec2 uPoint;
    uniform float uRadius;
    uniform float uAspectRatio;
    
    varying vec2 vUv;
    
    void main() {
      vec2 p = vUv - uPoint;
      p.x *= uAspectRatio;
      
      float splat = exp(-dot(p, p) / uRadius);
      vec3 base = texture2D(uTarget, vUv).xyz;
      
      gl_FragColor = vec4(base + splat * uColor, 1.0);
    }
  `,
  
  uniforms: {
    uTarget: { value: null },
    uColor: { value: null },
    uPoint: { value: null },
    uRadius: { value: 0.05 },
    uAspectRatio: { value: 1.0 },
  },
};