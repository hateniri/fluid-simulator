// Vertex shader
export const gradientSubtractVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader
export const gradientSubtractFragmentShader = `
uniform sampler2D velocityTexture;
uniform sampler2D pressureTexture;
uniform vec2 texelSize;

varying vec2 vUv;

void main() {
    vec2 velocity = texture2D(velocityTexture, vUv).xy;
    
    float pLeft = texture2D(pressureTexture, vUv - vec2(texelSize.x, 0.0)).x;
    float pRight = texture2D(pressureTexture, vUv + vec2(texelSize.x, 0.0)).x;
    float pBottom = texture2D(pressureTexture, vUv - vec2(0.0, texelSize.y)).x;
    float pTop = texture2D(pressureTexture, vUv + vec2(0.0, texelSize.y)).x;
    
    vec2 gradient = vec2(pRight - pLeft, pTop - pBottom) * 0.5;
    velocity -= gradient;
    
    gl_FragColor = vec4(velocity, 0.0, 1.0);
}
`;