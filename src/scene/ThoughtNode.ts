import * as THREE from "three";

export class ThoughtNode {
  public mesh: THREE.Mesh;
  public id: string;
  private baseColor: THREE.Color;
  public expanded = false;

  constructor(id: string, colorHex = "#7AF7B8", radius = 14) {
    this.id = id;
    this.baseColor = new THREE.Color(colorHex);

    const geo = new THREE.IcosahedronGeometry(radius, 2);
    const mat = new THREE.MeshStandardMaterial({
      color: this.baseColor,
      metalness: 0.25,
      roughness: 0.35,
      emissive: this.baseColor.clone().multiplyScalar(0.06),
    });

    this.mesh = new THREE.Mesh(geo, mat);

    // subtle organic surface deformation (vertex noise) to look "biological"
    this.mesh.geometry = this.mesh.geometry.clone();
    const pos = this.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const n = 1 + (Math.random() - 0.5) * 0.08;
      pos.setXYZ(i, vx * n, vy * n, vz * n);
    }
    pos.needsUpdate = true;
  }

  setHover(on: boolean) {
    this.mesh.scale.setScalar(on ? 1.25 : 1.0);
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = on ? 2.0 : 0.6;
    mat.roughness = on ? 0.08 : 0.35;
  }

  setPosition(x: number, y: number, z: number) {
    this.mesh.position.set(x, y, z);
  }

  // small pop for expand
  expandInstant() {
    this.expanded = true;
    this.mesh.scale.setScalar(1.6);
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 3.0;
  }

  collapse() {
    this.expanded = false;
    this.mesh.scale.setScalar(1.0);
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.6;
  }
}
