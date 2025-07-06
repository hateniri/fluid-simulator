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
  
  private velocityRT: THREE.WebGLRenderTarget;
  private densityRT: THREE.WebGLRenderTarget;
  private displayRT: THREE.WebGLRenderTarget;
  
  private quad: THREE.Mesh;
  private splats: Splat[] = [];
  
  private shaders = {
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
    
    // Setup render targets
    const rtOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType
    };
    
    this.velocityRT = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this.densityRT = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this.displayRT = new THREE.WebGLRenderTarget(width, height, {
      ...rtOptions,
      type: THREE.UnsignedByteType
    });
    
    // Setup scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.shaders.display);
    this.scene.add(this.quad);
    
    // Clear render targets
    this.clear();
  }
  
  private clear(): void {
    this.renderer.setRenderTarget(this.velocityRT);
    this.renderer.clear();
    this.renderer.setRenderTarget(this.densityRT);
    this.renderer.clear();
    this.renderer.setRenderTarget(this.displayRT);
    this.renderer.clear();
    this.renderer.setRenderTarget(null);
  }
  
  public addSplat(x: number, y: number, dx: number, dy: number, color: THREE.Color): void {
    this.splats.push({ x, y, dx, dy, color, radius: 0.05 });
  }
  
  public update(dt: number): void {
    // Apply fade to density
    this.quad.material = this.shaders.fade;
    this.shaders.fade.uniforms.uTexture.value = this.densityRT.texture;
    this.shaders.fade.uniforms.uFade.value = 0.985;
    
    const tempRT = this.velocityRT; // Use as temp buffer
    this.renderer.setRenderTarget(tempRT);
    this.renderer.render(this.scene, this.camera);
    
    // Copy back to density
    this.renderer.setRenderTarget(this.densityRT);
    this.quad.material = new THREE.MeshBasicMaterial({ map: tempRT.texture });
    this.renderer.render(this.scene, this.camera);
    
    // Apply splats
    this.quad.material = this.shaders.splat;
    while (this.splats.length > 0) {
      const splat = this.splats.pop()!;
      
      this.shaders.splat.uniforms.uTarget.value = this.densityRT.texture;
      this.shaders.splat.uniforms.uPoint.value.set(splat.x, splat.y);
      this.shaders.splat.uniforms.uColor.value.set(splat.color.r, splat.color.g, splat.color.b);
      this.shaders.splat.uniforms.uRadius.value = splat.radius;
      
      this.renderer.setRenderTarget(tempRT);
      this.renderer.render(this.scene, this.camera);
      
      // Swap buffers
      const temp = this.densityRT;
      this.densityRT = tempRT;
      this.velocityRT = temp;
    }
    
    // Update display
    this.quad.material = this.shaders.display;
    this.shaders.display.uniforms.uDensity.value = this.densityRT.texture;
    this.renderer.setRenderTarget(this.displayRT);
    this.renderer.render(this.scene, this.camera);
    
    // Reset render target
    this.renderer.setRenderTarget(null);
  }
  
  public getTexture(): THREE.Texture {
    return this.displayRT.texture;
  }
  
  public dispose(): void {
    this.velocityRT.dispose();
    this.densityRT.dispose();
    this.displayRT.dispose();
    this.quad.geometry.dispose();
    Object.values(this.shaders).forEach(shader => shader.dispose());
  }
}