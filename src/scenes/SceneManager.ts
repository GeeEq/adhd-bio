import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { ThoughtNode } from "./ThoughtNode";

type Particle = { pos: THREE.Vector3; vel: THREE.Vector3; life: number; };

export class SceneManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private controls: OrbitControls;
  private ray = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private clock = new THREE.Clock();
  private canvas: HTMLCanvasElement;

  private nodes: ThoughtNode[] = [];
  private particles: Particle[] = [];
  private particleGeo?: THREE.BufferGeometry;
  private particleMat?: THREE.PointsMaterial;
  private particlePoints?: THREE.Points;

  // drag state
  private dragging = false;
  private dragNode: ThoughtNode | null = null;
  private dragPlane = new THREE.Plane();
  private dragOffset = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 4000);
    this.camera.position.set(0, 80, 420);

    // lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.14));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(120, 180, 100);
    this.scene.add(key);
    const fill = new THREE.PointLight(0x7af7b8, 0.12, 800);
    fill.position.set(-120, -80, 200);
    this.scene.add(fill);

    // controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 900;

    window.addEventListener("resize", () => this.onResize());
    canvas.addEventListener("pointermove", (e) => this.onPointerMove(e), { passive: true });
    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointerup", () => this.onPointerUp());

    this.buildNodes();
    this.buildParticleSystem();

    this.tick();
  }

  private buildNodes() {
    // create nodes in organic cluster layout
    const colors = ["#7AF7B8","#C2A1FF","#FFD57A","#8AE3FF","#FF7AA2","#FFB48F"];
    const count = 8;
    for (let i=0;i<count;i++){
      const n = new ThoughtNode(`t${i}`, colors[i % colors.length], 12 + Math.random()*8);
      const theta = Math.random()*Math.PI*2;
      const r = 120 + Math.random()*160;
      const x = Math.cos(theta)*r;
      const z = Math.sin(theta)*r*0.6;
      const y = (Math.random()-0.5) * 40;
      n.setPosition(x,y,z);
      this.nodes.push(n);
      this.scene.add(n.mesh);
    }
  }

  private buildParticleSystem() {
    // start empty buffer for up-to ~400 particles
    const max = 600;
    this.particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(max * 3);
    this.particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.particleMat = new THREE.PointsMaterial({ size: 6, vertexColors: false, map: this.makeSprite(), transparent: true, blending: THREE.AdditiveBlending });
    this.particlePoints = new THREE.Points(this.particleGeo, this.particleMat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);
  }

  private makeSprite() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.2, "rgba(190,250,230,0.7)");
    grad.addColorStop(1, "rgba(120,250,190,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,size,size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onPointerMove(ev: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.dragging && this.dragNode) {
      // project pointer to plane
      this.ray.setFromCamera(this.mouse, this.camera);
      const intersect = new THREE.Vector3();
      this.ray.ray.intersectPlane(this.dragPlane, intersect);
      const newPos = intersect.sub(this.dragOffset);
      this.dragNode.setPosition(newPos.x, newPos.y, newPos.z);
    }
  }

  private onPointerDown(ev: PointerEvent) {
    // pick
    this.ray.setFromCamera(this.mouse, this.camera);
    const objs = this.nodes.map(n => n.mesh);
    const hits = this.ray.intersectObjects(objs, true);
    if (hits.length) {
      const hit = hits[0];
      const node = this.nodes.find(n => n.mesh === (hit.object as any) || hit.object.parent === n.mesh);
      if (!node) return;

      // start drag: compute drag plane based on camera normal at hit point
      this.dragging = true;
      this.dragNode = node;
      const planeNormal = this.camera.getWorldDirection(new THREE.Vector3()).clone();
      this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, hit.point);
      // compute offset between hitpoint and mesh position, to keep grab point consistent
      this.dragOffset.copy(hit.point).sub(node.mesh.position);

      // short-circuit: if pointerdown & not move (click), expand particle burst and node pop
      // We'll schedule a small timeout to decide click vs drag:
      setTimeout(() => {
        if (this.dragging && this.dragNode === node) {
          // treat as drag still in progress — do nothing
        }
      }, 160);
    } else {
      // clicked empty space — maybe collapse anything expanded
      this.nodes.forEach(n => n.collapse());
    }
  }

  private onPointerUp() {
    if (this.dragging && this.dragNode) {
      // if pointer up quickly (no large movement) treat as click/expand
      // we'll detect movement by comparing distance to original maybe; for simplicity: expand on release
      this.expandNode(this.dragNode);
    }
    this.dragging = false;
    this.dragNode = null;
  }

  private expandNode(node: ThoughtNode) {
    // visual expand
    node.expandInstant();

    // spawn burst particles at node pos
    const origin = node.mesh.getWorldPosition(new THREE.Vector3());
    for (let i=0;i<120;i++){
      const dir = new THREE.Vector3((Math.random()-0.5)*2, (Math.random()-0.3)*2, (Math.random()-0.5)*2).normalize();
      const speed = 40 + Math.random()*200;
      this.particles.push({ pos: origin.clone(), vel: dir.multiplyScalar(speed), life: 0.9 + Math.random()*0.9 });
    }
  }

  private updateParticles(dt: number) {
    const positions = this.particleGeo!.attributes.position.array as Float32Array;
    let idx = 0;
    for (let i=0;i<this.particles.length;i++){
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        // remove particle
        this.particles.splice(i,1);
        i--;
        continue;
      }
      // simple physics: velocity damp + gravity-like sink
      p.vel.multiplyScalar(0.98);
      p.vel.y -= 40 * dt;
      p.pos.addScaledVector(p.vel, dt);
      positions[idx++] = p.pos.x;
      positions[idx++] = p.pos.y;
      positions[idx++] = p.pos.z;
    }
    // zero rest of buffer
    const maxCount = (this.particleGeo!.attributes.position.count);
    for (let j = (this.particles.length*3); j < maxCount*3; j++) positions[j] = 0;
    this.particleGeo!.attributes.position.needsUpdate = true;

    // fade particle size by number (optional)
    if (this.particleMat) {
      this.particleMat.size = 6;
      this.particleMat.opacity = 1.0;
    }
  }

  private tick = () => {
    requestAnimationFrame(this.tick);
    const dt = Math.min(0.04, this.clock.getDelta());
    const t = this.clock.getElapsedTime();

    // gentle orbiting motion for nodes (if not dragging)
    this.nodes.forEach((n, i) => {
      if (!this.dragging || this.dragNode !== n) {
        const phase = i * 0.9 + t * 0.25;
        const r = 140 + (i * 8);
        const x = Math.cos(phase) * r;
        const z = Math.sin(phase) * r * 0.7;
        const y = Math.sin(phase * 0.6 + i) * 18;
        n.setPosition(x,y,z);
      }
    });

    // hover detection
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.nodes.map(n=> n.mesh), true);
    const hovered = hits.length ? (this.nodes.find(n => n.mesh === hits[0].object || hits[0].object.parent === n.mesh)!) : null;
    this.nodes.forEach(n => n.setHover(n === hovered));

    // update particles
    this.updateParticles(dt);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
