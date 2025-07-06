import * as THREE from 'three';
import { FluidSimulation } from './FluidSimulation';

class App {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private fluidSimulation: FluidSimulation;
    
    private mouse: THREE.Vector2 = new THREE.Vector2();
    private lastMouse: THREE.Vector2 = new THREE.Vector2();
    private mouseVelocity: THREE.Vector2 = new THREE.Vector2();
    private isMouseDown: boolean = false;
    
    private clock: THREE.Clock = new THREE.Clock();
    private colorIndex: number = 0;
    private colors: THREE.Vector3[] = [
        new THREE.Vector3(1, 0, 0),    // Red
        new THREE.Vector3(0, 1, 0),    // Green
        new THREE.Vector3(0, 0, 1),    // Blue
        new THREE.Vector3(1, 1, 0),    // Yellow
        new THREE.Vector3(1, 0, 1),    // Magenta
        new THREE.Vector3(0, 1, 1),    // Cyan
    ];
    
    constructor() {
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    private init(): void {
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);
        
        // Setup scene and camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 1;
        
        // Initialize fluid simulation
        const simWidth = 512;
        const simHeight = 512;
        this.fluidSimulation = new FluidSimulation(this.renderer, simWidth, simHeight);
        
        // Create display plane
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({
            map: this.fluidSimulation.getDensityTexture()
        });
        const plane = new THREE.Mesh(geometry, material);
        this.scene.add(plane);
    }
    
    private setupEventListeners(): void {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Touch events
        window.addEventListener('touchmove', this.onTouchMove.bind(this));
        window.addEventListener('touchstart', this.onTouchStart.bind(this));
        window.addEventListener('touchend', this.onTouchEnd.bind(this));
    }
    
    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    private updateMousePosition(clientX: number, clientY: number): void {
        this.lastMouse.copy(this.mouse);
        this.mouse.x = clientX / window.innerWidth;
        this.mouse.y = 1.0 - clientY / window.innerHeight;
        
        this.mouseVelocity.x = this.mouse.x - this.lastMouse.x;
        this.mouseVelocity.y = this.mouse.y - this.lastMouse.y;
    }
    
    private onMouseMove(event: MouseEvent): void {
        this.updateMousePosition(event.clientX, event.clientY);
        
        if (this.isMouseDown) {
            this.addSplat();
        }
    }
    
    private onMouseDown(event: MouseEvent): void {
        this.isMouseDown = true;
        this.updateMousePosition(event.clientX, event.clientY);
        this.addSplat();
    }
    
    private onMouseUp(): void {
        this.isMouseDown = false;
    }
    
    private onTouchMove(event: TouchEvent): void {
        event.preventDefault();
        const touch = event.touches[0];
        this.updateMousePosition(touch.clientX, touch.clientY);
        this.addSplat();
    }
    
    private onTouchStart(event: TouchEvent): void {
        event.preventDefault();
        this.isMouseDown = true;
        const touch = event.touches[0];
        this.updateMousePosition(touch.clientX, touch.clientY);
        this.addSplat();
    }
    
    private onTouchEnd(): void {
        this.isMouseDown = false;
    }
    
    private addSplat(): void {
        const color = this.colors[this.colorIndex];
        this.colorIndex = (this.colorIndex + 1) % this.colors.length;
        
        const velocityScale = 50.0;
        this.fluidSimulation.addSplat(
            this.mouse.x,
            this.mouse.y,
            this.mouseVelocity.x * velocityScale,
            this.mouseVelocity.y * velocityScale,
            color
        );
    }
    
    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        
        const dt = Math.min(this.clock.getDelta(), 0.016);
        
        // Update fluid simulation
        this.fluidSimulation.update(dt);
        
        // Render scene
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}