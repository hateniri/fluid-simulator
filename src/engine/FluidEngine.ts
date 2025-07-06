import * as THREE from 'three';
import { createShaderPass } from './shaderUtils';
import { 
  advectionShader,
  divergenceShader,
  pressureShader,
  gradientSubtractShader,
  vorticityShader,
  splatShader,
  displayShader
} from './shaders';

export class FluidEngine {
  private renderer: THREE.WebGLRenderer;
  private resolution: THREE.Vector2;
  private texelSize: THREE.Vector2;
  
  private velocityFBO: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  private densityFBO: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  private pressureFBO: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  private divergenceFBO: THREE.WebGLRenderTarget;
  private vorticityFBO: THREE.WebGLRenderTarget;
  private displayFBO: THREE.WebGLRenderTarget;
  
  private passes: {
    advection: ReturnType<typeof createShaderPass>;
    divergence: ReturnType<typeof createShaderPass>;
    pressure: ReturnType<typeof createShaderPass>;
    gradientSubtract: ReturnType<typeof createShaderPass>;
    vorticity: ReturnType<typeof createShaderPass>;
    splat: ReturnType<typeof createShaderPass>;
    display: ReturnType<typeof createShaderPass>;
  };
  
  private config = {
    viscosity: 0.0001,
    diffusion: 0.00001,
    pressure: 0.8,
    vorticity: 30,
    colorMode: 'rainbow',
    brightness: 1,
    contrast: 1,
  };
  
  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.resolution = new THREE.Vector2(width, height);
    this.texelSize = new THREE.Vector2(1 / width, 1 / height);
    
    // Initialize FBOs
    const options: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    };
    
    this.velocityFBO = {
      read: new THREE.WebGLRenderTarget(width, height, options),
      write: new THREE.WebGLRenderTarget(width, height, options),
    };
    
    this.densityFBO = {
      read: new THREE.WebGLRenderTarget(width, height, options),
      write: new THREE.WebGLRenderTarget(width, height, options),
    };
    
    this.pressureFBO = {
      read: new THREE.WebGLRenderTarget(width, height, options),
      write: new THREE.WebGLRenderTarget(width, height, options),
    };
    
    this.divergenceFBO = new THREE.WebGLRenderTarget(width, height, options);
    this.vorticityFBO = new THREE.WebGLRenderTarget(width, height, options);
    this.displayFBO = new THREE.WebGLRenderTarget(width, height, {
      ...options,
      type: THREE.UnsignedByteType,
    });
    
    // Initialize shader passes
    this.passes = {
      advection: createShaderPass(renderer, advectionShader),
      divergence: createShaderPass(renderer, divergenceShader),
      pressure: createShaderPass(renderer, pressureShader),
      gradientSubtract: createShaderPass(renderer, gradientSubtractShader),
      vorticity: createShaderPass(renderer, vorticityShader),
      splat: createShaderPass(renderer, splatShader),
      display: createShaderPass(renderer, displayShader),
    };
    
    // Clear all buffers
    this.clear();
  }
  
  private clear(): void {
    const clearPass = createShaderPass(this.renderer, {
      vertex: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragment: `
        void main() {
          gl_FragColor = vec4(0.0);
        }
      `,
      uniforms: {},
    });
    
    clearPass.render(this.velocityFBO.read);
    clearPass.render(this.velocityFBO.write);
    clearPass.render(this.densityFBO.read);
    clearPass.render(this.densityFBO.write);
    clearPass.render(this.pressureFBO.read);
    clearPass.render(this.pressureFBO.write);
    clearPass.render(this.divergenceFBO);
    clearPass.render(this.vorticityFBO);
    
    clearPass.dispose();
  }
  
  public reset(): void {
    this.clear();
    this.addRandomSplats(5);
  }
  
  public updateConfig(config: Partial<typeof this.config>): void {
    Object.assign(this.config, config);
  }
  
  public addSplat(x: number, y: number, dx: number, dy: number, color: THREE.Color, radius: number = 0.05): void {
    // Add velocity
    this.passes.splat.setUniforms({
      uTarget: this.velocityFBO.read.texture,
      uPoint: new THREE.Vector2(x, y),
      uColor: new THREE.Vector3(dx, dy, 0),
      uRadius: radius,
      uAspectRatio: this.resolution.x / this.resolution.y,
    });
    this.passes.splat.render(this.velocityFBO.write);
    this.swapVelocity();
    
    // Add density
    this.passes.splat.setUniforms({
      uTarget: this.densityFBO.read.texture,
      uColor: new THREE.Vector3(color.r, color.g, color.b),
    });
    this.passes.splat.render(this.densityFBO.write);
    this.swapDensity();
  }
  
  public addRandomSplats(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = Math.random();
      const y = Math.random();
      const dx = (Math.random() - 0.5) * 10;
      const dy = (Math.random() - 0.5) * 10;
      const color = new THREE.Color();
      color.setHSL(Math.random(), 1, 0.5);
      this.addSplat(x, y, dx, dy, color, 0.1);
    }
  }
  
  public update(dt: number): void {
    // Advect velocity
    this.passes.advection.setUniforms({
      uVelocity: this.velocityFBO.read.texture,
      uSource: this.velocityFBO.read.texture,
      uTexelSize: this.texelSize,
      uDt: dt,
      uDissipation: 1 - this.config.viscosity,
    });
    this.passes.advection.render(this.velocityFBO.write);
    this.swapVelocity();
    
    // Advect density
    this.passes.advection.setUniforms({
      uVelocity: this.velocityFBO.read.texture,
      uSource: this.densityFBO.read.texture,
      uDissipation: 1 - this.config.diffusion,
    });
    this.passes.advection.render(this.densityFBO.write);
    this.swapDensity();
    
    // Vorticity confinement
    if (this.config.vorticity > 0) {
      this.passes.vorticity.setUniforms({
        uVelocity: this.velocityFBO.read.texture,
        uTexelSize: this.texelSize,
        uCurl: this.config.vorticity,
        uDt: dt,
      });
      this.passes.vorticity.render(this.velocityFBO.write);
      this.swapVelocity();
    }
    
    // Pressure projection
    this.passes.divergence.setUniforms({
      uVelocity: this.velocityFBO.read.texture,
      uTexelSize: this.texelSize,
    });
    this.passes.divergence.render(this.divergenceFBO);
    
    // Clear pressure
    this.renderer.setRenderTarget(this.pressureFBO.read);
    this.renderer.clear();
    
    // Solve pressure
    for (let i = 0; i < 20; i++) {
      this.passes.pressure.setUniforms({
        uPressure: this.pressureFBO.read.texture,
        uDivergence: this.divergenceFBO.texture,
        uTexelSize: this.texelSize,
      });
      this.passes.pressure.render(this.pressureFBO.write);
      this.swapPressure();
    }
    
    // Subtract pressure gradient
    this.passes.gradientSubtract.setUniforms({
      uVelocity: this.velocityFBO.read.texture,
      uPressure: this.pressureFBO.read.texture,
      uTexelSize: this.texelSize,
    });
    this.passes.gradientSubtract.render(this.velocityFBO.write);
    this.swapVelocity();
    
    // Update display
    this.passes.display.setUniforms({
      uDensity: this.densityFBO.read.texture,
      uBrightness: this.config.brightness,
      uContrast: this.config.contrast,
    });
    this.passes.display.render(this.displayFBO);
  }
  
  public getDisplayTexture(): THREE.Texture {
    return this.displayFBO.texture;
  }
  
  private swapVelocity(): void {
    [this.velocityFBO.read, this.velocityFBO.write] = [this.velocityFBO.write, this.velocityFBO.read];
  }
  
  private swapDensity(): void {
    [this.densityFBO.read, this.densityFBO.write] = [this.densityFBO.write, this.densityFBO.read];
  }
  
  private swapPressure(): void {
    [this.pressureFBO.read, this.pressureFBO.write] = [this.pressureFBO.write, this.pressureFBO.read];
  }
  
  public dispose(): void {
    this.velocityFBO.read.dispose();
    this.velocityFBO.write.dispose();
    this.densityFBO.read.dispose();
    this.densityFBO.write.dispose();
    this.pressureFBO.read.dispose();
    this.pressureFBO.write.dispose();
    this.divergenceFBO.dispose();
    this.vorticityFBO.dispose();
    this.displayFBO.dispose();
    
    Object.values(this.passes).forEach(pass => pass.dispose());
  }
}