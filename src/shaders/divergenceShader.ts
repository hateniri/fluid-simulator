// Vertex shader
export const divergenceVertexShader = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader
export const divergenceFragmentShader = `
uniform sampler2D velocityTexture;
uniform vec2 texelSize;

varying vec2 vUv;

void main() {
    vec2 xLeft = texture2D(velocityTexture, vUv - vec2(texelSize.x, 0.0)).xy;
    vec2 xRight = texture2D(velocityTexture, vUv + vec2(texelSize.x, 0.0)).xy;
    vec2 yBottom = texture2D(velocityTexture, vUv - vec2(0.0, texelSize.y)).xy;
    vec2 yTop = texture2D(velocityTexture, vUv + vec2(0.0, texelSize.y)).xy;
    
    float divergence = ((xRight.x - xLeft.x) + (yTop.y - yBottom.y)) * 0.5;
    
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}
`;