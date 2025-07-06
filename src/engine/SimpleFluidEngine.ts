import * as THREE from 'three';

interface Splat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: THREE.Color;
  radius: number;
}

export class SimpleFluidEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private resolution: THREE.Vector2;
  
  // Double buffering for ping-pong rendering
  private densityBuffers: {
    read: THREE.WebGLRenderTarget;
    write: THREE.WebGLRenderTarget;
  };
  private displayRT: THREE.WebGLRenderTarget;
  
  private quad: THREE.Mesh;
  private splats: Splat[] = [];
  
  private materials = {
    copy: new THREE.MeshBasicMaterial(),
    
    splat: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTarget;
        uniform vec3 uColor;
        uniform vec2 uPoint;
        uniform float uRadius;
        varying vec2 vUv;
        
        void main() {
          vec2 p = vUv - uPoint;
          float d = exp(-dot(p, p) / (uRadius * uRadius));
          vec3 base = texture2D(uTarget, vUv).rgb;
          gl_FragColor = vec4(base + d * uColor, 1.0);
        }
      `,
      uniforms: {
        uTarget: { value: null },
        uColor: { value: new THREE.Vector3() },
        uPoint: { value: new THREE.Vector2() },
        uRadius: { value: 0.05 }
      }
    }),
    
    fade: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uFade;
        varying vec2 vUv;
        
        void main() {
          vec4 color = texture2D(uTexture, vUv);
          gl_FragColor = vec4(color.rgb * uFade, 1.0);
        }
      `,
      uniforms: {
        uTexture: { value: null },
        uFade: { value: 0.98 }
      }
    }),
    
    display: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uDensity;
        varying vec2 vUv;
        
        void main() {
          vec3 color = texture2D(uDensity, vUv).rgb;
          // Apply some post-processing
          color = pow(color, vec3(0.45)); // Gamma correction
          color = clamp(color * 1.5, 0.0, 1.0); // Brightness
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uDensity: { value: null }
      }
    })
  };
  
  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.resolution = new THREE.Vector2(width, height);
    
    // Setup render targets with proper options
    const rtOptions: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false
    };
    
    // Create double buffer for density
    this.densityBuffers = {
      read: new THREE.WebGLRenderTarget(width, height, rtOptions),
      write: new THREE.WebGLRenderTarget(width, height, rtOptions)
    };
    
    this.displayRT = new THREE.WebGLRenderTarget(width, height, {
      ...rtOptions,
      type: THREE.UnsignedByteType
    });
    
    // Setup scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.materials.display);
    this.scene.add(this.quad);
    
    // Clear render targets
    this.clear();
  }
  
  private clear(): void {
    // Clear all render targets
    const clearMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.quad.material = clearMaterial;
    
    this.renderer.setRenderTarget(this.densityBuffers.read);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    
    this.renderer.setRenderTarget(this.densityBuffers.write);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    
    this.renderer.setRenderTarget(this.displayRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    
    this.renderer.setRenderTarget(null);
    clearMaterial.dispose();
  }
  
  private swapBuffers(): void {
    const temp = this.densityBuffers.read;
    this.densityBuffers.read = this.densityBuffers.write;
    this.densityBuffers.write = temp;
  }
  
  public addSplat(x: number, y: number, dx: number, dy: number, color: THREE.Color): void {
    this.splats.push({ x, y, dx, dy, color, radius: 0.05 });
  }
  
  public update(dt: number): void {
    // Apply fade effect
    this.quad.material = this.materials.fade;
    this.materials.fade.uniforms.uTexture.value = this.densityBuffers.read.texture;
    this.materials.fade.uniforms.uFade.value = 0.985;
    
    this.renderer.setRenderTarget(this.densityBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapBuffers();
    
    // Apply splats
    if (this.splats.length > 0) {
      this.quad.material = this.materials.splat;
      
      // Process up to 5 splats per frame to avoid performance issues
      const splatCount = Math.min(this.splats.length, 5);
      
      for (let i = 0; i < splatCount; i++) {
        const splat = this.splats.shift()!;
        
        // Set uniforms
        this.materials.splat.uniforms.uTarget.value = this.densityBuffers.read.texture;
        this.materials.splat.uniforms.uPoint.value.set(splat.x, splat.y);
        this.materials.splat.uniforms.uColor.value.set(
          splat.color.r, 
          splat.color.g, 
          splat.color.b
        );
        this.materials.splat.uniforms.uRadius.value = splat.radius;
        
        // Render to write buffer
        this.renderer.setRenderTarget(this.densityBuffers.write);
        this.renderer.render(this.scene, this.camera);
        
        // Swap buffers for next iteration
        this.swapBuffers();
      }
    }
    
    // Update display texture
    this.quad.material = this.materials.display;
    this.materials.display.uniforms.uDensity.value = this.densityBuffers.read.texture;
    this.renderer.setRenderTarget(this.displayRT);
    this.renderer.render(this.scene, this.camera);
    
    // Reset render target
    this.renderer.setRenderTarget(null);
  }
  
  public getTexture(): THREE.Texture {
    return this.displayRT.texture;
  }
  
  public reset(): void {
    this.clear();
    this.splats = [];
  }
  
  public dispose(): void {
    this.densityBuffers.read.dispose();
    this.densityBuffers.write.dispose();
    this.displayRT.dispose();
    this.quad.geometry.dispose();
    Object.values(this.materials).forEach(material => material.dispose());
  }
}