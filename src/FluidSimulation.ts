import * as THREE from 'three';
import { 
    advectionVertexShader, 
    advectionFragmentShader 
} from './shaders/advectionShader';
import { 
    divergenceVertexShader, 
    divergenceFragmentShader 
} from './shaders/divergenceShader';
import { 
    pressureVertexShader, 
    pressureFragmentShader 
} from './shaders/pressureShader';
import { 
    gradientSubtractVertexShader, 
    gradientSubtractFragmentShader 
} from './shaders/gradientSubtractShader';
import { 
    splatVertexShader, 
    splatFragmentShader 
} from './shaders/splatShader';

export class FluidSimulation {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private resolution: THREE.Vector2;
    private texelSize: THREE.Vector2;
    
    private velocityRenderTargets: THREE.WebGLRenderTarget[];
    private densityRenderTargets: THREE.WebGLRenderTarget[];
    private pressureRenderTargets: THREE.WebGLRenderTarget[];
    private divergenceRenderTarget: THREE.WebGLRenderTarget;
    
    private advectionMaterial: THREE.ShaderMaterial;
    private divergenceMaterial: THREE.ShaderMaterial;
    private pressureMaterial: THREE.ShaderMaterial;
    private gradientSubtractMaterial: THREE.ShaderMaterial;
    private splatMaterial: THREE.ShaderMaterial;
    private displayMaterial: THREE.ShaderMaterial;
    
    private quad: THREE.Mesh;
    private currentIndex: number = 0;
    
    constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
        this.renderer = renderer;
        this.resolution = new THREE.Vector2(width, height);
        this.texelSize = new THREE.Vector2(1.0 / width, 1.0 / height);
        
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.initRenderTargets();
        this.initMaterials();
        this.initQuad();
    }
    
    private initRenderTargets(): void {
        const options = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType
        };
        
        this.velocityRenderTargets = [
            new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, options),
            new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, options)
        ];
        
        this.densityRenderTargets = [
            new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, options),
            new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, options)
        ];
        
        this.pressureRenderTargets = [
            new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, options),
            new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, options)
        ];
        
        this.divergenceRenderTarget = new THREE.WebGLRenderTarget(
            this.resolution.x, 
            this.resolution.y, 
            options
        );
    }
    
    private initMaterials(): void {
        this.advectionMaterial = new THREE.ShaderMaterial({
            vertexShader: advectionVertexShader,
            fragmentShader: advectionFragmentShader,
            uniforms: {
                velocityTexture: { value: null },
                sourceTexture: { value: null },
                dt: { value: 0.016 },
                dissipation: { value: 0.98 },
                texelSize: { value: this.texelSize }
            }
        });
        
        this.divergenceMaterial = new THREE.ShaderMaterial({
            vertexShader: divergenceVertexShader,
            fragmentShader: divergenceFragmentShader,
            uniforms: {
                velocityTexture: { value: null },
                texelSize: { value: this.texelSize }
            }
        });
        
        this.pressureMaterial = new THREE.ShaderMaterial({
            vertexShader: pressureVertexShader,
            fragmentShader: pressureFragmentShader,
            uniforms: {
                pressureTexture: { value: null },
                divergenceTexture: { value: null },
                texelSize: { value: this.texelSize }
            }
        });
        
        this.gradientSubtractMaterial = new THREE.ShaderMaterial({
            vertexShader: gradientSubtractVertexShader,
            fragmentShader: gradientSubtractFragmentShader,
            uniforms: {
                velocityTexture: { value: null },
                pressureTexture: { value: null },
                texelSize: { value: this.texelSize }
            }
        });
        
        this.splatMaterial = new THREE.ShaderMaterial({
            vertexShader: splatVertexShader,
            fragmentShader: splatFragmentShader,
            uniforms: {
                targetTexture: { value: null },
                color: { value: new THREE.Vector3(0, 0, 0) },
                point: { value: new THREE.Vector2(0.5, 0.5) },
                radius: { value: 0.01 },
                aspectRatio: { value: new THREE.Vector2(1, 1) }
            }
        });
        
        this.displayMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D densityTexture;
                varying vec2 vUv;
                void main() {
                    vec3 density = texture2D(densityTexture, vUv).rgb;
                    gl_FragColor = vec4(density, 1.0);
                }
            `,
            uniforms: {
                densityTexture: { value: null }
            }
        });
    }
    
    private initQuad(): void {
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.quad = new THREE.Mesh(geometry, this.displayMaterial);
        this.scene.add(this.quad);
    }
    
    private renderToTarget(
        material: THREE.ShaderMaterial, 
        target: THREE.WebGLRenderTarget
    ): void {
        this.quad.material = material;
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.scene, this.camera);
    }
    
    public advectVelocity(dt: number): void {
        const source = this.velocityRenderTargets[this.currentIndex];
        const target = this.velocityRenderTargets[1 - this.currentIndex];
        
        this.advectionMaterial.uniforms.velocityTexture.value = source.texture;
        this.advectionMaterial.uniforms.sourceTexture.value = source.texture;
        this.advectionMaterial.uniforms.dt.value = dt;
        this.advectionMaterial.uniforms.dissipation.value = 0.99;
        
        this.renderToTarget(this.advectionMaterial, target);
        this.currentIndex = 1 - this.currentIndex;
    }
    
    public advectDensity(dt: number): void {
        const velocity = this.velocityRenderTargets[this.currentIndex].texture;
        const source = this.densityRenderTargets[this.currentIndex];
        const target = this.densityRenderTargets[1 - this.currentIndex];
        
        this.advectionMaterial.uniforms.velocityTexture.value = velocity;
        this.advectionMaterial.uniforms.sourceTexture.value = source.texture;
        this.advectionMaterial.uniforms.dt.value = dt;
        this.advectionMaterial.uniforms.dissipation.value = 0.98;
        
        this.renderToTarget(this.advectionMaterial, target);
    }
    
    public computeDivergence(): void {
        const velocity = this.velocityRenderTargets[this.currentIndex].texture;
        
        this.divergenceMaterial.uniforms.velocityTexture.value = velocity;
        this.renderToTarget(this.divergenceMaterial, this.divergenceRenderTarget);
    }
    
    public solvePressure(iterations: number = 20): void {
        let pressureIndex = 0;
        
        for (let i = 0; i < iterations; i++) {
            const source = this.pressureRenderTargets[pressureIndex];
            const target = this.pressureRenderTargets[1 - pressureIndex];
            
            this.pressureMaterial.uniforms.pressureTexture.value = source.texture;
            this.pressureMaterial.uniforms.divergenceTexture.value = this.divergenceRenderTarget.texture;
            
            this.renderToTarget(this.pressureMaterial, target);
            pressureIndex = 1 - pressureIndex;
        }
    }
    
    public subtractGradient(): void {
        const velocity = this.velocityRenderTargets[this.currentIndex];
        const pressure = this.pressureRenderTargets[0].texture;
        const target = this.velocityRenderTargets[1 - this.currentIndex];
        
        this.gradientSubtractMaterial.uniforms.velocityTexture.value = velocity.texture;
        this.gradientSubtractMaterial.uniforms.pressureTexture.value = pressure;
        
        this.renderToTarget(this.gradientSubtractMaterial, target);
        this.currentIndex = 1 - this.currentIndex;
    }
    
    public addSplat(x: number, y: number, dx: number, dy: number, color: THREE.Vector3): void {
        const velocityTarget = this.velocityRenderTargets[this.currentIndex];
        const densityTarget = this.densityRenderTargets[this.currentIndex];
        
        // Add velocity splat
        this.splatMaterial.uniforms.targetTexture.value = velocityTarget.texture;
        this.splatMaterial.uniforms.point.value.set(x, y);
        this.splatMaterial.uniforms.color.value.set(dx, dy, 0);
        this.splatMaterial.uniforms.radius.value = 0.005;
        
        this.renderToTarget(this.splatMaterial, this.velocityRenderTargets[1 - this.currentIndex]);
        
        // Add density splat
        this.splatMaterial.uniforms.targetTexture.value = densityTarget.texture;
        this.splatMaterial.uniforms.color.value.copy(color);
        this.splatMaterial.uniforms.radius.value = 0.008;
        
        this.renderToTarget(this.splatMaterial, this.densityRenderTargets[1 - this.currentIndex]);
        
        this.currentIndex = 1 - this.currentIndex;
    }
    
    public update(dt: number): void {
        this.advectVelocity(dt);
        this.advectDensity(dt);
        this.computeDivergence();
        this.solvePressure();
        this.subtractGradient();
    }
    
    public render(target: THREE.WebGLRenderTarget | null = null): void {
        this.displayMaterial.uniforms.densityTexture.value = 
            this.densityRenderTargets[this.currentIndex].texture;
        this.quad.material = this.displayMaterial;
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.scene, this.camera);
    }
    
    public getDensityTexture(): THREE.Texture {
        return this.densityRenderTargets[this.currentIndex].texture;
    }
    
    public dispose(): void {
        this.velocityRenderTargets.forEach(rt => rt.dispose());
        this.densityRenderTargets.forEach(rt => rt.dispose());
        this.pressureRenderTargets.forEach(rt => rt.dispose());
        this.divergenceRenderTarget.dispose();
        
        this.advectionMaterial.dispose();
        this.divergenceMaterial.dispose();
        this.pressureMaterial.dispose();
        this.gradientSubtractMaterial.dispose();
        this.splatMaterial.dispose();
        this.displayMaterial.dispose();
        
        this.quad.geometry.dispose();
    }
}