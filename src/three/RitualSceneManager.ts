import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { ExperienceSpec, Language, ViewMode } from '../data/experiences';
import { TRADITION_VISUAL_CONFIGS } from '../data/traditionVisualConfig';
import { getAssetSpec } from '../data/assetManifest';
import {
  advanceGazeHold,
  advanceMotionProgress,
  computePourRate,
  calculatePhysicalVesselPour,
  VesselOpeningSpec,
  DropBodyState,
  HandGestureState,
  mapDeviceOrientationToLook,
  stepOfferingDrop
} from '../logic/ritualEngine';
import {
  GestureStepOutput,
  RitualGestureId
} from '../logic/gestureEngine';
import {
  MappedCameraHand,
  resolveHandCollision,
  resolveObjectSupportY,
  resolvePropSeparation,
  StaticPropCircle,
  PhysicsWorld,
  RigidBody3D,
  BoxCollider,
  SphereCollider,
  CylinderCollider,
  Collider3D
} from '../logic/collisionPhysics';
import { createProceduralTextures, TextureBundle } from './proceduralTextures';
import { buildExperienceScene, BuiltFocalScene, InteractivePropEntry } from './ritualModels';
import { createVirtualHandsRig, VirtualHandsRig } from './virtualHands';
import { RitualAudioEngine } from '../audio/ritualAudio';

function createGarbhagrihaEnvironment(): THREE.Scene {
  const envScene = new THREE.Scene();

  // Warm ancient stone Garbhagriha sanctum ambient enclosure (Panel 1 Reference)
  const boxGeo = new THREE.BoxGeometry(16, 12, 16);
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x584738, side: THREE.BackSide });
  const room = new THREE.Mesh(boxGeo, wallMat);
  envScene.add(room);

  // Warm golden diya flames and sanctum bounce lamps strategically placed so metal and stone reflect authentic temple firelight
  const lampNodes = [
    { pos: [0, 0.28, 0.45], color: 0xffb844, r: 0.18 }, // Central altar Kuber Diya
    { pos: [-0.72, 0.22, 0.30], color: 0xff9922, r: 0.16 }, // Left brass lamp
    { pos: [0.72, 0.22, 0.30], color: 0xff9922, r: 0.16 }, // Right Aarti thali diya
    { pos: [-1.45, 0.95, -0.4], color: 0xff8811, r: 0.22 }, // Left wall niche
    { pos: [1.45, 0.95, -0.4], color: 0xff8811, r: 0.22 }, // Right wall niche
    { pos: [0, 2.4, 0.8], color: 0xffecd0, r: 0.55 }, // Sacred overhead dome radiance
    { pos: [0, 0.75, -2.4], color: 0xff8822, r: 0.30 } // Deep sanctum inner Akhand Jyot
  ];

  lampNodes.forEach(({ pos, color, r }) => {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    lamp.position.set(pos[0], pos[1], pos[2]);
    envScene.add(lamp);
  });

  return envScene;
}

export interface SceneHudSnapshot {
  activeStepId: string | null;
  heldStepId: string | null;
  heldCustomLabel?: Record<Language, string>;
  heldCustomAction?: Record<Language, string>;
  completedIds: string[];
  pourRate: number;
  tiltAngleRad: number;
  tiltDegrees: number;
  actionProgress: number;
  tasbihCount: number;
  gazeTargetId: string | null;
  gazeProgress: number;
  sensorActive: boolean;
  bannerTextKey: 'idle' | 'reach' | 'holding' | 'pouring' | 'completed';
  handGesture: HandGestureState;
  canPlaceHeld: boolean;
  nearStepId: string | null;
  lastCompletedId: string | null;
  liquidRemaining?: number;
}

interface ActiveDropEntry {
  state: DropBodyState;
  targetX: number;
  floorY: number;
  targetZ: number;
  massKg: number;
  heavy: boolean;
  onImpactSound: 'tray' | 'flower';
}

interface ActiveArcFlight {
  stepId: string;
  startX: number;
  startY: number;
  startZ: number;
  destX: number;
  destY: number;
  destZ: number;
  arcHeight: number;
  progress: number;
  durationSec: number;
  spawnKind: 'flower' | 'leaf' | 'none';
}

export class RitualSceneManager {
  private container: HTMLElement;
  private exp: ExperienceSpec;
  private mode: ViewMode;
  private audio: RitualAudioEngine;
  private onSnapshot: (snap: SceneHudSnapshot) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private stereoCam: THREE.StereoCamera;
  private textures: TextureBundle;
  private built: BuiltFocalScene;
  private hands: VirtualHandsRig;

  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private startTimeMs = performance.now();
  private lastTickMs = performance.now();

  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.2);
  private altarPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.04);
  private _hitPoint = new THREE.Vector3();
  private _targetPos = new THREE.Vector3();
  private _hoverWorld = new THREE.Vector3(0.24, 0.18, 0.36);
  private _spoutWorld = new THREE.Vector3();
  private _prevDragPos = new THREE.Vector3();
  private _prevCamHandPos = new THREE.Vector3();
  private _hasPrevCamPos = false;

  private activeStepId: string | null = null;
  private heldStepId: string | null = null;
  private heldViaDock = false;
  private heldViaCamera = false;
  private isPointerDown = false;
  private pointerDraggedDist = 0;
  private reachTimer = 0;
  private releaseFlashTimer = 0;
  private nearStepId: string | null = null;
  private currentHandGesture: HandGestureState = 'idle';

  private liveCameraRight: MappedCameraHand | null = null;
  private liveCameraLeft: MappedCameraHand | null = null;

  private completedIds = new Set<string>();
  private pourAccumulated = new Map<string, number>();
  private liquidVolumes = new Map<string, number>();
  private motionAccumulated = new Map<string, number>();
  private activeDrops = new Map<string, ActiveDropEntry>();
  private activeArcFlights: ActiveArcFlight[] = [];
  private tasbihCount = 0;
  private singingBowlEnergy = 0;
  private tiltAngleRad = 0;
  private currentPourRate = 0;
  private lastCompletedId: string | null = null;
  private lastSnapshotEmit = 0;

  private yawRad = 0;
  private pitchRad = 0;
  private baselineAlpha: number | null = null;
  private sensorActive = false;
  private vrLookDragging = false;
  private lastLookPointer = { x: 0, y: 0 };
  private gazeTargetId: string | null = null;
  private gazeProgress = 0;
  private vrAutoActionTimer = 0;
  private vrAutoStepId: string | null = null;

  private physicsWorld: PhysicsWorld;
  private resizeObserver: ResizeObserver;
  private hitTargets: THREE.Object3D[] = [];
  private flowerOfferCount = 0;
  private leafOfferCount = 0;

  constructor(
    container: HTMLElement,
    exp: ExperienceSpec,
    mode: ViewMode,
    audio: RitualAudioEngine,
    onSnapshot: (snap: SceneHudSnapshot) => void,
    onAssetsReady?: () => void
  ) {
    this.container = container;
    this.exp = exp;
    this.mode = mode;
    this.audio = audio;
    this.onSnapshot = onSnapshot;

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 0.75 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setScissorTest(false);
    this.renderer.xr.enabled = true;

    const rect = container.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.className = 'touch-none-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Warm Indian temple sandstone ambient background (Panel 1 Reference)
    const sanctumTone = new THREE.Color(0x423428);
    this.scene.background = sanctumTone;
    // Gentle distance atmospheric fog only beyond 7.5m (No black void fog!)
    this.scene.fog = new THREE.Fog(0x423428, 7.5, 18.0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const sanctumEnvScene = createGarbhagrihaEnvironment();
    this.scene.environment = pmrem.fromScene(sanctumEnvScene, 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(
      mode === 'vr' ? 62 : 48,
      mode === 'vr' ? (w * 0.5) / h : w / h,
      0.05,
      30
    );
    // Natural standing devotee eye height in front of the consecrated sanctum altar (Panel 6 Reference)
    // Perfectly frames the complete Lingam, Yoni base, carved pillars, hanging bells, and offerings
    this.camera.position.set(0, 0.76, 1.82);
    this.camera.lookAt(0, mode === 'normal' ? 0.30 : 0.20, -0.05);

    this.stereoCam = new THREE.StereoCamera();
    this.stereoCam.eyeSep = 0.064;

    // Balanced Sacred Temple Illumination (Panel 1 & 5 Reference - Chiaroscuro Garbhagriha Lighting)
    // 1. Atmospheric neutral-warm ambient bounce (natural stone bounce, preserves sacred shadow depth)
    const hemi = new THREE.HemisphereLight(0xd8d0c5, 0x2c2620, 0.38);
    this.scene.add(hemi);

    // 2. Focused Divine Deity Spotlight on Shiva Lingam and altar (warm celestial illumination)
    const divineSpot = new THREE.SpotLight(0xfff6ea, 2.4, 9.0, Math.PI / 3.8, 0.72, 1.1);
    divineSpot.position.set(0, 2.8, 1.8);
    divineSpot.target.position.set(0, 0.22, -0.05);
    this.scene.add(divineSpot.target);
    if (!this.isSoftwareGl) {
      divineSpot.castShadow = true;
      divineSpot.shadow.mapSize.set(2048, 2048);
      divineSpot.shadow.bias = -0.0001;
      divineSpot.shadow.normalBias = 0.025;
    }
    this.scene.add(divineSpot);

    // 3. Front-left temple architectural light (soft natural fill grazing stone pillars & wall relief)
    const archLightL = new THREE.DirectionalLight(0xeed8c2, 0.24);
    archLightL.position.set(-2.8, 2.4, 2.0);
    this.scene.add(archLightL);

    // 4. Front-right temple architectural light (soft natural fill grazing right pillars and Gomukha spout)
    const archLightR = new THREE.DirectionalLight(0xe8dcce, 0.20);
    archLightR.position.set(2.8, 2.4, 2.0);
    this.scene.add(archLightR);

    // 5. Back sanctum corridor fill light (soft warm Akhand Jyot tone in deep sanctum - Panel 1 chiaroscuro)
    const corridorLight = new THREE.PointLight(0xffbe68, 0.85, 5.0, 1.4);
    corridorLight.position.set(0, 1.2, -1.8);
    this.scene.add(corridorLight);

    // 6. Soft natural rim light illuminating Sheshnaag & deity silhouette
    const rimLight = new THREE.DirectionalLight(0xf2e8da, 0.22);
    rimLight.position.set(0, 2.0, -1.4);
    this.scene.add(rimLight);

    // 7. Soft warm foreground illumination for sacred offerings on the altar
    const tableFill = new THREE.DirectionalLight(0xf5ebd8, 0.28);
    tableFill.position.set(0, 1.4, 1.4);
    this.scene.add(tableFill);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    if (exp.id === 'shiva') {
      this.scene.background = this.textures.shivaSanctumBgMap;
      this.scene.fog = null;
    }
    void this.textures.whenReady.then(() => {
      if (!this.disposed) {
        onAssetsReady?.();
      }
    });
    this.built = buildExperienceScene(exp, this.textures, mode);
    this.scene.add(this.built.focalGroup);

    this.physicsWorld = new PhysicsWorld();
    this.initPhysics();

    this.hands = createVirtualHandsRig(
      this.textures.skinMap,
      this.textures.skinBump,
      this.textures.sleeveMap,
      exp.hasSacredThread
    );
    this.scene.add(this.hands.group);

    this.built.interactiveMeshes.forEach(({ hitProxy }) => {
      this.hitTargets.push(hitProxy);
    });
    this.raycaster.layers.set(1);

    this.activeStepId = exp.steps[0]?.id ?? null;

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.loadManifestAssets();

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.emitSnapshot(true);
    this.tick();
  }

  private loadManifestAssets() {
    const spec = getAssetSpec(this.exp.id);
    if (!spec) return;

    // 1. HDRI Environment Map
    if (spec.environmentHDR) {
      const rgbe = new RGBELoader();
      rgbe.load(
        spec.environmentHDR,
        (hdrTex) => {
          if (this.disposed) return;
          hdrTex.mapping = THREE.EquirectangularReflectionMapping;
          this.scene.environment = hdrTex;
        },
        undefined,
        () => {
          // Graceful fallback to RoomEnvironment PMREM
        }
      );
    }

    const gltfLoader = new GLTFLoader();

    // 2. Custom Environment Architecture Model
    if (spec.environmentModel) {
      gltfLoader.load(
        spec.environmentModel,
        (gltf) => {
          if (this.disposed) return;
          const envModel = gltf.scene;
          envModel.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          envModel.position.set(0, 0, 0);
          this.scene.add(envModel);
        },
        undefined,
        () => {
          // Graceful fallback: procedural cyclorama & architecture remain visible
        }
      );
    }

    // 3. Focal Deity Model
    if (spec.deityModel) {
      gltfLoader.load(
        spec.deityModel,
        (gltf) => {
          if (this.disposed) return;
          const deity = gltf.scene;
          deity.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
            }
          });
          deity.position.set(0, 0.02, -0.05);
          this.built.focalGroup.add(deity);
        },
        undefined,
        () => {
          // Graceful fallback: built procedural deity representation remains visible
        }
      );
    }

    // 4. Interactive Prop Models (Kalash, Thali, Bhog Plate, Diya, etc.)
    if (spec.objects) {
      Object.entries(spec.objects).forEach(([objKey, url]) => {
        let targetEntry: InteractivePropEntry | undefined;
        this.built.interactiveMeshes.forEach((entry, id) => {
          const lowerId = id.toLowerCase();
          const lowerKey = objKey.toLowerCase();
          if (lowerId.includes(lowerKey) || lowerKey.includes(lowerId)) {
            targetEntry = entry;
          }
        });

        if (targetEntry) {
          const entry = targetEntry;
          gltfLoader.load(
            url,
            (gltf) => {
              if (this.disposed) return;
              const propScene = gltf.scene;
              propScene.traverse((node) => {
                if ((node as THREE.Mesh).isMesh) {
                  node.castShadow = true;
                  node.receiveShadow = true;
                }
              });

              // Fit model bounding box to expected prop height
              const box = new THREE.Box3().setFromObject(propScene);
              const size = box.getSize(new THREE.Vector3());
              if (size.y > 0.01 && entry.height > 0.01) {
                const scaleFactor = entry.height / size.y;
                propScene.scale.setScalar(scaleFactor);
              }

              // Hide visual procedural child meshes, keeping hitProxy & functional points
              entry.root.children.forEach((c) => {
                if (c !== entry.hitProxy && c !== entry.spoutTip && c !== entry.liquidSurface) {
                  c.visible = false;
                }
              });
              entry.root.add(propScene);
            },
            undefined,
            () => {
              // Graceful fallback: procedural model remains visible
            }
          );
        }
      });
    }
  }

  private getServingPlateId(): string {
    return this.exp.id === 'krishna' ? 'makhan-bowl' : 'bhog-shiva';
  }

  private isFlowerOfferingStep(stepId: string): boolean {
    return (
      stepId.includes('pushpa') ||
      stepId.includes('flowers') ||
      stepId.includes('hibiscus') ||
      stepId.includes('lotus') ||
      stepId.includes('lilies') ||
      stepId.includes('gulab')
    );
  }

  private isLeafOfferingStep(stepId: string): boolean {
    return stepId === 'bilva-patra' || stepId === 'tulsi-leaves';
  }

  private getStaticProps(excludeId?: string | null): StaticPropCircle[] {
    const out: StaticPropCircle[] = [];
    const plateId = this.getServingPlateId();
    this.built.interactiveMeshes.forEach((entry, id) => {
      if (id === excludeId) return;
      // Seated bhog/makhan food items travel with serving plate rather than colliding with it
      if (excludeId === plateId && entry.isBhogItem && entry.seatedInPlate) return;
      out.push({
        id,
        x: entry.root.position.x,
        y: entry.root.position.y,
        z: entry.root.position.z,
        radius: entry.radius,
        height: entry.height
      });
    });
    return out;
  }

  private getBhogPlateCircle(): StaticPropCircle | null {
    const plateId = this.getServingPlateId();
    if (this.heldStepId === plateId) return null;
    const plate = this.built.interactiveMeshes.get(plateId);
    if (!plate) return null;
    return {
      id: plateId,
      x: plate.root.position.x,
      y: plate.root.position.y,
      z: plate.root.position.z,
      radius: plate.radius,
      height: plate.height
    };
  }

  private initPhysics() {
    // 1. Static Chowki Table
    this.physicsWorld.addStaticBody(
      'altar-table',
      new THREE.Vector3(0, -0.05, 0.35),
      new BoxCollider(new THREE.Vector3(0.85, 0.05, 0.45))
    );

    // 2. Static Temple Stone Floor
    this.physicsWorld.addStaticBody(
      'temple-floor',
      new THREE.Vector3(0, -0.6, 0),
      new BoxCollider(new THREE.Vector3(6.0, 0.5, 6.0))
    );

    // 3. Deity static obstacles (Shiva Lingam, Pitha base, Gomukha, Naga)
    if (this.built.hasLingam) {
      // Monolithic Lingam cylindrical column
      this.physicsWorld.addStaticBody(
        'lingam-column',
        new THREE.Vector3(0, 0.35, -0.05),
        new CylinderCollider(0.148, 0.18)
      );

      // Lingam rounded dome apex
      this.physicsWorld.addStaticBody(
        'lingam-dome',
        new THREE.Vector3(0, 0.54, -0.05),
        new SphereCollider(0.148)
      );

      // Tiered Stone Pitha / Yoni base
      this.physicsWorld.addStaticBody(
        'yoni-base',
        new THREE.Vector3(0, 0.08, -0.05),
        new CylinderCollider(0.38, 0.09)
      );

      // Gomukha drainage spout
      this.physicsWorld.addStaticBody(
        'gomukha-spout',
        new THREE.Vector3(0.38, 0.08, -0.05),
        new BoxCollider(new THREE.Vector3(0.08, 0.05, 0.14))
      );

      // Naga 5-headed brass hood / canopy behind Lingam
      this.physicsWorld.addStaticBody(
        'naga-canopy',
        new THREE.Vector3(0, 0.65, -0.22),
        new CylinderCollider(0.24, 0.32)
      );
    }

    // 4. Register dynamic rigid bodies for all interactive ritual meshes
    this.built.interactiveMeshes.forEach((entry, stepId) => {
      const isVessel = entry.spec.kind === 'pour-water' || entry.spec.kind === 'pour-milk';
      const isPlate = entry.spec.kind === 'aarti-wave' || entry.spec.kind === 'place-item';
      const isBotanical = entry.spec.gripStyle === 'pinch';

      let collider: Collider3D;
      let mass = 0.5;

      if (isVessel) {
        collider = new CylinderCollider(entry.radius, entry.height / 2);
        mass = 0.85;
      } else if (isBotanical) {
        collider = new SphereCollider(Math.max(0.03, entry.radius));
        mass = 0.04;
      } else if (isPlate) {
        collider = new CylinderCollider(Math.max(0.08, entry.radius), entry.height / 2);
        mass = 0.65;
      } else {
        collider = new SphereCollider(Math.max(0.04, entry.radius));
        mass = 0.35;
      }

      const body = new RigidBody3D({
        id: stepId,
        collider,
        mass,
        position: entry.root.position.clone(),
        restitution: isBotanical ? 0.05 : 0.22,
        friction: 0.55,
        linearDamping: isBotanical ? 0.35 : 0.08
      });

      this.physicsWorld.addDynamicBody(body);
    });
  }

  private clampTargetWithPhysics(
    rawX: number,
    rawY: number,
    rawZ: number,
    heldId: string | null
  ): THREE.Vector3 {
    const rawPos = new THREE.Vector3(rawX, rawY, rawZ);
    const body = heldId ? this.physicsWorld.getBody(heldId) : undefined;
    if (body) {
      return this.physicsWorld.resolveKinematicMove(body, rawPos);
    }
    const heldEntry = heldId ? this.built.interactiveMeshes.get(heldId) : undefined;
    const resolved = resolveHandCollision(
      { x: rawX, y: rawY, z: rawZ },
      0.045,
      heldEntry?.radius ?? 0.045,
      heldEntry?.height ?? 0.06,
      this.built.hasLingam,
      this.getStaticProps(heldId),
      heldId
    );
    return new THREE.Vector3(resolved.x, resolved.y, resolved.z);
  }

  private bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    if (this.mode === 'vr') {
      window.addEventListener('deviceorientation', this.onDeviceOrientation);
    }
  }

  private unbindEvents() {
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
  }

  private onDeviceOrientation = (ev: DeviceOrientationEvent) => {
    if (ev.alpha === null || ev.beta === null || ev.gamma === null) return;
    if (this.baselineAlpha === null) {
      this.baselineAlpha = ev.alpha;
    }
    this.sensorActive = true;
    const look = mapDeviceOrientationToLook(ev.alpha, ev.beta, ev.gamma, this.baselineAlpha);
    this.yawRad = THREE.MathUtils.clamp(look.yawRad, -0.95, 0.95);
    this.pitchRad = look.pitchRad;
  };

  private onKeyDown = (ev: KeyboardEvent) => {
    if (this.mode !== 'vr') return;
    const step = 0.06;
    if (ev.key === 'ArrowLeft' || ev.key === 'a') this.yawRad = Math.min(0.95, this.yawRad + step);
    if (ev.key === 'ArrowRight' || ev.key === 'd') this.yawRad = Math.max(-0.95, this.yawRad - step);
    if (ev.key === 'ArrowUp' || ev.key === 'w') this.pitchRad = Math.min(0.6, this.pitchRad + step);
    if (ev.key === 'ArrowDown' || ev.key === 's') this.pitchRad = Math.max(-0.6, this.pitchRad - step);
  };

  private onWheel = (ev: WheelEvent) => {
    if (this.mode !== 'normal' || !this.heldStepId) return;
    const entry = this.built.interactiveMeshes.get(this.heldStepId);
    if (!entry) return;
    if (entry.spec.kind === 'pour-water' || entry.spec.kind === 'pour-milk') {
      ev.preventDefault();
      this.tiltAngleRad = THREE.MathUtils.clamp(
        this.tiltAngleRad + (ev.deltaY < 0 ? 0.09 : -0.09),
        0,
        1.38
      );
      this.emitSnapshot(true);
    }
  };

  private updatePointerNdc(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  private onPointerDown = (ev: PointerEvent) => {
    this.audio.unlock();
    this.isPointerDown = true;
    this.pointerDraggedDist = 0;

    if (this.mode === 'vr') {
      this.vrLookDragging = true;
      this.lastLookPointer = { x: ev.clientX, y: ev.clientY };
      return;
    }

    this.updatePointerNdc(ev.clientX, ev.clientY);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitTargets, false);

    if (hits.length > 0) {
      const stepId = hits[0].object.userData.stepId as string;
      if (this.heldStepId && this.heldStepId !== stepId) {
        this.dropHeldBackToTray();
      }
      this.heldViaDock = false;
      this.heldViaCamera = false;
      this.beginHoldingStep(stepId);
      const entry = this.built.interactiveMeshes.get(stepId);
      if (entry) {
        this._prevDragPos.copy(entry.root.position);
      }
      return;
    }

    if (this.heldStepId) {
      const heldEntry = this.built.interactiveMeshes.get(this.heldStepId);
      if (heldEntry && heldEntry.spec.kind === 'place-item') {
        const sp = heldEntry.spec;
        if (this.raycaster.ray.intersectPlane(this.altarPlane, this._hitPoint)) {
          const distToTarget = Math.hypot(
            this._hitPoint.x - sp.targetPosition[0],
            this._hitPoint.z - sp.targetPosition[2]
          );
          if (distToTarget < 0.56) {
            this.releaseHeldAtTarget();
            this.isPointerDown = false;
            return;
          }
        }
      }
      return;
    }

    if (this.raycaster.ray.intersectPlane(this.altarPlane, this._hitPoint)) {
      const clamped = this.clampTargetWithPhysics(
        this._hitPoint.x,
        0.18,
        this._hitPoint.z,
        null
      );
      this._hoverWorld.copy(clamped);
      this.reachTimer = 1.4;
      this.emitSnapshot(true);
    }

    if (this.activeStepId) {
      const entry = this.built.interactiveMeshes.get(this.activeStepId);
      if (entry && entry.spec.kind === 'guided-reflection') {
        this.completeStep(entry.spec.id);
      }
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (this.mode === 'vr') {
      if (this.vrLookDragging) {
        const dx = ev.clientX - this.lastLookPointer.x;
        const dy = ev.clientY - this.lastLookPointer.y;
        this.lastLookPointer = { x: ev.clientX, y: ev.clientY };
        this.yawRad = THREE.MathUtils.clamp(this.yawRad - dx * 0.004, -0.95, 0.95);
        this.pitchRad = THREE.MathUtils.clamp(this.pitchRad - dy * 0.004, -0.55, 0.55);
      }
      return;
    }

    this.updatePointerNdc(ev.clientX, ev.clientY);
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    if (!this.heldStepId) {
      const hits = this.raycaster.intersectObjects(this.hitTargets, false);
      if (hits.length > 0) {
        const hitStepId = hits[0].object.userData.stepId as string;
        this.nearStepId = hitStepId;
        const hitEntry = this.built.interactiveMeshes.get(hitStepId);
        if (hitEntry) {
          const clamped = this.clampTargetWithPhysics(
            hitEntry.root.position.x,
            Math.max(0.14, hitEntry.root.position.y + 0.08),
            hitEntry.root.position.z,
            null
          );
          this._hoverWorld.copy(clamped);
          this.reachTimer = 0.85;
        }
      } else {
        this.nearStepId = null;
        if (this.raycaster.ray.intersectPlane(this.altarPlane, this._hitPoint)) {
          if (
            Math.abs(this._hitPoint.x) < 0.86 &&
            this._hitPoint.z > -0.26 &&
            this._hitPoint.z < 0.72
          ) {
            const clamped = this.clampTargetWithPhysics(
              this._hitPoint.x,
              0.17,
              this._hitPoint.z,
              null
            );
            this._hoverWorld.copy(clamped);
            this.reachTimer = 0.7;
          }
        }
      }
      return;
    }

    if (!this.isPointerDown) return;
    const entry = this.built.interactiveMeshes.get(this.heldStepId);
    if (!entry) return;

    const planeNormal = new THREE.Vector3(0, 0.42, 0.9).normalize();
    this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, new THREE.Vector3(0, 0.35, 0.16));

    if (this.raycaster.ray.intersectPlane(this.dragPlane, this._hitPoint)) {
      const resolved = resolveHandCollision(
        {
          x: THREE.MathUtils.clamp(this._hitPoint.x, -0.82, 0.82),
          y: THREE.MathUtils.clamp(this._hitPoint.y, 0.06, 0.85),
          z: THREE.MathUtils.clamp(this._hitPoint.z, -0.14, 0.62)
        },
        0.045,
        entry.radius,
        entry.height,
        this.built.hasLingam && entry.spec.id !== 'bilva-patra',
        this.getStaticProps(this.heldStepId),
        this.heldStepId
      );

      this._hitPoint.set(resolved.x, resolved.y, resolved.z);
      const moveDist = this._hitPoint.distanceTo(this._prevDragPos);
      this.pointerDraggedDist += moveDist;
      this._prevDragPos.copy(this._hitPoint);
      this._targetPos.copy(this._hitPoint);

      const spec = entry.spec;

      if (spec.kind === 'pour-water' || spec.kind === 'pour-milk') {
        const dx = this._hitPoint.x - spec.targetPosition[0];
        const dz = this._hitPoint.z - spec.targetPosition[2];
        const horizDist = Math.hypot(dx, dz);

        if (horizDist < 0.48) {
          const heightFactor = THREE.MathUtils.clamp((this._hitPoint.y - 0.32) / 0.38, 0.25, 1.0);
          this.tiltAngleRad = THREE.MathUtils.clamp(0.48 + heightFactor * 0.78, 0.42, 1.32);
        } else {
          this.tiltAngleRad = 0.08;
        }
      } else if (spec.kind === 'aarti-wave' || spec.kind === 'chaur-seva') {
        const cur = this.motionAccumulated.get(spec.id) ?? 0;
        const next = advanceMotionProgress(cur, moveDist, 2.8);
        this.motionAccumulated.set(spec.id, next);
        if (next >= 1 && !this.completedIds.has(spec.id)) {
          this.completeStep(spec.id);
        }
      } else if (spec.kind === 'singing-bowl') {
        if (moveDist > 0.015) {
          this.singingBowlEnergy = Math.min(1, this.singingBowlEnergy + moveDist * 1.4);
        }
      } else if (spec.kind === 'tasbih-count') {
        if (moveDist > 0.03) {
          this.advanceTasbih();
        }
      }
    }
  };

  private onPointerUp = () => {
    const wasPointerDown = this.isPointerDown;
    this.isPointerDown = false;
    this.vrLookDragging = false;
    if (this.mode === 'vr' || !this.heldStepId || !wasPointerDown) return;

    if (this.heldViaDock && this.pointerDraggedDist < 0.04) {
      return;
    }

    const entry = this.built.interactiveMeshes.get(this.heldStepId);
    if (!entry) {
      this.heldStepId = null;
      return;
    }

    const spec = entry.spec;
    if (spec.kind === 'place-item') {
      if (entry.isBhogItem) {
        this.dropIndividualBhogItem(entry.spec.id, entry.root.position.x, entry.root.position.z);
      } else {
        const dist = Math.hypot(
          entry.root.position.x - spec.targetPosition[0],
          entry.root.position.z - spec.targetPosition[2]
        );
        if (dist < 0.46) {
          this.placeObjectAtTarget(spec.id, entry.root.position.x, entry.root.position.z);
        } else {
          this.releaseObjectToTray(spec.id);
        }
      }
    } else if (spec.kind === 'light-flame') {
      // Allow gently placing an already-lit Diya or Candle wherever user releases it on the chowki
      const sep = resolvePropSeparation(
        entry.root.position.x,
        entry.root.position.z,
        spec.id,
        entry.radius,
        this.getStaticProps(spec.id),
        this.built.hasLingam
      );
      const supportY = resolveObjectSupportY(
        sep.x,
        sep.z,
        spec.id,
        this.built.hasLingam,
        this.getBhogPlateCircle()
      );
      this.scheduleDrop(spec.id, sep.x, supportY, sep.z, 0.45, true, 'tray');
    } else {
      this.tiltAngleRad = 0;
      this.currentPourRate = 0;
      this.audio.updatePourStream(0, false);
      this.releaseObjectToTray(spec.id);
    }

    const body = this.heldStepId ? this.physicsWorld.getBody(this.heldStepId) : undefined;
    if (body) {
      body.setKinematic(false);
    }

    this.heldStepId = null;
    this.heldViaDock = false;
    this.heldViaCamera = false;
    this.releaseFlashTimer = 0.42;
    this.built.targetHalo.visible = false;
    this.emitSnapshot(true);
  };

  /**
   * Receives live 21-landmark camera hand tracking + gesture state machine outputs
   * in Normal Screen mode without rendering synthetic plastic mannequin arms.
   */
  public applyCameraHands(right: MappedCameraHand | null, left: MappedCameraHand | null) {
    this.liveCameraRight = right?.detected ? right : null;
    this.liveCameraLeft = left?.detected ? left : null;

    if (this.mode !== 'normal') return;
    if (!this.liveCameraRight) {
      this._hasPrevCamPos = false;
      return;
    }

    const camR = this.liveCameraRight;
    const heldEntry = this.heldStepId ? this.built.interactiveMeshes.get(this.heldStepId) : undefined;
    const clampedPos = resolveHandCollision(
      camR.worldPos,
      0.045,
      heldEntry?.radius ?? 0.045,
      heldEntry?.height ?? 0.06,
      this.built.hasLingam && heldEntry?.spec.id !== 'bilva-patra',
      this.getStaticProps(this.heldStepId),
      this.heldStepId
    );
    this._hoverWorld.set(clampedPos.x, clampedPos.y, clampedPos.z);
  }

  public isPourStepComplete(stepId: string | null): boolean {
    if (!stepId) return false;
    return this.completedIds.has(stepId) && (this.pourAccumulated.get(stepId) ?? 0) >= 1;
  }

  public cancelActiveGesture() {
    if (this.mode !== 'normal') return;
    if (this.heldStepId) {
      this.dropHeldBackToTray();
      this.releaseFlashTimer = 0.25;
      this.emitSnapshot(true);
    }
  }

  /**
   * Drives 3D object placement, Kalash pouring, Aarti/Chaur tracking, and flame ignition
   * directly from low-compute gesture recognition phases.
   */
  public applyGestureOutput(
    output: GestureStepOutput,
    stepId: string | null,
    gestureId: RitualGestureId | null
  ) {
    if (this.mode !== 'normal' || this.isPointerDown) return;

    if (output.justCancelled) {
      this.cancelActiveGesture();
      return;
    }

    if (!stepId || !gestureId) return;
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;
    const spec = entry.spec;
    const { state } = output;

    if (state.phase === 'ACTION') {
      if (gestureId === 'vessel-pour') {
        if (this.heldStepId !== stepId) {
          if (this.heldStepId) this.dropHeldBackToTray();
          this.heldViaDock = false;
          this.heldViaCamera = true;
          this.beginHoldingStep(stepId);
        }
        this._targetPos.set(
          spec.targetPosition[0] + 0.07,
          0.60,
          spec.targetPosition[2] + 0.14
        );
        this.tiltAngleRad = THREE.MathUtils.clamp(output.activePourTiltRad, 0, 1.38);
      } else if (gestureId === 'circular-aarti') {
        if (this.heldStepId !== stepId) {
          if (this.heldStepId) this.dropHeldBackToTray();
          this.heldViaDock = false;
          this.heldViaCamera = true;
          this.beginHoldingStep(stepId);
        }
        // Plate directly tracks the user's real circular hand trajectory (never spins independently)
        this._targetPos.set(
          THREE.MathUtils.clamp(spec.targetPosition[0] + state.cursorOffset.x, -0.58, 0.58),
          THREE.MathUtils.clamp(spec.targetPosition[1] + state.cursorOffset.y, 0.22, 0.72),
          THREE.MathUtils.clamp(spec.targetPosition[2] + state.cursorOffset.z * 0.35, 0.14, 0.45)
        );
        this.motionAccumulated.set(stepId, Math.max(this.motionAccumulated.get(stepId) ?? 0, state.actionProgress));
      } else if (gestureId === 'sweep-chaur') {
        if (this.heldStepId !== stepId) {
          if (this.heldStepId) this.dropHeldBackToTray();
          this.heldViaDock = false;
          this.heldViaCamera = true;
          this.beginHoldingStep(stepId);
        }
        this._targetPos.set(
          THREE.MathUtils.clamp(spec.targetPosition[0] + state.cursorOffset.x * 1.25, -0.52, 0.52),
          THREE.MathUtils.clamp(spec.targetPosition[1] + state.cursorOffset.y * 0.35, 0.42, 0.7),
          spec.targetPosition[2]
        );
        this.motionAccumulated.set(stepId, Math.max(this.motionAccumulated.get(stepId) ?? 0, state.actionProgress));
      } else if (gestureId === 'pinch-release-leaf') {
        if (this.heldStepId !== stepId) {
          if (this.heldStepId) this.dropHeldBackToTray();
          this.heldViaDock = false;
          this.heldViaCamera = true;
          this.beginHoldingStep(stepId);
        }
        const lerpRatio = THREE.MathUtils.clamp(0.35 + state.actionProgress * 0.65, 0.35, 1);
        this._targetPos.set(
          THREE.MathUtils.lerp(spec.trayPosition[0], spec.targetPosition[0], lerpRatio) +
            state.cursorOffset.x * 0.22,
          THREE.MathUtils.lerp(0.18, spec.targetPosition[1] + 0.12, lerpRatio),
          THREE.MathUtils.lerp(spec.trayPosition[2], spec.targetPosition[2], lerpRatio)
        );
      } else if (gestureId === 'namaste-flowers' || gestureId === 'cupped-bhog') {
        this.built.targetHalo.position.set(
          spec.targetPosition[0],
          0.018,
          spec.targetPosition[2]
        );
        this.built.targetHalo.visible = true;
      }
      this.emitSnapshot(false);
    }

    if (output.justCompleted) {
      this.triggerStepAnimatedAction(stepId);
    }
  }

  /**
   * Executes a single clean animated offering or ritual step (used by confirmed gestures & accessibility button).
   */
  public triggerStepAnimatedAction(stepId: string) {
    this.audio.unlock();
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;
    const spec = entry.spec;

    if (spec.kind === 'light-flame') {
      this.igniteStepFlame(stepId);
      this.heldStepId = null;
      this.heldViaCamera = false;
      this.built.targetHalo.visible = false;
      return;
    }
    if (spec.kind === 'singing-bowl') {
      this.strikeSingingBowl(stepId);
      return;
    }
    if (spec.kind === 'tasbih-count') {
      this.advanceTasbih();
      return;
    }
    if (spec.kind === 'guided-reflection') {
      this.completeStep(stepId);
      return;
    }
    if (spec.kind === 'pour-water' || spec.kind === 'pour-milk') {
      // Pour completed: gracefully return Kalash to tray & stop fluid stream
      if (this.heldStepId === stepId) {
        this.dropHeldBackToTray();
      }
      this.completeStep(stepId);
      return;
    }
    if (spec.kind === 'aarti-wave' || spec.kind === 'chaur-seva') {
      this.motionAccumulated.set(stepId, 1);
      if (this.heldStepId === stepId) {
        this.dropHeldBackToTray();
      }
      this.completeStep(stepId);
      return;
    }

    // place-item: animate along a smooth natural arc onto the altar
    if (this.heldStepId === stepId) {
      this.heldStepId = null;
      this.heldViaCamera = false;
      this.heldViaDock = false;
    }
    this.built.targetHalo.visible = false;
    this.launchCurvedOfferingFlight(stepId);
  }

  private launchCurvedOfferingFlight(stepId: string) {
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;
    const spec = entry.spec;

    const isFlower = this.isFlowerOfferingStep(stepId);
    const isLeaf = this.isLeafOfferingStep(stepId);

    const jitterAngle = ((isFlower ? this.flowerOfferCount : this.leafOfferCount) * 1.25) % (Math.PI * 2);
    const destX =
      spec.targetPosition[0] +
      (isFlower ? Math.cos(jitterAngle) * 0.065 : isLeaf ? Math.cos(jitterAngle) * 0.028 : 0);
    const destZ =
      spec.targetPosition[2] +
      (isFlower ? Math.sin(jitterAngle) * 0.045 : isLeaf ? Math.sin(jitterAngle) * 0.025 : 0);

    let finalX = destX;
    let finalZ = destZ;
    if (!isFlower && !isLeaf) {
      const sep = resolvePropSeparation(
        destX,
        destZ,
        stepId,
        entry.radius,
        this.getStaticProps(stepId),
        this.built.hasLingam
      );
      finalX = sep.x;
      finalZ = sep.z;
    }

    const supportY = resolveObjectSupportY(
      finalX,
      finalZ,
      stepId,
      this.built.hasLingam,
      this.getBhogPlateCircle()
    );

    this.activeArcFlights.push({
      stepId,
      startX: entry.root.position.x,
      startY: entry.root.position.y,
      startZ: entry.root.position.z,
      destX: finalX,
      destY: supportY,
      destZ: finalZ,
      arcHeight: isFlower || isLeaf ? 0.24 : 0.16,
      progress: 0,
      durationSec: isFlower || isLeaf ? 0.58 : 0.65,
      spawnKind: isFlower ? 'flower' : isLeaf ? 'leaf' : 'none'
    });
  }

  public selectAndActivateStep(stepId: string) {
    this.audio.unlock();
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;

    if (this.heldStepId && this.heldStepId !== stepId) {
      this.dropHeldBackToTray();
    }

    if (!entry.isBhogItem) {
      this.activeStepId = stepId;
    }
    const spec = entry.spec;

    if (spec.kind === 'light-flame') {
      if (this.mode === 'normal' && this.completedIds.has(stepId) && !spec.id.includes('incense')) {
        this.heldViaDock = true;
        this.heldViaCamera = false;
        this.beginHoldingStep(stepId);
        return;
      }
      this.igniteStepFlame(stepId);
      return;
    }
    if (spec.kind === 'singing-bowl') {
      this.strikeSingingBowl(stepId);
      return;
    }
    if (spec.kind === 'tasbih-count') {
      this.advanceTasbih();
      return;
    }
    if (spec.kind === 'guided-reflection') {
      this.completeStep(stepId);
      return;
    }

    this.heldViaDock = this.mode === 'normal';
    this.heldViaCamera = false;
    this.beginHoldingStep(stepId);

    if (spec.kind === 'pour-water' || spec.kind === 'pour-milk') {
      // Hover cleanly above & right of the 0.46m Lingam crown so spout pours dead-center with zero stone clipping
      this._targetPos.set(
        spec.targetPosition[0] + 0.07,
        0.60,
        spec.targetPosition[2] + 0.14
      );
      entry.root.position.y = Math.max(entry.root.position.y, 0.26);
      this.tiltAngleRad = 0.88;
      if (this.mode === 'vr') {
        this.vrAutoStepId = stepId;
        this.vrAutoActionTimer = 3.6;
      }
    } else if (spec.kind === 'aarti-wave' || spec.kind === 'chaur-seva') {
      this._targetPos.set(spec.targetPosition[0], spec.targetPosition[1], spec.targetPosition[2]);
      if (this.mode === 'vr') {
        this.vrAutoStepId = stepId;
        this.vrAutoActionTimer = 3.2;
      }
    } else if (spec.kind === 'place-item') {
      if (this.mode === 'vr') {
        if (entry.isBhogItem) {
          this.dropIndividualBhogItem(stepId, spec.targetPosition[0], spec.targetPosition[2]);
        } else {
          this.placeObjectAtTarget(stepId);
        }
        this.heldStepId = null;
        this.heldViaDock = false;
        this.built.targetHalo.visible = false;
      } else {
        this._targetPos.set(
          spec.targetPosition[0],
          spec.targetPosition[1] + 0.14,
          spec.targetPosition[2] + 0.1
        );
      }
    }
    this.emitSnapshot(true);
  }

  public releaseHeldAtTarget() {
    if (!this.heldStepId) return;
    const entry = this.built.interactiveMeshes.get(this.heldStepId);
    if (!entry) return;

    if (entry.spec.kind === 'place-item' || entry.spec.kind === 'light-flame') {
      if (entry.spec.kind === 'light-flame') {
        const sep = resolvePropSeparation(
          entry.root.position.x,
          entry.root.position.z,
          entry.spec.id,
          entry.radius,
          this.getStaticProps(entry.spec.id),
          this.built.hasLingam
        );
        const supportY = resolveObjectSupportY(
          sep.x,
          sep.z,
          entry.spec.id,
          this.built.hasLingam,
          this.getBhogPlateCircle()
        );
        this.scheduleDrop(entry.spec.id, sep.x, supportY, sep.z, 0.45, true, 'tray');
      } else if (entry.isBhogItem) {
        const plate = this.getBhogPlateCircle();
        const tx = plate ? plate.x + (entry.localOffsetInPlate?.x ?? 0) : entry.spec.targetPosition[0];
        const tz = plate ? plate.z + (entry.localOffsetInPlate?.z ?? 0) : entry.spec.targetPosition[2];
        this.dropIndividualBhogItem(entry.spec.id, tx, tz);
      } else {
        this.placeObjectAtTarget(entry.spec.id);
      }
      this.heldStepId = null;
      this.heldViaDock = false;
      this.heldViaCamera = false;
      this.releaseFlashTimer = 0.45;
      this.built.targetHalo.visible = false;
      this.emitSnapshot(true);
    } else {
      this.returnHeldToTray();
    }
  }

  public returnHeldToTray() {
    if (!this.heldStepId) return;
    this.dropHeldBackToTray();
    this.releaseFlashTimer = 0.4;
    this.emitSnapshot(true);
  }

  private dropHeldBackToTray() {
    if (!this.heldStepId) return;
    const id = this.heldStepId;
    this.tiltAngleRad = 0;
    this.currentPourRate = 0;
    this.audio.updatePourStream(0, false);
    this.releaseObjectToTray(id);
    const body = this.heldStepId ? this.physicsWorld.getBody(this.heldStepId) : undefined;
    if (body) {
      body.setKinematic(false);
    }

    this.heldStepId = null;
    this.heldViaDock = false;
    this.heldViaCamera = false;
    this.built.targetHalo.visible = false;
  }

  public triggerHandGesture(gesture: HandGestureState) {
    this.audio.unlock();
    if (gesture === 'reach') {
      const targetEntry = this.activeStepId
        ? this.built.interactiveMeshes.get(this.activeStepId)
        : undefined;
      if (targetEntry) {
        this._hoverWorld.set(
          targetEntry.root.position.x,
          Math.max(0.18, targetEntry.root.position.y + 0.1),
          targetEntry.root.position.z
        );
      } else {
        this._hoverWorld.set(0.14, 0.22, 0.28);
      }
      this.reachTimer = 1.4;
    } else if (gesture === 'release') {
      this.releaseHeldAtTarget();
    }
    this.emitSnapshot(true);
  }

  public setManualTilt(tiltNormalized: number) {
    if (!this.heldStepId) {
      const pourStep = this.exp.steps.find(
        (s) => s.kind === 'pour-water' || s.kind === 'pour-milk'
      );
      if (pourStep) {
        this.heldViaDock = true;
        this.beginHoldingStep(pourStep.id);
        this._targetPos.set(
          pourStep.targetPosition[0] + 0.07,
          0.60,
          pourStep.targetPosition[2] + 0.14
        );
      }
    }
    this.tiltAngleRad = THREE.MathUtils.clamp(tiltNormalized, 0, 1) * 1.38;
    if (tiltNormalized <= 0.05 && this.vrAutoStepId) {
      this.vrAutoActionTimer = 0;
    }
    this.emitSnapshot(true);
  }

  private beginHoldingStep(stepId: string) {
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;
    this.activeDrops.delete(stepId);
    if (!entry.isBhogItem) {
      this.activeStepId = stepId;
    }
    this.heldStepId = stepId;
    const body = this.physicsWorld.getBody(stepId);
    if (body) {
      body.setKinematic(true);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
    }
    const spec = entry.spec;

    if (spec.kind === 'light-flame') {
      if (this.mode === 'normal' && this.completedIds.has(stepId) && !spec.id.includes('incense')) {
        this.audio.playBrassHandling();
        this._targetPos.copy(entry.root.position);
        this._targetPos.y = Math.max(0.2, this._targetPos.y + 0.12);
        this.built.targetHalo.position.set(
          spec.targetPosition[0],
          0.018,
          spec.targetPosition[2]
        );
        this.built.targetHalo.visible = true;
        this.emitSnapshot(true);
        return;
      }
      this.igniteStepFlame(stepId);
      this.heldStepId = null;
      return;
    }
    if (spec.kind === 'singing-bowl') {
      this.strikeSingingBowl(stepId);
      this.heldStepId = null;
      return;
    }
    if (spec.kind === 'tasbih-count') {
      this.advanceTasbih();
      this.heldStepId = null;
      return;
    }
    if (spec.kind === 'guided-reflection') {
      this.completeStep(spec.id);
      this.heldStepId = null;
      return;
    }

    if (entry.isBhogItem) {
      entry.seatedInPlate = false;
    }

    if (spec.gripStyle === 'kalash' || spec.gripStyle === 'handle' || spec.gripStyle === 'cradle') {
      this.audio.playBrassHandling();
    } else {
      this.audio.playFlowerPlace();
    }

    this._targetPos.copy(entry.root.position);
    this._targetPos.y = Math.max(0.22, this._targetPos.y + 0.12);

    this.built.targetHalo.position.set(
      spec.targetPosition[0],
      0.018,
      spec.targetPosition[2]
    );
    this.built.targetHalo.visible =
      spec.kind === 'place-item' || spec.kind === 'pour-water' || spec.kind === 'pour-milk';
    this.emitSnapshot(true);
  }

  private scheduleDrop(
    stepId: string,
    targetX: number,
    floorY: number,
    targetZ: number,
    massKg: number,
    heavy: boolean,
    onImpactSound: 'tray' | 'flower'
  ) {
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;
    const body = this.physicsWorld.getBody(stepId);
    if (body) {
      body.setKinematic(false);
      body.position.set(entry.root.position.x, Math.max(floorY + 0.04, entry.root.position.y), entry.root.position.z);
      body.velocity.set(0, -0.25, 0);
    }
    this.activeDrops.set(stepId, {
      state: {
        x: entry.root.position.x,
        y: Math.max(floorY + 0.04, entry.root.position.y),
        z: entry.root.position.z,
        vx: 0,
        vy: -0.25,
        vz: 0,
        settled: false
      },
      targetX,
      floorY,
      targetZ,
      massKg,
      heavy,
      onImpactSound
    });
  }

  private dropIndividualBhogItem(itemId: string, rawX: number, rawZ: number) {
    const entry = this.built.interactiveMeshes.get(itemId);
    const plateId = this.getServingPlateId();
    const plate = this.built.interactiveMeshes.get(plateId);
    if (!entry) return;

    const plateCircle = this.getBhogPlateCircle();
    let destX = THREE.MathUtils.clamp(rawX, -0.78, 0.78);
    let destZ = THREE.MathUtils.clamp(rawZ, -0.18, 0.6);

    if (plate && plateCircle) {
      const distToPlate = Math.hypot(destX - plateCircle.x, destZ - plateCircle.z);
      if (distToPlate <= plateCircle.radius * 1.35) {
        // Snap gently into the serving tray interior without overflowing the rim
        const clampR = Math.min(distToPlate, plateCircle.radius * 0.62);
        const angle = Math.atan2(destZ - plateCircle.z, destX - plateCircle.x);
        destX = plateCircle.x + Math.cos(angle) * clampR;
        destZ = plateCircle.z + Math.sin(angle) * clampR;
        entry.seatedInPlate = true;
        entry.localOffsetInPlate = new THREE.Vector3(
          destX - plateCircle.x,
          0.014,
          destZ - plateCircle.z
        );
      } else {
        entry.seatedInPlate = false;
        const sep = resolvePropSeparation(
          destX,
          destZ,
          itemId,
          entry.radius,
          this.getStaticProps(itemId),
          this.built.hasLingam
        );
        destX = sep.x;
        destZ = sep.z;
      }
    }

    const supportY = resolveObjectSupportY(
      destX,
      destZ,
      itemId,
      this.built.hasLingam,
      plateCircle
    );

    this.scheduleDrop(itemId, destX, supportY, destZ, 0.18, false, 'flower');
    this.audio.playPlacementChime();
  }

  private placeObjectAtTarget(stepId: string, preferredX?: number, preferredZ?: number) {
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;
    const spec = entry.spec;

    if (stepId === 'akshat-swastik' && this.built.akshatSwastikReveal) {
      this.built.akshatSwastikReveal.visible = true;
    }
    if (stepId === 'durga-chunari' && this.built.chunariDrape) {
      this.built.chunariDrape.visible = true;
    }

    const isFlower = this.isFlowerOfferingStep(stepId);
    const isLeaf = this.isLeafOfferingStep(stepId);
    const countForJitter = isFlower ? this.flowerOfferCount : this.leafOfferCount;
    const jitterAngle = (countForJitter * 1.25) % (Math.PI * 2);
    const jitterX = isFlower
      ? Math.cos(jitterAngle) * 0.065
      : isLeaf
      ? Math.cos(jitterAngle) * 0.025
      : ((this.completedIds.size % 3) - 1) * 0.032;
    const jitterZ = isFlower ? Math.sin(jitterAngle) * 0.045 : isLeaf ? Math.sin(jitterAngle) * 0.025 : 0;

    let destX =
      preferredX !== undefined
        ? preferredX
        : spec.targetPosition[0] +
          (stepId === 'durga-chunari' ||
          stepId === 'bhog-shiva' ||
          stepId === 'makhan-bowl'
            ? 0
            : jitterX);
    let destZ = preferredZ !== undefined ? preferredZ : spec.targetPosition[2] + jitterZ;

    if (!isLeaf && !isFlower) {
      const sep = resolvePropSeparation(
        destX,
        destZ,
        stepId,
        entry.radius,
        this.getStaticProps(stepId),
        this.built.hasLingam
      );
      destX = sep.x;
      destZ = sep.z;
    }

    const supportY = resolveObjectSupportY(
      destX,
      destZ,
      stepId,
      this.built.hasLingam,
      this.getBhogPlateCircle()
    );
    const isLightBotanical = spec.gripStyle === 'pinch';

    if (this.mode === 'normal' && isFlower && this.flowerOfferCount < 8) {
      this.built.spawnOfferedFlower(stepId, destX, supportY, destZ);
      this.flowerOfferCount += 1;
      const restX = spec.trayPosition[0];
      const restZ = Math.min(0.48, spec.trayPosition[2] - 0.08);
      const onRunner = Math.abs(restX) <= 0.74 && restZ >= 0.14 && restZ <= 0.68;
      entry.root.position.set(restX, onRunner ? 0.009 : 0.002, restZ);
      this.audio.playFlowerPlace();
    } else if (this.mode === 'normal' && isLeaf && this.leafOfferCount < 8) {
      this.built.spawnOfferedLeaf(stepId, destX, supportY, destZ);
      this.leafOfferCount += 1;
      const restX = spec.trayPosition[0];
      const restZ = Math.min(0.48, spec.trayPosition[2] - 0.08);
      const onRunner = Math.abs(restX) <= 0.74 && restZ >= 0.14 && restZ <= 0.68;
      entry.root.position.set(restX, onRunner ? 0.009 : 0.002, restZ);
      this.audio.playFlowerPlace();
    } else {
      this.scheduleDrop(
        stepId,
        destX,
        supportY,
        destZ,
        isLightBotanical ? 0.14 : 0.75,
        !isLightBotanical,
        isLightBotanical ? 'flower' : 'tray'
      );
    }

    this.audio.playPlacementChime();
    this.completeStep(stepId);
  }

  private releaseObjectToTray(stepId: string) {
    const entry = this.built.interactiveMeshes.get(stepId);
    if (!entry) return;
    if (
      this.completedIds.has(stepId) &&
      entry.spec.kind === 'place-item' &&
      !this.isFlowerOfferingStep(stepId) &&
      !this.isLeafOfferingStep(stepId)
    ) {
      return;
    }

    if (entry.isBhogItem) {
      const plate = this.getBhogPlateCircle();
      const tx = plate ? plate.x + (entry.localOffsetInPlate?.x ?? 0) : entry.spec.trayPosition[0];
      const tz = plate ? plate.z + (entry.localOffsetInPlate?.z ?? 0) : entry.spec.trayPosition[2];
      this.dropIndividualBhogItem(stepId, tx, tz);
      return;
    }

    const [tx, , tz] = entry.spec.trayPosition;
    const rawZ = Math.min(0.48, tz - 0.08);
    const sep = resolvePropSeparation(
      tx,
      rawZ,
      stepId,
      entry.radius,
      this.getStaticProps(stepId),
      this.built.hasLingam
    );
    const supportY = resolveObjectSupportY(
      sep.x,
      sep.z,
      stepId,
      this.built.hasLingam,
      this.getBhogPlateCircle()
    );
    const isLight = entry.spec.gripStyle === 'pinch';
    this.scheduleDrop(
      stepId,
      sep.x,
      supportY,
      sep.z,
      isLight ? 0.16 : 0.85,
      !isLight,
      isLight ? 'flower' : 'tray'
    );
  }

  private igniteStepFlame(stepId: string) {
    this.built.flames.forEach((f) => {
      f.lit = true;
    });
    this.audio.playFlameIgnite();
    this.completeStep(stepId);
  }

  private strikeSingingBowl(stepId: string) {
    this.singingBowlEnergy = 1.0;
    this.audio.playSingingBowl();
    this.completeStep(stepId);
  }

  private advanceTasbih() {
    this.tasbihCount = Math.min(33, this.tasbihCount + 1);
    if (this.built.tasbihWheel) {
      this.built.tasbihWheel.rotation.y += (Math.PI * 2) / 20;
    }
    this.audio.playTasbihClick();
    if (this.tasbihCount >= 7 && !this.completedIds.has('tasbih-beads')) {
      this.completeStep('tasbih-beads');
    } else {
      this.emitSnapshot(true);
    }
  }

  private completeStep(stepId: string) {
    if (!this.exp.steps.some((s) => s.id === stepId)) {
      this.emitSnapshot(true);
      return;
    }
    if (!this.completedIds.has(stepId)) {
      this.completedIds.add(stepId);
      this.lastCompletedId = stepId;
      if (stepId.includes('aarti')) {
        this.audio.playBell(1.0);
      } else if (!stepId.includes('tasbih') && !stepId.includes('bowl')) {
        this.audio.playBell(1.25);
      }
      const nextStep = this.exp.steps.find((s) => !this.completedIds.has(s.id));
      if (nextStep) {
        this.activeStepId = nextStep.id;
      }
    }
    this.emitSnapshot(true);
  }

  public recenterVR() {
    this.baselineAlpha = null;
    this.yawRad = 0;
    this.pitchRad = 0;
  }

  public resetRitual() {
    this.completedIds.clear();
    this.pourAccumulated.clear();
    this.liquidVolumes.clear();
    this.motionAccumulated.clear();
    this.activeDrops.clear();
    this.activeArcFlights = [];
    this.tasbihCount = 0;
    this.singingBowlEnergy = 0;
    const body = this.heldStepId ? this.physicsWorld.getBody(this.heldStepId) : undefined;
    if (body) {
      body.setKinematic(false);
    }

    this.heldStepId = null;
    this.heldViaDock = false;
    this.heldViaCamera = false;
    this.vrAutoStepId = null;
    this.vrAutoActionTimer = 0;
    this.tiltAngleRad = 0;
    this.currentPourRate = 0;
    this.reachTimer = 0;
    this.releaseFlashTimer = 0;
    this.flowerOfferCount = 0;
    this.leafOfferCount = 0;
    this.currentHandGesture = 'idle';
    this.lastCompletedId = null;
    this.audio.updatePourStream(0, false);
    this.built.clearPlacedOfferings();

    // Reset main ritual steps onto chowki / runner first
    this.built.interactiveMeshes.forEach((entry) => {
      if (entry.isBhogItem) return;
      const restX = entry.spec.trayPosition[0];
      const restZ = Math.min(0.48, entry.spec.trayPosition[2] - 0.08);
      const onRunner = Math.abs(restX) <= 0.74 && restZ >= 0.14 && restZ <= 0.68;
      const restY = onRunner ? 0.009 : 0.002;
      entry.root.position.set(restX, restY, restZ);
      entry.root.rotation.set(0, 0, 0);
    });

    // Re-seat individual Bhog / Makhan items inside the serving plate
    const bhogPlate = this.built.interactiveMeshes.get(this.getServingPlateId());
    if (bhogPlate) {
      const defaults: Record<string, [number, number, number]> = {
        'bhog-item-pom': [-0.024, 0.014, 0.016],
        'bhog-item-banana': [0.018, 0.014, 0.006],
        'bhog-item-peda': [0.002, 0.014, -0.028],
        'krishna-item-makhan': [-0.024, 0.014, 0.012],
        'krishna-item-mishri': [0.026, 0.014, 0.012],
        'krishna-item-peda': [0.0, 0.014, -0.028]
      };
      this.built.bhogItemIds.forEach((id) => {
        const item = this.built.interactiveMeshes.get(id);
        const off = defaults[id];
        if (!item || !off) return;
        item.seatedInPlate = true;
        item.localOffsetInPlate = new THREE.Vector3(off[0], off[1], off[2]);
        item.root.position.set(
          bhogPlate.root.position.x + off[0],
          bhogPlate.root.position.y + off[1],
          bhogPlate.root.position.z + off[2]
        );
        item.root.rotation.set(0, 0, 0);
      });
    }

    if (this.built.akshatSwastikReveal) this.built.akshatSwastikReveal.visible = false;
    if (this.built.chunariDrape) this.built.chunariDrape.visible = false;
    this.built.targetHalo.visible = false;
    this.activeStepId = this.exp.steps[0]?.id ?? null;
    this.emitSnapshot(true);
  }

  public handleResize() {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    this.camera.aspect = this.mode === 'vr' ? (w * 0.5) / h : w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public async requestWebXRSession(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('xr' in navigator)) return false;
    try {
      const xr = (navigator as unknown as { xr: { requestSession: (mode: string, options?: unknown) => Promise<any> } }).xr;
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
      });
      await this.renderer.xr.setSession(session);
      return true;
    } catch (err) {
      console.warn('WebXR session request error:', err);
      return false;
    }
  }

  private emitSnapshot(force = false) {
    const now = performance.now();
    if (!force && now - this.lastSnapshotEmit < 120) return;
    this.lastSnapshotEmit = now;

    const currentId = this.heldStepId ?? this.activeStepId;
    let actionProgress = 0;
    if (currentId) {
      actionProgress =
        this.pourAccumulated.get(currentId) ??
        this.motionAccumulated.get(currentId) ??
        (this.completedIds.has(currentId) ? 1 : 0);
    }

    const heldEntry = this.heldStepId ? this.built.interactiveMeshes.get(this.heldStepId) : undefined;
    const canPlaceHeld = Boolean(
      heldEntry && (heldEntry.spec.kind === 'place-item' || heldEntry.spec.kind === 'light-flame')
    );
    const isPour = heldEntry?.spec.kind === 'pour-water' || heldEntry?.spec.kind === 'pour-milk';
    const liquidRemaining =
      isPour && this.heldStepId ? (this.liquidVolumes.get(this.heldStepId) ?? 1.0) : undefined;

    let bannerTextKey: SceneHudSnapshot['bannerTextKey'] = 'idle';
    if (this.currentPourRate > 0.05) bannerTextKey = 'pouring';
    else if (this.heldStepId) bannerTextKey = 'holding';
    else if (this.reachTimer > 0.05) bannerTextKey = 'reach';
    else if (this.completedIds.size === this.exp.steps.length) bannerTextKey = 'completed';

    this.onSnapshot({
      activeStepId: this.activeStepId,
      heldStepId: this.heldStepId,
      heldCustomLabel: heldEntry?.isBhogItem ? heldEntry.spec.label : undefined,
      heldCustomAction: heldEntry?.isBhogItem ? heldEntry.spec.instructionAction : undefined,
      completedIds: Array.from(this.completedIds),
      pourRate: this.currentPourRate,
      tiltAngleRad: this.tiltAngleRad,
      tiltDegrees: Math.round((this.tiltAngleRad * 180) / Math.PI),
      actionProgress,
      tasbihCount: this.tasbihCount,
      gazeTargetId: this.gazeTargetId,
      gazeProgress: this.gazeProgress,
      sensorActive: this.sensorActive,
      bannerTextKey,
      handGesture: this.currentHandGesture,
      canPlaceHeld,
      nearStepId: this.nearStepId,
      lastCompletedId: this.lastCompletedId,
      liquidRemaining
    });
  }

  private syncSeatedBhogItems() {
    if (this.built.bhogItemIds.length === 0) return;
    const bhogPlate = this.built.interactiveMeshes.get(this.getServingPlateId());
    if (!bhogPlate) return;

    for (let i = 0; i < this.built.bhogItemIds.length; i++) {
      const id = this.built.bhogItemIds[i];
      if (id === this.heldStepId || this.activeDrops.has(id)) continue;
      const item = this.built.interactiveMeshes.get(id);
      if (!item || !item.seatedInPlate || !item.localOffsetInPlate) continue;
      item.root.position.set(
        bhogPlate.root.position.x + item.localOffsetInPlate.x,
        bhogPlate.root.position.y + item.localOffsetInPlate.y,
        bhogPlate.root.position.z + item.localOffsetInPlate.z
      );
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 32);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const rawDt = Math.max(
      0.001,
      Math.min((nowMs - this.lastTickMs) / 1000, this.isSoftwareGl ? 0.36 : 0.14)
    );
    const dt = Math.min(rawDt, this.isSoftwareGl ? 0.24 : 0.06);
    const elapsed = (nowMs - this.startTimeMs) / 1000;
    this.lastTickMs = nowMs;

    for (let i = 0; i < this.built.flames.length; i++) {
      this.built.flames[i].update(elapsed, dt);
    }

    if (this.built.singingBowlRipple) {
      if (this.singingBowlEnergy > 0.01) {
        this.singingBowlEnergy = Math.max(0, this.singingBowlEnergy - dt * 0.25);
        const pulse = 1 + ((elapsed * 1.8) % 1) * 0.85;
        this.built.singingBowlRipple.scale.setScalar(pulse);
        (this.built.singingBowlRipple.material as THREE.MeshBasicMaterial).opacity =
          this.singingBowlEnergy * 0.55;
      } else {
        (this.built.singingBowlRipple.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    // Step smooth curved offering flights (flowers, leaves, Bhog trays triggered by gestures)
    for (let i = this.activeArcFlights.length - 1; i >= 0; i--) {
      const flight = this.activeArcFlights[i];
      const entry = this.built.interactiveMeshes.get(flight.stepId);
      if (!entry) {
        this.activeArcFlights.splice(i, 1);
        continue;
      }
      flight.progress = Math.min(1, flight.progress + rawDt / flight.durationSec);
      const t = flight.progress;
      const smooth = t * t * (3 - 2 * t);
      const lift = Math.sin(t * Math.PI) * flight.arcHeight;
      entry.root.position.set(
        THREE.MathUtils.lerp(flight.startX, flight.destX, smooth),
        THREE.MathUtils.lerp(flight.startY, flight.destY, smooth) + lift,
        THREE.MathUtils.lerp(flight.startZ, flight.destZ, smooth)
      );
      if (flight.progress >= 1) {
        this.activeArcFlights.splice(i, 1);
        if (flight.stepId === 'akshat-swastik' && this.built.akshatSwastikReveal) {
          this.built.akshatSwastikReveal.visible = true;
        }
        if (flight.stepId === 'durga-chunari' && this.built.chunariDrape) {
          this.built.chunariDrape.visible = true;
        }
        if (flight.spawnKind === 'flower' && this.flowerOfferCount < 8) {
          this.built.spawnOfferedFlower(flight.stepId, flight.destX, flight.destY, flight.destZ);
          this.flowerOfferCount += 1;
          const restX = entry.spec.trayPosition[0];
          const restZ = Math.min(0.48, entry.spec.trayPosition[2] - 0.08);
          const onRunner = Math.abs(restX) <= 0.74 && restZ >= 0.14 && restZ <= 0.68;
          entry.root.position.set(restX, onRunner ? 0.009 : 0.002, restZ);
          this.audio.playFlowerPlace();
        } else if (flight.spawnKind === 'leaf' && this.leafOfferCount < 8) {
          this.built.spawnOfferedLeaf(flight.stepId, flight.destX, flight.destY, flight.destZ);
          this.leafOfferCount += 1;
          const restX = entry.spec.trayPosition[0];
          const restZ = Math.min(0.48, entry.spec.trayPosition[2] - 0.08);
          const onRunner = Math.abs(restX) <= 0.74 && restZ >= 0.14 && restZ <= 0.68;
          entry.root.position.set(restX, onRunner ? 0.009 : 0.002, restZ);
          this.audio.playFlowerPlace();
        } else {
          entry.root.position.set(flight.destX, flight.destY, flight.destZ);
          this.audio.playTraySettle(true);
        }
        this.audio.playPlacementChime();
        this.completeStep(flight.stepId);
      }
    }

    // 1. Step Bespoke 3D Continuous Collision & Rigid-Body Physics
    this.physicsWorld.step(rawDt);

    // Step rigid-body drop physics cleanly in <= 0.05s sub-steps so drops settle in real time
    const dropSteps = Math.max(2, Math.min(8, Math.ceil(rawDt / 0.05)));
    const subDt = rawDt / dropSteps;
    this.activeDrops.forEach((drop, stepId) => {
      const entry = this.built.interactiveMeshes.get(stepId);
      if (!entry) {
        this.activeDrops.delete(stepId);
        return;
      }
      const prevSettled = drop.state.settled;
      for (let s = 0; s < dropSteps && !drop.state.settled; s++) {
        drop.state = stepOfferingDrop(
          drop.state,
          drop.targetX,
          drop.floorY,
          drop.targetZ,
          drop.massKg,
          subDt
        );
      }
      entry.root.position.set(drop.state.x, drop.state.y, drop.state.z);
      entry.root.rotation.z = THREE.MathUtils.damp(entry.root.rotation.z, 0, 14, rawDt);
      if (!prevSettled && drop.state.settled) {
        const b = this.physicsWorld.getBody(stepId);
        if (b) {
          b.position.copy(entry.root.position);
          b.velocity.set(0, 0, 0);
          b.isGrounded = true;
        }
        if (drop.onImpactSound === 'flower') {
          this.audio.playFlowerPlace();
        } else {
          this.audio.playTraySettle(drop.heavy);
        }
        this.activeDrops.delete(stepId);
      }
    });

    if (this.mode === 'vr') {
      const lookQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(this.pitchRad - 0.3, this.yawRad, 0, 'YXZ')
      );
      this.camera.quaternion.slerp(lookQuat, 1 - Math.exp(-12 * dt));

      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      const gazeHits = this.raycaster.intersectObjects(this.hitTargets, false);
      const hitId = gazeHits.length > 0 ? (gazeHits[0].object.userData.stepId as string) : null;

      if (hitId && hitId !== this.vrAutoStepId) {
        if (this.gazeTargetId !== hitId) {
          this.gazeTargetId = hitId;
          this.gazeProgress = 0;
        }
        const res = advanceGazeHold(true, this.gazeProgress, dt, 1.15);
        this.gazeProgress = res.progress;
        if (res.triggered) {
          this.gazeProgress = 0;
          this.selectAndActivateStep(hitId);
        }
      } else {
        const res = advanceGazeHold(false, this.gazeProgress, dt, 1.15);
        this.gazeProgress = res.progress;
        if (this.gazeProgress <= 0.01) this.gazeTargetId = null;
      }
    } else {
      this.camera.position.set(0, 0.72, 1.82);
      this.camera.lookAt(0, 0.28, -0.04);
    }

    if (this.vrAutoStepId && this.vrAutoActionTimer > 0) {
      this.vrAutoActionTimer -= dt;
      const autoEntry = this.built.interactiveMeshes.get(this.vrAutoStepId);
      if (autoEntry) {
        const sp = autoEntry.spec;
        if (sp.kind === 'aarti-wave' || sp.kind === 'chaur-seva') {
          const ang = elapsed * 2.6;
          this._targetPos.set(
            sp.targetPosition[0] + Math.cos(ang) * 0.22,
            sp.targetPosition[1] + Math.sin(ang * 2) * 0.06,
            sp.targetPosition[2] + Math.sin(ang) * 0.1
          );
          const cur = this.motionAccumulated.get(sp.id) ?? 0;
          const next = advanceMotionProgress(cur, dt * 1.0, 2.8);
          this.motionAccumulated.set(sp.id, next);
          if (next >= 1 && !this.completedIds.has(sp.id)) {
            this.completeStep(sp.id);
          }
        }
      }
      if (this.vrAutoActionTimer <= 0) {
        const finishedId = this.vrAutoStepId;
        this.vrAutoStepId = null;
        this.tiltAngleRad = 0;
        this.currentPourRate = 0;
        this.audio.updatePourStream(0, false);
        this.releaseObjectToTray(finishedId);
        this.heldStepId = null;
        this.releaseFlashTimer = 0.4;
        this.built.targetHalo.visible = false;
        this.emitSnapshot(true);
      }
    }

    let pourRateThisFrame = 0;
    let isMilkThisFrame = false;

    if (this.heldStepId) {
      const entry = this.built.interactiveMeshes.get(this.heldStepId);
      if (entry) {
        const spec = entry.spec;

        if (
          this.mode === 'normal' &&
          this.heldViaDock &&
          !this.isPointerDown &&
          (spec.kind === 'aarti-wave' || spec.kind === 'chaur-seva')
        ) {
          const ang = elapsed * 2.4;
          this._targetPos.set(
            spec.targetPosition[0] + Math.cos(ang) * 0.2,
            spec.targetPosition[1] + Math.sin(ang * 2) * 0.05,
            spec.targetPosition[2] + Math.sin(ang) * 0.08
          );
          const cur = this.motionAccumulated.get(spec.id) ?? 0;
          const next = advanceMotionProgress(cur, dt * 0.85, 2.8);
          this.motionAccumulated.set(spec.id, next);
          if (next >= 1 && !this.completedIds.has(spec.id)) {
            this.completeStep(spec.id);
          }
        }

        const clamped = this.clampTargetWithPhysics(
          this._targetPos.x,
          this._targetPos.y,
          this._targetPos.z,
          spec.id === 'bilva-patra' ? null : this.heldStepId
        );
        // Elevate slightly over obstacles when transitioning across the Lingam so lerp never tunnels through stone
        if (
          this.built.hasLingam &&
          spec.id !== 'bilva-patra' &&
          Math.hypot(entry.root.position.x, entry.root.position.z + 0.05) < 0.28 &&
          entry.root.position.y < clamped.y - 0.08
        ) {
          entry.root.position.y = THREE.MathUtils.lerp(
            entry.root.position.y,
            clamped.y,
            1 - Math.exp(-24 * dt)
          );
        }
        entry.root.position.lerp(clamped, 1 - Math.exp(-16 * dt));
        // Enforce non-penetration on the actual interpolated position every frame
        const resolvedCur = this.clampTargetWithPhysics(
          entry.root.position.x,
          entry.root.position.y,
          entry.root.position.z,
          spec.id === 'bilva-patra' ? null : this.heldStepId
        );
        entry.root.position.copy(resolvedCur);

        if (spec.kind === 'pour-water' || spec.kind === 'pour-milk') {
          isMilkThisFrame = spec.kind === 'pour-milk';

          // Orient the tilt quaternion towards the deity target position (Lingam apex)
          const toTargetX = spec.targetPosition[0] - entry.root.position.x;
          const toTargetZ = spec.targetPosition[2] - entry.root.position.z;
          const toTargetDist = Math.hypot(toTargetX, toTargetZ);

          if (toTargetDist > 0.02) {
            const tiltDirX = toTargetX / toTargetDist;
            const tiltDirZ = toTargetZ / toTargetDist;
            const tiltAxis = new THREE.Vector3(tiltDirZ, 0, -tiltDirX).normalize();
            const targetQuat = new THREE.Quaternion().setFromAxisAngle(tiltAxis, this.tiltAngleRad);
            entry.root.quaternion.slerp(targetQuat, 1 - Math.exp(-14 * dt));
          } else {
            entry.root.rotation.z = THREE.MathUtils.damp(entry.root.rotation.z, this.tiltAngleRad, 14, dt);
          }

          let currentVol = this.liquidVolumes.get(spec.id);
          if (currentVol === undefined) {
            currentVol = 1.0;
            this.liquidVolumes.set(spec.id, currentVol);
          }

          if (entry.liquidSurface) {
            if (currentVol > 0.005) {
              entry.liquidSurface.visible = true;
              // Finite liquid height: drops from top rim (0.133) down to bottom (0.026) as vessel empties
              const lvlY = THREE.MathUtils.lerp(0.026, 0.133, Math.pow(currentVol, 0.65));
              entry.liquidSurface.position.y = lvlY;
              // Scale radius according to internal Kalash lathe contour
              const radFactor = THREE.MathUtils.lerp(0.62, 1.0, Math.sin(currentVol * Math.PI * 0.85 + 0.15));
              entry.liquidSurface.scale.set(radFactor, radFactor, 1);
              // Liquid meniscus stays horizontal relative to gravity
              entry.liquidSurface.rotation.order = 'ZYX';
              entry.liquidSurface.rotation.z = -this.tiltAngleRad * 0.92;
              entry.liquidSurface.position.x = -Math.sin(this.tiltAngleRad) * 0.012 * currentVol;
            } else {
              entry.liquidSurface.visible = false;
            }
          }
          entry.root.updateMatrixWorld(true);

          // Physical vessel opening specification matching copper/brass Kalash dimensions
          const vesselOpeningSpec: VesselOpeningSpec = {
            rimRadius: 0.048,
            rimHeight: 0.148,
            localOpeningCenter: new THREE.Vector3(0, 0.148, 0),
            localOpeningNormal: new THREE.Vector3(0, 1, 0),
            containerHeight: 0.155,
            fullCapacityLitres: 1.0,
            neckConstrictionRadius: 0.038
          };

          const body = this.physicsWorld.getBody(spec.id);
          const pourResult = calculatePhysicalVesselPour(
            vesselOpeningSpec,
            entry.root.position,
            entry.root.quaternion,
            currentVol,
            body ? body.velocity : undefined
          );

          // Physical liquid depletion: drain water strictly when lowest rim lip dips below liquid level
          if (pourResult.isPouring && currentVol > 0) {
            const drainRate = dt * (0.24 * pourResult.flowRate);
            currentVol = Math.max(0, currentVol - drainRate);
            this.liquidVolumes.set(spec.id, currentVol);
          }

          // Effective pour rate cuts to zero when empty, tapering gracefully on the last few drops
          pourRateThisFrame = currentVol <= 0.001
            ? 0
            : pourResult.flowRate * Math.min(1.0, currentVol * 4.5);

          this.currentPourRate = pourRateThisFrame;
          this.audio.updatePourStream(pourRateThisFrame, isMilkThisFrame);

          if (this.built.shivaFluid) {
            this.built.shivaFluid.update(
              pourRateThisFrame,
              isMilkThisFrame,
              pourResult.emissionPoint,
              0,
              0,
              elapsed,
              dt,
              pourResult.emissionVelocity
            );
          }

          const pouredFraction = Math.min(1, 1 - currentVol);
          this.pourAccumulated.set(spec.id, pouredFraction);
          if (pouredFraction >= 0.88 && !this.completedIds.has(spec.id)) {
            this.completeStep(spec.id);
          }
        } else {
          entry.root.rotation.z = THREE.MathUtils.damp(entry.root.rotation.z, 0, 12, dt);
          if (this.built.shivaFluid) {
            this.built.shivaFluid.update(0, false, this._spoutWorld, -1, 0, elapsed, dt);
          }
        }

        const gesture: HandGestureState =
          pourRateThisFrame > 0.06
            ? 'pour'
            : spec.kind === 'aarti-wave' || spec.kind === 'chaur-seva'
            ? 'wave'
            : 'grip';
        this.currentHandGesture = gesture;
        const hideSynthetic = this.mode === 'normal';
        this.hands.setTarget(
          'right',
          entry.root.position,
          this.tiltAngleRad,
          1.0,
          spec.gripStyle,
          gesture,
          dt,
          elapsed,
          this.liveCameraRight,
          this.liveCameraLeft,
          hideSynthetic,
          this.isPointerDown
        );
      }
    } else {
      if (this.built.shivaFluid) {
        this.built.shivaFluid.update(0, false, this._spoutWorld, -1, 0, elapsed, dt);
      }
      const hideSynthetic = this.mode === 'normal';
      if (this.releaseFlashTimer > 0) {
        this.releaseFlashTimer = Math.max(0, this.releaseFlashTimer - dt);
        this.currentHandGesture = 'release';
        this.hands.setTarget(
          'right',
          this._hoverWorld,
          0,
          0.08,
          'cradle',
          'release',
          dt,
          elapsed,
          this.liveCameraRight,
          this.liveCameraLeft,
          hideSynthetic,
          false
        );
      } else if (this.reachTimer > 0) {
        this.reachTimer = Math.max(0, this.reachTimer - dt);
        this.currentHandGesture = 'reach';
        this.hands.setTarget(
          'right',
          this._hoverWorld,
          0,
          0.12,
          'cradle',
          'reach',
          dt,
          elapsed,
          this.liveCameraRight,
          this.liveCameraLeft,
          hideSynthetic,
          this.isPointerDown
        );
      } else {
        this.currentHandGesture = this.liveCameraRight?.isPinching ? 'grip' : 'idle';
        this.hands.setTarget(
          'idle',
          this._hoverWorld,
          0,
          0.14,
          'kalash',
          'idle',
          dt,
          elapsed,
          this.liveCameraRight,
          this.liveCameraLeft,
          hideSynthetic,
          false
        );
      }
    }

    // Keep Bhog fruit & sweets riding flush inside Bhog plate whenever plate moves or drops
    this.syncSeatedBhogItems();

    this.currentPourRate = pourRateThisFrame;
    this.audio.updatePourStream(pourRateThisFrame, isMilkThisFrame);
    this.emitSnapshot(false);

    if (this.renderer.xr.isPresenting) {
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene, this.camera);
    } else if (this.mode === 'vr') {
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      const halfW = Math.floor(size.x / 2);
      const fullH = Math.floor(size.y);

      this.camera.updateMatrixWorld();
      this.stereoCam.update(this.camera);

      this.renderer.setScissorTest(true);

      this.renderer.setScissor(0, 0, halfW, fullH);
      this.renderer.setViewport(0, 0, halfW, fullH);
      this.renderer.render(this.scene, this.stereoCam.cameraL);

      this.renderer.setScissor(halfW, 0, size.x - halfW, fullH);
      this.renderer.setViewport(halfW, 0, size.x - halfW, fullH);
      this.renderer.render(this.scene, this.stereoCam.cameraR);

      this.renderer.setScissorTest(false);
    } else {
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.unbindEvents();
    this.audio.updatePourStream(0, false);
    this.built.dispose();
    this.hands.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
