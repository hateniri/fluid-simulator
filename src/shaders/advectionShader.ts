// Vertex shader
export const advectionVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader
export const advectionFragmentShader = `
uniform sampler2D velocityTexture;
uniform sampler2D sourceTexture;
uniform float dt;
uniform float dissipation;
uniform vec2 texelSize;

varying vec2 vUv;

void main() {
    vec2 velocity = texture2D(velocityTexture, vUv).xy;
    vec2 pos = vUv - velocity * dt * texelSize;
    
    vec4 result = texture2D(sourceTexture, pos);
    result *= dissipation;
    
    gl_FragColor = result;
}
`;