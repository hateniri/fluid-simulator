import * as THREE from 'three';

interface SmokeSource {
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  color: THREE.Vector3;
  temperature: number;
  density: number;
  radius: number;
}

export class SmokeFluidEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private resolution: THREE.Vector2;
  private texelSize: THREE.Vector2;
  
  // Buffers for simulation
  private velocityBuffers: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  private densityBuffers: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  private temperatureBuffers: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  private pressureBuffers: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget };
  private divergenceBuffer: THREE.WebGLRenderTarget;
  private vorticityBuffer: THREE.WebGLRenderTarget;
  private displayBuffer: THREE.WebGLRenderTarget;
  
  private quad: THREE.Mesh;
  private time: number = 0;
  
  // Smoke sources
  private smokeSources: SmokeSource[] = [];
  
  private materials = {
    advection: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 uTexelSize;
        uniform float uDt;
        uniform float uDissipation;
        varying vec2 vUv;
        
        void main() {
          vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexelSize;
          vec4 result = texture2D(uSource, coord);
          gl_FragColor = result * uDissipation;
        }
      `,
      uniforms: {
        uVelocity: { value: null },
        uSource: { value: null },
        uTexelSize: { value: null },
        uDt: { value: 0.016 },
        uDissipation: { value: 0.98 }
      }
    }),
    
    buoyancy: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uVelocity;
        uniform sampler2D uTemperature;
        uniform sampler2D uDensity;
        uniform float uAmbientTemp;
        uniform float uDt;
        uniform float uKappa;
        uniform float uSigma;
        varying vec2 vUv;
        
        void main() {
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          float temperature = texture2D(uTemperature, vUv).x;
          float density = length(texture2D(uDensity, vUv).rgb);
          
          // Buoyancy force
          float buoyancy = uKappa * (temperature - uAmbientTemp) - uSigma * density;
          velocity.y += buoyancy * uDt;
          
          gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `,
      uniforms: {
        uVelocity: { value: null },
        uTemperature: { value: null },
        uDensity: { value: null },
        uAmbientTemp: { value: 0.0 },
        uDt: { value: 0.016 },
        uKappa: { value: 0.05 },
        uSigma: { value: 0.02 }
      }
    }),
    
    divergence: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uVelocity;
        uniform vec2 uTexelSize;
        varying vec2 vUv;
        
        void main() {
          vec2 xLeft = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).xy;
          vec2 xRight = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).xy;
          vec2 yBottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).xy;
          vec2 yTop = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).xy;
          
          float divergence = ((xRight.x - xLeft.x) + (yTop.y - yBottom.y)) * 0.5;
          gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
        }
      `,
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: null }
      }
    }),
    
    pressure: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        uniform vec2 uTexelSize;
        varying vec2 vUv;
        
        void main() {
          float divergence = texture2D(uDivergence, vUv).x;
          
          float pLeft = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
          float pRight = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
          float pBottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
          float pTop = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
          
          float pressure = (pLeft + pRight + pBottom + pTop - divergence) * 0.25;
          gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
      `,
      uniforms: {
        uPressure: { value: null },
        uDivergence: { value: null },
        uTexelSize: { value: null }
      }
    }),
    
    gradientSubtract: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uVelocity;
        uniform sampler2D uPressure;
        uniform vec2 uTexelSize;
        varying vec2 vUv;
        
        void main() {
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          
          float pLeft = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
          float pRight = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
          float pBottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
          float pTop = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
          
          vec2 gradient = vec2(pRight - pLeft, pTop - pBottom) * 0.5;
          velocity -= gradient;
          
          gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `,
      uniforms: {
        uVelocity: { value: null },
        uPressure: { value: null },
        uTexelSize: { value: null }
      }
    }),
    
    vorticity: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform vec2 uTexelSize;
        uniform float uCurlStrength;
        uniform float uDt;
        varying vec2 vUv;
        
        void main() {
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          
          float cLeft = texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x;
          float cRight = texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x;
          float cBottom = texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x;
          float cTop = texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x;
          float cCenter = texture2D(uCurl, vUv).x;
          
          vec2 force = vec2(abs(cTop) - abs(cBottom), abs(cLeft) - abs(cRight));
          force = normalize(force + 0.00001) * uCurlStrength * cCenter;
          
          velocity += force * uDt;
          gl_FragColor = vec4(velocity, 0.0, 1.0);
        }
      `,
      uniforms: {
        uVelocity: { value: null },
        uCurl: { value: null },
        uTexelSize: { value: null },
        uCurlStrength: { value: 20.0 },
        uDt: { value: 0.016 }
      }
    }),
    
    curl: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uVelocity;
        uniform vec2 uTexelSize;
        varying vec2 vUv;
        
        void main() {
          vec2 xLeft = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).xy;
          vec2 xRight = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).xy;
          vec2 yBottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).xy;
          vec2 yTop = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).xy;
          
          float curl = ((xRight.y - xLeft.y) - (yTop.x - yBottom.x)) * 0.5;
          gl_FragColor = vec4(curl, 0.0, 0.0, 1.0);
        }
      `,
      uniforms: {
        uVelocity: { value: null },
        uTexelSize: { value: null }
      }
    }),
    
    addSource: new THREE.ShaderMaterial({
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
        uniform float uIntensity;
        varying vec2 vUv;
        
        void main() {
          vec2 p = vUv - uPoint;
          float d = exp(-dot(p, p) / (uRadius * uRadius));
          vec3 base = texture2D(uTarget, vUv).rgb;
          vec3 result = base + d * uColor * uIntensity;
          gl_FragColor = vec4(result, 1.0);
        }
      `,
      uniforms: {
        uTarget: { value: null },
        uColor: { value: new THREE.Vector3() },
        uPoint: { value: new THREE.Vector2() },
        uRadius: { value: 0.05 },
        uIntensity: { value: 1.0 }
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
        uniform float uTime;
        varying vec2 vUv;
        
        vec3 tonemapACES(vec3 color) {
          float a = 2.51;
          float b = 0.03;
          float c = 2.43;
          float d = 0.59;
          float e = 0.14;
          return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
        }
        
        void main() {
          vec3 density = texture2D(uDensity, vUv).rgb;
          
          // Apply some color correction for better smoke appearance
          density = pow(density, vec3(0.8));
          
          // Subtle color shift based on density
          vec3 smokeColor = density;
          smokeColor = mix(smokeColor, smokeColor * vec3(0.9, 0.95, 1.0), 0.2);
          
          // Apply tone mapping for better contrast
          smokeColor = tonemapACES(smokeColor * 1.5);
          
          // Add subtle glow to bright areas
          float brightness = dot(smokeColor, vec3(0.299, 0.587, 0.114));
          smokeColor += pow(brightness, 2.0) * 0.1;
          
          gl_FragColor = vec4(smokeColor, 1.0);
        }
      `,
      uniforms: {
        uDensity: { value: null },
        uTime: { value: 0 }
      }
    })
  };
  
  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.resolution = new THREE.Vector2(width, height);
    this.texelSize = new THREE.Vector2(1 / width, 1 / height);
    
    // Setup render targets
    const rtOptions: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false
    };
    
    // Create double buffers
    this.velocityBuffers = {
      read: new THREE.WebGLRenderTarget(width, height, rtOptions),
      write: new THREE.WebGLRenderTarget(width, height, rtOptions)
    };
    
    this.densityBuffers = {
      read: new THREE.WebGLRenderTarget(width, height, rtOptions),
      write: new THREE.WebGLRenderTarget(width, height, rtOptions)
    };
    
    this.temperatureBuffers = {
      read: new THREE.WebGLRenderTarget(width, height, rtOptions),
      write: new THREE.WebGLRenderTarget(width, height, rtOptions)
    };
    
    this.pressureBuffers = {
      read: new THREE.WebGLRenderTarget(width, height, rtOptions),
      write: new THREE.WebGLRenderTarget(width, height, rtOptions)
    };
    
    this.divergenceBuffer = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this.vorticityBuffer = new THREE.WebGLRenderTarget(width, height, rtOptions);
    
    this.displayBuffer = new THREE.WebGLRenderTarget(width, height, {
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
    
    // Set texel size for all materials
    Object.values(this.materials).forEach(material => {
      if (material.uniforms.uTexelSize) {
        material.uniforms.uTexelSize.value = this.texelSize;
      }
    });
    
    // Initialize smoke sources - three colored smoke streams
    this.smokeSources = [
      {
        position: new THREE.Vector2(0.2, 0.1),
        velocity: new THREE.Vector2(0, 2),
        color: new THREE.Vector3(1, 0.2, 0.2), // Red
        temperature: 1.5,
        density: 2.0,
        radius: 0.04
      },
      {
        position: new THREE.Vector2(0.5, 0.1),
        velocity: new THREE.Vector2(0, 2.2),
        color: new THREE.Vector3(0.2, 1, 0.2), // Green
        temperature: 1.6,
        density: 2.0,
        radius: 0.04
      },
      {
        position: new THREE.Vector2(0.8, 0.1),
        velocity: new THREE.Vector2(0, 1.8),
        color: new THREE.Vector3(0.2, 0.2, 1), // Blue
        temperature: 1.4,
        density: 2.0,
        radius: 0.04
      }
    ];
    
    this.clear();
  }
  
  private clear(): void {
    const clearMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.quad.material = clearMaterial;
    
    const targets = [
      this.velocityBuffers.read,
      this.velocityBuffers.write,
      this.densityBuffers.read,
      this.densityBuffers.write,
      this.temperatureBuffers.read,
      this.temperatureBuffers.write,
      this.pressureBuffers.read,
      this.pressureBuffers.write,
      this.divergenceBuffer,
      this.vorticityBuffer,
      this.displayBuffer
    ];
    
    targets.forEach(rt => {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear();
    });
    
    this.renderer.setRenderTarget(null);
    clearMaterial.dispose();
  }
  
  private swapBuffers(buffers: { read: THREE.WebGLRenderTarget; write: THREE.WebGLRenderTarget }): void {
    const temp = buffers.read;
    buffers.read = buffers.write;
    buffers.write = temp;
  }
  
  public update(dt: number): void {
    this.time += dt;
    
    // Apply sources
    this.smokeSources.forEach(source => {
      // Add density
      this.quad.material = this.materials.addSource;
      this.materials.addSource.uniforms.uTarget.value = this.densityBuffers.read.texture;
      this.materials.addSource.uniforms.uPoint.value = source.position;
      this.materials.addSource.uniforms.uColor.value = source.color;
      this.materials.addSource.uniforms.uRadius.value = source.radius;
      this.materials.addSource.uniforms.uIntensity.value = source.density * dt;
      
      this.renderer.setRenderTarget(this.densityBuffers.write);
      this.renderer.render(this.scene, this.camera);
      this.swapBuffers(this.densityBuffers);
      
      // Add temperature
      this.materials.addSource.uniforms.uTarget.value = this.temperatureBuffers.read.texture;
      this.materials.addSource.uniforms.uColor.value.set(source.temperature, 0, 0);
      this.materials.addSource.uniforms.uIntensity.value = dt;
      
      this.renderer.setRenderTarget(this.temperatureBuffers.write);
      this.renderer.render(this.scene, this.camera);
      this.swapBuffers(this.temperatureBuffers);
      
      // Add velocity
      this.materials.addSource.uniforms.uTarget.value = this.velocityBuffers.read.texture;
      this.materials.addSource.uniforms.uColor.value.set(source.velocity.x, source.velocity.y, 0);
      this.materials.addSource.uniforms.uIntensity.value = dt * 0.5;
      
      this.renderer.setRenderTarget(this.velocityBuffers.write);
      this.renderer.render(this.scene, this.camera);
      this.swapBuffers(this.velocityBuffers);
    });
    
    // Apply buoyancy
    this.quad.material = this.materials.buoyancy;
    this.materials.buoyancy.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    this.materials.buoyancy.uniforms.uTemperature.value = this.temperatureBuffers.read.texture;
    this.materials.buoyancy.uniforms.uDensity.value = this.densityBuffers.read.texture;
    this.materials.buoyancy.uniforms.uDt.value = dt;
    
    this.renderer.setRenderTarget(this.velocityBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapBuffers(this.velocityBuffers);
    
    // Calculate curl for vorticity confinement
    this.quad.material = this.materials.curl;
    this.materials.curl.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    
    this.renderer.setRenderTarget(this.vorticityBuffer);
    this.renderer.render(this.scene, this.camera);
    
    // Apply vorticity confinement
    this.quad.material = this.materials.vorticity;
    this.materials.vorticity.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    this.materials.vorticity.uniforms.uCurl.value = this.vorticityBuffer.texture;
    this.materials.vorticity.uniforms.uDt.value = dt;
    
    this.renderer.setRenderTarget(this.velocityBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapBuffers(this.velocityBuffers);
    
    // Advect velocity
    this.quad.material = this.materials.advection;
    this.materials.advection.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    this.materials.advection.uniforms.uSource.value = this.velocityBuffers.read.texture;
    this.materials.advection.uniforms.uDt.value = dt;
    this.materials.advection.uniforms.uDissipation.value = 0.98;
    
    this.renderer.setRenderTarget(this.velocityBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapBuffers(this.velocityBuffers);
    
    // Advect density
    this.materials.advection.uniforms.uSource.value = this.densityBuffers.read.texture;
    this.materials.advection.uniforms.uDissipation.value = 0.97;
    
    this.renderer.setRenderTarget(this.densityBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapBuffers(this.densityBuffers);
    
    // Advect temperature
    this.materials.advection.uniforms.uSource.value = this.temperatureBuffers.read.texture;
    this.materials.advection.uniforms.uDissipation.value = 0.96;
    
    this.renderer.setRenderTarget(this.temperatureBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapBuffers(this.temperatureBuffers);
    
    // Pressure projection
    // Calculate divergence
    this.quad.material = this.materials.divergence;
    this.materials.divergence.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    
    this.renderer.setRenderTarget(this.divergenceBuffer);
    this.renderer.render(this.scene, this.camera);
    
    // Clear pressure
    this.renderer.setRenderTarget(this.pressureBuffers.read);
    this.renderer.clear();
    
    // Solve pressure (Jacobi iterations)
    this.quad.material = this.materials.pressure;
    for (let i = 0; i < 30; i++) {
      this.materials.pressure.uniforms.uPressure.value = this.pressureBuffers.read.texture;
      this.materials.pressure.uniforms.uDivergence.value = this.divergenceBuffer.texture;
      
      this.renderer.setRenderTarget(this.pressureBuffers.write);
      this.renderer.render(this.scene, this.camera);
      this.swapBuffers(this.pressureBuffers);
    }
    
    // Subtract pressure gradient
    this.quad.material = this.materials.gradientSubtract;
    this.materials.gradientSubtract.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    this.materials.gradientSubtract.uniforms.uPressure.value = this.pressureBuffers.read.texture;
    
    this.renderer.setRenderTarget(this.velocityBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapBuffers(this.velocityBuffers);
    
    // Final display
    this.quad.material = this.materials.display;
    this.materials.display.uniforms.uDensity.value = this.densityBuffers.read.texture;
    this.materials.display.uniforms.uTime.value = this.time;
    
    this.renderer.setRenderTarget(this.displayBuffer);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }
  
  public getTexture(): THREE.Texture {
    return this.displayBuffer.texture;
  }
  
  public addCustomSmoke(x: number, y: number, color: THREE.Vector3): void {
    const source: SmokeSource = {
      position: new THREE.Vector2(x, y),
      velocity: new THREE.Vector2((Math.random() - 0.5) * 0.5, 1 + Math.random()),
      color: color,
      temperature: 1 + Math.random() * 0.5,
      density: 1.5,
      radius: 0.03
    };
    
    // Temporarily add source
    this.smokeSources.push(source);
    setTimeout(() => {
      const index = this.smokeSources.indexOf(source);
      if (index > -1) {
        this.smokeSources.splice(index, 1);
      }
    }, 100);
  }
  
  public reset(): void {
    this.clear();
    this.time = 0;
  }
  
  public dispose(): void {
    this.velocityBuffers.read.dispose();
    this.velocityBuffers.write.dispose();
    this.densityBuffers.read.dispose();
    this.densityBuffers.write.dispose();
    this.temperatureBuffers.read.dispose();
    this.temperatureBuffers.write.dispose();
    this.pressureBuffers.read.dispose();
    this.pressureBuffers.write.dispose();
    this.divergenceBuffer.dispose();
    this.vorticityBuffer.dispose();
    this.displayBuffer.dispose();
    this.quad.geometry.dispose();
    Object.values(this.materials).forEach(material => material.dispose());
  }
}