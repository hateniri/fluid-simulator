import * as THREE from 'three';

export class SimpleTest {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private mesh: THREE.Mesh;
    
    constructor() {
        console.log('SimpleTest: Starting...');
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        document.body.appendChild(this.renderer.domElement);
        console.log('SimpleTest: Renderer created');
        
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;
        console.log('SimpleTest: Camera created');
        
        // Create geometry
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);
        console.log('SimpleTest: Mesh created and added to scene');
        
        // Start animation
        this.animate();
        console.log('SimpleTest: Animation started');
    }
    
    private animate = (): void => {
        requestAnimationFrame(this.animate);
        
        this.mesh.rotation.x += 0.01;
        this.mesh.rotation.y += 0.01;
        
        this.renderer.render(this.scene, this.camera);
    }
}