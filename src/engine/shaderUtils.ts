import * as THREE from 'three';

export interface ShaderDefinition {
  vertex: string;
  fragment: string;
  uniforms: Record<string, { value: any }>;
}

export function createShaderPass(renderer: THREE.WebGLRenderer, shader: ShaderDefinition) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  
  const material = new THREE.ShaderMaterial({
    vertexShader: shader.vertex,
    fragmentShader: shader.fragment,
    uniforms: { ...shader.uniforms },
    depthTest: false,
    depthWrite: false,
  });
  
  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  
  return {
    render: (target: THREE.WebGLRenderTarget | null = null) => {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    },
    
    setUniforms: (uniforms: Record<string, any>) => {
      Object.entries(uniforms).forEach(([key, value]) => {
        if (material.uniforms[key]) {
          material.uniforms[key].value = value;
        } else {
          material.uniforms[key] = { value };
        }
      });
    },
    
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}