// Vertex shader
export const pressureVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader
export const pressureFragmentShader = `
uniform sampler2D pressureTexture;
uniform sampler2D divergenceTexture;
uniform vec2 texelSize;

varying vec2 vUv;

void main() {
    float divergence = texture2D(divergenceTexture, vUv).x;
    
    float pLeft = texture2D(pressureTexture, vUv - vec2(texelSize.x, 0.0)).x;
    float pRight = texture2D(pressureTexture, vUv + vec2(texelSize.x, 0.0)).x;
    float pBottom = texture2D(pressureTexture, vUv - vec2(0.0, texelSize.y)).x;
    float pTop = texture2D(pressureTexture, vUv + vec2(0.0, texelSize.y)).x;
    
    float pressure = (pLeft + pRight + pBottom + pTop - divergence) * 0.25;
    
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}
`;