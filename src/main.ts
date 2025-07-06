import * as THREE from 'three';
// import { FluidSimulation } from './FluidSimulation';
import { DebugFluidSimulation as FluidSimulation } from './DebugFluidSimulation';
import { WEBGL } from './WebGLCheck';

class App {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private fluidSimulation: FluidSimulation | null = null;
    private plane: THREE.Mesh | null = null;
    
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
        try {
            console.log('Initializing Fluid Simulator...');
            this.init();
            this.setupEventListeners();
            this.animate();
            console.log('Fluid Simulator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Fluid Simulator:', error);
            this.showError('Failed to initialize: ' + error.message);
        }
    }
    
    private showError(message: string): void {
        const info = document.getElementById('info');
        if (info) {
            info.innerHTML = `<span style="color: red;">Error: ${message}</span>`;
        }
    }
    
    private init(): void {
        // Check WebGL support
        if (!WEBGL.isWebGLAvailable()) {
            throw new Error('WebGL is not supported in your browser');
        }
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);
        
        // Check renderer capabilities
        const gl = this.renderer.getContext();
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            console.log('GPU:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }
        
        // Check float texture support
        const floatTextureSupport = gl.getExtension('OES_texture_float');
        const halfFloatTextureSupport = gl.getExtension('OES_texture_half_float');
        console.log('Float texture support:', !!floatTextureSupport);
        console.log('Half float texture support:', !!halfFloatTextureSupport);
        
        // Setup scene and camera
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111); // Dark gray instead of black
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 1;
        
        try {
            // Initialize fluid simulation with smaller size for testing
            const simWidth = 256;
            const simHeight = 256;
            console.log(`Creating fluid simulation: ${simWidth}x${simHeight}`);
            this.fluidSimulation = new FluidSimulation(this.renderer, simWidth, simHeight);
            
            // Create a simple test plane first
            const geometry = new THREE.PlaneGeometry(2, 2);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                side: THREE.DoubleSide
            });
            this.plane = new THREE.Mesh(geometry, material);
            this.scene.add(this.plane);
            
            console.log('Test plane created');
            
            // Try to get density texture
            const densityTexture = this.fluidSimulation.getDensityTexture();
            if (densityTexture) {
                console.log('Density texture obtained:', densityTexture);
                material.map = densityTexture;
                material.needsUpdate = true;
            } else {
                console.error('Failed to get density texture');
            }
            
        } catch (error) {
            console.error('Failed to create fluid simulation:', error);
            throw error;
        }
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
        
        if (this.isMouseDown && this.fluidSimulation) {
            this.addSplat();
        }
    }
    
    private onMouseDown(event: MouseEvent): void {
        this.isMouseDown = true;
        this.updateMousePosition(event.clientX, event.clientY);
        if (this.fluidSimulation) {
            this.addSplat();
        }
    }
    
    private onMouseUp(): void {
        this.isMouseDown = false;
    }
    
    private onTouchMove(event: TouchEvent): void {
        event.preventDefault();
        const touch = event.touches[0];
        this.updateMousePosition(touch.clientX, touch.clientY);
        if (this.fluidSimulation) {
            this.addSplat();
        }
    }
    
    private onTouchStart(event: TouchEvent): void {
        event.preventDefault();
        this.isMouseDown = true;
        const touch = event.touches[0];
        this.updateMousePosition(touch.clientX, touch.clientY);
        if (this.fluidSimulation) {
            this.addSplat();
        }
    }
    
    private onTouchEnd(): void {
        this.isMouseDown = false;
    }
    
    private addSplat(): void {
        if (!this.fluidSimulation) return;
        
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
        
        console.log(`Added splat at (${this.mouse.x.toFixed(2)}, ${this.mouse.y.toFixed(2)}) with color`, color);
    }
    
    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        
        const dt = Math.min(this.clock.getDelta(), 0.016);
        
        if (this.fluidSimulation && this.plane) {
            // Update fluid simulation
            this.fluidSimulation.update(dt);
            
            // Update plane texture
            const material = this.plane.material as THREE.MeshBasicMaterial;
            const texture = this.fluidSimulation.getDensityTexture();
            if (texture && material.map !== texture) {
                material.map = texture;
                material.needsUpdate = true;
            }
            
            // Render fluid simulation first
            this.fluidSimulation.render();
        }
        
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