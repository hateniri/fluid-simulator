import * as THREE from 'three';

interface Wave {
  x: number;
  y: number;
  strength: number;
  radius: number;
}

export class OceanFluidEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private resolution: THREE.Vector2;
  
  private velocityBuffers: {
    read: THREE.WebGLRenderTarget;
    write: THREE.WebGLRenderTarget;
  };
  private heightBuffers: {
    read: THREE.WebGLRenderTarget;
    write: THREE.WebGLRenderTarget;
  };
  private normalBuffer: THREE.WebGLRenderTarget;
  private foamBuffer: THREE.WebGLRenderTarget;
  private displayRT: THREE.WebGLRenderTarget;
  
  private quad: THREE.Mesh;
  private waves: Wave[] = [];
  private time: number = 0;
  
  private materials = {
    waveUpdate: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uHeight;
        uniform sampler2D uVelocity;
        uniform vec2 uTexelSize;
        uniform float uDamping;
        uniform float uTime;
        
        varying vec2 vUv;
        
        void main() {
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          float height = texture2D(uHeight, vUv).x;
          
          // Sample neighboring heights for wave equation
          float hLeft = texture2D(uHeight, vUv - vec2(uTexelSize.x, 0.0)).x;
          float hRight = texture2D(uHeight, vUv + vec2(uTexelSize.x, 0.0)).x;
          float hBottom = texture2D(uHeight, vUv - vec2(0.0, uTexelSize.y)).x;
          float hTop = texture2D(uHeight, vUv + vec2(0.0, uTexelSize.y)).x;
          
          // Wave equation
          float laplacian = (hLeft + hRight + hBottom + hTop - 4.0 * height);
          velocity.x += laplacian * 0.5;
          
          // Add ambient waves
          float wave1 = sin(vUv.x * 10.0 - uTime * 2.0) * 0.001;
          float wave2 = sin(vUv.y * 8.0 - uTime * 1.5) * 0.001;
          float wave3 = sin((vUv.x + vUv.y) * 6.0 - uTime * 2.5) * 0.0005;
          velocity.x += wave1 + wave2 + wave3;
          
          // Apply damping
          velocity *= uDamping;
          
          // Update height
          height += velocity.x;
          
          gl_FragColor = vec4(height, velocity.x, 0.0, 1.0);
        }
      `,
      uniforms: {
        uHeight: { value: null },
        uVelocity: { value: null },
        uTexelSize: { value: new THREE.Vector2() },
        uDamping: { value: 0.98 },
        uTime: { value: 0 }
      }
    }),
    
    waveImpact: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTarget;
        uniform vec2 uPoint;
        uniform float uRadius;
        uniform float uStrength;
        
        varying vec2 vUv;
        
        void main() {
          vec2 current = texture2D(uTarget, vUv).xy;
          vec2 diff = vUv - uPoint;
          float dist = length(diff);
          float influence = exp(-dist * dist / (uRadius * uRadius)) * uStrength;
          
          current.x += influence;
          current.y += influence * 0.5;
          
          gl_FragColor = vec4(current, 0.0, 1.0);
        }
      `,
      uniforms: {
        uTarget: { value: null },
        uPoint: { value: new THREE.Vector2() },
        uRadius: { value: 0.1 },
        uStrength: { value: 0.1 }
      }
    }),
    
    calculateNormals: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uHeight;
        uniform vec2 uTexelSize;
        
        varying vec2 vUv;
        
        void main() {
          float hLeft = texture2D(uHeight, vUv - vec2(uTexelSize.x, 0.0)).x;
          float hRight = texture2D(uHeight, vUv + vec2(uTexelSize.x, 0.0)).x;
          float hBottom = texture2D(uHeight, vUv - vec2(0.0, uTexelSize.y)).x;
          float hTop = texture2D(uHeight, vUv + vec2(0.0, uTexelSize.y)).x;
          
          vec3 normal = normalize(vec3(
            (hLeft - hRight) * 0.5,
            (hBottom - hTop) * 0.5,
            0.01
          ));
          
          gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
        }
      `,
      uniforms: {
        uHeight: { value: null },
        uTexelSize: { value: new THREE.Vector2() }
      }
    }),
    
    calculateFoam: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uHeight;
        uniform sampler2D uVelocity;
        uniform sampler2D uPrevFoam;
        uniform vec2 uTexelSize;
        uniform float uTime;
        
        varying vec2 vUv;
        
        void main() {
          float height = texture2D(uHeight, vUv).x;
          float velocity = abs(texture2D(uVelocity, vUv).y);
          float prevFoam = texture2D(uPrevFoam, vUv).x;
          
          // Generate foam where waves are steep or fast
          float foam = prevFoam * 0.95; // Decay
          
          // Add new foam based on wave activity
          if (velocity > 0.02 || abs(height) > 0.1) {
            foam += velocity * 5.0 + abs(height) * 2.0;
          }
          
          // Clamp foam
          foam = clamp(foam, 0.0, 1.0);
          
          gl_FragColor = vec4(foam, foam, foam, 1.0);
        }
      `,
      uniforms: {
        uHeight: { value: null },
        uVelocity: { value: null },
        uPrevFoam: { value: null },
        uTexelSize: { value: new THREE.Vector2() },
        uTime: { value: 0 }
      }
    }),
    
    oceanDisplay: new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uHeight;
        uniform sampler2D uNormal;
        uniform sampler2D uFoam;
        uniform float uTime;
        uniform vec3 uLightDir;
        uniform vec3 uViewPos;
        
        varying vec2 vUv;
        
        vec3 getOceanColor(float depth) {
          vec3 deepColor = vec3(0.004, 0.016, 0.047); // Deep ocean blue
          vec3 shallowColor = vec3(0.02, 0.1, 0.2); // Lighter blue
          vec3 surfaceColor = vec3(0.05, 0.2, 0.3); // Turquoise
          
          float t = clamp(depth * 2.0 + 0.5, 0.0, 1.0);
          vec3 color = mix(deepColor, shallowColor, t);
          color = mix(color, surfaceColor, clamp(depth * 4.0 + 0.8, 0.0, 1.0));
          
          return color;
        }
        
        void main() {
          float height = texture2D(uHeight, vUv).x;
          vec3 normal = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
          float foam = texture2D(uFoam, vUv).x;
          
          // Base ocean color based on depth
          vec3 oceanColor = getOceanColor(height + 0.5);
          
          // Simple lighting
          vec3 lightDir = normalize(uLightDir);
          float NdotL = max(dot(normal, lightDir), 0.0);
          
          // Specular highlight
          vec3 viewDir = normalize(uViewPos - vec3(vUv, 0.0));
          vec3 halfDir = normalize(lightDir + viewDir);
          float spec = pow(max(dot(normal, halfDir), 0.0), 32.0);
          
          // Subsurface scattering approximation
          float subsurface = pow(max(dot(-normal, lightDir), 0.0), 3.0) * 0.5;
          vec3 subsurfaceColor = vec3(0.0, 0.3, 0.4) * subsurface;
          
          // Combine lighting
          vec3 color = oceanColor * (0.3 + NdotL * 0.7);
          color += subsurfaceColor;
          color += vec3(1.0, 1.0, 0.9) * spec * 0.8;
          
          // Add foam
          vec3 foamColor = vec3(0.9, 0.95, 1.0);
          color = mix(color, foamColor, foam * 0.8);
          
          // Atmospheric perspective
          float distance = length(vUv - vec2(0.5));
          vec3 fogColor = vec3(0.7, 0.8, 0.9);
          color = mix(color, fogColor, distance * 0.2);
          
          // Tone mapping
          color = color / (color + vec3(1.0));
          color = pow(color, vec3(0.45));
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uHeight: { value: null },
        uNormal: { value: null },
        uFoam: { value: null },
        uTime: { value: 0 },
        uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uViewPos: { value: new THREE.Vector3(0.5, 0.5, 1.0) }
      }
    })
  };
  
  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.resolution = new THREE.Vector2(width, height);
    
    const texelSize = new THREE.Vector2(1 / width, 1 / height);
    
    // Setup render targets
    const rtOptions: THREE.WebGLRenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false
    };
    
    this.velocityBuffers = {
      read: new THREE.WebGLRenderTarget(width, height, rtOptions),
      write: new THREE.WebGLRenderTarget(width, height, rtOptions)
    };
    
    this.heightBuffers = {
      read: new THREE.WebGLRenderTarget(width, height, rtOptions),
      write: new THREE.WebGLRenderTarget(width, height, rtOptions)
    };
    
    this.normalBuffer = new THREE.WebGLRenderTarget(width, height, rtOptions);
    this.foamBuffer = new THREE.WebGLRenderTarget(width, height, rtOptions);
    
    this.displayRT = new THREE.WebGLRenderTarget(width, height, {
      ...rtOptions,
      type: THREE.UnsignedByteType
    });
    
    // Setup scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.materials.oceanDisplay);
    this.scene.add(this.quad);
    
    // Set texel size for all materials
    Object.values(this.materials).forEach(material => {
      if (material.uniforms.uTexelSize) {
        material.uniforms.uTexelSize.value = texelSize;
      }
    });
    
    this.clear();
  }
  
  private clear(): void {
    const clearMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.quad.material = clearMaterial;
    
    [
      this.velocityBuffers.read,
      this.velocityBuffers.write,
      this.heightBuffers.read,
      this.heightBuffers.write,
      this.normalBuffer,
      this.foamBuffer,
      this.displayRT
    ].forEach(rt => {
      this.renderer.setRenderTarget(rt);
      this.renderer.clear();
    });
    
    this.renderer.setRenderTarget(null);
    clearMaterial.dispose();
  }
  
  private swapVelocityBuffers(): void {
    const temp = this.velocityBuffers.read;
    this.velocityBuffers.read = this.velocityBuffers.write;
    this.velocityBuffers.write = temp;
  }
  
  private swapHeightBuffers(): void {
    const temp = this.heightBuffers.read;
    this.heightBuffers.read = this.heightBuffers.write;
    this.heightBuffers.write = temp;
  }
  
  public addWave(x: number, y: number, strength: number = 0.1): void {
    this.waves.push({ x, y, strength, radius: 0.1 });
  }
  
  public update(dt: number): void {
    this.time += dt;
    
    // Update wave physics
    this.quad.material = this.materials.waveUpdate;
    this.materials.waveUpdate.uniforms.uHeight.value = this.heightBuffers.read.texture;
    this.materials.waveUpdate.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    this.materials.waveUpdate.uniforms.uTime.value = this.time;
    
    this.renderer.setRenderTarget(this.heightBuffers.write);
    this.renderer.render(this.scene, this.camera);
    this.swapHeightBuffers();
    
    // Apply wave impacts
    if (this.waves.length > 0) {
      this.quad.material = this.materials.waveImpact;
      const wavesToProcess = Math.min(this.waves.length, 3);
      
      for (let i = 0; i < wavesToProcess; i++) {
        const wave = this.waves.shift()!;
        
        this.materials.waveImpact.uniforms.uTarget.value = this.heightBuffers.read.texture;
        this.materials.waveImpact.uniforms.uPoint.value.set(wave.x, wave.y);
        this.materials.waveImpact.uniforms.uRadius.value = wave.radius;
        this.materials.waveImpact.uniforms.uStrength.value = wave.strength;
        
        this.renderer.setRenderTarget(this.heightBuffers.write);
        this.renderer.render(this.scene, this.camera);
        this.swapHeightBuffers();
      }
    }
    
    // Calculate normals
    this.quad.material = this.materials.calculateNormals;
    this.materials.calculateNormals.uniforms.uHeight.value = this.heightBuffers.read.texture;
    this.renderer.setRenderTarget(this.normalBuffer);
    this.renderer.render(this.scene, this.camera);
    
    // Calculate foam
    this.quad.material = this.materials.calculateFoam;
    this.materials.calculateFoam.uniforms.uHeight.value = this.heightBuffers.read.texture;
    this.materials.calculateFoam.uniforms.uVelocity.value = this.velocityBuffers.read.texture;
    this.materials.calculateFoam.uniforms.uPrevFoam.value = this.foamBuffer.texture;
    this.materials.calculateFoam.uniforms.uTime.value = this.time;
    
    const tempFoam = this.velocityBuffers.write; // Reuse as temp
    this.renderer.setRenderTarget(tempFoam);
    this.renderer.render(this.scene, this.camera);
    
    // Copy back to foam buffer
    this.quad.material = new THREE.MeshBasicMaterial({ map: tempFoam.texture });
    this.renderer.setRenderTarget(this.foamBuffer);
    this.renderer.render(this.scene, this.camera);
    
    // Final ocean rendering
    this.quad.material = this.materials.oceanDisplay;
    this.materials.oceanDisplay.uniforms.uHeight.value = this.heightBuffers.read.texture;
    this.materials.oceanDisplay.uniforms.uNormal.value = this.normalBuffer.texture;
    this.materials.oceanDisplay.uniforms.uFoam.value = this.foamBuffer.texture;
    this.materials.oceanDisplay.uniforms.uTime.value = this.time;
    
    // Update light direction
    const lightAngle = this.time * 0.1;
    this.materials.oceanDisplay.uniforms.uLightDir.value.set(
      Math.cos(lightAngle) * 0.5,
      0.8,
      Math.sin(lightAngle) * 0.5
    );
    
    this.renderer.setRenderTarget(this.displayRT);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }
  
  public getTexture(): THREE.Texture {
    return this.displayRT.texture;
  }
  
  public reset(): void {
    this.clear();
    this.waves = [];
    this.time = 0;
  }
  
  public dispose(): void {
    this.velocityBuffers.read.dispose();
    this.velocityBuffers.write.dispose();
    this.heightBuffers.read.dispose();
    this.heightBuffers.write.dispose();
    this.normalBuffer.dispose();
    this.foamBuffer.dispose();
    this.displayRT.dispose();
    this.quad.geometry.dispose();
    Object.values(this.materials).forEach(material => material.dispose());
  }
}