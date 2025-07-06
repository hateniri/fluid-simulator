// Vertex shader
export const splatVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader
export const splatFragmentShader = `
uniform sampler2D targetTexture;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
uniform vec2 aspectRatio;

varying vec2 vUv;

void main() {
    vec2 p = vUv - point;
    p.x *= aspectRatio.x;
    p.y *= aspectRatio.y;
    
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(targetTexture, vUv).xyz;
    
    gl_FragColor = vec4(base + splat, 1.0);
}
`;