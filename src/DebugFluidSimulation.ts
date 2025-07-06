import * as THREE from 'three';

export class DebugFluidSimulation {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private resolution: THREE.Vector2;
    private quad: THREE.Mesh;
    
    constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
        console.log('DebugFluidSimulation: Initializing...');
        this.renderer = renderer;
        this.resolution = new THREE.Vector2(width, height);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Create a simple test texture
        const size = width * height;
        const data = new Float32Array(size * 4);
        
        for (let i = 0; i < size; i++) {
            const stride = i * 4;
            // Create a gradient pattern
            const x = (i % width) / width;
            const y = Math.floor(i / width) / height;
            
            data[stride] = x;        // R
            data[stride + 1] = y;    // G
            data[stride + 2] = 0.5;  // B
            data[stride + 3] = 1.0;  // A
        }
        
        const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
        texture.needsUpdate = true;
        
        console.log('DebugFluidSimulation: Test texture created');
        
        // Create simple material
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D testTexture;
                varying vec2 vUv;
                void main() {
                    vec4 color = texture2D(testTexture, vUv);
                    gl_FragColor = vec4(color.rgb, 1.0);
                }
            `,
            uniforms: {
                testTexture: { value: texture }
            }
        });
        
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.quad = new THREE.Mesh(geometry, material);
        this.scene.add(this.quad);
        
        console.log('DebugFluidSimulation: Quad created and added to scene');
    }
    
    public render(target: THREE.WebGLRenderTarget | null = null): void {
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.scene, this.camera);
    }
    
    public getDensityTexture(): THREE.Texture {
        return (this.quad.material as THREE.ShaderMaterial).uniforms.testTexture.value;
    }
    
    public update(dt: number): void {
        // No-op for debug
    }
    
    public addSplat(x: number, y: number, dx: number, dy: number, color: THREE.Vector3): void {
        console.log(`DebugFluidSimulation: addSplat called at (${x}, ${y})`);
    }
}