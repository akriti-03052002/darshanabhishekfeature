import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ExperienceSpec, RitualObjectSpec, ViewMode } from '../data/experiences';
import { getTraditionVisualAsset } from '../data/assetManifest';
import { computeFluidDynamics, computeStreamArcPoints } from '../logic/ritualEngine';
import { BUNDLED_SHRINE_IMAGES, TextureBundle } from './proceduralTextures';

export interface FlameRig {
  group: THREE.Group;
  outerSprite: THREE.Sprite;
  coreSprite: THREE.Sprite;
  smokeSprite: THREE.Sprite | null;
  light: THREE.PointLight;
  lit: boolean;
  update: (time: number, dt: number) => void;
}

export interface ShivaFluidRig {
  streamMesh: THREE.Mesh;
  streamMat: THREE.MeshPhysicalMaterial;
  surfaceFilm: THREE.Mesh;
  surfaceFilmMat: THREE.MeshPhysicalMaterial;
  drainStream: THREE.Mesh;
  basinLiquid: THREE.Mesh;
  basinLiquidMat: THREE.MeshPhysicalMaterial;
  splashInstanced: THREE.InstancedMesh;
  update: (
    pourRate: number,
    isMilk: boolean,
    spoutWorldPos: THREE.Vector3,
    pourDirX: number,
    pourDirZ: number,
    time: number,
    dt: number,
    emissionVelocity?: THREE.Vector3
  ) => void;
}

export interface InteractivePropEntry {
  root: THREE.Group;
  hitProxy: THREE.Mesh;
  spoutTip?: THREE.Object3D;
  liquidSurface?: THREE.Mesh;
  spec: RitualObjectSpec;
  radius: number;
  height: number;
  isBhogItem?: boolean;
  seatedInPlate?: boolean;
  localOffsetInPlate?: THREE.Vector3;
}

export interface BuiltFocalScene {
  focalGroup: THREE.Group;
  placedOfferingsGroup: THREE.Group;
  shivaFluid: ShivaFluidRig | null;
  flames: FlameRig[];
  interactiveMeshes: Map<string, InteractivePropEntry>;
  bhogItemIds: string[];
  hasLingam: boolean;
  singingBowlRipple: THREE.Mesh | null;
  tasbihWheel: THREE.Group | null;
  akshatSwastikReveal: THREE.Group | null;
  chunariDrape: THREE.Mesh | null;
  targetHalo: THREE.Mesh;
  spawnOfferedFlower: (stepId: string, x: number, y: number, z: number) => void;
  spawnOfferedLeaf: (stepId: string, x: number, y: number, z: number) => void;
  clearPlacedOfferings: () => void;
  dispose: () => void;
}

function makeContactShadow(tex: THREE.Texture, radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 24);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.44
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.004;
  return mesh;
}

function createFlameRig(
  textures: TextureBundle,
  colorHex = 0xffa638,
  intensity = 1.15,
  initiallyLit = false,
  withSmoke = true
): FlameRig {
  const group = new THREE.Group();

  const outerMat = new THREE.SpriteMaterial({
    map: textures.flameSpriteMap,
    color: colorHex,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const outerSprite = new THREE.Sprite(outerMat);
  outerSprite.scale.set(0.032, 0.052, 1);
  outerSprite.position.set(0, 0.025, 0);

  const coreMat = new THREE.SpriteMaterial({
    map: textures.flameSpriteMap,
    color: 0xfffce8,
    transparent: true,
    opacity: 0.96,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const coreSprite = new THREE.Sprite(coreMat);
  coreSprite.scale.set(0.015, 0.026, 1);
  coreSprite.position.set(0, 0.016, 0);

  let smokeSprite: THREE.Sprite | null = null;
  if (withSmoke) {
    const smokeMat = new THREE.SpriteMaterial({
      map: textures.smokeSpriteMap,
      color: 0xe8e4dc,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    });
    smokeSprite = new THREE.Sprite(smokeMat);
    smokeSprite.scale.set(0.04, 0.055, 1);
    smokeSprite.position.set(0, 0.068, 0);
    group.add(smokeSprite);
  }

  const light = new THREE.PointLight(colorHex, initiallyLit ? intensity : 0, 2.4, 2.0);
  light.position.set(0, 0.045, 0);

  group.add(outerSprite, coreSprite, light);
  outerSprite.visible = initiallyLit;
  coreSprite.visible = initiallyLit;
  if (smokeSprite) smokeSprite.visible = initiallyLit;

  const phase = Math.random() * Math.PI * 2;
  const rig: FlameRig = {
    group,
    outerSprite,
    coreSprite,
    smokeSprite,
    light,
    lit: initiallyLit,
    update: (time: number, _dt: number) => {
      outerSprite.visible = rig.lit;
      coreSprite.visible = rig.lit;
      if (smokeSprite) smokeSprite.visible = rig.lit;
      if (!rig.lit) {
        light.intensity = 0;
        return;
      }
      const t = time + phase;
      const swayX = Math.sin(t * 3.2) * 0.0012;
      const pulse = Math.sin(t * 4.5) * 0.04;
      outerSprite.scale.set(0.032 * (1 - pulse * 0.2), 0.052 * (1 + pulse * 0.4), 1);
      outerSprite.position.set(swayX, 0.025, 0);
      coreSprite.scale.set(0.015 * (1 - pulse * 0.1), 0.026 * (1 + pulse * 0.2), 1);
      coreSprite.position.set(swayX * 0.5, 0.016, 0);

      if (smokeSprite) {
        const rise = (t * 0.42) % 1;
        smokeSprite.position.set(Math.sin(t * 2.4) * 0.01, 0.056 + rise * 0.11, 0);
        smokeSprite.scale.setScalar(0.028 + rise * 0.042);
        (smokeSprite.material as THREE.SpriteMaterial).opacity = (1 - rise) * 0.2;
      }
      // Calm, stable illumination with very subtle natural warmth variation (eliminating annoying flickering)
      light.intensity = intensity * (0.98 + Math.sin(t * 2.4) * 0.03);
    }
  };
  return rig;
}

function buildKalashMesh(
  textures: TextureBundle,
  brassMat: THREE.Material,
  isMilk: boolean
): { group: THREE.Group; spoutTip: THREE.Object3D; liquidSurface: THREE.Mesh } {
  const g = new THREE.Group();
  // Authentic hand-hammered antique red copper for milk vessel (Panel 3 & 4 Reference) or warm golden brass for Gangajal Kalash (Real Photographic Textures)
  const bodyMat = isMilk
    ? new THREE.MeshStandardMaterial({
        color: 0xffffff, // Pure real photographic hammered copper texture!
        map: textures.copperMap,
        roughnessMap: textures.copperRoughness,
        bumpMap: textures.copperRoughness,
        bumpScale: 0.003,
        roughness: 0.28,
        metalness: 0.90,
        envMapIntensity: 1.25
      })
    : new THREE.MeshStandardMaterial({
        color: 0xffffff, // Pure real photographic hammered antique brass texture!
        map: textures.brassMap,
        roughnessMap: textures.brassRoughness,
        bumpMap: textures.brassRoughness,
        bumpScale: 0.003,
        roughness: 0.26,
        metalness: 0.88,
        envMapIntensity: 1.30
      });

  // Hollow Kalash lathe profile with outer body, flared pouring lip, and authentic inner vessel wall
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.044, 0),
    new THREE.Vector2(0.068, 0.038),
    new THREE.Vector2(0.072, 0.074),
    new THREE.Vector2(0.046, 0.112),
    new THREE.Vector2(0.038, 0.132),
    new THREE.Vector2(0.053, 0.149),
    new THREE.Vector2(0.045, 0.15),
    new THREE.Vector2(0.032, 0.131),
    new THREE.Vector2(0.04, 0.106),
    new THREE.Vector2(0.056, 0.07),
    new THREE.Vector2(0.001, 0.015)
  ];
  const geo = new THREE.LatheGeometry(pts, 36);
  const vessel = new THREE.Mesh(geo, bodyMat);
  vessel.castShadow = true;
  vessel.receiveShadow = true;
  g.add(vessel);

  // Pure Crystalline Holy Gangajal (clear transparent liquid) or rich opaque creamy milk
  const liquidMat = isMilk
    ? new THREE.MeshStandardMaterial({
        color: 0xfbf8f2,
        roughness: 0.32,
        metalness: 0.0
      })
    : new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.015,
        metalness: 0.0,
        transparent: true,
        opacity: 0.88,
        transmission: 0.94,
        ior: 1.333,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        reflectivity: 0.85
      });
  const liquidSurface = new THREE.Mesh(new THREE.CircleGeometry(0.034, 24), liquidMat);
  liquidSurface.rotation.x = -Math.PI / 2;
  liquidSurface.position.y = 0.129;
  g.add(liquidSurface);

  // Sacred Kalash Mauli (Kalava) Sacred Thread Band tied around vessel neck (Panel 3 Reference)
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b, // Sacred red cotton kalava cord
    roughness: 0.78,
    metalness: 0.02
  });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0032, 8, 28), bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.122;
  g.add(band);

  const spoutTip = new THREE.Object3D();
  spoutTip.position.set(-0.048, 0.148, 0);
  g.add(spoutTip);

  return { group: g, spoutTip, liquidSurface };
}

function buildBilvaLeafCluster(textures: TextureBundle): THREE.Group {
  const g = new THREE.Group();
  const leafMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: textures.leafMap,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.24,
    clearcoatRoughness: 0.36,
    side: THREE.DoubleSide
  });

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.024, 0.015, 0.022, 0.044, 0, 0.062);
  shape.bezierCurveTo(-0.022, 0.044, -0.024, 0.015, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(shape, 16);
  const pos = leafGeo.attributes.position;
  const uvArr = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, Math.sin((y / 0.062) * Math.PI) * 0.0055 - Math.abs(x) * 0.16);
    // Normalize UVs [0..1] cleanly so central midrib and venation align along every leaf blade
    uvArr[i * 2] = THREE.MathUtils.clamp((x + 0.024) / 0.048, 0.02, 0.98);
    uvArr[i * 2 + 1] = THREE.MathUtils.clamp(y / 0.062, 0.02, 0.98);
  }
  leafGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  leafGeo.computeVertexNormals();

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3b662b, roughness: 0.65 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0022, 0.032, 8), stemMat);
  stem.rotation.x = Math.PI / 2;
  stem.position.set(0, 0.008, 0.016);
  g.add(stem);

  const angles = [0, 1.05, -1.05];
  angles.forEach((ang, idx) => {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.rotation.x = -Math.PI / 2 + 0.16;
    leaf.rotation.z = ang;
    leaf.scale.setScalar(idx === 0 ? 1.14 : 0.92);
    leaf.position.set(Math.sin(ang) * 0.008, 0.011, -Math.cos(ang) * 0.004);
    leaf.castShadow = true;
    g.add(leaf);
  });
  return g;
}

function buildFlowerCluster(textures: TextureBundle, colorHex: number, isLotus = false): THREE.Group {
  const g = new THREE.Group();
  const isWarmMarigold =
    !isLotus && (colorHex === 0xf59e0b || colorHex === 0xea580c || colorHex === 0xf97316);
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: isWarmMarigold ? (colorHex === 0xea580c ? 0xffb380 : 0xffffff) : colorHex,
    map: isWarmMarigold ? textures.marigoldPetalMap : textures.petalMap,
    roughness: 0.44,
    metalness: 0.01,
    sheen: 0.32,
    sheenColor: new THREE.Color(0xfffaf0),
    side: THREE.DoubleSide
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: isLotus ? 0xfacc15 : isWarmMarigold ? 0xd97706 : 0xb45309,
    roughness: 0.62
  });

  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.quadraticCurveTo(0.016, 0.016, 0, 0.043);
  petalShape.quadraticCurveTo(-0.016, 0.016, 0, 0);
  const petalGeo = new THREE.ShapeGeometry(petalShape, 12);
  const pos = petalGeo.attributes.position;
  const uvArr = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, y * y * 3.8 + Math.sin(x * 180) * 0.0012);
    uvArr[i * 2] = THREE.MathUtils.clamp((x + 0.016) / 0.032, 0.02, 0.98);
    uvArr[i * 2 + 1] = THREE.MathUtils.clamp(y / 0.043, 0.02, 0.98);
  }
  petalGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  petalGeo.computeVertexNormals();

  // Green botanical calyx cup beneath petals
  const calyx = new THREE.Mesh(
    new THREE.ConeGeometry(0.013, 0.011, 10),
    new THREE.MeshStandardMaterial({ color: 0x366527, roughness: 0.72 })
  );
  calyx.rotation.x = Math.PI;
  calyx.position.y = 0.006;
  g.add(calyx);

  const rings = isLotus
    ? [
        { count: 10, tilt: 0.85, scale: 1.08, y: 0.012, r: 0.012 },
        { count: 8, tilt: 0.45, scale: 0.88, y: 0.018, r: 0.008 }
      ]
    : [
        { count: 14, tilt: 1.05, scale: 1.04, y: 0.01, r: 0.012 },
        { count: 11, tilt: 0.65, scale: 0.84, y: 0.018, r: 0.007 },
        { count: 8, tilt: 0.34, scale: 0.6, y: 0.024, r: 0.004 }
      ];

  rings.forEach((ring, rIdx) => {
    for (let i = 0; i < ring.count; i++) {
      const ang = (i / ring.count) * Math.PI * 2 + rIdx * 0.32;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(Math.cos(ang) * ring.r, ring.y, Math.sin(ang) * ring.r);
      petal.rotation.order = 'YXZ';
      petal.rotation.y = -ang + Math.PI / 2;
      petal.rotation.x = ring.tilt;
      petal.scale.setScalar(ring.scale);
      petal.castShadow = true;
      g.add(petal);
    }
  });

  const core = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), centerMat);
  core.scale.set(1, 0.62, 1);
  core.position.y = 0.021;
  g.add(core);
  return g;
}

function buildSingleFoodMesh(
  textures: TextureBundle,
  kind: 'pom' | 'banana' | 'peda' | 'makhan-scoop' | 'mishri' | 'coconut'
): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'coconut') {
    // Authentic Cracked Half Coconut (Panel 3 Reference - real sacred offering size)
    const huskMat = new THREE.MeshStandardMaterial({
      color: 0x482e1c, // Fibrous brown coir husk
      roughness: 0.92,
      metalness: 0.02
    });
    // Outer fibrous coconut shell
    const huskGeo = new THREE.SphereGeometry(0.032, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const husk = new THREE.Mesh(huskGeo, huskMat);
    husk.rotation.x = Math.PI * 0.92;
    husk.rotation.y = 0.25;
    husk.position.set(0, 0.008, 0);
    husk.castShadow = true;
    g.add(husk);

    // Thick crisp white coconut meat lining
    const meatMat = new THREE.MeshStandardMaterial({
      color: 0xfcfdfd, // Pure fresh coconut kernel
      roughness: 0.35,
      metalness: 0.0
    });
    const meatGeo = new THREE.SphereGeometry(0.029, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const meat = new THREE.Mesh(meatGeo, meatMat);
    meat.rotation.x = Math.PI * 0.92;
    meat.rotation.y = 0.25;
    meat.position.set(0, 0.009, 0);
    g.add(meat);

    // Cut rim where white meat meets brown shell
    const meatRim = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.032, 24), meatMat);
    meatRim.rotation.x = -Math.PI * 0.08;
    meatRim.rotation.y = 0.25;
    meatRim.position.set(0, 0.015, 0);
    g.add(meatRim);
  } else if (kind === 'pom') {
    const pomMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.fruitMap,
      roughness: 0.42,
      clearcoat: 0.18
    });
    const pomPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.02, 0.006),
      new THREE.Vector2(0.029, 0.024),
      new THREE.Vector2(0.026, 0.042),
      new THREE.Vector2(0.012, 0.052),
      new THREE.Vector2(0.007, 0.057),
      new THREE.Vector2(0.011, 0.061),
      new THREE.Vector2(0.001, 0.058)
    ];
    const pom = new THREE.Mesh(new THREE.LatheGeometry(pomPts, 22), pomMat);
    pom.castShadow = true;
    pom.receiveShadow = true;
    g.add(pom);
  } else if (kind === 'banana') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.028, 0.014, -0.022),
      new THREE.Vector3(-0.004, 0.01, -0.004),
      new THREE.Vector3(0.018, 0.016, 0.016),
      new THREE.Vector3(0.028, 0.032, 0.032)
    ]);
    const banGeo = new THREE.TubeGeometry(curve, 16, 0.011, 10, false);
    const banMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.bananaMap,
      roughness: 0.46
    });
    const ban = new THREE.Mesh(banGeo, banMat);
    ban.castShadow = true;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.005, 0.012, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c4318, roughness: 0.85 })
    );
    tip.position.set(0.029, 0.036, 0.034);
    g.add(ban, tip);
  } else if (kind === 'makhan-scoop') {
    const butterMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.makhanMap,
      bumpMap: textures.makhanBump,
      bumpScale: 0.0032,
      roughness: 0.34,
      sheen: 0.42,
      sheenColor: new THREE.Color(0xfffbeb),
      clearcoat: 0.14
    });
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.024, 18, 14), butterMat);
    base.scale.set(1.15, 0.58, 1.08);
    base.position.y = 0.012;
    base.castShadow = true;

    const midTier = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), butterMat);
    midTier.scale.set(1.05, 0.65, 1.02);
    midTier.position.set(0.002, 0.022, -0.001);
    midTier.castShadow = true;

    const swirl = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.017, 14), butterMat);
    swirl.position.set(0.003, 0.032, -0.002);
    swirl.rotation.z = -0.22;

    // Real photographic serrated Tulsi leaf cutouts crowning the fresh white butter
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.leafCutoutMap,
      alphaTest: 0.38,
      roughness: 0.4,
      side: THREE.DoubleSide
    });
    const leafGeo = new THREE.PlaneGeometry(0.024, 0.034, 4, 4);
    const lPos = leafGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const lx = lPos.getX(i);
      const ly = lPos.getY(i);
      lPos.setZ(i, Math.cos((ly / 0.034) * Math.PI) * 0.0024 - Math.abs(lx) * 0.12);
    }
    leafGeo.computeVertexNormals();

    const leaf1 = new THREE.Mesh(leafGeo, leafMat);
    leaf1.rotation.set(-1.02, 0.34, 0.42);
    leaf1.position.set(-0.009, 0.034, 0.01);
    const leaf2 = new THREE.Mesh(leafGeo, leafMat);
    leaf2.scale.setScalar(0.84);
    leaf2.rotation.set(-1.14, -0.44, -0.36);
    leaf2.position.set(-0.015, 0.029, 0.004);
    g.add(base, midTier, swirl, leaf1, leaf2);
  } else if (kind === 'mishri') {
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.05,
      metalness: 0.04,
      clearcoat: 1.0,
      ior: 1.54,
      transparent: true,
      opacity: 0.86
    });
    const offsets = [
      [0, 0.011, 0, 0.011],
      [-0.012, 0.008, 0.009, 0.0085],
      [0.011, 0.009, -0.007, 0.009],
      [0.004, 0.016, 0.004, 0.007]
    ];
    offsets.forEach(([x, y, z, r], idx) => {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), crystalMat);
      c.scale.set(1.22, 0.84, 1.15);
      c.position.set(x, y, z);
      c.rotation.set(idx * 0.65, idx * 1.15, 0.35);
      c.castShadow = true;
      g.add(c);
    });
  } else {
    // Artisan rounded Mathura / Saffron Peda with photographic texture + pistachio & saffron
    const pedaPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.014, 0),
      new THREE.Vector2(0.019, 0.005),
      new THREE.Vector2(0.018, 0.012),
      new THREE.Vector2(0.013, 0.016),
      new THREE.Vector2(0.001, 0.015)
    ];
    const peda = new THREE.Mesh(
      new THREE.LatheGeometry(pedaPts, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.pedaMap,
        bumpMap: textures.pedaBump,
        bumpScale: 0.0026,
        roughness: 0.56
      })
    );
    peda.castShadow = true;
    const pist = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.0025, 0.0032),
      new THREE.MeshStandardMaterial({ color: 0x558b2f, roughness: 0.65 })
    );
    pist.position.set(0.001, 0.0165, 0);
    const saffron = new THREE.Mesh(
      new THREE.BoxGeometry(0.0075, 0.0012, 0.0015),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 })
    );
    saffron.position.set(-0.002, 0.0168, 0.002);
    saffron.rotation.y = 0.65;
    g.add(peda, pist, saffron);
  }
  return g;
}

function buildAartiThali(
  textures: TextureBundle,
  brassMat: THREE.Material,
  flamesOut: FlameRig[],
  initiallyLit = true
): THREE.Group {
  const g = new THREE.Group();
  const platePts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.095, 0.003),
    new THREE.Vector2(0.118, 0.02),
    new THREE.Vector2(0.113, 0.022),
    new THREE.Vector2(0.09, 0.006),
    new THREE.Vector2(0.001, 0.005)
  ];
  const plate = new THREE.Mesh(new THREE.LatheGeometry(platePts, 32), brassMat);
  plate.castShadow = true;
  plate.receiveShadow = true;
  g.add(plate);

  const diyaPts = [
    new THREE.Vector2(0.001, 0.006),
    new THREE.Vector2(0.019, 0.006),
    new THREE.Vector2(0.03, 0.026),
    new THREE.Vector2(0.025, 0.027),
    new THREE.Vector2(0.015, 0.01)
  ];
  const diya = new THREE.Mesh(new THREE.LatheGeometry(diyaPts, 18), brassMat);
  g.add(diya);

  [0xdc2626, 0xeab308].forEach((col, i) => {
    const a = i === 0 ? 0.85 : -0.85;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.012, 14), brassMat);
    cup.position.set(Math.cos(a) * 0.062, 0.012, Math.sin(a) * 0.062);
    const powder = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 10, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
    );
    powder.scale.set(1, 0.45, 1);
    powder.position.set(cup.position.x, 0.017, cup.position.z);
    g.add(cup, powder);
  });

  // Soft natural ghee diya flame (Panel 3 & 5 Reference - authentic warm glow without burning out the tabletop)
  const flame = createFlameRig(textures, 0xffa638, 0.65, initiallyLit, true);
  flame.group.position.set(0, 0.032, 0);
  g.add(flame.group);
  flamesOut.push(flame);

  return g;
}

function buildDiyaStand(
  textures: TextureBundle,
  brassMat: THREE.Material,
  flamesOut: FlameRig[],
  isKapoor = false,
  initiallyLit = false
): THREE.Group {
  const g = new THREE.Group();
  const pts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.036, 0),
    new THREE.Vector2(0.012, 0.015),
    new THREE.Vector2(0.01, 0.042),
    new THREE.Vector2(0.038, 0.058),
    new THREE.Vector2(0.034, 0.062),
    new THREE.Vector2(0.001, 0.05)
  ];
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), brassMat);
  cup.castShadow = true;
  cup.receiveShadow = true;
  g.add(cup);

  const ghee = new THREE.Mesh(
    new THREE.CircleGeometry(0.028, 18),
    new THREE.MeshPhysicalMaterial({ color: 0xf59e0b, roughness: 0.14, transparent: true, opacity: 0.72 })
  );
  ghee.rotation.x = -Math.PI / 2;
  ghee.position.y = 0.054;
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0034, 0.016, 8),
    new THREE.MeshStandardMaterial({ color: isKapoor ? 0xf8fafc : 0xe5dccb, roughness: 0.85 })
  );
  wick.position.y = 0.059;
  g.add(ghee, wick);

  const flame = createFlameRig(
    textures,
    isKapoor ? 0x7dd3fc : 0xffa436,
    0.65,
    initiallyLit,
    true
  );
  flame.group.position.set(0, 0.062, 0);
  g.add(flame.group);
  flamesOut.push(flame);
  return g;
}

function buildBhogBowl(
  textures: TextureBundle,
  brassMat: THREE.Material,
  type: 'empty-plate' | 'fruits' | 'makhan' | 'laddoo' | 'prasad' | 'chandan' | 'kesar' | 'water'
): THREE.Group {
  const g = new THREE.Group();
  const isSilver = type === 'makhan';
  const bowlMat = isSilver
    ? new THREE.MeshStandardMaterial({ color: 0xdce2e8, roughness: 0.2, metalness: 0.92 })
    : new THREE.MeshStandardMaterial({
        color: 0xdca842,
        bumpMap: textures.brassRoughness,
        bumpScale: 0.0024,
        roughness: 0.30,
        metalness: 0.82,
        envMapIntensity: 1.15
      });

  const pts =
    type === 'empty-plate' || type === 'fruits'
      ? [
          new THREE.Vector2(0.001, 0),
          new THREE.Vector2(0.062, 0.002),
          new THREE.Vector2(0.088, 0.018),
          new THREE.Vector2(0.083, 0.021),
          new THREE.Vector2(0.058, 0.006),
          new THREE.Vector2(0.001, 0.006)
        ]
      : [
          new THREE.Vector2(0.001, 0),
          new THREE.Vector2(0.038, 0),
          new THREE.Vector2(0.068, 0.028),
          new THREE.Vector2(0.072, 0.048),
          new THREE.Vector2(0.066, 0.048),
          new THREE.Vector2(0.032, 0.012),
          new THREE.Vector2(0.001, 0.012)
        ];

  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), bowlMat);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  g.add(bowl);

  if (type === 'makhan') {
    const butterMat = new THREE.MeshPhysicalMaterial({
      color: 0xfefaf0,
      roughness: 0.34,
      sheen: 0.25,
      sheenColor: new THREE.Color(0xffffff)
    });
    const butter = new THREE.Mesh(new THREE.SphereGeometry(0.05, 18, 14), butterMat);
    butter.scale.set(1, 0.56, 1);
    butter.position.y = 0.036;
    const topPeak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.024, 14), butterMat);
    topPeak.position.set(0.004, 0.062, -0.004);
    topPeak.rotation.z = -0.18;
    g.add(butter, topPeak);

    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88
    });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.0068, 0), crystalMat);
      c.position.set(Math.cos(a) * 0.024, 0.058 + (i % 2) * 0.006, Math.sin(a) * 0.024);
      c.rotation.set(i, i * 0.7, 0);
      g.add(c);
    }
  } else if (type === 'laddoo') {
    const ladMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.boondiMap,
      bumpMap: textures.boondiBump,
      bumpScale: 0.0055,
      roughness: 0.56
    });
    const offsets: Array<[number, number, number, number]> = [
      [0, 0.034, 0, 1.0],
      [0.024, 0.034, 0.015, 0.96],
      [-0.024, 0.034, 0.015, 0.98],
      [0, 0.034, -0.026, 0.95],
      [0, 0.064, 0, 1.02]
    ];
    offsets.forEach(([x, y, z, s], idx) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.019 * s, 16, 14), ladMat);
      l.scale.set(1.03, 0.95, 1.01);
      l.rotation.set(idx * 0.7, idx * 1.1, idx * 0.4);
      l.position.set(x, y, z);
      l.castShadow = true;
      g.add(l);
    });
  } else if (type === 'fruits') {
    const coco = buildSingleFoodMesh(textures, 'coconut');
    coco.position.set(-0.024, 0.006, -0.012);
    coco.scale.setScalar(1.05);

    const ban1 = buildSingleFoodMesh(textures, 'banana');
    ban1.position.set(0.016, 0.008, 0.010);

    const ban2 = buildSingleFoodMesh(textures, 'banana');
    ban2.position.set(0.020, 0.018, -0.012);
    ban2.rotation.y = 0.6;
    ban2.scale.setScalar(0.92);

    const pom = buildSingleFoodMesh(textures, 'pom');
    pom.position.set(-0.006, 0.008, 0.026);
    pom.scale.setScalar(0.85);

    g.add(coco, ban1, ban2, pom);
  } else if (type === 'prasad' || type === 'chandan' || type === 'kesar') {
    const fillMat =
      type === 'prasad'
        ? new THREE.MeshStandardMaterial({
            color: 0xb8732a,
            map: textures.boondiMap,
            bumpMap: textures.boondiBump,
            bumpScale: 0.003,
            roughness: 0.36
          })
        : new THREE.MeshStandardMaterial({
            color: type === 'chandan' ? 0xd9a74a : 0xea580c,
            roughness: 0.62
          });
    const fill = new THREE.Mesh(new THREE.SphereGeometry(0.054, 18, 12), fillMat);
    fill.scale.set(1, 0.38, 1);
    fill.position.y = 0.034;
    g.add(fill);
  } else if (type === 'water') {
    const waterDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 22),
      new THREE.MeshPhysicalMaterial({ color: 0xbae6fd, roughness: 0.05, transparent: true, opacity: 0.72 })
    );
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.y = 0.042;
    g.add(waterDisc);
  }

  return g;
}

function createDynamicStreamGeometry(segments = 12, radialSegs = 10): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const vertCount = segments * radialSegs;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  for (let i = 0; i < segments - 1; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const nextJ = (j + 1) % radialSegs;
      const a = i * radialSegs + j;
      const b = i * radialSegs + nextJ;
      const c = (i + 1) * radialSegs + nextJ;
      const d = (i + 1) * radialSegs + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

function updateDynamicStreamGeometry(
  geo: THREE.BufferGeometry,
  arcCoords: Float32Array,
  count: number,
  baseRadius: number,
  time: number,
  flowSpeed: number,
  radialSegs = 10
) {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  const posArr = posAttr.array as Float32Array;
  const normArr = normAttr.array as Float32Array;

  for (let i = 0; i < count; i++) {
    const cx = arcCoords[i * 3];
    const cy = arcCoords[i * 3 + 1];
    const cz = arcCoords[i * 3 + 2];
    const t = i / Math.max(1, count - 1);
    const ripple = 1 + Math.sin(t * 14 - time * 14 * flowSpeed) * 0.14;
    const r = baseRadius * (0.72 + Math.sin(t * Math.PI) * 0.3 + t * 0.2) * ripple;

    for (let j = 0; j < radialSegs; j++) {
      const theta = (j / radialSegs) * Math.PI * 2;
      const nx = Math.cos(theta);
      const nz = Math.sin(theta);
      const idx = (i * radialSegs + j) * 3;
      posArr[idx] = cx + nx * r;
      posArr[idx + 1] = cy;
      posArr[idx + 2] = cz + nz * r;
      normArr[idx] = nx;
      normArr[idx + 1] = 0;
      normArr[idx + 2] = nz;
    }
  }
  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
  geo.computeBoundingSphere();
}

/**
 * Builds a complete, grounded close-up home sanctum architectural room:
 * Makrana marble floor, sandstone walls, recessed arched niche, carved teakwood altar chowki
 * resting flush on 4 turned wooden legs, hanging brass bell, marigold toran, and standing Samai lamps.
 */
function buildSanctumEnvironment(
  textures: TextureBundle,
  brassMat: THREE.Material,
  woodMat: THREE.Material,
  marbleMat: THREE.Material,
  sandstoneMat: THREE.Material,
  exp: ExperienceSpec,
  flamesOut: FlameRig[]
): THREE.Group {
  const env = new THREE.Group();
  const floorY = -0.34;

  // Authentic Aged Ancient Temple Sandstone / Granite (Panel 1 & 6 Reference - Real Photographic Texture)
  const templeStoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Pure real photographic ancient Garbhagriha ashlar granite
    map: textures.sandstoneMap,
    bumpMap: textures.sandstoneBump,
    bumpScale: 0.006,
    roughness: 0.72,
    metalness: 0.02,
    envMapIntensity: 0.35
  });

  const darkTempleStoneMat = new THREE.MeshStandardMaterial({
    color: 0xdcd5cc, // Carved architectural mouldings, doorframes, stepped plinths
    map: textures.sandstoneMap,
    bumpMap: textures.sandstoneBump,
    bumpScale: 0.006,
    roughness: 0.75,
    metalness: 0.02,
    envMapIntensity: 0.30
  });

  const deepDarkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x9e9588, // Inner sanctum corridor portal depth
    map: textures.sandstoneMap,
    bumpMap: textures.sandstoneBump,
    bumpScale: 0.006,
    roughness: 0.80,
    metalness: 0.02,
    envMapIntensity: 0.25
  });

  // 1. Ancient Stone Flagstone Temple Floor (8.5m x 8.5m)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), templeStoneMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  env.add(floor);

  // 1b. Overhead Ceiling Slab & Carved Timber Temple Rafters
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), darkTempleStoneMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 2.15;
  env.add(ceiling);

  [-0.6, 0.3, 1.2, 2.1].forEach((bz) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.18, 0.24), woodMat);
    beam.position.set(0, 2.05, bz);
    beam.castShadow = true;
    env.add(beam);
  });

  if (exp.id === 'shiva') {
    // Photorealistic 3D Shiva Temple Garbhagriha Background (Panel 1 Reference & Real Temple Architecture)
    const bgMat = new THREE.MeshBasicMaterial({
      map: textures.shivaSanctumBgMap,
      color: 0xffffff
    });

    // Elegant curved architectural sanctum backdrop placed at z = -1.15 behind the altar
    // Curving gently gives authentic stereoscopic 3D depth and parallax when viewing in 3D or WebXR!
    const bgCurvePts: THREE.Vector3[] = [];
    const bgSegs = 32;
    const bgRadius = 4.4;
    const bgSpan = Math.PI * 0.58; // ~105 degrees field of view
    for (let i = 0; i <= bgSegs; i++) {
      const t = i / bgSegs;
      const ang = (t - 0.5) * bgSpan;
      const bx = Math.sin(ang) * bgRadius;
      const bz = -0.98 - (bgRadius - Math.cos(ang) * bgRadius);
      bgCurvePts.push(new THREE.Vector3(bx, 0, bz));
    }
    const bgCurve = new THREE.CatmullRomCurve3(bgCurvePts);
    const bgPlaneGeo = new THREE.PlaneGeometry(5.4, 3.04, 32, 1);
    const pAttr = bgPlaneGeo.attributes.position;
    for (let i = 0; i < pAttr.count; i++) {
      const u = (pAttr.getX(i) + 2.7) / 5.4;
      const sample = bgCurve.getPointAt(THREE.MathUtils.clamp(u, 0, 1));
      pAttr.setX(i, sample.x);
      pAttr.setZ(i, sample.z);
    }
    bgPlaneGeo.computeVertexNormals();

    const bgMesh = new THREE.Mesh(bgPlaneGeo, bgMat);
    bgMesh.position.set(0, 0.08, 0);
    env.add(bgMesh);
  } else {
    // 2. Ancient Carved Temple Sanctum Back Wall with DEEP Recessed Garbhagriha Portal
    const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 0.25), templeStoneMat);
    backWallLeft.position.set(-2.4, 1.15, -0.88);
    backWallLeft.receiveShadow = true;
    backWallLeft.castShadow = true;

    const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.4, 0.25), templeStoneMat);
    backWallRight.position.set(2.4, 1.15, -0.88);
    backWallRight.receiveShadow = true;
    backWallRight.castShadow = true;

    const portalLintel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.44, 0.32), templeStoneMat);
    portalLintel.position.set(0, 1.94, -0.88);
    portalLintel.castShadow = true;
    portalLintel.receiveShadow = true;

    const portalCornice = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.38), darkTempleStoneMat);
    portalCornice.position.set(0, 2.14, -0.88);
    portalCornice.castShadow = true;
    env.add(backWallLeft, backWallRight, portalLintel, portalCornice);

    [-1.12, 1.12].forEach((jx) => {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.15, 0.28), darkTempleStoneMat);
      jamb.position.set(jx, floorY + 1.07, -0.86);
      jamb.castShadow = true;
      jamb.receiveShadow = true;

      const jBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.32), darkTempleStoneMat);
      jBase.position.set(jx, floorY + 0.11, -0.86);
      jBase.castShadow = true;
      env.add(jamb, jBase);
    });

    const corridorFloor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 2.6), darkTempleStoneMat);
    corridorFloor.position.set(0, floorY - 0.05, -2.15);
    corridorFloor.receiveShadow = true;

    const corridorLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 2.6), darkTempleStoneMat);
    corridorLeft.position.set(-1.12, floorY + 1.3, -2.15);
    corridorLeft.castShadow = true;
    corridorLeft.receiveShadow = true;

    const corridorRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 2.6), darkTempleStoneMat);
    corridorRight.position.set(1.12, floorY + 1.3, -2.15);
    corridorRight.castShadow = true;
    corridorRight.receiveShadow = true;

    const corridorCeiling = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 2.6), deepDarkStoneMat);
    corridorCeiling.position.set(0, 2.15, -2.15);

    const midFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.24), deepDarkStoneMat);
    midFrameL.position.set(-0.88, floorY + 1.1, -1.75);
    const midFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.24), deepDarkStoneMat);
    midFrameR.position.set(0.88, floorY + 1.1, -1.75);
    const midLintel = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.28, 0.26), deepDarkStoneMat);
    midLintel.position.set(0, floorY + 2.05, -1.75);

    const innerFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.0, 0.22), deepDarkStoneMat);
    innerFrameL.position.set(-0.68, floorY + 1.0, -2.55);
    const innerFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.0, 0.22), deepDarkStoneMat);
    innerFrameR.position.set(0.68, floorY + 1.0, -2.55);
    const innerLintel = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.24, 0.24), deepDarkStoneMat);
    innerLintel.position.set(0, floorY + 1.9, -2.55);

    const innerBackWall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 0.22), deepDarkStoneMat);
    innerBackWall.position.set(0, floorY + 1.3, -3.35);
    innerBackWall.receiveShadow = true;

    [-0.92, 0.92].forEach((nx) => {
      const nicheBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.24), deepDarkStoneMat);
      nicheBox.position.set(nx, floorY + 0.65, -2.15);
      const sideDiya = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.022, 0.038, 14),
        brassMat
      );
      sideDiya.position.set(nx, floorY + 0.52, -2.15);
      const sideFlame = createFlameRig(textures, 0xff8811, 0.85, false, true);
      sideFlame.group.position.set(nx, floorY + 0.56, -2.15);
      flamesOut.push(sideFlame);
      env.add(nicheBox, sideDiya, sideFlame.group);
    });

    const akhandLight = new THREE.PointLight(0xff9922, 1.2, 4.5, 1.8);
    akhandLight.position.set(0, floorY + 0.55, -2.4);
    env.add(
      corridorFloor, corridorLeft, corridorRight, corridorCeiling,
      midFrameL, midFrameR, midLintel,
      innerFrameL, innerFrameR, innerLintel,
      innerBackWall, akhandLight
    );
  }

  // Traditional Horizontal Mango Leaf & Marigold Bandhanwar hung across the outer stone lintel
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1d5c19, roughness: 0.55 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 });
  const bandRope = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 2.5, 8), bandMat);
  bandRope.rotation.z = Math.PI / 2;
  bandRope.position.set(0, 1.76, -0.73);
  env.add(bandRope);

  for (let i = -12; i <= 12; i++) {
    const t = i / 12;
    const x = t * 1.15;
    const y = 1.76;
    const z = -0.72;

    const mLeaf = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.065, 5), leafMat);
    mLeaf.position.set(x, y - 0.038, z);
    mLeaf.rotation.x = Math.PI;
    mLeaf.rotation.z = (Math.random() - 0.5) * 0.15;
    env.add(mLeaf);

    if (i % 2 === 0) {
      const flowerCol = i % 4 === 0 ? 0xea580c : 0xf59e0b;
      const blossom = buildFlowerCluster(textures, flowerCol, false);
      blossom.scale.setScalar(0.68);
      blossom.position.set(x, y, z + 0.008);
      env.add(blossom);
    }
  }

  // 4b. Suspended Brass Abhishek Jaladhari Vessel (Optional legacy pot, omitted when using ornate Om backdrop)
  if (exp.id === 'shiva_jaladhari_legacy') {
    const jaladhariGroup = new THREE.Group();
    jaladhariGroup.position.set(0, 1.28, -0.05);

    // 3 Brass Suspension Chains connecting to ceiling beam
    [-0.065, 0.065].forEach((cx) => {
      const chMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.003, 0.98, 8),
        brassMat
      );
      chMesh.position.set(cx, 0.49, 0);
      jaladhariGroup.add(chMesh);
    });
    const chMeshRear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 0.98, 8),
      brassMat
    );
    chMeshRear.position.set(0, 0.49, -0.065);
    jaladhariGroup.add(chMeshRear);

    // Hammered Brass Pot Body
    const potPts = [
      new THREE.Vector2(0.012, -0.075),
      new THREE.Vector2(0.042, -0.05),
      new THREE.Vector2(0.072, 0.0),
      new THREE.Vector2(0.076, 0.045),
      new THREE.Vector2(0.054, 0.08),
      new THREE.Vector2(0.058, 0.095),
      new THREE.Vector2(0.068, 0.105),
      new THREE.Vector2(0.048, 0.105),
      new THREE.Vector2(0.001, 0.105)
    ];
    const potMesh = new THREE.Mesh(new THREE.LatheGeometry(potPts, 28), brassMat);
    potMesh.castShadow = true;
    potMesh.receiveShadow = true;
    jaladhariGroup.add(potMesh);

    // Conical Brass Drip Nozzle
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.038, 16), brassMat);
    nozzle.position.set(0, -0.09, 0);
    nozzle.rotation.x = Math.PI;
    jaladhariGroup.add(nozzle);

    // Glistening Water Droplet at nozzle tip
    const droplet = new THREE.Mesh(
      new THREE.SphereGeometry(0.0055, 12, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0x90caf9,
        roughness: 0.02,
        transmission: 0.92,
        ior: 1.33
      })
    );
    droplet.scale.set(1, 1.4, 1);
    droplet.position.set(0, -0.115, 0);
    jaladhariGroup.add(droplet);

    env.add(jaladhariGroup);
  }

  // Dedicated monolithic stone material for carved Dravidian pillars (monolithic granite/sandstone - Panel 1 & 6)
  const monolithicPillarMat = new THREE.MeshStandardMaterial({
    color: 0xc8bfb2,
    map: textures.sandstoneMap,
    bumpMap: textures.sandstoneBump,
    bumpScale: 0.0022,
    roughness: 0.66,
    metalness: 0.02,
    envMapIntensity: 0.35
  });

  // 4c. Sculpted Indian Temple Columns (Dravidian / Nagara architecture with stepped plinth, fluted shaft & bracket capital - Panel 1 Reference)
  // 4 Prominent Pillars: 2 front pillars flanking altar + 2 mid-sanctum pillars receding into the Garbhagriha
  [
    { cx: -1.28, cz: 0.22 },
    { cx: 1.28, cz: 0.22 },
    { cx: -1.48, cz: -0.72 },
    { cx: 1.48, cz: -0.72 }
  ].forEach(({ cx, cz }) => {
    // Stepped Carved Stone Plinth (Upapitha & Adhisthana)
    const colPlinthBase = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.48), darkTempleStoneMat);
    colPlinthBase.position.set(cx, floorY + 0.11, cz);
    colPlinthBase.castShadow = true;
    colPlinthBase.receiveShadow = true;

    const colPlinthUpper = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.16, 0.40), monolithicPillarMat);
    colPlinthUpper.position.set(cx, floorY + 0.30, cz);
    colPlinthUpper.castShadow = true;

    // Square Lower Shaft (Saduram) with carved bas-relief medallions
    const colSquareShaft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.54, 0.32), monolithicPillarMat);
    colSquareShaft.position.set(cx, floorY + 0.65, cz);
    colSquareShaft.castShadow = true;
    colSquareShaft.receiveShadow = true;

    // Carved circular lotus rosette medallion on front face of pillar
    const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.015, 16), darkTempleStoneMat);
    rosette.rotation.x = Math.PI / 2;
    rosette.position.set(cx, floorY + 0.65, cz + 0.165);
    rosette.castShadow = true;

    // Octagonal transitional drum (Padma Bandha)
    const octDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.165, 0.18, 8), darkTempleStoneMat);
    octDrum.position.set(cx, floorY + 1.01, cz);
    octDrum.castShadow = true;

    // 12-faceted carved stone shaft (Stambha)
    const colShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.148, 0.58, 12),
      monolithicPillarMat
    );
    colShaft.position.set(cx, floorY + 1.39, cz);
    colShaft.castShadow = true;
    colShaft.receiveShadow = true;

    // Carved Ornamental Belt Ring (Mala-sthana) at mid-height
    const beltRing = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.016, 8, 20), darkTempleStoneMat);
    beltRing.rotation.x = Math.PI / 2;
    beltRing.position.set(cx, floorY + 1.48, cz);
    beltRing.castShadow = true;

    // Flared Stone Bell Capital (Kumbha & Kalasa)
    const capPts = [
      new THREE.Vector2(0.132, 0),
      new THREE.Vector2(0.165, 0.05),
      new THREE.Vector2(0.195, 0.11),
      new THREE.Vector2(0.16, 0.15),
      new THREE.Vector2(0.20, 0.18)
    ];
    const bellCap = new THREE.Mesh(new THREE.LatheGeometry(capPts, 20), monolithicPillarMat);
    bellCap.position.set(cx, floorY + 1.76, cz);
    bellCap.castShadow = true;

    // Traditional Four-Way Stepped Bracket Capital (Potikai / Pushpapodigai)
    const bracketBeamX = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.34), darkTempleStoneMat);
    bracketBeamX.position.set(cx, floorY + 1.94, cz);
    bracketBeamX.castShadow = true;

    const bracketBeamZ = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.58), darkTempleStoneMat);
    bracketBeamZ.position.set(cx, floorY + 1.94, cz);
    bracketBeamZ.castShadow = true;

    env.add(colPlinthBase, colPlinthUpper, colSquareShaft, rosette, octDrum, colShaft, beltRing, bellCap, bracketBeamX, bracketBeamZ);
  });

  // Authentic Heavy Carved Stone Architrave Lintel Beams spanning across the Mandapa (Panel 1 & 6)
  const frontLintelBeam = new THREE.Mesh(new THREE.BoxGeometry(2.86, 0.22, 0.34), darkTempleStoneMat);
  frontLintelBeam.position.set(0, floorY + 2.11, 0.22);
  frontLintelBeam.castShadow = true;

  const rearLintelBeam = new THREE.Mesh(new THREE.BoxGeometry(3.30, 0.22, 0.34), darkTempleStoneMat);
  rearLintelBeam.position.set(0, floorY + 2.11, -0.72);
  rearLintelBeam.castShadow = true;

  const leftLintelBeam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 1.25), darkTempleStoneMat);
  leftLintelBeam.position.set(-1.38, floorY + 2.11, -0.25);
  leftLintelBeam.castShadow = true;

  const rightLintelBeam = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 1.25), darkTempleStoneMat);
  rightLintelBeam.position.set(1.38, floorY + 2.11, -0.25);
  rightLintelBeam.castShadow = true;

  env.add(frontLintelBeam, rearLintelBeam, leftLintelBeam, rightLintelBeam);

  // 5. Heavy Hanging Brass Temple Bells (Ghanti) on both sides (omitted for Shiva sanctum to showcase ornate lamps)
  if (exp.id !== 'shiva') {
    [-0.68, 0.68].forEach((bx) => {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.65, 8), brassMat);
      chain.position.set(bx, 1.45, -0.32);

      const bellPts = [
        new THREE.Vector2(0.008, 0.14),
        new THREE.Vector2(0.028, 0.11),
        new THREE.Vector2(0.046, 0.05),
        new THREE.Vector2(0.076, 0.0),
        new THREE.Vector2(0.068, 0.0),
        new THREE.Vector2(0.035, 0.05)
      ];
      const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 28), brassMat);
      bell.position.set(bx, 1.05, -0.32);
      bell.castShadow = true;

      const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), brassMat);
      clapper.position.set(bx, 1.02, -0.32);

      env.add(chain, bell, clapper);
    });
  }

  // 6. Grounded Carved Pooja Altar Platform (Top flush at y = 0.0)
  const altarMat =
    exp.id === 'shiva'
      ? new THREE.MeshStandardMaterial({
          color: 0xc8bfb2, // Authentic ancient grey-sandstone Garbhagriha ashlar stone (Panel 1 & 3 Reference)
          map: textures.sandstoneMap,
          bumpMap: textures.sandstoneBump,
          bumpScale: 0.0032,
          roughness: 0.44, // Authentic soft holy water stone sheen (Panel 3 Reference)
          metalness: 0.02,
          envMapIntensity: 0.42
        })
      : exp.id === 'krishna' || exp.id === 'balaji'
      ? new THREE.MeshStandardMaterial({
          color: 0xf8f5ee,
          map: textures.altarMarbleMap,
          roughness: 0.26,
          metalness: 0.02,
          envMapIntensity: 0.35
        })
      : woodMat;

  // Solid grounded Vedi slab (2.4m wide x 1.18m deep, top at y = 0.0)
  const vediSlab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.18), altarMat);
  vediSlab.position.set(0, -0.03, 0.18);
  vediSlab.castShadow = true;
  vediSlab.receiveShadow = true;
  env.add(vediSlab);

  const frontBevel = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.036, 0.05),
    darkTempleStoneMat
  );
  frontBevel.position.set(0, -0.018, 0.77);
  frontBevel.receiveShadow = true;

  const plinthUnder = new THREE.Mesh(
    new THREE.BoxGeometry(2.32, 0.28, 1.06),
    darkTempleStoneMat
  );
  plinthUnder.position.set(0, -0.2, 0.18);
  plinthUnder.castShadow = true;
  plinthUnder.receiveShadow = true;
  env.add(frontBevel, plinthUnder);

  // 4 Turned Chowki Legs meeting marble floor (for wooden mandirs only)
  if (exp.id !== 'shiva') {
    const legPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.036, 0.01),
      new THREE.Vector2(0.026, 0.06),
      new THREE.Vector2(0.042, 0.16),
      new THREE.Vector2(0.030, 0.25),
      new THREE.Vector2(0.042, 0.29)
    ];
    const legGeo = new THREE.LatheGeometry(legPts, 16);
    [
      [-1.05, -0.25],
      [1.05, -0.25],
      [-1.05, 0.65],
      [1.05, 0.65]
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(lx, floorY, lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      env.add(leg);
    });
  }

  // Consecrated Altar Surface (Stone Vedi for Shiva - Panel 3 & 6; Silk Vastra for Desktop Mandirs)
  if (exp.id !== 'shiva') {
    const runnerMat = new THREE.MeshStandardMaterial({
      color: exp.id === 'islamic' ? 0x166534 : exp.id === 'sikh' ? 0x25418c : 0x7a1226,
      map: textures.brocadeMap,
      roughness: 0.72,
      metalness: 0.05,
      envMapIntensity: 0.25
    });
    const runner = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.008, 0.54), runnerMat);
    runner.position.set(0, 0.004, 0.42);
    runner.receiveShadow = true;
    env.add(runner);

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd4a348,
      roughness: 0.35,
      metalness: 0.65
    });
    [-0.26, 0.26].forEach((tz) => {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.003, 0.022), trimMat);
      trim.position.set(0, 0.0085, 0.42 + tz);
      trim.receiveShadow = true;
      env.add(trim);
    });
  } else {
    // Sacred Temple Stone Altar for Shiva has soft holy water sheen integrated directly on vediSlab (zero coplanar Z-fighting)
  }

  // 7. Tall 5-Tier Flanking Brass Samai Oil Lamps with Dynamic Golden Point Lights
  const isShiva = exp.id === 'shiva';
  const samaiXCoords = isShiva ? [-0.64, 0.64] : [-1.18, 1.18];
  const samaiY = isShiva ? 0.0 : floorY;
  const samaiZ = isShiva ? -0.26 : -0.42;
  samaiXCoords.forEach((sx) => {
    const samai = new THREE.Group();
    const standPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.125, 0),
      new THREE.Vector2(0.105, 0.04),
      new THREE.Vector2(0.032, 0.18),
      new THREE.Vector2(0.024, 0.58),
      new THREE.Vector2(0.088, 0.65),
      new THREE.Vector2(0.082, 0.66),
      new THREE.Vector2(0.020, 0.61)
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(standPts, 24), brassMat);
    body.castShadow = true;
    body.receiveShadow = true;
    samai.add(body);

    const flame = createFlameRig(textures, 0xffa844, 0.85, true, true);
    flame.group.position.set(0, 0.66, 0);
    samai.add(flame.group);
    flamesOut.push(flame);

    samai.position.set(sx, samaiY, samaiZ);
    env.add(samai);
  });

  // 8. Recessed Side Wall Niches with Brass Diyas
  [-2.42, 2.42].forEach((wx) => {
    const wallDiya = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.02, 0.03, 16), brassMat);
    wallDiya.position.set(wx + (wx < 0 ? 0.06 : -0.06), 0.38, 0.35);
    wallDiya.castShadow = true;
    env.add(wallDiya);

    const diyaFlame = createFlameRig(textures, 0xff9422, 0.88, false, true);
    diyaFlame.group.position.set(wx + (wx < 0 ? 0.06 : -0.06), 0.41, 0.35);
    env.add(diyaFlame.group);
    flamesOut.push(diyaFlame);
  });

  return env;
}

function buildShivaAltar(
  textures: TextureBundle,
  brassMat: THREE.Material
): { group: THREE.Group; fluidRig: ShivaFluidRig } {
  const group = new THREE.Group();

  // Consecrated Krishna Shila River Stone (Panel 2 Reference)
  // Monolithic velvety smooth black river stone with subtle satin sheen (roughness: 0.44, metalness: 0.02)
  // ZERO plastic shine, zero chrome reflections!
  const dryBasaltColor = new THREE.Color(0xffffff);
  const wetBasaltColor = new THREE.Color(0x666670);

  const basaltMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Pure real photographic Krishna Shila river stone!
    map: textures.basaltMap,
    bumpMap: textures.basaltBump,
    bumpScale: 0.0018,
    roughness: 0.44,
    metalness: 0.02,
    envMapIntensity: 0.55
  });

  // Carved Monolithic Stone Pedestal (Pitha) & Yoni / Jalahari Base (Panel 2 & 6 Reference)
  // Tiered classical temple stone plinth: Upana base plinth, Kantham throat, Kumuda roll moulding, and circular Jalahari trough
  const pithaPts = [
    new THREE.Vector2(0.001, -0.16),
    new THREE.Vector2(0.38, -0.16), // Lower Upana base plinth
    new THREE.Vector2(0.375, -0.10),
    new THREE.Vector2(0.32, -0.07),  // Undercut Kantham neck
    new THREE.Vector2(0.31, 0.0),
    new THREE.Vector2(0.35, 0.04),  // Flared Padma / Kumuda torus
    new THREE.Vector2(0.36, 0.08),  // Upper Jalahari plinth
    new THREE.Vector2(0.355, 0.142),// Raised outer retaining rim
    new THREE.Vector2(0.31, 0.142),
    new THREE.Vector2(0.28, 0.115), // Recessed inner collection trough where Abhishek fluids flow
    new THREE.Vector2(0.155, 0.115),
    new THREE.Vector2(0.001, 0.115)
  ];
  const pithaGeo = new THREE.LatheGeometry(pithaPts, 48);
  const pitha = new THREE.Mesh(pithaGeo, basaltMat);
  pitha.position.set(0, 0, -0.05);
  pitha.castShadow = true;
  pitha.receiveShadow = true;
  group.add(pitha);

  // Rounded circular stone rim of the Jalahari basin
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.022, 16, 48), basaltMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.140, -0.05);
  rim.castShadow = true;
  group.add(rim);

  // Carved Stone Gomukha Spout extending toward the collection basin on the right (Panel 2 Reference)
  const spoutShape = new THREE.Shape();
  spoutShape.moveTo(-0.052, 0);
  spoutShape.lineTo(0.052, 0);
  spoutShape.lineTo(0.032, 0.30);
  spoutShape.lineTo(-0.032, 0.30);
  spoutShape.closePath();
  const spoutGeo = new THREE.ExtrudeGeometry(spoutShape, {
    depth: 0.042,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008
  });
  spoutGeo.rotateX(Math.PI / 2);
  spoutGeo.rotateY(Math.PI / 2);
  const spout = new THREE.Mesh(spoutGeo, basaltMat);
  spout.position.set(0.22, 0.140, -0.05);
  spout.castShadow = true;
  spout.receiveShadow = true;
  group.add(spout);

  // Sculpted Monolithic Krishna Shila Shiva Lingam (Classic Svayambhu rounded dome - matching User Reference)
  const lingamPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.126, 0),
    new THREE.Vector2(0.126, 0.22),
    new THREE.Vector2(0.124, 0.28),
    new THREE.Vector2(0.120, 0.33),
    new THREE.Vector2(0.110, 0.375),
    new THREE.Vector2(0.092, 0.415),
    new THREE.Vector2(0.066, 0.445),
    new THREE.Vector2(0.034, 0.462),
    new THREE.Vector2(0.001, 0.466)
  ];
  const lingamGeo = new THREE.LatheGeometry(lingamPts, 48);
  const lingam = new THREE.Mesh(lingamGeo, basaltMat);
  lingam.position.set(0, 0.115, -0.05);
  lingam.castShadow = true;
  lingam.receiveShadow = true;
  group.add(lingam);

  // Sacred Silver Chandra Crescent Moon on left side of the crown (Panel 2 Reference)
  const chandraMat = new THREE.MeshStandardMaterial({
    color: 0xecf0f5,
    metalness: 0.90,
    roughness: 0.20
  });
  const chandraMoon = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0032, 10, 24, Math.PI * 0.75),
    chandraMat
  );
  chandraMoon.rotation.z = Math.PI * 0.42;
  chandraMoon.rotation.y = 0.15;
  chandraMoon.position.set(-0.062, 0.525, -0.025);
  group.add(chandraMoon);

  // Sacred Vibhuti Tripundra (3 Curved Crisp White Ash Bands prominently on the forehead - matching User Reference)
  const bhasmaMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Pure crisp chalk white sacred ash
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const tripundraGroup = new THREE.Group();
  const tripundraBaseY = 0.428;
  [-1, 0, 1].forEach((lineIdx) => {
    const lineY = tripundraBaseY + lineIdx * 0.013;
    const rAtY = 0.120 - Math.max(0, lineIdx * 0.005) + 0.0028;
    const arcSpan = 0.76;
    const segments = 24;

    const curvePts: THREE.Vector3[] = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const angle = Math.PI + (t - 0.5) * arcSpan;
      const x = -rAtY * Math.sin(angle);
      const z = -0.05 - rAtY * Math.cos(angle);
      curvePts.push(new THREE.Vector3(x, lineY, z));
    }
    const curve = new THREE.CatmullRomCurve3(curvePts);
    const stripGeo = new THREE.TubeGeometry(curve, 24, 0.0026, 8, false);
    const stripMesh = new THREE.Mesh(stripGeo, bhasmaMat);
    tripundraGroup.add(stripMesh);
  });
  group.add(tripundraGroup);

  // Sacred Vermilion Kumkum Red Center Bindu (matching User Reference)
  const binduRed = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xc41e1e, roughness: 0.55 })
  );
  binduRed.scale.set(1.0, 1.0, 0.35);
  binduRed.position.set(0, tripundraBaseY, -0.05 + 0.124);
  group.add(binduRed);

  // Sacred Chandan Sandalwood paste yellow center dot (matching User Reference)
  const binduGold = new THREE.Mesh(
    new THREE.SphereGeometry(0.004, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.50 })
  );
  binduGold.scale.set(1.0, 1.0, 0.4);
  binduGold.position.set(0, tripundraBaseY, -0.05 + 0.126);
  group.add(binduGold);

  // Sacred Vertical Chandan Tilak Mark above Tripundra (matching User Reference)
  const urdhvaTilak = new THREE.Mesh(
    new THREE.PlaneGeometry(0.010, 0.024),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.85, side: THREE.DoubleSide })
  );
  urdhvaTilak.position.set(0, tripundraBaseY + 0.030, -0.05 + 0.116);
  urdhvaTilak.rotation.x = -0.16;
  group.add(urdhvaTilak);

  const urdhvaRedLine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.003, 0.018),
    new THREE.MeshStandardMaterial({ color: 0xc41e1e, roughness: 0.55, side: THREE.DoubleSide })
  );
  urdhvaRedLine.position.set(0, tripundraBaseY + 0.030, -0.05 + 0.117);
  urdhvaRedLine.rotation.x = -0.16;
  group.add(urdhvaRedLine);

  // =========================================================================
  // SACRED SCULPTED GOLDEN NAGA (Panchamukhi Sheshanaga Canopy - Panel 2 & 6 Reference)
  // Traditional 7-headed golden cobra hood arching protectively over the Shiva Lingam,
  // with fluted underside, coiled base on Yoni plinth, and lustrous temple brass PBR material.
  // =========================================================================
  const nagaGroup = new THREE.Group();
  nagaGroup.position.set(0, 0, -0.05);

  const nagaBrassMat = new THREE.MeshStandardMaterial({
    color: 0xffdf88, // Authentic warm golden temple brass/bronze
    map: textures.brassMap,
    roughnessMap: textures.brassRoughness,
    bumpMap: textures.brassRoughness,
    bumpScale: 0.0032,
    roughness: 0.26,
    metalness: 0.92,
    envMapIntensity: 1.15,
    side: THREE.DoubleSide
  });

  // 1. Triple-Tiered Serpent Coils resting at rear and sides of Yoni plinth
  const nagaCoilPts: THREE.Vector3[] = [];
  const numCoilSteps = 48;
  for (let i = 0; i <= numCoilSteps; i++) {
    const t = i / numCoilSteps;
    const angle = t * Math.PI * 3.2 - Math.PI * 0.4;
    const r = 0.165 - t * 0.016;
    const y = 0.118 + t * 0.052;
    nagaCoilPts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
  }
  const nagaCoilCurve = new THREE.CatmullRomCurve3(nagaCoilPts);
  const nagaCoilMesh = new THREE.Mesh(new THREE.TubeGeometry(nagaCoilCurve, 48, 0.014, 12, false), nagaBrassMat);
  nagaCoilMesh.castShadow = true;
  nagaCoilMesh.receiveShadow = true;
  nagaGroup.add(nagaCoilMesh);

  // 2. Thick Ascending Spine / Neck rising vertically behind Lingam cylinder
  const spinePts = [
    new THREE.Vector3(0, 0.166, -0.165),
    new THREE.Vector3(0, 0.280, -0.160),
    new THREE.Vector3(0, 0.420, -0.145),
    new THREE.Vector3(0, 0.520, -0.110),
    new THREE.Vector3(0, 0.600, -0.060),
    new THREE.Vector3(0, 0.645, 0.015)
  ];
  const spineCurve = new THREE.CatmullRomCurve3(spinePts);
  const spineMesh = new THREE.Mesh(new THREE.TubeGeometry(spineCurve, 32, 0.022, 14, false), nagaBrassMat);
  spineMesh.castShadow = true;
  nagaGroup.add(spineMesh);

  // 3. Majestic Vertical Flared Cobra Hood Fan (Arches protectively forward over Lingam dome - Panel 2 Reference)
  const hoodWidthSegments = 32;
  const hoodHeightSegments = 24;
  const hoodGeo = new THREE.BufferGeometry();
  const hoodPositions: number[] = [];
  const hoodNormals: number[] = [];
  const hoodUvs: number[] = [];
  const hoodIndices: number[] = [];

  for (let j = 0; j <= hoodHeightSegments; j++) {
    const v = j / hoodHeightSegments; // 0 at base (y=0.18), 1 at crest (y=0.645)
    const y = 0.18 + v * 0.465;
    // Curves gracefully forward over the top of the Lingam dome (y=0.54, z=0)
    const forwardCurve = Math.pow(v, 2.2) * 0.185;
    const zBase = -0.145 + v * 0.040;
    const z = zBase + forwardCurve;

    // Fan half-width: narrow at base (0.08m), swelling into wide magnificent cobra hood (0.24m / 48cm total span)
    const spanX = 0.08 + Math.sin(Math.pow(v, 0.72) * Math.PI * 0.88) * 0.165;

    for (let i = 0; i <= hoodWidthSegments; i++) {
      const u = (i / hoodWidthSegments) * 2 - 1; // -1 to +1
      const x = u * spanX;
      // Forward cupping (concave dish facing devotee)
      const dishZ = (1 - u * u) * 0.045;
      // Radiant fluted vertical ribs (iconic Indian temple Sheshanaga texture)
      const flute = Math.cos(u * 7 * Math.PI) * 0.009 * (1 - u * u * 0.25);

      hoodPositions.push(x, y, z + dishZ + flute);
      hoodUvs.push((u + 1) * 0.5, v);
    }
  }

  for (let j = 0; j < hoodHeightSegments; j++) {
    for (let i = 0; i < hoodWidthSegments; i++) {
      const a = j * (hoodWidthSegments + 1) + i;
      const b = (j + 1) * (hoodWidthSegments + 1) + i;
      const c = (j + 1) * (hoodWidthSegments + 1) + (i + 1);
      const d = j * (hoodWidthSegments + 1) + (i + 1);
      hoodIndices.push(a, b, d);
      hoodIndices.push(b, c, d);
    }
  }

  hoodGeo.setAttribute('position', new THREE.Float32BufferAttribute(hoodPositions, 3));
  hoodGeo.setAttribute('uv', new THREE.Float32BufferAttribute(hoodUvs, 2));
  hoodGeo.setIndex(hoodIndices);
  hoodGeo.computeVertexNormals();

  const hoodMesh = new THREE.Mesh(hoodGeo, nagaBrassMat);
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  nagaGroup.add(hoodMesh);

  // 4. Heavy Golden Fluted Crest Struts running vertically along the hood
  [-3, -2, -1, 0, 1, 2, 3].forEach((ribIdx) => {
    const ribPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 16; s++) {
      const v = s / 16;
      const y = 0.18 + v * 0.465;
      const forwardCurve = Math.pow(v, 2.2) * 0.185;
      const zBase = -0.145 + v * 0.040;
      const spanX = 0.08 + Math.sin(Math.pow(v, 0.72) * Math.PI * 0.88) * 0.165;
      const u = ribIdx / 3.4;
      const x = u * spanX;
      const dishZ = (1 - u * u) * 0.045;
      ribPts.push(new THREE.Vector3(x, y, zBase + forwardCurve + dishZ + 0.004));
    }
    const ribCurve = new THREE.CatmullRomCurve3(ribPts);
    const ribMesh = new THREE.Mesh(new THREE.TubeGeometry(ribCurve, 20, 0.0042, 8, false), nagaBrassMat);
    nagaGroup.add(ribMesh);
  });

  // 5. Seven Sculpted Cobra Heads (Sapta-Mukhi Sheshanaga) crowning forward canopy rim
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.2, metalness: 0.5 });
  const headConfigs = [
    { idx: 0, x: 0.0, y: 0.650, z: 0.052, rotY: 0, rotZ: 0, rotX: 0.52, scale: 1.65 },
    { idx: -1, x: -0.056, y: 0.642, z: 0.044, rotY: -0.20, rotZ: 0.10, rotX: 0.48, scale: 1.45 },
    { idx: 1, x: 0.056, y: 0.642, z: 0.044, rotY: 0.20, rotZ: -0.10, rotX: 0.48, scale: 1.45 },
    { idx: -2, x: -0.112, y: 0.622, z: 0.026, rotY: -0.40, rotZ: 0.18, rotX: 0.42, scale: 1.30 },
    { idx: 2, x: 0.112, y: 0.622, z: 0.026, rotY: 0.40, rotZ: -0.18, rotX: 0.42, scale: 1.30 },
    { idx: -3, x: -0.168, y: 0.592, z: 0.002, rotY: -0.58, rotZ: 0.26, rotX: 0.35, scale: 1.15 },
    { idx: 3, x: 0.168, y: 0.592, z: 0.002, rotY: 0.58, rotZ: -0.26, rotX: 0.35, scale: 1.15 }
  ];

  headConfigs.forEach((cfg) => {
    const headGroup = new THREE.Group();
    headGroup.position.set(cfg.x, cfg.y, cfg.z);
    headGroup.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);

    const s = cfg.scale;
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.015 * s, 0.042 * s, 10), nagaBrassMat);
    snout.rotation.x = Math.PI * 0.5;
    snout.scale.set(1.15, 0.65, 1.35);
    snout.castShadow = true;
    headGroup.add(snout);

    const flangeGeo = new THREE.BoxGeometry(0.028 * s, 0.005 * s, 0.024 * s);
    const flange = new THREE.Mesh(flangeGeo, nagaBrassMat);
    flange.position.set(0, -0.002 * s, -0.008 * s);
    headGroup.add(flange);

    if (cfg.idx === 0) {
      const crownMesh = new THREE.Mesh(new THREE.ConeGeometry(0.008 * s, 0.022 * s, 8), nagaBrassMat);
      crownMesh.position.set(0, 0.016 * s, -0.006 * s);
      headGroup.add(crownMesh);
    }

    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0024 * s, 8, 8), eyeMat);
      eye.position.set(side * 0.008 * s, 0.004 * s, 0.007 * s);
      headGroup.add(eye);
    });

    nagaGroup.add(headGroup);
  });

  // Load Blender Sheshanaga GLB Model
  try {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      '/models/sheshanaga_master.glb',
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.material = nagaBrassMat;
          }
        });
        model.position.set(0, 0, 0);
        model.scale.set(1.0, 1.0, 1.0);
        nagaGroup.add(model);
        hoodMesh.visible = false;
      },
      undefined,
      (err) => {
        // Fallback gracefully to high-detail procedural canopy
        console.warn('Blender Sheshanaga GLB using procedural canopy fallback:', err);
      }
    );
  } catch (e) {
    console.warn('GLTFLoader init fallback:', e);
  }

  group.add(nagaGroup);

  // Traditional Suspended Abhishek Dharapatra (Gangajal Drip Vessel) directly above Shiva Lingam (matching User Reference)
  const dharapatraGroup = new THREE.Group();
  dharapatraGroup.position.set(0, 0.96, -0.05);

  const potPts = [
    new THREE.Vector2(0.001, -0.06),
    new THREE.Vector2(0.008, -0.06), // Nozzle spout
    new THREE.Vector2(0.014, -0.04),
    new THREE.Vector2(0.046, -0.01),
    new THREE.Vector2(0.058, 0.035),
    new THREE.Vector2(0.052, 0.075),
    new THREE.Vector2(0.038, 0.095), // Narrow neck
    new THREE.Vector2(0.048, 0.105), // Flared rim
    new THREE.Vector2(0.042, 0.110),
    new THREE.Vector2(0.001, 0.110)
  ];
  const potBody = new THREE.Mesh(new THREE.LatheGeometry(potPts, 24), brassMat);
  potBody.castShadow = true;
  dharapatraGroup.add(potBody);

  const cordMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 });
  for (let cIdx = 0; cIdx < 3; cIdx++) {
    const cAng = (cIdx / 3) * Math.PI * 2;
    const cordPts = [
      new THREE.Vector3(Math.cos(cAng) * 0.046, 0.105, Math.sin(cAng) * 0.046),
      new THREE.Vector3(Math.cos(cAng) * 0.018, 0.46, Math.sin(cAng) * 0.018)
    ];
    const cordCurve = new THREE.CatmullRomCurve3(cordPts);
    const cordMesh = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 12, 0.0018, 6, false), cordMat);
    dharapatraGroup.add(cordMesh);
  }

  const dropletMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.96,
    opacity: 1,
    transparent: true,
    roughness: 0.04,
    ior: 1.333
  });
  const waterDrop = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 10, 8), dropletMat);
  waterDrop.scale.set(1.0, 1.45, 1.0);
  waterDrop.position.set(0, -0.068, 0);
  dharapatraGroup.add(waterDrop);
  // dharapatraGroup omitted to keep the central glowing Om emblem in the background unobstructed
  // group.add(dharapatraGroup);

  // =========================================================================
  // SACRED REAL FLOWER GARLAND SYSTEM (Panel 2 Reference - Lush Marigold Mala)
  // Dedicated botanical models: Voluminous Indian Genda (Saffron & Golden Marigolds),
  // Gulab (Velvety Red Rose Crown), and Soft Mogra Jasmine Buds (Zero Spiky Teeth!)
  // =========================================================================
  const garlandGroup = new THREE.Group();
  garlandGroup.position.set(0, 0, -0.05);

  const mograPetalMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbfbf6,
    roughness: 0.28,
    metalness: 0.0,
    sheen: 0.95,
    sheenColor: 0xffffff,
    transmission: 0.06,
    thickness: 0.008
  });
  const mograCalyxMat = new THREE.MeshStandardMaterial({ color: 0x1f5c1b, roughness: 0.7 });
  const mograCoreMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.6 });

  // Soft, rounded, natural Mogra (Jasmine) bud - NO sharp star teeth!
  const createMograBud = (scale = 1.0) => {
    const mogra = new THREE.Group();
    const calyx = new THREE.Mesh(new THREE.CylinderGeometry(0.0028 * scale, 0.0042 * scale, 0.010 * scale, 8), mograCalyxMat);
    calyx.position.z = -0.005 * scale;
    calyx.rotation.x = Math.PI / 2;
    mogra.add(calyx);

    const stamen = new THREE.Mesh(new THREE.SphereGeometry(0.0035 * scale, 8, 8), mograCoreMat);
    stamen.position.z = 0.002 * scale;
    mogra.add(stamen);

    // 5 soft rounded overlapping petals forming a natural floral bud
    for (let pIdx = 0; pIdx < 5; pIdx++) {
      const pAng = (pIdx / 5) * Math.PI * 2;
      const pet = new THREE.Mesh(new THREE.SphereGeometry(0.0048 * scale, 8, 6), mograPetalMat);
      pet.scale.set(0.85, 1.25, 0.85);
      pet.position.set(Math.cos(pAng) * 0.0032 * scale, Math.sin(pAng) * 0.0032 * scale, 0.004 * scale);
      pet.rotation.z = pAng;
      mogra.add(pet);
    }
    return mogra;
  };

  // Voluminous, fluffy Indian Marigold (Genda) blossom with 4 ruffled tiers of petals
  const createMarigoldBlossom = (flowerCol: number, scale = 1.0) => {
    const blossomGroup = new THREE.Group();
    const flowerPetalMat = new THREE.MeshPhysicalMaterial({
      color: flowerCol,
      map: textures.marigoldPhotoMap,
      roughness: 0.38,
      metalness: 0.01,
      sheen: 0.95,
      sheenColor: new THREE.Color(flowerCol).lerp(new THREE.Color(0xffedd5), 0.5)
    });

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.010 * scale, 8, 8), flowerPetalMat);
    blossomGroup.add(core);

    // Tier 1: Inner ruffled center
    for (let pIdx = 0; pIdx < 8; pIdx++) {
      const pAng = (pIdx / 8) * Math.PI * 2;
      const pet = new THREE.Mesh(new THREE.SphereGeometry(0.0075 * scale, 6, 6), flowerPetalMat);
      pet.scale.set(1.10, 0.60, 1.15);
      pet.position.set(Math.cos(pAng) * 0.007 * scale, (Math.random() - 0.5) * 0.004 * scale, Math.sin(pAng) * 0.007 * scale);
      blossomGroup.add(pet);
    }
    // Tier 2: Mid-inner petals
    for (let pIdx = 0; pIdx < 12; pIdx++) {
      const pAng = (pIdx / 12) * Math.PI * 2 + 0.25;
      const pet = new THREE.Mesh(new THREE.SphereGeometry(0.0095 * scale, 6, 6), flowerPetalMat);
      pet.scale.set(1.20, 0.65, 1.25);
      pet.position.set(Math.cos(pAng) * 0.012 * scale, (Math.random() - 0.5) * 0.005 * scale, Math.sin(pAng) * 0.012 * scale);
      blossomGroup.add(pet);
    }
    // Tier 3: Mid-outer ruffled pom-pom
    for (let pIdx = 0; pIdx < 16; pIdx++) {
      const pAng = (pIdx / 16) * Math.PI * 2 + 0.12;
      const pet = new THREE.Mesh(new THREE.SphereGeometry(0.0115 * scale, 6, 6), flowerPetalMat);
      pet.scale.set(1.25, 0.70, 1.30);
      pet.position.set(Math.cos(pAng) * 0.017 * scale, (Math.random() - 0.5) * 0.006 * scale, Math.sin(pAng) * 0.017 * scale);
      blossomGroup.add(pet);
    }
    // Tier 4: Outer soft undulating base petals
    for (let pIdx = 0; pIdx < 18; pIdx++) {
      const pAng = (pIdx / 18) * Math.PI * 2 + 0.35;
      const pet = new THREE.Mesh(new THREE.SphereGeometry(0.0130 * scale, 6, 6), flowerPetalMat);
      pet.scale.set(1.30, 0.75, 1.35);
      pet.position.set(Math.cos(pAng) * 0.021 * scale, (Math.random() - 0.5) * 0.007 * scale, Math.sin(pAng) * 0.021 * scale);
      blossomGroup.add(pet);
    }

    const calyxMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.010 * scale, 0.014 * scale, 8),
      new THREE.MeshStandardMaterial({ color: 0x1f5c1b, roughness: 0.65 })
    );
    calyxMesh.rotation.x = Math.PI;
    calyxMesh.position.y = -0.014 * scale;
    blossomGroup.add(calyxMesh);

    return blossomGroup;
  };

  const rosePetalMat = new THREE.MeshPhysicalMaterial({
    color: 0x991b1b,
    roughness: 0.34,
    metalness: 0.0,
    sheen: 0.95,
    sheenColor: 0xdc2626
  });
  const createRoseBlossom = (scale = 1.0) => {
    const roseGroup = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.008 * scale, 8, 8), rosePetalMat);
    roseGroup.add(core);

    for (let rIdx = 0; rIdx < 14; rIdx++) {
      const rAng = (rIdx / 14) * Math.PI * 2.8;
      const rad = 0.006 * scale + (rIdx / 14) * 0.012 * scale;
      const pet = new THREE.Mesh(new THREE.SphereGeometry(0.0095 * scale, 8, 6), rosePetalMat);
      pet.scale.set(1.25, 0.55, 1.35);
      pet.position.set(Math.cos(rAng) * rad, 0.002 * rIdx * scale, Math.sin(rAng) * rad);
      pet.rotation.y = rAng;
      roseGroup.add(pet);
    }
    return roseGroup;
  };

  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0xfdfcf9,
    map: textures.petalMap,
    roughness: 0.65
  });

  // 1. TALL FOREHEAD ARCH GARLAND (Lush Marigold Mala framing Tripundra - Panel 2 Reference)
  const archPts = [
    new THREE.Vector3(-0.138, 0.22, 0.02),
    new THREE.Vector3(-0.135, 0.33, 0.05),
    new THREE.Vector3(-0.122, 0.43, 0.075),
    new THREE.Vector3(-0.078, 0.51, 0.090),
    new THREE.Vector3(0.0, 0.536, 0.095),
    new THREE.Vector3(0.078, 0.51, 0.090),
    new THREE.Vector3(0.122, 0.43, 0.075),
    new THREE.Vector3(0.135, 0.33, 0.05),
    new THREE.Vector3(0.138, 0.22, 0.02)
  ];
  const archCurve = new THREE.CatmullRomCurve3(archPts);
  const archRope = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 32, 0.008, 8, false), ropeMat);
  garlandGroup.add(archRope);

  const numArchFlowers = 33;
  for (let i = 0; i < numArchFlowers; i++) {
    const t = i / (numArchFlowers - 1);
    const pt = archCurve.getPoint(t);

    let flw: THREE.Group;
    if (i === 15 || i === 16 || i === 17) {
      // Crown cluster at top apex: Royal Velvety Red Roses (Panel 2 Reference)
      flw = createRoseBlossom(i === 16 ? 1.45 : 1.25);
    } else if (i % 2 === 0) {
      // Alternating Saffron Orange Marigold Pom-poms
      flw = createMarigoldBlossom(0xea580c, 1.15);
    } else {
      // Alternating Golden Yellow Marigold Pom-poms
      flw = createMarigoldBlossom(0xf59e0b, 1.15);
    }

    flw.position.copy(pt);
    flw.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(pt.x * 0.8, pt.y * 0.2, 1).normalize());
    garlandGroup.add(flw);

    // Subtle pearlescent Mogra bud nestled between marigolds along inner seam
    if (i % 2 === 1 && i !== 15 && i !== 17) {
      const bud = createMograBud(0.95);
      bud.position.set(pt.x * 0.92, pt.y, pt.z + 0.008);
      garlandGroup.add(bud);
    }
  }

  // 2. HORIZONTAL PEETH BASE GARLAND (Dense circular bed of Marigolds on Yoni plinth - Panel 2 Reference)
  const peethPts = [
    new THREE.Vector3(-0.17, 0.175, -0.02),
    new THREE.Vector3(-0.16, 0.175, 0.10),
    new THREE.Vector3(-0.09, 0.175, 0.18),
    new THREE.Vector3(0.0, 0.175, 0.20),
    new THREE.Vector3(0.09, 0.175, 0.18),
    new THREE.Vector3(0.16, 0.175, 0.10),
    new THREE.Vector3(0.17, 0.175, -0.02)
  ];
  const peethCurve = new THREE.CatmullRomCurve3(peethPts);
  const peethRope = new THREE.Mesh(new THREE.TubeGeometry(peethCurve, 24, 0.008, 8, false), ropeMat);
  garlandGroup.add(peethRope);

  const numPeethFlowers = 23;
  for (let i = 0; i < numPeethFlowers; i++) {
    const t = i / (numPeethFlowers - 1);
    const pt = peethCurve.getPoint(t);
    // Rich continuous bed of alternating Saffron and Golden Marigolds
    const col = i % 2 === 0 ? 0xea580c : 0xf59e0b;
    const flw = createMarigoldBlossom(col, 1.15);
    flw.position.copy(pt);
    flw.rotation.x = Math.PI * 0.35;
    garlandGroup.add(flw);
  }

  // 3. CASCADING FRONT PENDANT LOOP (Latkan falling gracefully over front of Yoni rim - Panel 2 Reference)
  const loopPts = [
    new THREE.Vector3(-0.055, 0.195, 0.18),
    new THREE.Vector3(-0.085, 0.14, 0.32),
    new THREE.Vector3(-0.065, 0.06, 0.40),
    new THREE.Vector3(0.0, 0.005, 0.43),
    new THREE.Vector3(0.065, 0.06, 0.40),
    new THREE.Vector3(0.085, 0.14, 0.32),
    new THREE.Vector3(0.055, 0.195, 0.18)
  ];
  const loopCurve = new THREE.CatmullRomCurve3(loopPts);
  const loopRope = new THREE.Mesh(new THREE.TubeGeometry(loopCurve, 20, 0.007, 8, false), ropeMat);
  garlandGroup.add(loopRope);

  const numLoopFlowers = 17;
  for (let i = 0; i < numLoopFlowers; i++) {
    const t = i / (numLoopFlowers - 1);
    const pt = loopCurve.getPoint(t);
    const flw = i % 2 === 0 ? createMarigoldBlossom(0xf59e0b, 0.95) : createMograBud(1.15);
    flw.position.copy(pt);
    flw.rotation.x = 0.42;
    garlandGroup.add(flw);
  }

  // Tassel at bottom tip: Saffron Marigold + Red Rose + soft Mogra drops (Panel 2 Reference)
  const tipMarigold = createMarigoldBlossom(0xf59e0b, 1.40);
  tipMarigold.position.set(0, 0.005, 0.435);
  tipMarigold.rotation.x = 0.45;
  garlandGroup.add(tipMarigold);

  const tipRose = createRoseBlossom(1.25);
  tipRose.position.set(0, -0.008, 0.448);
  tipRose.rotation.x = 0.50;
  garlandGroup.add(tipRose);

  [-0.018, 0.018].forEach((tx) => {
    const bud = createMograBud(1.0);
    bud.position.set(tx, -0.022, 0.455);
    bud.rotation.x = 0.70;
    garlandGroup.add(bud);
  });

  group.add(garlandGroup);

  // 3. Sacred Trifoliate Bilva Patra leaf placed proudly upon the Lingam crown (matching User Reference)
  const crownBilva = new THREE.Group();
  crownBilva.position.set(0, 0.582, -0.05);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    map: textures.leafMap,
    roughness: 0.44,
    metalness: 0.02,
    side: THREE.DoubleSide
  });
  const leafGeo = new THREE.PlaneGeometry(0.048, 0.068);
  leafGeo.rotateX(-Math.PI * 0.45);

  const centerLeaf = new THREE.Mesh(leafGeo, leafMat);
  centerLeaf.position.set(0, 0.006, 0.016);
  centerLeaf.rotation.x = 0.12;
  crownBilva.add(centerLeaf);

  const leftLeaf = new THREE.Mesh(leafGeo, leafMat);
  leftLeaf.scale.setScalar(0.88);
  leftLeaf.position.set(-0.026, 0.003, -0.01);
  leftLeaf.rotation.z = 0.55;
  leftLeaf.rotation.x = 0.1;
  crownBilva.add(leftLeaf);

  const rightLeaf = new THREE.Mesh(leafGeo, leafMat);
  rightLeaf.scale.setScalar(0.88);
  rightLeaf.position.set(0.026, 0.003, -0.01);
  rightLeaf.rotation.z = -0.55;
  rightLeaf.rotation.x = 0.1;
  crownBilva.add(rightLeaf);

  // Sacred Sandalwood paste (Chandan) dot at center of Bilva patra (Panel 2 Reference)
  const chandanDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.008, 12),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.88, side: THREE.DoubleSide })
  );
  chandanDot.rotation.x = -Math.PI / 2;
  chandanDot.position.set(0, 0.010, 0.005);
  crownBilva.add(chandanDot);
  group.add(crownBilva);

  // 4. Scattered Fresh Rose & Marigold Petals on the Jalahari basin rim & stone altar (Panel 3 Reference)
  const petalMatOrange = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    map: textures.marigoldPetalMap,
    roughness: 0.55,
    side: THREE.DoubleSide
  });
  const petalMatRed = new THREE.MeshStandardMaterial({
    color: 0x9f1239,
    map: textures.petalMap,
    roughness: 0.55,
    side: THREE.DoubleSide
  });
  const pShape = new THREE.Shape();
  pShape.moveTo(0, 0);
  pShape.quadraticCurveTo(0.012, 0.008, 0, 0.024);
  pShape.quadraticCurveTo(-0.012, 0.008, 0, 0);
  const petalGeo = new THREE.ShapeGeometry(pShape, 8);
  petalGeo.rotateX(-Math.PI / 2);

  const scatteredPetals: Array<[number, number, number, number, boolean]> = [
    [-0.22, 0.145, 0.08, 0.4, true],
    [-0.18, 0.145, 0.14, -0.7, false],
    [0.19, 0.145, 0.09, 0.9, true],
    [0.16, 0.145, 0.15, -0.3, false],
    [-0.26, 0.006, -0.15, 1.2, false],
    [0.28, 0.006, -0.12, -0.8, true],
    [-0.12, 0.006, 0.22, 0.2, true],
    [0.08, 0.006, 0.24, -0.5, false],
    [-0.02, 0.006, 0.25, 0.6, true],
    // Altar stone slab scattered fresh petals (Panel 3 Reference)
    [-0.38, 0.006, 0.45, 0.5, false],
    [-0.42, 0.006, 0.52, -1.1, true],
    [-0.08, 0.006, 0.46, 0.8, false],
    [0.12, 0.006, 0.48, -0.4, true],
    [0.34, 0.006, 0.42, 1.3, false],
    [0.44, 0.006, 0.52, -0.6, true]
  ];
  scatteredPetals.forEach(([px, py, pz, rot, isOrange]) => {
    const pMesh = new THREE.Mesh(petalGeo, isOrange ? petalMatOrange : petalMatRed);
    pMesh.position.set(px, py, pz);
    pMesh.rotation.y = rot;
    group.add(pMesh);
  });

  // Loose fresh marigold blossoms on stone altar (Panel 3 Reference)
  [-0.32, 0.38].forEach((bx, idx) => {
    const looseBlossom = createMarigoldBlossom(idx === 0 ? 0xf59e0b : 0xea580c, 1.15);
    looseBlossom.position.set(bx, 0.015, 0.50);
    looseBlossom.rotation.x = -0.2;
    group.add(looseBlossom);
  });

  // Real Hand-Hammered Antique Copper Jalpatra collection vessel (Panel 3 & 4 Reference - Real Photographic Texture)
  const copperMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.copperMap,
    roughnessMap: textures.copperRoughness,
    bumpMap: textures.copperRoughness,
    bumpScale: 0.003,
    roughness: 0.28,
    metalness: 0.90,
    envMapIntensity: 1.25
  });
  const basinPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.155, 0.055),
    new THREE.Vector2(0.165, 0.088),
    new THREE.Vector2(0.15, 0.088),
    new THREE.Vector2(0.105, 0.014),
    new THREE.Vector2(0.001, 0.014)
  ];
  const basin = new THREE.Mesh(new THREE.LatheGeometry(basinPts, 32), copperMat);
  basin.position.set(0.56, 0.0, -0.05);
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);

  // Subtle brass altar bell accent beside Jalahari
  const diyaLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.02, 16), brassMat);
  diyaLeft.position.set(-0.34, 0.01, -0.2);
  group.add(diyaLeft);

  // Real-time Parabolic Pouring Stream connecting Kalash Spout Lip -> Lingam Crown
  const STREAM_SEGS = 14;
  const RADIAL_SEGS = 12;
  const streamGeo = createDynamicStreamGeometry(STREAM_SEGS, RADIAL_SEGS);
  // Pure Crystalline Holy Gangajal (Clear transparent liquid, refractive with high clearcoat sheen)
  const streamMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.015,
    metalness: 0.0,
    transparent: true,
    opacity: 0.88,
    transmission: 0.94,
    ior: 1.333,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 0.85,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide
  });
  const streamMesh = new THREE.Mesh(streamGeo, streamMat);
  streamMesh.visible = false;
  streamMesh.frustumCulled = false;
  group.add(streamMesh);

  // Milky residue coating film over the Lingam (ONLY visible when offering milk)
  const surfaceFilmMat = new THREE.MeshPhysicalMaterial({
    color: 0xfdfaf2,
    roughness: 0.35,
    metalness: 0.0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false
  });
  const surfaceFilm = new THREE.Mesh(new THREE.LatheGeometry(lingamPts, 32), surfaceFilmMat);
  surfaceFilm.scale.setScalar(1.004);
  surfaceFilm.position.copy(lingam.position);
  surfaceFilm.visible = false;
  group.add(surfaceFilm);

  // Cascading Water Flow Strips running down the Lingam contours into the Jalahari trough
  const trickleGroup = new THREE.Group();
  const trickleStripGeo = new THREE.PlaneGeometry(0.032, 0.32, 4, 12);
  trickleStripGeo.translate(0, -0.16, 0);
  const trickleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.02,
    transparent: true,
    opacity: 0.0,
    transmission: 0.92,
    ior: 1.333,
    clearcoat: 1.0,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const trickleStrips: THREE.Mesh[] = [];
  [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((angle) => {
    const strip = new THREE.Mesh(trickleStripGeo, trickleMat);
    strip.position.set(Math.cos(angle) * 0.126, 0.45, -0.05 + Math.sin(angle) * 0.126);
    strip.rotation.y = -angle + Math.PI / 2;
    trickleGroup.add(strip);
    trickleStrips.push(strip);
  });
  group.add(trickleGroup);

  // Gomukha drainage spout runoff stream into Copper Jalpatra basin
  const drainStream = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.012, 0.15, 12), streamMat);
  drainStream.position.set(0.53, 0.075, -0.05);
  drainStream.rotation.z = 0.25;
  drainStream.visible = false;
  group.add(drainStream);

  // Refractive Liquid Pool filling the Copper Jalpatra Basin
  const basinLiquidMat = new THREE.MeshPhysicalMaterial({
    color: 0xf0f9ff,
    roughness: 0.03,
    metalness: 0.0,
    transparent: true,
    opacity: 0.0,
    transmission: 0.90,
    ior: 1.333,
    clearcoat: 1.0,
    envMapIntensity: 1.4
  });
  const basinLiquid = new THREE.Mesh(new THREE.CircleGeometry(0.14, 28), basinLiquidMat);
  basinLiquid.rotation.x = -Math.PI / 2;
  basinLiquid.position.set(0.56, 0.016, -0.05);
  basinLiquid.visible = false;
  group.add(basinLiquid);

  const DROP_COUNT = 36;
  const dropGeo = new THREE.SphereGeometry(0.0068, 8, 8);
  const splashInstanced = new THREE.InstancedMesh(dropGeo, streamMat, DROP_COUNT);
  splashInstanced.frustumCulled = false;
  group.add(splashInstanced);

  const arcBuf = new Float32Array(STREAM_SEGS * 3);
  const dropState = Array.from({ length: DROP_COUNT }, (_, i) => ({
    x: 0,
    y: -10,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: i * 0.03
  }));
  const _mat4 = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3();

  let wetness = 0;
  let basinFill = 0.05;

  const fluidRig: ShivaFluidRig = {
    streamMesh,
    streamMat,
    surfaceFilm,
    surfaceFilmMat,
    drainStream,
    basinLiquid,
    basinLiquidMat,
    splashInstanced,
    update: (pourRate, isMilk, spoutWorldPos, pourDirX, pourDirZ, time, dt, emissionVelocity) => {
      const safeDt = Math.min(dt, 0.05);
      const dyn = computeFluidDynamics(isMilk, pourRate);

      if (isMilk) {
        streamMat.color.setHex(0xfcf8ee);
        streamMat.opacity = 0.96;
        streamMat.transmission = 0.12;
        streamMat.roughness = 0.18;
        streamMat.clearcoat = 0.80;
        surfaceFilmMat.color.setHex(0xfcf8ee);
        basinLiquidMat.color.setHex(0xf8f3e8);
        trickleMat.color.setHex(0xfcf8ee);
      } else {
        // Pure Crystalline Holy Gangajal (Clear transparent water!)
        streamMat.color.setHex(0xffffff);
        streamMat.opacity = 0.88;
        streamMat.transmission = 0.94;
        streamMat.ior = 1.333;
        streamMat.roughness = 0.015;
        streamMat.clearcoat = 1.0;
        streamMat.clearcoatRoughness = 0.02;
        streamMat.envMapIntensity = 1.8;
        surfaceFilmMat.color.setHex(0xffffff);
        basinLiquidMat.color.setHex(0xebf8ff);
        trickleMat.color.setHex(0xffffff);
      }

      const isPouring = pourRate > 0.03;
      streamMesh.visible = isPouring;
      let impactX = 0;
      let impactY = 0.54;
      let impactZ = -0.05;
      let hitLingam = false;

      if (isPouring) {
        let count = 0;

        if (emissionVelocity && emissionVelocity.lengthSq() > 0.01) {
          // True ballistic gravity trajectory and solid Lingam collision query
          const dtStep = 0.022;
          const curPos = spoutWorldPos.clone();
          const curVel = emissionVelocity.clone();
          const gAcc = new THREE.Vector3(0, -9.81, 0);

          arcBuf[0] = curPos.x;
          arcBuf[1] = curPos.y;
          arcBuf[2] = curPos.z;
          count = 1;

          const lingamRad = 0.148;

          for (let i = 1; i < STREAM_SEGS; i++) {
            curVel.addScaledVector(gAcc, dtStep);
            curPos.addScaledVector(curVel, dtStep);

            // 1. Collision with Lingam hemispherical dome crown (center at y=0.54, z=-0.05)
            const distDome = curPos.distanceTo(new THREE.Vector3(0, 0.54, -0.05));
            if (curPos.y >= 0.52 && distDome <= lingamRad) {
              hitLingam = true;
              impactX = curPos.x;
              impactY = curPos.y;
              impactZ = curPos.z;
              arcBuf[i * 3] = curPos.x;
              arcBuf[i * 3 + 1] = curPos.y;
              arcBuf[i * 3 + 2] = curPos.z;
              count = i + 1;
              break;
            }

            // 2. Collision with Lingam cylindrical body (y: 0.165 to 0.54)
            const horizDist = Math.hypot(curPos.x - 0, curPos.z - (-0.05));
            if (curPos.y >= 0.165 && curPos.y <= 0.54 && horizDist <= lingamRad) {
              hitLingam = true;
              impactX = curPos.x;
              impactY = curPos.y;
              impactZ = curPos.z;
              arcBuf[i * 3] = curPos.x;
              arcBuf[i * 3 + 1] = curPos.y;
              arcBuf[i * 3 + 2] = curPos.z;
              count = i + 1;
              break;
            }

            // 3. Collision with Table / Plinth surface (y <= 0.005)
            if (curPos.y <= 0.005) {
              impactX = curPos.x;
              impactY = 0.005;
              impactZ = curPos.z;
              arcBuf[i * 3] = curPos.x;
              arcBuf[i * 3 + 1] = 0.005;
              arcBuf[i * 3 + 2] = curPos.z;
              count = i + 1;
              break;
            }

            arcBuf[i * 3] = curPos.x;
            arcBuf[i * 3 + 1] = curPos.y;
            arcBuf[i * 3 + 2] = curPos.z;
            count = i + 1;
          }
        } else {
          // Guided fallback
          const crownY = 0.54;
          count = computeStreamArcPoints(
            spoutWorldPos.x,
            spoutWorldPos.y,
            spoutWorldPos.z,
            pourRate,
            crownY,
            pourDirX,
            pourDirZ,
            arcBuf,
            STREAM_SEGS
          );
          hitLingam = true;
          impactX = arcBuf[(count - 1) * 3] || 0;
          impactY = 0.54;
          impactZ = arcBuf[(count - 1) * 3 + 2] || -0.05;
        }

        if (count > 1) {
          updateDynamicStreamGeometry(
            streamGeo,
            arcBuf,
            count,
            dyn.streamRadius,
            time,
            dyn.flowSpeed,
            RADIAL_SEGS
          );
        }

        if (hitLingam) {
          wetness = Math.min(1, wetness + safeDt * dyn.coatingGainRate * pourRate);
          basinFill = Math.min(1, basinFill + safeDt * 0.14 * pourRate);
        } else {
          wetness = Math.max(0.06, wetness - safeDt * dyn.coatingDecayRate);
        }
      } else {
        wetness = Math.max(0.06, wetness - safeDt * dyn.coatingDecayRate);
      }

      // Dynamic Wet-Surface simulation on the sacred idol (Panel 4 Reference):
      basaltMat.color.lerpColors(dryBasaltColor, wetBasaltColor, wetness);
      basaltMat.roughness = THREE.MathUtils.lerp(0.68, 0.12, wetness);
      basaltMat.envMapIntensity = THREE.MathUtils.lerp(0.22, 0.95, wetness);

      const emptyFade = Math.min(1, Math.max(0, (basinFill - 0.055) / 0.2));
      basinLiquid.visible = basinFill > 0.055;
      basinLiquidMat.opacity = emptyFade * (isMilk ? 0.96 : 0.72);

      // Only display milk film overlay when offering milk (never for water!)
      surfaceFilm.visible = isMilk && wetness > 0.06;
      if (surfaceFilm.visible) {
        surfaceFilmMat.opacity = Math.min(0.68, wetness * 0.85);
      }

      // Cascading water/milk flow trickles running down the cylindrical body
      trickleMat.opacity = THREE.MathUtils.clamp(
        (isPouring ? 0.75 : 0.35) * wetness,
        0,
        0.85
      );
      trickleStrips.forEach((strip, sIdx) => {
        // Vertical ripple oscillation as water flows
        strip.scale.y = 1.0 + Math.sin(time * 8 + sIdx * 1.5) * 0.04;
      });

      drainStream.visible = wetness > 0.25;
      if (drainStream.visible) {
        drainStream.scale.setScalar((0.72 + wetness * 0.48) * (isMilk ? 1.15 : 0.92));
      }
      basinLiquid.position.y = 0.016 + basinFill * 0.052;
      basinLiquid.scale.setScalar(0.84 + basinFill * 0.16);

      // Realistic Splash & Droplet Physics with persistent post-pour dripping
      for (let i = 0; i < DROP_COUNT; i++) {
        const d = dropState[i];
        d.life -= safeDt * dyn.flowSpeed;
        if (d.life <= 0) {
          if (isPouring) {
            // Active pouring splashes at crown impact & in copper basin
            const atBasin = i % 4 === 0 && wetness > 0.35;
            if (atBasin) {
              d.x = 0.56 + (Math.random() - 0.5) * 0.035;
              d.y = 0.04 + basinFill * 0.04;
              d.z = -0.05 + (Math.random() - 0.5) * 0.035;
              d.vx = (Math.random() - 0.5) * 0.12;
              d.vy = (0.18 + Math.random() * 0.14) * dyn.flowSpeed;
              d.vz = (Math.random() - 0.5) * 0.12;
            } else {
              const ang = Math.random() * Math.PI * 2;
              const rad = 0.014 + Math.random() * 0.036;
              d.x = impactX + Math.cos(ang) * rad;
              d.y = 0.455;
              d.z = impactZ + Math.sin(ang) * rad;
              d.vx = Math.cos(ang) * (0.16 + Math.random() * 0.14);
              d.vy = (0.22 + Math.random() * 0.16) * dyn.flowSpeed;
              d.vz = Math.sin(ang) * (0.16 + Math.random() * 0.14);
            }
            d.life = 0.28 + Math.random() * 0.22;
          } else if (wetness > 0.12 && i % 3 === 0) {
            // Persistent residual dripping: droplets naturally drip from Gomukha spout and Lingam rim!
            if (i % 6 === 0) {
              // Spout tip dripping into copper basin
              d.x = 0.48 + (Math.random() - 0.5) * 0.01;
              d.y = 0.14;
              d.z = -0.05 + (Math.random() - 0.5) * 0.01;
              d.vx = 0.02;
              d.vy = -0.08;
              d.vz = 0;
              d.life = 0.35;
            } else {
              // Lingam base rim dripping down into trough
              const ang = Math.random() * Math.PI * 2;
              d.x = Math.cos(ang) * 0.13;
              d.y = 0.20;
              d.z = -0.05 + Math.sin(ang) * 0.13;
              d.vx = 0;
              d.vy = -0.06;
              d.vz = 0;
              d.life = 0.28;
            }
          } else {
            // Finished drop moves below floor
            d.y = -10;
            d.life = 0.1;
          }
        } else {
          // Physics gravity & trajectory update
          d.vy -= 2.6 * safeDt;
          d.x += d.vx * safeDt;
          d.y += d.vy * safeDt;
          d.z += d.vz * safeDt;
        }
        _pos.set(d.x, d.y, d.z);
        const s = d.y < 0.02 ? 0.0001 : (0.65 + d.life) * dyn.splashScale;
        _scale.setScalar(s);
        _mat4.compose(_pos, _quat, _scale);
        splashInstanced.setMatrixAt(i, _mat4);
      }
      splashInstanced.instanceMatrix.needsUpdate = true;
    }
  };

  return { group, fluidRig };
}

/**
 * Builds an authentic carved architectural sanctum shrine alcove (stone/teakwood pillars,
 * brass Prabhavali arch, lotus plinth, marigold garland & arched sacred relief medallion)
 * rather than a flat rectangular framed wall photo.
 */
function buildArchedSanctumShrine(
  exp: ExperienceSpec,
  textures: TextureBundle,
  brassMat: THREE.Material,
  woodMat: THREE.Material,
  marbleMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const baseMat = exp.id === 'mahavir' || exp.id === 'sikh' ? marbleMat : woodMat;

  // 1. Stepped Carved Temple Plinth & Lotus Seat resting directly on Chowki
  const plinthLower = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.055, 0.34), baseMat);
  plinthLower.position.set(0, 0.0275, -0.22);
  plinthLower.castShadow = true;
  plinthLower.receiveShadow = true;
  const plinthUpper = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.24), brassMat);
  plinthUpper.position.set(0, 0.075, -0.22);
  plinthUpper.castShadow = true;
  g.add(plinthLower, plinthUpper);

  // 2. Fluted Sanctum Pillars framing the Recessed Alcove
  const shrineColMat =
    exp.id === 'mahavir' || exp.id === 'sikh'
      ? marbleMat
      : new THREE.MeshStandardMaterial({
          color: 0xc8a982,
          map: textures.sandstoneMap,
          roughness: 0.74,
          envMapIntensity: 0.25
        });
  [-0.36, 0.36].forEach((px) => {
    const colBase = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.06, 0.095), baseMat);
    colBase.position.set(px, 0.085, -0.25);
    const colShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.038, 0.56, 16),
      shrineColMat
    );
    colShaft.position.set(px, 0.39, -0.25);
    colShaft.castShadow = true;
    const colCap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.034, 0.05, 16), brassMat);
    colCap.position.set(px, 0.68, -0.25);
    g.add(colBase, colShaft, colCap);
  });

  // 3. Sculpted Brass Prabhavali Dome Arch + Kalash Spire
  const outerArch = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.024, 14, 36, Math.PI),
    brassMat
  );
  outerArch.position.set(0, 0.52, -0.25);
  outerArch.castShadow = true;
  const innerArch = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.012, 10, 32, Math.PI),
    brassMat
  );
  innerArch.position.set(0, 0.52, -0.245);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.09, 18), brassMat);
  spire.position.set(0, 0.93, -0.25);
  const finialOrb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), brassMat);
  finialOrb.position.set(0, 0.985, -0.25);
  g.add(outerArch, innerArch, spire, finialOrb);

  // 4. Curved Recessed Arch Niche Backdrop + Seamless Sacred Shrine Image
  const archShape = new THREE.Shape();
  const rw = 0.31;
  const rh = 0.44;
  archShape.moveTo(-rw, 0);
  archShape.lineTo(rw, 0);
  archShape.lineTo(rw, rh);
  archShape.absarc(0, rh, rw, 0, Math.PI, false);
  archShape.lineTo(-rw, 0);

  const backingGeo = new THREE.ExtrudeGeometry(archShape, {
    depth: 0.04,
    bevelEnabled: false,
    curveSegments: 28
  });
  const backingMesh = new THREE.Mesh(
    backingGeo,
    new THREE.MeshStandardMaterial({
      color: 0x3b2214,
      map: textures.woodMap,
      roughness: 0.72
    })
  );
  backingMesh.position.set(0, 0.085, -0.3);
  backingMesh.castShadow = true;
  backingMesh.receiveShadow = true;
  g.add(backingMesh);

  const resolvedUrl = BUNDLED_SHRINE_IMAGES[exp.id] ?? exp.imageUrl;
  const shrineTex = textures.createTrackedImageTexture(resolvedUrl);
  const shrineFaceMat = new THREE.MeshStandardMaterial({
    color: 0xf6efe6,
    map: shrineTex,
    roughness: 0.56,
    metalness: 0.02,
    envMapIntensity: 0.22
  });

  // Arched planar relief inset deep inside the carved Prabhavali arch (normalized UVs [0..1])
  const insetShape = new THREE.Shape();
  const iw = 0.285;
  const ih = 0.415;
  insetShape.moveTo(-iw, 0);
  insetShape.lineTo(iw, 0);
  insetShape.lineTo(iw, ih);
  insetShape.absarc(0, ih, iw, 0, Math.PI, false);
  insetShape.lineTo(-iw, 0);

  const insetGeo = new THREE.ShapeGeometry(insetShape, 28);
  const posAttr = insetGeo.attributes.position;
  const uvArr = new Float32Array(posAttr.count * 2);
  const totalH = ih + iw;
  for (let i = 0; i < posAttr.count; i++) {
    const px = posAttr.getX(i);
    const py = posAttr.getY(i);
    uvArr[i * 2] = (px + iw) / (2 * iw);
    uvArr[i * 2 + 1] = py / totalH;
  }
  insetGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));

  const shrineRelief = new THREE.Mesh(insetGeo, shrineFaceMat);
  shrineRelief.position.set(0, 0.095, -0.252);
  shrineRelief.receiveShadow = true;
  g.add(shrineRelief);

  // Warm soft Sanctum Arch Downlight illuminating the deity niche naturally
  const nicheLight = new THREE.PointLight(0xffe4b8, 0.72, 1.4, 2.0);
  nicheLight.position.set(0, 0.78, -0.05);
  g.add(nicheLight);

  // Foreground carved brass flower offering rim along base of shrine plinth
  for (let i = -3; i <= 3; i++) {
    const petal = buildFlowerCluster(textures, i % 2 === 0 ? 0xf59e0b : 0xfaf6ed, false);
    petal.scale.setScalar(0.42);
    petal.position.set(i * 0.085, 0.055, -0.06);
    g.add(petal);
  }

  // Tradition-specific sculptural 3D foreground accent beside the shrine
  if (exp.id === 'krishna') {
    // Carved bamboo Bansuri flute resting diagonally on the brass lotus step
    const flute = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0085, 0.0095, 0.36, 12),
      new THREE.MeshStandardMaterial({ color: 0xc29b48, roughness: 0.42 })
    );
    flute.rotation.z = Math.PI / 2 - 0.14;
    flute.rotation.y = 0.2;
    flute.position.set(0.02, 0.11, -0.14);
    flute.castShadow = true;
    g.add(flute);
  }

  return g;
}

function buildSikhPalkiFocal(
  textures: TextureBundle,
  exp: ExperienceSpec,
  marbleMat: THREE.Material,
  brassMat: THREE.Material,
  woodMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  g.add(buildArchedSanctumShrine(exp, textures, brassMat, woodMat, marbleMat));

  const velvetBlue = new THREE.MeshStandardMaterial({
    color: 0x1e3a8a,
    map: textures.brocadeMap,
    roughness: 0.66
  });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.25, metalness: 0.9 });

  const platform = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.32), marbleMat);
  platform.position.set(0, 0.04, -0.14);
  platform.castShadow = true;
  platform.receiveShadow = true;
  g.add(platform);

  const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.014, 0.21), goldMat);
  goldTrim.position.set(0, 0.088, -0.14);
  g.add(goldTrim);

  const rumala = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.065, 0.19), velvetBlue);
  rumala.position.set(0, 0.125, -0.14);
  rumala.castShadow = true;
  g.add(rumala);

  return g;
}

function buildChristianCrossFocal(
  woodMat: THREE.Material,
  brassMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();

  const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.18), woodMat);
  step1.position.set(0, 0.02, -0.16);
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.14), woodMat);
  step2.position.set(0, 0.06, -0.16);
  g.add(step1, step2);

  const vBeam = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.045), woodMat);
  vBeam.position.set(0, 0.38, -0.16);
  vBeam.castShadow = true;
  const hBeam = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.07, 0.045), woodMat);
  hBeam.position.set(0, 0.48, -0.16);
  hBeam.castShadow = true;

  const brassInlayV = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.58, 0.05), brassMat);
  brassInlayV.position.set(0, 0.38, -0.16);
  const brassInlayH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.05), brassMat);
  brassInlayH.position.set(0, 0.48, -0.16);

  g.add(vBeam, hBeam, brassInlayV, brassInlayH);
  return g;
}

function buildIslamicZiyaratFocal(
  textures: TextureBundle,
  marbleMat: THREE.Material,
  brassMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const emeraldMat = new THREE.MeshStandardMaterial({
    color: 0x065f46,
    map: textures.brocadeMap,
    roughness: 0.68
  });

  const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.78, 0.04), marbleMat);
  screenFrame.position.set(0, 0.42, -0.34);
  g.add(screenFrame);

  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.68, 0.05), brassMat);
    bar.position.set(i * 0.14, 0.42, -0.33);
    g.add(bar);
  }
  for (let j = -2; j <= 2; j++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.015, 0.05), brassMat);
    bar.position.set(0, 0.42 + j * 0.14, -0.33);
    g.add(bar);
  }

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.34), marbleMat);
  plinth.position.set(0, 0.06, -0.12);
  plinth.receiveShadow = true;
  g.add(plinth);

  const chadarBorder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.018, 0.3), brassMat);
  chadarBorder.position.set(0, 0.122, -0.12);
  g.add(chadarBorder);

  const chadar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.052, 0.27), emeraldMat);
  chadar.position.set(0, 0.145, -0.12);
  chadar.castShadow = true;
  g.add(chadar);

  const chadarRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.565, 0.012, 0.05), brassMat);
  chadarRibbon.position.set(0, 0.168, -0.12);
  g.add(chadarRibbon);

  return g;
}

function buildJainMahavirFocal(
  exp: ExperienceSpec,
  textures: TextureBundle,
  marbleMat: THREE.Material,
  brassMat: THREE.Material,
  woodMat: THREE.Material
): { group: THREE.Group; swastikGroup: THREE.Group } {
  const group = new THREE.Group();
  group.add(buildArchedSanctumShrine(exp, textures, brassMat, woodMat, marbleMat));

  const thali = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.015, 28), brassMat);
  thali.position.set(0, 0.012, 0.18);
  thali.receiveShadow = true;
  group.add(thali);

  const swastikGroup = new THREE.Group();
  swastikGroup.position.set(0, 0.022, 0.18);
  const riceMat = new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.7 });
  const bars: Array<[number, number, number, number]> = [
    [0, 0, 0.11, 0.014],
    [0, 0, 0.014, 0.11],
    [0.028, -0.048, 0.055, 0.014],
    [-0.028, 0.048, 0.055, 0.014],
    [0.048, 0.028, 0.014, 0.055],
    [-0.048, -0.028, 0.014, 0.055]
  ];
  bars.forEach(([x, z, w, d]) => {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, d), riceMat);
    seg.position.set(x, 0, z);
    swastikGroup.add(seg);
  });
  swastikGroup.visible = false;
  group.add(swastikGroup);

  return { group, swastikGroup };
}

function buildInteractiveProp(
  textures: TextureBundle,
  expId: ExperienceSpec['id'],
  step: RitualObjectSpec,
  brassMat: THREE.Material,
  woodMat: THREE.Material,
  flamesOut: FlameRig[]
): {
  root: THREE.Group;
  spoutTip?: THREE.Object3D;
  liquidSurface?: THREE.Mesh;
  extraRef?: THREE.Group;
  radius: number;
  height: number;
} {
  const root = new THREE.Group();

  if (step.kind === 'pour-water') {
    const built = buildKalashMesh(textures, brassMat, false);
    root.add(built.group);
    return {
      root,
      spoutTip: built.spoutTip,
      liquidSurface: built.liquidSurface,
      radius: 0.072,
      height: 0.148
    };
  }
  if (step.kind === 'pour-milk') {
    const built = buildKalashMesh(textures, brassMat, true);
    root.add(built.group);
    return {
      root,
      spoutTip: built.spoutTip,
      liquidSurface: built.liquidSurface,
      radius: 0.072,
      height: 0.148
    };
  }
  if (step.id === 'bilva-patra' || step.id === 'tulsi-leaves') {
    root.add(buildBilvaLeafCluster(textures));
    return { root, radius: 0.048, height: 0.028 };
  }
  if (step.id === 'pushpa-shiva') {
    // Rich offering mound matching Panel 3 Reference:
    // Tight cluster of vibrant orange & golden marigold blossoms + generous pile of velvety red rose petals
    const flowerMound = new THREE.Group();
    const rosePetalMat = new THREE.MeshStandardMaterial({
      color: 0x9f1239, // Deep velvety Indian rose petal red (Panel 3 Reference)
      roughness: 0.52,
      metalness: 0.01,
      side: THREE.DoubleSide
    });
    const pGeo = new THREE.PlaneGeometry(0.022, 0.028);
    pGeo.rotateX(-Math.PI / 2);
    for (let r = 0; r < 20; r++) {
      const pMesh = new THREE.Mesh(pGeo, rosePetalMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.052;
      pMesh.position.set(Math.cos(angle) * dist, 0.003 + r * 0.0006, Math.sin(angle) * dist);
      pMesh.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      flowerMound.add(pMesh);
    }
    const numMarigolds = 5;
    for (let m = 0; m < numMarigolds; m++) {
      const mCol = m % 2 === 0 ? 0xea580c : 0xf59e0b;
      const b = buildFlowerCluster(textures, mCol, false);
      b.scale.setScalar(0.85);
      const mAng = (m / numMarigolds) * Math.PI * 2;
      const mDist = 0.026;
      b.position.set(Math.cos(mAng) * mDist, 0.008, Math.sin(mAng) * mDist);
      flowerMound.add(b);
    }
    root.add(flowerMound);
    return { root, radius: 0.065, height: 0.045 };
  }
  if (step.kind === 'aarti-wave') {
    root.add(buildAartiThali(textures, brassMat, flamesOut, true));
    return { root, radius: 0.118, height: 0.045 };
  }
  if (step.kind === 'light-flame') {
    if (step.id.includes('candle')) {
      const candleMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.16, 16), candleMat);
      candle.position.y = 0.08;
      candle.castShadow = true;
      root.add(candle);
      const flame = createFlameRig(textures, 0xffa726, 1.3, false, true);
      flame.group.position.y = 0.165;
      root.add(flame.group);
      flamesOut.push(flame);
      return { root, radius: 0.032, height: 0.18 };
    }
    if (step.id.includes('incense')) {
      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.02, 16), brassMat);
      holder.position.y = 0.01;
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.003, 0.16, 8),
        new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 })
      );
      stick.position.y = 0.08;
      stick.rotation.z = -0.2;
      root.add(holder, stick);
      const ember = createFlameRig(textures, 0xff5722, 0.65, false, true);
      ember.group.position.set(0.016, 0.16, 0);
      ember.group.scale.setScalar(0.55);
      root.add(ember.group);
      flamesOut.push(ember);
      return { root, radius: 0.038, height: 0.16 };
    }
    root.add(buildDiyaStand(textures, brassMat, flamesOut, step.id.includes('kapoor'), false));
    return { root, radius: 0.042, height: 0.075 };
  }
  if (step.id === 'makhan-bowl') {
    // Wide hammered silver Makhan Mishri tray; individual Makhan/Mishri/Peda pieces sit inside & are pickable
    const tray = buildBhogBowl(textures, brassMat, 'empty-plate');
    tray.children.forEach((c) => {
      if ((c as THREE.Mesh).isMesh) {
        (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.22,
          metalness: 0.9
        });
      }
    });
    root.add(tray);
    return { root, radius: 0.088, height: 0.024 };
  }
  if (step.id === 'balaji-laddoo') {
    root.add(buildBhogBowl(textures, brassMat, 'laddoo'));
    return { root, radius: 0.075, height: 0.08 };
  }
  if (step.id === 'bhog-shiva') {
    // Empty Bhog offering thali; individual Bhog food items sit inside & are also independently pickable!
    root.add(buildBhogBowl(textures, brassMat, 'empty-plate'));
    return { root, radius: 0.088, height: 0.024 };
  }
  if (step.id.includes('bhog') || step.id.includes('fruits')) {
    root.add(buildBhogBowl(textures, brassMat, 'fruits'));
    return { root, radius: 0.088, height: 0.065 };
  }
  if (step.id === 'karah-prasad') {
    root.add(buildBhogBowl(textures, brassMat, 'prasad'));
    return { root, radius: 0.075, height: 0.065 };
  }
  if (step.id.includes('chandan') || step.id.includes('sindoor')) {
    root.add(buildBhogBowl(textures, brassMat, 'chandan'));
    return { root, radius: 0.075, height: 0.06 };
  }
  if (step.id.includes('kesar')) {
    root.add(buildBhogBowl(textures, brassMat, 'kesar'));
    return { root, radius: 0.075, height: 0.06 };
  }
  if (step.id === 'buddha-water') {
    root.add(buildBhogBowl(textures, brassMat, 'water'));
    return { root, radius: 0.075, height: 0.055 };
  }
  if (step.id.includes('chunari') || step.id.includes('chola')) {
    const clothCol = step.id.includes('chola') ? 0xea580c : 0xb91c1c;
    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.028, 0.11),
      new THREE.MeshStandardMaterial({ color: clothCol, map: textures.brocadeMap, roughness: 0.68 })
    );
    cloth.position.y = 0.016;
    const fold = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.018, 0.145, 12),
      new THREE.MeshStandardMaterial({ color: clothCol, map: textures.brocadeMap, roughness: 0.68 })
    );
    fold.rotation.z = Math.PI / 2;
    fold.position.y = 0.028;
    root.add(cloth, fold);
    return { root, radius: 0.08, height: 0.045 };
  }
  if (step.id === 'buddha-lotus') {
    root.add(buildFlowerCluster(textures, 0xf472b6, true));
    return { root, radius: 0.055, height: 0.04 };
  }
  if (step.id === 'white-lilies') {
    root.add(buildFlowerCluster(textures, 0xf8fafc, true));
    return { root, radius: 0.055, height: 0.04 };
  }
  if (step.id === 'gulab-petals' || step.id === 'durga-hibiscus') {
    root.add(buildFlowerCluster(textures, 0xe11d48, false));
    return { root, radius: 0.055, height: 0.04 };
  }
  if (step.id === 'buddha-bowl') {
    const bowlPts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.05, 0),
      new THREE.Vector2(0.085, 0.032),
      new THREE.Vector2(0.092, 0.072),
      new THREE.Vector2(0.086, 0.072),
      new THREE.Vector2(0.045, 0.01),
      new THREE.Vector2(0.001, 0.01)
    ];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 28), brassMat);
    bowl.castShadow = true;
    const striker = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.14, 12), woodMat);
    striker.position.set(0.04, 0.055, 0);
    striker.rotation.z = -0.7;
    root.add(bowl, striker);
    return { root, radius: 0.095, height: 0.085 };
  }
  if (step.id === 'chaur-sahib') {
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xd8dee6,
      roughness: 0.22,
      metalness: 0.88
    });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.016, 0.17, 18), handleMat);
    handle.position.y = 0.085;
    handle.castShadow = true;

    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), brassMat);
    pommel.position.y = 0.014;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0055, 10, 24), brassMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.17;
    const collarCup = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.015, 0.024, 18), brassMat);
    collarCup.position.y = 0.165;

    // Sculpted fluted yak-hair plume core + radial hair lock tufts
    const plumePts = [
      new THREE.Vector2(0.017, 0),
      new THREE.Vector2(0.036, 0.052),
      new THREE.Vector2(0.056, 0.115),
      new THREE.Vector2(0.064, 0.175),
      new THREE.Vector2(0.046, 0.215),
      new THREE.Vector2(0.014, 0.236),
      new THREE.Vector2(0.001, 0.244)
    ];
    const plumeGeo = new THREE.LatheGeometry(plumePts, 36);
    const pPos = plumeGeo.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      const px = pPos.getX(i);
      const py = pPos.getY(i);
      const pz = pPos.getZ(i);
      const rad = Math.hypot(px, pz);
      if (rad > 0.004) {
        const theta = Math.atan2(pz, px);
        const hNorm = Math.min(1, py / 0.24);
        const strandWave =
          Math.sin(theta * 18) * 0.0048 * hNorm +
          Math.cos(theta * 10 + hNorm * 4.2) * 0.0026 * Math.sin(hNorm * Math.PI);
        const scale = (rad + strandWave) / rad;
        pPos.setX(i, px * scale);
        pPos.setZ(i, pz * scale);
      }
    }
    plumeGeo.computeVertexNormals();

    const plumeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4efe4,
      bumpMap: textures.makhanBump,
      bumpScale: 0.0026,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.42,
      sheenColor: new THREE.Color(0xfffdf8),
      envMapIntensity: 0.25
    });
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = 0.17;
    const plumeCore = new THREE.Mesh(plumeGeo, plumeMat);
    plumeCore.castShadow = true;
    plumeGroup.add(plumeCore);

    // Outer flowing yak-hair lock wisps layered gently around the collar
    const lockGeo = new THREE.ConeGeometry(0.015, 0.175, 8);
    lockGeo.translate(0, 0.0875, 0);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const lock = new THREE.Mesh(lockGeo, plumeMat);
      lock.position.set(Math.cos(a) * 0.022, 0.01, Math.sin(a) * 0.022);
      lock.rotation.order = 'YXZ';
      lock.rotation.y = -a;
      lock.rotation.z = 0.22 + (k % 2) * 0.07;
      lock.scale.set(0.85, 0.92 + (k % 3) * 0.08, 0.72);
      lock.castShadow = true;
      plumeGroup.add(lock);
    }

    root.add(handle, pommel, collarCup, collar, plumeGroup);
    return { root, radius: 0.072, height: 0.42 };
  }
  if (step.id === 'tasbih-beads') {
    const wheel = new THREE.Group();
    const beadMat = new THREE.MeshStandardMaterial({ color: 0x78350f, map: textures.woodMap, roughness: 0.45 });
    const count = 20;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), beadMat);
      bead.position.set(Math.cos(a) * 0.065, 0.02, Math.sin(a) * 0.065);
      wheel.add(bead);
    }
    const tassel = new THREE.Mesh(
      new THREE.ConeGeometry(0.014, 0.045, 10),
      new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.75 })
    );
    tassel.position.set(0.09, 0.022, 0);
    tassel.rotation.z = -Math.PI / 2;
    wheel.add(tassel);
    root.add(wheel);
    return { root, extraRef: wheel, radius: 0.075, height: 0.04 };
  }
  if (step.id === 'ittar-bottle') {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xfef08a,
      roughness: 0.08,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.84
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.075, 8), glassMat);
    body.position.y = 0.038;
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.016), brassMat);
    cap.position.y = 0.09;
    root.add(body, cap);
    return { root, radius: 0.032, height: 0.11 };
  }
  if (step.id === 'prayer-candle-place') {
    const candleMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.14, 16), candleMat);
    candle.position.y = 0.07;
    candle.castShadow = true;
    const wick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.002, 0.0025, 0.014, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b2f26, roughness: 0.9 })
    );
    wick.position.y = 0.145;
    root.add(candle, wick);
    return { root, radius: 0.03, height: 0.16 };
  }
  if (step.id === 'akshat-swastik') {
    const bowl = buildBhogBowl(textures, brassMat, 'water');
    const rice = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.72 })
    );
    rice.scale.set(1, 0.45, 1);
    rice.position.y = 0.035;
    root.add(bowl, rice);
    return { root, radius: 0.075, height: 0.06 };
  }
  if (step.kind === 'guided-reflection') {
    const standL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.065), woodMat);
    standL.position.set(-0.022, 0.032, 0);
    standL.rotation.z = -0.45;
    const standR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.065), woodMat);
    standR.position.set(0.022, 0.032, 0);
    standR.rotation.z = 0.45;
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.006, 0.058),
      new THREE.MeshStandardMaterial({ color: 0xfef9ec, roughness: 0.72 })
    );
    page.position.set(0, 0.046, 0);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.009, 0.06), brassMat);
    trim.position.set(0, 0.047, 0);
    root.add(standL, standR, page, trim);
    return { root, radius: 0.065, height: 0.06 };
  }

  root.add(buildFlowerCluster(textures, expId === 'krishna' ? 0xf8fafc : 0xf59e0b, false));
  return { root, radius: 0.055, height: 0.04 };
}

/**
 * Normal Screen Mode ONLY: Replaces the boxy procedural sandstone room & framed shrine cards with:
 * 1. A seamless curved 16:9 photorealistic devotional sanctuary cyclorama tailored per tradition.
 * 2. A wide grounded carved Pooja Vedi altar slab (basalt, Makrana marble, or teak) flush at y = 0.0.
 * 3. A draped, folded & gold-bordered woven textile runner resting naturally on the Vedi surface.
 */
function buildPhotorealisticSanctumNormalMode(
  exp: ExperienceSpec,
  textures: TextureBundle
): THREE.Group {
  // Deprecated cyclorama removed: Sanctum architecture is now 100% authentic 3D geometry
  return new THREE.Group();
}

export function buildExperienceScene(
  exp: ExperienceSpec,
  textures: TextureBundle,
  mode: ViewMode = 'normal'
): BuiltFocalScene {
  const focalGroup = new THREE.Group();
  const flames: FlameRig[] = [];
  const interactiveMeshes = new Map<string, InteractivePropEntry>();
  const bhogItemIds: string[] = [];

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, // Pure real photographic hammered antique brass texture!
    map: textures.brassMap,
    roughness: 0.24,
    roughnessMap: textures.brassRoughness,
    bumpMap: textures.brassRoughness,
    bumpScale: 0.0028,
    metalness: 0.88,
    clearcoat: 0.35,
    clearcoatRoughness: 0.15,
    reflectivity: 0.92,
    envMapIntensity: 1.35
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.woodMap,
    roughness: 0.56,
    metalness: 0.04
  });

  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.marbleMap,
    roughness: 0.34,
    metalness: 0.04
  });

  const sandstoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.sandstoneMap,
    roughness: 0.82,
    metalness: 0.02
  });

  // Grounded 3D Temple Sanctum Environment (Authentic Garbhagriha Architecture with NO flat 2D cyclorama!)
  focalGroup.add(
    buildSanctumEnvironment(textures, brassMat, woodMat, marbleMat, sandstoneMat, exp, flames)
  );

  const placedOfferingsGroup = new THREE.Group();
  focalGroup.add(placedOfferingsGroup);

  let shivaFluid: ShivaFluidRig | null = null;
  let singingBowlRipple: THREE.Mesh | null = null;
  let tasbihWheel: THREE.Group | null = null;
  let akshatSwastikReveal: THREE.Group | null = null;
  let chunariDrape: THREE.Mesh | null = null;
  const hasLingam = exp.id === 'shiva';

  if (exp.id === 'shiva') {
    const built = buildShivaAltar(textures, brassMat);
    focalGroup.add(built.group);
    shivaFluid = built.fluidRig;
  } else if (exp.id === 'buddha') {
    focalGroup.add(buildArchedSanctumShrine(exp, textures, brassMat, woodMat, marbleMat));
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.11, 28),
      new THREE.MeshBasicMaterial({ color: 0xfcd34d, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(0.46, 0.015, 0.42);
    focalGroup.add(ripple);
    singingBowlRipple = ripple;
  } else if (exp.id === 'sikh') {
    focalGroup.add(buildSikhPalkiFocal(textures, exp, marbleMat, brassMat, woodMat));
  } else if (exp.id === 'christian') {
    focalGroup.add(buildChristianCrossFocal(woodMat, brassMat));
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.042, 0.04, 18), brassMat);
    holder.position.set(-0.22, 0.02, 0.22);
    holder.castShadow = true;
    holder.receiveShadow = true;
    focalGroup.add(holder);
  } else if (exp.id === 'islamic') {
    focalGroup.add(buildIslamicZiyaratFocal(textures, marbleMat, brassMat));
  } else if (exp.id === 'mahavir') {
    const built = buildJainMahavirFocal(exp, textures, marbleMat, brassMat, woodMat);
    focalGroup.add(built.group);
    akshatSwastikReveal = built.swastikGroup;
  } else {
    focalGroup.add(buildArchedSanctumShrine(exp, textures, brassMat, woodMat, marbleMat));
    if (exp.id === 'krishna') {
      // Carved bamboo Bansuri flute resting gently on the Krishna altar
      const flute = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0085, 0.0095, 0.34, 14),
        new THREE.MeshStandardMaterial({ color: 0xc29b48, roughness: 0.44 })
      );
      flute.rotation.z = Math.PI / 2 - 0.02;
      flute.rotation.y = 0.24;
      flute.position.set(0.0, 0.016, 0.04);
      flute.castShadow = true;
      focalGroup.add(flute);
    }

    if (exp.id === 'durga') {
      const drapeGeo = new THREE.PlaneGeometry(0.46, 0.2, 24, 10);
      drapeGeo.rotateX(-Math.PI / 2);
      const dPos = drapeGeo.attributes.position;
      for (let i = 0; i < dPos.count; i++) {
        const dx = dPos.getX(i);
        dPos.setY(i, Math.abs(Math.sin(dx * 22)) * 0.007);
      }
      drapeGeo.computeVertexNormals();
      chunariDrape = new THREE.Mesh(
        drapeGeo,
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          map: textures.brocadeMap,
          roughness: 0.68,
          sheen: 0.4,
          sheenColor: new THREE.Color(0xfca5a5),
          side: THREE.DoubleSide
        })
      );
      chunariDrape.position.set(0, 0.012, 0.1);
      chunariDrape.castShadow = true;
      chunariDrape.visible = false;
      focalGroup.add(chunariDrape);
    }
  }

  const targetHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.105, 0.14, 32),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  targetHalo.rotation.x = -Math.PI / 2;
  targetHalo.visible = false;
  focalGroup.add(targetHalo);

  exp.steps.forEach((step) => {
    const { root, spoutTip, liquidSurface, extraRef, radius, height } = buildInteractiveProp(
      textures,
      exp.id,
      step,
      brassMat,
      woodMat,
      flames
    );
    if (extraRef && step.id === 'tasbih-beads') {
      tasbihWheel = extraRef;
    }

    const isHolderCandle = step.id === 'prayer-candle-light';
    const restX = step.trayPosition[0];
    const restZ = isHolderCandle
      ? step.trayPosition[2]
      : Math.min(0.48, step.trayPosition[2] - 0.08);
    const onRunner = Math.abs(restX) <= 0.74 && restZ >= 0.14 && restZ <= 0.68;
    const restY = isHolderCandle ? 0.038 : onRunner ? 0.009 : 0.002;

    root.position.set(restX, restY, restZ);
    if (!isHolderCandle) {
      root.add(makeContactShadow(textures.contactShadowMap, Math.max(0.055, radius * 1.15)));
    }

    const hitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(0.06, radius * 1.25), Math.max(0.06, radius * 1.25), Math.max(0.12, height + 0.06), 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitProxy.position.y = Math.max(0.05, height * 0.5);
    hitProxy.userData.stepId = step.id;
    hitProxy.layers.set(1);
    root.add(hitProxy);

    focalGroup.add(root);
    interactiveMeshes.set(step.id, {
      root,
      hitProxy,
      spoutTip,
      liquidSurface,
      spec: step,
      radius,
      height
    });
  });

  // Helper to attach individually pickable food offerings inside a serving plate
  const attachPickablePlateItems = (
    plateId: string,
    items: Array<{
      id: string;
      kind: 'pom' | 'banana' | 'peda' | 'makhan-scoop' | 'mishri' | 'coconut';
      labelHi: string;
      labelEn: string;
      offset: [number, number, number];
      accentHex: string;
    }>
  ) => {
    const plate = interactiveMeshes.get(plateId);
    if (!plate) return;
    items.forEach((fs) => {
      const foodRoot = buildSingleFoodMesh(textures, fs.kind);
      foodRoot.position.set(
        plate.root.position.x + fs.offset[0],
        plate.root.position.y + fs.offset[1],
        plate.root.position.z + fs.offset[2]
      );
      foodRoot.add(makeContactShadow(textures.contactShadowMap, 0.032));

      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.position.y = 0.022;
      hitProxy.userData.stepId = fs.id;
      hitProxy.layers.set(1);
      foodRoot.add(hitProxy);

      focalGroup.add(foodRoot);
      bhogItemIds.push(fs.id);

      const syntheticSpec: RitualObjectSpec = {
        id: fs.id,
        stepIndex: plate.spec.stepIndex,
        kind: 'place-item',
        gripStyle: 'pinch',
        label: { hi: fs.labelHi, en: fs.labelEn },
        instructionHold: {
          hi: `${fs.labelHi} हाथ में है — थाली में सजाएं या वेदी पर रखें`,
          en: `Holding ${fs.labelEn} — arrange in the tray or place near altar`
        },
        instructionAction: {
          hi: `${fs.labelHi} को वेदी पर अर्पित करें`,
          en: `Place ${fs.labelEn} gently onto the offering tray`
        },
        completedText: { hi: `${fs.labelHi} रखा गया`, en: `${fs.labelEn} placed` },
        trayPosition: [
          plate.root.position.x + fs.offset[0],
          plate.root.position.y + fs.offset[1],
          plate.root.position.z + fs.offset[2]
        ],
        targetPosition: [
          plate.spec.targetPosition[0] + fs.offset[0],
          plate.spec.targetPosition[1],
          plate.spec.targetPosition[2] + fs.offset[2]
        ],
        accentHex: fs.accentHex
      };

      interactiveMeshes.set(fs.id, {
        root: foodRoot,
        hitProxy,
        spec: syntheticSpec,
        radius: 0.028,
        height: 0.048,
        isBhogItem: true,
        seatedInPlate: true,
        localOffsetInPlate: new THREE.Vector3(fs.offset[0], fs.offset[1], fs.offset[2])
      });
    });
  };

  if (exp.id === 'shiva') {
    attachPickablePlateItems('bhog-shiva', [
      { id: 'bhog-item-coconut', kind: 'coconut', labelHi: 'श्रीफल नारियल', labelEn: 'Sacred Coconut', offset: [-0.026, 0.008, -0.010], accentHex: '#f8fafc' },
      { id: 'bhog-item-banana', kind: 'banana', labelHi: 'पका केला', labelEn: 'Ripe Banana', offset: [0.022, 0.008, 0.012], accentHex: '#eab308' },
      { id: 'bhog-item-banana2', kind: 'banana', labelHi: 'कदली फल', labelEn: 'Yellow Banana', offset: [0.018, 0.018, -0.014], accentHex: '#facc15' },
      { id: 'bhog-item-peda', kind: 'peda', labelHi: 'केसर पेड़ा', labelEn: 'Saffron Peda', offset: [-0.004, 0.008, 0.026], accentHex: '#f59e0b' }
    ]);
  } else if (exp.id === 'krishna') {
    attachPickablePlateItems('makhan-bowl', [
      { id: 'krishna-item-makhan', kind: 'makhan-scoop', labelHi: 'ताजा माखन', labelEn: 'Fresh Makhan', offset: [-0.022, 0.014, 0.014], accentHex: '#faf4e8' },
      { id: 'krishna-item-mishri', kind: 'mishri', labelHi: 'मिश्री दाना', labelEn: 'Mishri Crystals', offset: [0.022, 0.014, 0.012], accentHex: '#e2e8f0' },
      { id: 'krishna-item-peda', kind: 'peda', labelHi: 'मथुरा पेड़ा', labelEn: 'Mathura Peda', offset: [0.0, 0.014, -0.026], accentHex: '#f59e0b' }
    ]);
  }

  const spawnOfferedFlower = (stepId: string, x: number, y: number, z: number) => {
    const color =
      stepId.includes('lotus')
        ? 0xf472b6
        : stepId.includes('lilies') || stepId.includes('krishna')
        ? 0xf8fafc
        : stepId.includes('gulab') || stepId.includes('hibiscus')
        ? 0xe11d48
        : placedOfferingsGroup.children.length % 2 === 0
        ? 0xf59e0b
        : 0xea580c;
    const isLotus = stepId.includes('lotus') || stepId.includes('lilies');
    const blossom = buildFlowerCluster(textures, color, isLotus);
    blossom.position.set(x, y, z);
    blossom.rotation.y = placedOfferingsGroup.children.length * 1.15;
    blossom.scale.setScalar(0.92 + (placedOfferingsGroup.children.length % 3) * 0.08);
    blossom.add(makeContactShadow(textures.contactShadowMap, 0.048));
    placedOfferingsGroup.add(blossom);
  };

  const spawnOfferedLeaf = (_stepId: string, x: number, y: number, z: number) => {
    const leaf = buildBilvaLeafCluster(textures);
    leaf.position.set(x, y, z);
    leaf.rotation.y = placedOfferingsGroup.children.length * 1.35;
    leaf.scale.setScalar(0.9 + (placedOfferingsGroup.children.length % 3) * 0.06);
    placedOfferingsGroup.add(leaf);
  };

  const clearPlacedOfferings = () => {
    while (placedOfferingsGroup.children.length > 0) {
      const child = placedOfferingsGroup.children[0];
      placedOfferingsGroup.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat?.dispose());
        }
      });
    }
  };

  const dispose = () => {
    focalGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => mat?.dispose());
      }
    });
  };

  return {
    focalGroup,
    placedOfferingsGroup,
    shivaFluid,
    flames,
    interactiveMeshes,
    bhogItemIds,
    hasLingam,
    singingBowlRipple,
    tasbihWheel,
    akshatSwastikReveal,
    chunariDrape,
    targetHalo,
    spawnOfferedFlower,
    spawnOfferedLeaf,
    clearPlacedOfferings,
    dispose
  };
}
