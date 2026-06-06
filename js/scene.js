import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.plantGroup = null;
    this.materials = new Map();
    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(8, 6, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 100;
    this.controls.target.set(0, 2, 0);

    this.setupSky();
    this.setupLights();
    this.setupGround();

    this.plantGroup = new THREE.Group();
    this.scene.add(this.plantGroup);

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupSky() {
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0xffffff) },
        offset: { value: 33 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
    this.scene.background = new THREE.Color(0x87ceeb);
  }

  setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sunLight.position.set(10, 20, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.shadow.camera.left = -20;
    this.sunLight.shadow.camera.right = 20;
    this.sunLight.shadow.camera.top = 20;
    this.sunLight.shadow.camera.bottom = -20;
    this.sunLight.shadow.bias = -0.0001;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight(0x7799ff, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x2d5a27, 0.4);
    this.scene.add(hemi);
  }

  setupGround() {
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d6b32,
      roughness: 0.9,
      metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x333333);
    gridHelper.position.y = 0.001;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0.5, g: 0.3, b: 0.1 };
  }

  getMaterial(colorHex) {
    if (!this.materials.has(colorHex)) {
      const rgb = this.hexToRgb(colorHex);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(rgb.r, rgb.g, rgb.b),
        roughness: 0.7,
        metalness: 0.0,
        flatShading: false
      });
      this.materials.set(colorHex, mat);
    }
    return this.materials.get(colorHex);
  }

  clearPlant() {
    while (this.plantGroup.children.length > 0) {
      const child = this.plantGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.plantGroup.remove(child);
    }
  }

  buildMesh(meshData) {
    this.clearPlant();

    if (!meshData) return;

    const { cylinders = [], leaves = [] } = meshData;
    const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
    cylGeo.translate(0, 0.5, 0);

    for (const cyl of cylinders) {
      const mat = this.getMaterial(cyl.color);
      const mesh = new THREE.Mesh(cylGeo.clone(), mat);
      mesh.position.set(cyl.start.x, cyl.start.y, cyl.start.z);
      mesh.scale.set(cyl.radiusBottom, cyl.height, cyl.radiusBottom);
      mesh.quaternion.set(cyl.quaternion.x, cyl.quaternion.y, cyl.quaternion.z, cyl.quaternion.w);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.plantGroup.add(mesh);
    }

    const leafGeo = new THREE.ConeGeometry(0.3, 1, 4);
    leafGeo.translate(0, 0.5, 0);

    for (const leaf of leaves) {
      const mat = this.getMaterial(leaf.color);
      const mesh = new THREE.Mesh(leafGeo.clone(), mat);
      mesh.position.set(leaf.position.x, leaf.position.y, leaf.position.z);
      mesh.scale.set(leaf.size * 0.5, leaf.size, leaf.size * 0.5);
      mesh.quaternion.set(leaf.quaternion.x, leaf.quaternion.y, leaf.quaternion.z, leaf.quaternion.w);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.plantGroup.add(mesh);
    }

    this.centerCamera();
  }

  centerCamera() {
    const box = new THREE.Box3().setFromObject(this.plantGroup);
    if (!isFinite(box.min.x)) {
      return;
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    this.controls.target.copy(center);
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraZ = (maxDim / 2) / Math.tan(fov / 2);
    const distance = cameraZ * 1.8;

    const dir = new THREE.Vector3(1, 0.7, 1).normalize();
    this.camera.position.copy(center).add(dir.multiplyScalar(distance));
    this.camera.near = maxDim / 100;
    this.camera.far = maxDim * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  getPlantMeshes() {
    return this.plantGroup.children;
  }
}
