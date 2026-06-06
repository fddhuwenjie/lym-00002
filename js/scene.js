import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SEASONS = {
  spring: {
    name: '春季',
    stemColor: 0x8B7355,
    leafColors: [0x90EE90, 0x98FB98, 0x00FA9A, 0x7FFF00],
    leafDensity: 0.5,
    skyTop: 0x87CEEB,
    skyBottom: 0xE0FFFF,
    ambientIntensity: 0.5,
    groundColor: 0x4a7c3a,
    sunIntensity: 1.0
  },
  summer: {
    name: '夏季',
    stemColor: 0x8B4513,
    leafColors: [0x228B22, 0x006400, 0x2E8B57, 0x3CB371],
    leafDensity: 1.0,
    skyTop: 0x0077ff,
    skyBottom: 0xffffff,
    ambientIntensity: 0.6,
    groundColor: 0x3d6b32,
    sunIntensity: 1.3
  },
  autumn: {
    name: '秋季',
    stemColor: 0x654321,
    leafColors: [0xFF4500, 0xFF6347, 0xFFD700, 0xFFA500, 0x8B0000, 0xFF8C00],
    leafDensity: 0.7,
    skyTop: 0x4682B4,
    skyBottom: 0xFFE4B5,
    ambientIntensity: 0.4,
    groundColor: 0x8B7355,
    sunIntensity: 0.9
  },
  winter: {
    name: '冬季',
    stemColor: 0x696969,
    leafColors: [0xFFFFFF],
    leafDensity: 0.0,
    skyTop: 0xB0C4DE,
    skyBottom: 0xF0F8FF,
    ambientIntensity: 0.35,
    groundColor: 0xFFFFFF,
    sunIntensity: 0.7
  }
};

const VIEW_POSITIONS = {
  front: { pos: [0, 2, 10], target: [0, 2, 0] },
  back: { pos: [0, 2, -10], target: [0, 2, 0] },
  left: { pos: [-10, 2, 0], target: [0, 2, 0] },
  right: { pos: [10, 2, 0], target: [0, 2, 0] },
  top: { pos: [0, 12, 0.01], target: [0, 2, 0] },
  bottom: { pos: [0, -8, 0.01], target: [0, 2, 0] }
};

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.plantGroup = null;
    this.materials = new Map();
    this.allIterationData = null;
    this.growthAnimation = null;
    this.compareMode = false;
    this.compareScenes = [];
    this.currentSeason = 'summer';
    this.windStrength = 0;
    this.windDirection = new THREE.Vector3(0, 0, 1);
    this.time = 0;
    this.plantElements = [];
    this.originalPositions = [];
    this.originalQuaternions = [];
    this.isGifRecording = false;
    this.gifFrames = [];
    this.gifProgressCallback = null;
    this.seasonConfig = SEASONS.summer;
    this.init();
  }

  init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(8, 6, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
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

    this.cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
    this.cylGeo.translate(0, 0.5, 0);
    this.leafGeo = this.createLeafGeometry();
    this.leafGeo.translate(0, 0.5, 0);

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupSky() {
    const config = this.seasonConfig;
    const skyGeo = new THREE.SphereGeometry(500, 32, 32);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(config.skyTop) },
        bottomColor: { value: new THREE.Color(config.skyBottom) },
        offset: { value: 33 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelMatrix * vec4(position, 1.0);
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
    const sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.scene.add(sky);
    this.scene.background = new THREE.Color(config.skyBottom);
  }

  setupLights() {
    const config = this.seasonConfig;
    this.ambientLight = new THREE.AmbientLight(0xffffff, config.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, config.sunIntensity);
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

    this.hemiLight = new THREE.HemisphereLight(config.skyTop, config.groundColor, 0.4);
    this.scene.add(this.hemiLight);
  }

  setupGround() {
    const config = this.seasonConfig;
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: config.groundColor,
      roughness: 0.9,
      metalness: 0.0
    });
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
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

  createLeafGeometry() {
    const shape = new THREE.Shape();
    
    const width = 0.4;
    const height = 1.0;
    
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(width * 0.3, height * 0.15, width * 0.6, height * 0.3);
    shape.quadraticCurveTo(width * 0.8, height * 0.5, width * 0.6, height * 0.7);
    shape.quadraticCurveTo(width * 0.3, height * 0.9, 0, height);
    shape.quadraticCurveTo(-width * 0.3, height * 0.9, -width * 0.6, height * 0.7);
    shape.quadraticCurveTo(-width * 0.8, height * 0.5, -width * 0.6, height * 0.3);
    shape.quadraticCurveTo(-width * 0.3, height * 0.15, 0, 0);

    const extrudeSettings = {
      depth: 0.02,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
      curveSegments: 8
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(-Math.PI / 2);
    geometry.center();
    
    return geometry;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0.5, g: 0.3, b: 0.1 };
  }

  getSeasonalLeafColor() {
    const colors = this.seasonConfig.leafColors;
    const colorHex = colors[Math.floor(Math.random() * colors.length)];
    return '#' + colorHex.toString(16).padStart(6, '0');
  }

  getMaterial(colorHex, isLeaf = false) {
    const key = `${colorHex}_${isLeaf ? 'leaf' : 'stem'}`;
    if (!this.materials.has(key)) {
      const rgb = this.hexToRgb(colorHex);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(rgb.r, rgb.g, rgb.b),
        roughness: isLeaf ? 0.5 : 0.7,
        metalness: 0.0,
        flatShading: false,
        transparent: isLeaf,
        opacity: isLeaf ? 0.95 : 1.0,
        side: isLeaf ? THREE.DoubleSide : THREE.FrontSide
      });
      this.materials.set(key, mat);
    }
    return this.materials.get(key);
  }

  setSeason(season) {
    if (!SEASONS[season]) return;
    this.currentSeason = season;
    this.seasonConfig = SEASONS[season];
    const config = this.seasonConfig;

    this.skyMat.uniforms.topColor.value.setHex(config.skyTop);
    this.skyMat.uniforms.bottomColor.value.setHex(config.skyBottom);
    this.scene.background.setHex(config.skyBottom);

    this.ambientLight.intensity = config.ambientIntensity;
    this.sunLight.intensity = config.sunIntensity;
    this.hemiLight.color.setHex(config.skyTop);
    this.hemiLight.groundColor.setHex(config.groundColor);

    this.groundMat.color.setHex(config.groundColor);

    this.applySeasonToPlant();
    this.applySeasonToCompareScenes();
  }

  applySeasonToPlant() {
    const config = this.seasonConfig;
    const stemColorHex = '#' + config.stemColor.toString(16).padStart(6, '0');

    this.plantGroup.children.forEach(child => {
      if (child.userData.isLeaf) {
        if (config.leafDensity === 0) {
          child.visible = false;
        } else {
          child.visible = Math.random() < config.leafDensity;
          if (child.visible) {
            const newColor = this.getSeasonalLeafColor();
            child.material.color.set(this.hexToRgb(newColor).r, this.hexToRgb(newColor).g, this.hexToRgb(newColor).b);
          }
        }
      } else {
        child.material.color.setHex(config.stemColor);
      }
    });
  }

  applySeasonToCompareScenes() {
    this.compareScenes.forEach(cs => {
      const config = SEASONS[this.currentSeason];
      cs.plantGroup.children.forEach(child => {
        if (child.userData.isLeaf) {
          child.visible = Math.random() < config.leafDensity;
          if (child.visible) {
            const newColor = this.getSeasonalLeafColor();
            child.material.color.set(this.hexToRgb(newColor).r, this.hexToRgb(newColor).g, this.hexToRgb(newColor).b);
          }
        } else {
          child.material.color.setHex(config.stemColor);
        }
      });
    });
  }

  setWind(strength, direction = 'z+') {
    this.windStrength = Math.max(0, Math.min(10, strength));

    switch (direction) {
      case 'x+': this.windDirection.set(1, 0, 0); break;
      case 'x-': this.windDirection.set(-1, 0, 0); break;
      case 'z+': this.windDirection.set(0, 0, 1); break;
      case 'z-': this.windDirection.set(0, 0, -1); break;
      default: this.windDirection.set(0, 0, 1);
    }
  }

  calculateDistanceFromRoot(position) {
    return Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
  }

  updateWindAnimation() {
    if (this.windStrength <= 0) return;

    const t = this.time * 2;
    const maxDistance = 15;
    const maxAngle = (this.windStrength / 10) * 0.3;

    this.plantElements.forEach((mesh, index) => {
      const origPos = this.originalPositions[index];
      const origQuat = this.originalQuaternions[index];
      if (!origPos || !origQuat) return;

      const dist = this.calculateDistanceFromRoot(origPos);
      const distFactor = Math.min(dist / maxDistance, 1.0);
      const amplitude = maxAngle * distFactor;

      if (amplitude > 0.001) {
        const phase = dist * 0.5;
        const swingX = Math.sin(t + phase) * amplitude;
        const swingZ = Math.cos(t * 0.7 + phase) * amplitude * 0.5;

        const windAxis = new THREE.Vector3(
          -this.windDirection.z * swingX - this.windDirection.x * swingZ,
          0,
          this.windDirection.x * swingX
        ).normalize();

        const totalAngle = Math.sqrt(swingX * swingX + swingZ * swingZ);
        const swingQuat = new THREE.Quaternion().setFromAxisAngle(windAxis, totalAngle);

        mesh.quaternion.copy(origQuat).multiply(swingQuat);

        if (mesh.userData.isLeaf) {
          mesh.rotation.z += Math.sin(t * 3 + index) * 0.1;
        }
      }
    });

    this.compareScenes.forEach(cs => {
      cs.plantElements.forEach((mesh, index) => {
        const origPos = cs.originalPositions[index];
        const origQuat = cs.originalQuaternions[index];
        if (!origPos || !origQuat) return;

        const dist = this.calculateDistanceFromRoot(origPos);
        const distFactor = Math.min(dist / maxDistance, 1.0);
        const amplitude = maxAngle * distFactor;

        if (amplitude > 0.001) {
          const phase = dist * 0.5;
          const swingX = Math.sin(t + phase) * amplitude;
          const swingZ = Math.cos(t * 0.7 + phase) * amplitude * 0.5;

          const windAxis = new THREE.Vector3(
            -this.windDirection.z * swingX - this.windDirection.x * swingZ,
            0,
            this.windDirection.x * swingX
          ).normalize();

          const totalAngle = Math.sqrt(swingX * swingX + swingZ * swingZ);
          const swingQuat = new THREE.Quaternion().setFromAxisAngle(windAxis, totalAngle);

          mesh.quaternion.copy(origQuat).multiply(swingQuat);

          if (mesh.userData.isLeaf) {
            mesh.rotation.z += Math.sin(t * 3 + index) * 0.1;
          }
        }
      });
    });
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
    this.plantElements = [];
    this.originalPositions = [];
    this.originalQuaternions = [];
  }

  buildMesh(meshData, animateGrowth = false) {
    this.clearPlant();

    if (!meshData) return;

    const { cylinders = [], leaves = [] } = meshData;
    const config = this.seasonConfig;
    const stemColorHex = '#' + config.stemColor.toString(16).padStart(6, '0');

    for (const cyl of cylinders) {
      const color = this.currentSeason === 'summer' ? cyl.color : stemColorHex;
      const mat = this.getMaterial(color, false);
      const mesh = new THREE.Mesh(this.cylGeo.clone(), mat);
      mesh.position.set(cyl.start.x, cyl.start.y, cyl.start.z);

      if (animateGrowth) {
        mesh.scale.set(0.001, 0.001, 0.001);
        mesh.userData.targetScale = new THREE.Vector3(cyl.radiusBottom, cyl.height, cyl.radiusBottom);
        mesh.userData.growDelay = Math.random() * 0.3;
      } else {
        mesh.scale.set(cyl.radiusBottom, cyl.height, cyl.radiusBottom);
      }

      mesh.quaternion.set(cyl.quaternion.x, cyl.quaternion.y, cyl.quaternion.z, cyl.quaternion.w);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.isLeaf = false;
      this.plantGroup.add(mesh);
      this.plantElements.push(mesh);
      this.originalPositions.push(mesh.position.clone());
      this.originalQuaternions.push(mesh.quaternion.clone());
    }

    if (config.leafDensity > 0) {
      for (const leaf of leaves) {
        if (Math.random() > config.leafDensity) continue;

        const leafColor = this.currentSeason === 'summer' ? leaf.color : this.getSeasonalLeafColor();
        const mat = this.getMaterial(leafColor, true);
        const mesh = new THREE.Mesh(this.leafGeo.clone(), mat);
        mesh.position.set(leaf.position.x, leaf.position.y, leaf.position.z);

        if (animateGrowth) {
          mesh.scale.set(0.001, 0.001, 0.001);
          mesh.userData.targetScale = new THREE.Vector3(leaf.size * 1.0, leaf.size * 1.5, leaf.size * 1.0);
          mesh.userData.growDelay = 0.5 + Math.random() * 0.3;
        } else {
          mesh.scale.set(leaf.size * 1.0, leaf.size * 1.5, leaf.size * 1.0);
        }

        mesh.quaternion.set(leaf.quaternion.x, leaf.quaternion.y, leaf.quaternion.z, leaf.quaternion.w);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isLeaf = true;
        this.plantGroup.add(mesh);
        this.plantElements.push(mesh);
        this.originalPositions.push(mesh.position.clone());
        this.originalQuaternions.push(mesh.quaternion.clone());
      }
    }

    this.centerCamera();
  }

  startGrowthAnimation(allMeshData, speed = 1.5, onProgress) {
    this.allIterationData = allMeshData;
    this.growthAnimation = {
      currentIteration: 0,
      targetIteration: allMeshData.length - 1,
      iterationStartTime: 0,
      iterationDuration: 1500 / speed,
      elementStartTime: 0,
      elementDuration: 800 / speed,
      growingElements: [],
      state: 'waiting',
      onProgress: onProgress
    };

    this.buildMesh(allMeshData[0], false);
  }

  updateGrowthAnimation(deltaTime) {
    if (!this.growthAnimation) return;

    const ga = this.growthAnimation;

    if (ga.state === 'waiting') {
      ga.state = 'growing_iteration';
      ga.iterationStartTime = this.time * 1000;
      this.buildMesh(this.allIterationData[ga.currentIteration + 1], true);

      if (ga.onProgress) {
        ga.onProgress(ga.currentIteration + 1, ga.targetIteration);
      }
    }

    if (ga.state === 'growing_iteration') {
      const elapsed = this.time * 1000 - ga.iterationStartTime;
      let allDone = true;

      this.plantElements.forEach(mesh => {
        if (mesh.userData.targetScale) {
          const delay = (mesh.userData.growDelay || 0) * ga.iterationDuration;
          const elementElapsed = elapsed - delay;

          if (elementElapsed > 0) {
            const progress = Math.min(elementElapsed / ga.elementDuration, 1.0);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const target = mesh.userData.targetScale;

            mesh.scale.lerpVectors(
              new THREE.Vector3(0.001, 0.001, 0.001),
              target,
              easeProgress
            );

            if (progress < 1.0) allDone = false;
          } else {
            allDone = false;
          }
        }
      });

      if (allDone) {
        ga.currentIteration++;

        if (ga.currentIteration >= ga.targetIteration) {
          this.stopGrowthAnimation();
          if (ga.onProgress) {
            ga.onProgress(ga.currentIteration, ga.targetIteration, true);
          }
        } else {
          ga.state = 'waiting';
        }
      }
    }
  }

  stopGrowthAnimation() {
    if (this.growthAnimation) {
      this.plantElements.forEach(mesh => {
        if (mesh.userData.targetScale) {
          mesh.scale.copy(mesh.userData.targetScale);
        }
      });
      this.growthAnimation = null;
    }
  }

  setCompareMode(enabled, count = 2, presetNames = [], getPresetConfig) {
    this.compareMode = enabled;

    this.compareScenes.forEach(cs => {
      if (cs.container) {
        cs.container.remove();
      }
    });
    this.compareScenes = [];

    if (!enabled) {
      this.container.style.display = '';
      this.renderer.domElement.style.display = '';
      return;
    }

    this.renderer.domElement.style.display = 'none';
    this.container.classList.add('compare-mode', `count-${count}`);

    const presetDisplayNames = {
      'binary-tree': '二叉树',
      'pythagoras': '毕达哥拉斯树',
      'fern': '蕨类',
      'koch': 'Koch曲线',
      'dragon': '龙曲线',
      'sierpinski': 'Sierpinski',
      'hilbert3d': 'Hilbert 3D'
    };

    for (let i = 0; i < count; i++) {
      const viewport = document.createElement('div');
      viewport.className = 'compare-viewport';
      this.container.appendChild(viewport);

      const label = document.createElement('div');
      label.className = 'compare-label';
      const presetName = presetNames[i] || presetNames[0];
      label.textContent = presetDisplayNames[presetName] || presetName;
      viewport.appendChild(label);

      const scene = new THREE.Scene();
      scene.background = this.scene.background.clone();

      const camera = this.camera.clone();
      camera.aspect = viewport.clientWidth / viewport.clientHeight;
      camera.updateProjectionMatrix();

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(viewport.clientWidth, viewport.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      viewport.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 2;
      controls.maxDistance = 100;
      controls.target.set(0, 2, 0);

      controls.addEventListener('change', () => {
        this.compareScenes.forEach(cs => {
          if (cs.controls !== controls) {
            cs.camera.position.copy(camera.position);
            cs.controls.target.copy(controls.target);
          }
        });
        this.camera.position.copy(camera.position);
        this.controls.target.copy(controls.target);
      });

      this.controls.addEventListener('change', () => {
        this.compareScenes.forEach(cs => {
          cs.camera.position.copy(this.camera.position);
          cs.controls.target.copy(this.controls.target);
        });
      });

      const sunLight = this.sunLight.clone();
      scene.add(sunLight);
      scene.add(this.ambientLight.clone());
      scene.add(this.hemiLight.clone());

      const groundGeo = new THREE.PlaneGeometry(200, 200);
      const groundMat = this.groundMat.clone();
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.01;
      ground.receiveShadow = true;
      scene.add(ground);

      const plantGroup = new THREE.Group();
      scene.add(plantGroup);

      const cs = {
        container: viewport,
        scene,
        camera,
        renderer,
        controls,
        plantGroup,
        plantElements: [],
        originalPositions: [],
        originalQuaternions: []
      };

      this.compareScenes.push(cs);

      if (getPresetConfig && presetNames[i]) {
        const config = getPresetConfig(presetNames[i]);
        if (config) {
          this.buildCompareMesh(cs, config);
        }
      }
    }
  }

  buildCompareMesh(cs, meshData) {
    while (cs.plantGroup.children.length > 0) {
      const child = cs.plantGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      cs.plantGroup.remove(child);
    }
    cs.plantElements = [];
    cs.originalPositions = [];
    cs.originalQuaternions = [];

    if (!meshData) return;

    const { cylinders = [], leaves = [] } = meshData;
    const config = this.seasonConfig;
    const stemColorHex = '#' + config.stemColor.toString(16).padStart(6, '0');

    for (const cyl of cylinders) {
      const color = this.currentSeason === 'summer' ? cyl.color : stemColorHex;
      const mat = this.getMaterial(color, false);
      const mesh = new THREE.Mesh(this.cylGeo.clone(), mat);
      mesh.position.set(cyl.start.x, cyl.start.y, cyl.start.z);
      mesh.scale.set(cyl.radiusBottom, cyl.height, cyl.radiusBottom);
      mesh.quaternion.set(cyl.quaternion.x, cyl.quaternion.y, cyl.quaternion.z, cyl.quaternion.w);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.isLeaf = false;
      cs.plantGroup.add(mesh);
      cs.plantElements.push(mesh);
      cs.originalPositions.push(mesh.position.clone());
      cs.originalQuaternions.push(mesh.quaternion.clone());
    }

    if (config.leafDensity > 0) {
      for (const leaf of leaves) {
        if (Math.random() > config.leafDensity) continue;

        const leafColor = this.currentSeason === 'summer' ? leaf.color : this.getSeasonalLeafColor();
        const mat = this.getMaterial(leafColor, true);
        const mesh = new THREE.Mesh(this.leafGeo.clone(), mat);
        mesh.position.set(leaf.position.x, leaf.position.y, leaf.position.z);
        mesh.scale.set(leaf.size * 1.0, leaf.size * 1.5, leaf.size * 1.0);
        mesh.quaternion.set(leaf.quaternion.x, leaf.quaternion.y, leaf.quaternion.z, leaf.quaternion.w);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.isLeaf = true;
        cs.plantGroup.add(mesh);
        cs.plantElements.push(mesh);
        cs.originalPositions.push(mesh.position.clone());
        cs.originalQuaternions.push(mesh.quaternion.clone());
      }
    }

    const box = new THREE.Box3().setFromObject(cs.plantGroup);
    if (isFinite(box.min.x)) {
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      cs.controls.target.copy(center);
      const fov = cs.camera.fov * (Math.PI / 180);
      const cameraZ = (maxDim / 2) / Math.tan(fov / 2);
      const distance = cameraZ * 1.8;

      const dir = new THREE.Vector3(1, 0.7, 1).normalize();
      cs.camera.position.copy(center).add(dir.multiplyScalar(distance));
      cs.camera.near = maxDim / 100;
      cs.camera.far = maxDim * 100;
      cs.camera.updateProjectionMatrix();
    }
  }

  updateComparePreset(index, meshData) {
    if (this.compareScenes[index]) {
      this.buildCompareMesh(this.compareScenes[index], meshData);
    }
  }

  centerCamera() {
    const box = new THREE.Box3().setFromObject(this.plantGroup);
    if (!isFinite(box.min.x)) return;

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

    if (!this.compareMode) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    } else {
      this.compareScenes.forEach((cs, i) => {
        cs.camera.aspect = cs.container.clientWidth / cs.container.clientHeight;
        cs.camera.updateProjectionMatrix();
        cs.renderer.setSize(cs.container.clientWidth, cs.container.clientHeight);
      });
    }
  }

  captureScreenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  async capture6Views() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 400;
    canvas.width = size * 3;
    canvas.height = size * 2;

    const originalPos = this.camera.position.clone();
    const originalTarget = this.controls.target.clone();

    const views = [
      { key: 'front', x: 0, y: 0, label: '正' },
      { key: 'back', x: 1, y: 0, label: '反' },
      { key: 'left', x: 2, y: 0, label: '左' },
      { key: 'right', x: 0, y: 1, label: '右' },
      { key: 'top', x: 1, y: 1, label: '顶' },
      { key: 'bottom', x: 2, y: 1, label: '底' }
    ];

    const box = new THREE.Box3().setFromObject(this.plantGroup);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.8;

    for (const view of views) {
      const vp = VIEW_POSITIONS[view.key];
      const dir = new THREE.Vector3(...vp.pos).normalize();
      this.camera.position.copy(center).add(dir.multiplyScalar(distance));
      this.controls.target.set(...vp.target);
      this.controls.target.add(center);
      this.controls.target.y -= 2;
      this.controls.update();
      this.camera.lookAt(this.controls.target);

      this.renderer.render(this.scene, this.camera);
      const dataUrl = this.renderer.domElement.toDataURL('image/png');

      const img = new Image();
      await new Promise(resolve => {
        img.onload = resolve;
        img.src = dataUrl;
      });

      ctx.drawImage(img, view.x * size, view.y * size, size, size);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(view.x * size + 10, view.y * size + 10, 40, 24);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(view.label, view.x * size + 20, view.y * size + 27);
    }

    this.camera.position.copy(originalPos);
    this.controls.target.copy(originalTarget);
    this.controls.update();

    return canvas.toDataURL('image/png');
  }

  startGifRecording(duration = 6, fps = 15, onProgress) {
    this.isGifRecording = true;
    this.gifFrames = [];
    this.gifProgressCallback = onProgress;

    const originalPos = this.camera.position.clone();
    const originalTarget = this.controls.target.clone();

    const box = new THREE.Box3().setFromObject(this.plantGroup);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.8;

    const totalFrames = duration * fps;
    this.gifRecordingState = {
      startTime: this.time,
      duration,
      fps,
      totalFrames,
      currentFrame: 0,
      center,
      distance,
      originalPos,
      originalTarget
    };

    const overlay = document.createElement('div');
    overlay.className = 'gif-recording-overlay';
    overlay.id = 'gif-recording-overlay';
    overlay.innerHTML = '<div class="recording-dot"></div><span>REC</span>';
    this.container.appendChild(overlay);
  }

  updateGifRecording() {
    if (!this.isGifRecording || !this.gifRecordingState) return;

    const state = this.gifRecordingState;
    const frameInterval = 1 / state.fps;
    const elapsed = this.time - state.startTime;
    const targetFrame = Math.floor(elapsed / frameInterval);

    if (targetFrame > state.currentFrame && targetFrame < state.totalFrames) {
      const angle = (targetFrame / state.totalFrames) * Math.PI * 2;
      const x = Math.cos(angle) * state.distance;
      const z = Math.sin(angle) * state.distance;
      this.camera.position.set(x + state.center.x, state.center.y + 3, z + state.center.z);
      this.controls.target.copy(state.center);
      this.controls.update();
      this.camera.lookAt(state.center);

      this.renderer.render(this.scene, this.camera);
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.renderer.domElement, 0, 0, canvas.width, canvas.height);
      this.gifFrames.push(canvas);

      state.currentFrame = targetFrame;

      if (this.gifProgressCallback) {
        this.gifProgressCallback(Math.floor((targetFrame / state.totalFrames) * 100));
      }
    }

    if (targetFrame >= state.totalFrames) {
      this.finishGifRecording();
    }
  }

  finishGifRecording() {
    const state = this.gifRecordingState;
    this.camera.position.copy(state.originalPos);
    this.controls.target.copy(state.originalTarget);
    this.controls.update();

    const overlay = document.getElementById('gif-recording-overlay');
    if (overlay) overlay.remove();

    this.isGifRecording = false;
    const frames = this.gifFrames;
    this.gifFrames = [];
    this.gifRecordingState = null;

    this.createGifFromFrames(frames, state.fps);
  }

  async createGifFromFrames(frames, fps) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = frames[0].width;
    canvas.height = frames[0].height;

    const delay = Math.round(100 / fps);
    let gifData = this.buildGifHeader(canvas.width, canvas.height);

    for (let i = 0; i < frames.length; i++) {
      ctx.drawImage(frames[i], 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const quantized = this.quantizeImage(imageData);

      if (i === 0) {
        gifData += this.buildGifColorTable(quantized.palette);
        gifData += this.buildGifImageDescriptor(canvas.width, canvas.height);
        gifData += this.buildGifImageData(quantized.pixels, canvas.width, canvas.height);
      } else {
        gifData += this.buildGifGraphicsControlExtension(delay);
        gifData += this.buildGifImageDescriptor(canvas.width, canvas.height);
        gifData += this.buildGifImageData(quantized.pixels, canvas.width, canvas.height);
      }

      if (this.gifProgressCallback) {
        this.gifProgressCallback(90 + Math.floor((i / frames.length) * 10));
      }
    }

    gifData += String.fromCharCode(0x3B);

    const blob = new Blob([gifData], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lsystem-360-${Date.now()}.gif`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (this.gifProgressCallback) {
      this.gifProgressCallback(100, true);
    }
  }

  buildGifHeader(width, height) {
    const signature = 'GIF89a';
    const packed = 0xF7;
    const bgIndex = 0;
    const aspect = 0;

    let header = signature;
    header += String.fromCharCode(width & 0xFF, (width >> 8) & 0xFF);
    header += String.fromCharCode(height & 0xFF, (height >> 8) & 0xFF);
    header += String.fromCharCode(packed, bgIndex, aspect);
    return header;
  }

  buildGifColorTable(palette) {
    let table = '';
    for (let i = 0; i < 256; i++) {
      const color = palette[i] || [0, 0, 0];
      table += String.fromCharCode(color[0], color[1], color[2]);
    }
    return table;
  }

  buildGifImageDescriptor(width, height) {
    let desc = String.fromCharCode(0x2C);
    desc += String.fromCharCode(0, 0, 0, 0);
    desc += String.fromCharCode(width & 0xFF, (width >> 8) & 0xFF);
    desc += String.fromCharCode(height & 0xFF, (height >> 8) & 0xFF);
    desc += String.fromCharCode(0x00);
    return desc;
  }

  buildGifGraphicsControlExtension(delay) {
    let ext = String.fromCharCode(0x21, 0xF9, 0x04);
    ext += String.fromCharCode(0x04);
    ext += String.fromCharCode(delay & 0xFF, (delay >> 8) & 0xFF);
    ext += String.fromCharCode(0, 0);
    return ext;
  }

  buildGifImageData(pixels, width, height) {
    const minCodeSize = 8;
    let data = String.fromCharCode(minCodeSize);

    const clearCode = 256;
    const eoiCode = 257;
    let nextCode = 258;
    let codeSize = minCodeSize + 1;

    let dict = {};
    for (let i = 0; i < 256; i++) {
      dict[String.fromCharCode(i)] = i;
    }

    let current = '';
    let bitBuffer = 0;
    let bitCount = 0;

    const outputCodes = [];
    outputCodes.push(clearCode);

    for (let i = 0; i < pixels.length; i++) {
      const pixel = String.fromCharCode(pixels[i]);
      const combined = current + pixel;

      if (dict[combined] !== undefined) {
        current = combined;
      } else {
        outputCodes.push(dict[current]);
        if (nextCode < 4096) {
          dict[combined] = nextCode++;
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          outputCodes.push(clearCode);
          dict = {};
          for (let j = 0; j < 256; j++) {
            dict[String.fromCharCode(j)] = j;
          }
          nextCode = 258;
          codeSize = minCodeSize + 1;
        }
        current = pixel;
      }
    }

    if (current) {
      outputCodes.push(dict[current]);
    }
    outputCodes.push(eoiCode);

    for (const code of outputCodes) {
      bitBuffer |= (code << bitCount);
      bitCount += codeSize;

      while (bitCount >= 8) {
        data += String.fromCharCode(bitBuffer & 0xFF);
        bitBuffer >>= 8;
        bitCount -= 8;
      }
    }

    if (bitCount > 0) {
      data += String.fromCharCode(bitBuffer & 0xFF);
    }

    let blockData = '';
    for (let i = 0; i < data.length; i += 255) {
      const blockSize = Math.min(255, data.length - i);
      blockData += String.fromCharCode(blockSize);
      blockData += data.substr(i, blockSize);
    }
    blockData += String.fromCharCode(0);

    return blockData;
  }

  quantizeImage(imageData) {
    const pixels = imageData.data;
    const colorCounts = {};

    for (let i = 0; i < pixels.length; i += 4) {
      const r = (pixels[i] >> 3) << 3;
      const g = (pixels[i + 1] >> 3) << 3;
      const b = (pixels[i + 2] >> 3) << 3;
      const key = `${r},${g},${b}`;
      colorCounts[key] = (colorCounts[key] || 0) + 1;
    }

    const sortedColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 256)
      .map(([key]) => key.split(',').map(Number));

    while (sortedColors.length < 256) {
      sortedColors.push([0, 0, 0]);
    }

    const palette = sortedColors;
    const quantizedPixels = new Uint8Array(pixels.length / 4);

    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      const r = (pixels[i] >> 3) << 3;
      const g = (pixels[i + 1] >> 3) << 3;
      const b = (pixels[i + 2] >> 3) << 3;

      let minDist = Infinity;
      let minIndex = 0;

      for (let k = 0; k < palette.length; k++) {
        const dr = r - palette[k][0];
        const dg = g - palette[k][1];
        const db = b - palette[k][2];
        const dist = dr * dr + dg * dg + db * db;

        if (dist < minDist) {
          minDist = dist;
          minIndex = k;
        }
      }

      quantizedPixels[j] = minIndex;
    }

    return { palette, pixels: quantizedPixels };
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = 1 / 60;
    this.time += deltaTime;

    if (!this.compareMode) {
      this.controls.update();
      this.updateWindAnimation();
      this.updateGrowthAnimation(deltaTime);
      this.updateGifRecording();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.compareScenes.forEach(cs => {
        cs.controls.update();
      });
      this.updateWindAnimation();
      this.compareScenes.forEach(cs => {
        cs.renderer.render(cs.scene, cs.camera);
      });
    }
  }

  getPlantMeshes() {
    return this.plantGroup.children;
  }
}
