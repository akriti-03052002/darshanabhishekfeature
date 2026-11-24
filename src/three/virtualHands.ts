import * as THREE from 'three';
import {
  computeHandGripPose,
  GripStyle,
  HandGestureState,
  HandGripPose,
  solveArmElbowPosition
} from '../logic/ritualEngine';
import { MappedCameraHand } from '../logic/collisionPhysics';

interface FingerChain {
  proximal: THREE.Bone;
  middle: THREE.Bone;
  distal: THREE.Bone;
}

export interface ArticulatedHand {
  root: THREE.Group;
  skinnedMesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  wristBone: THREE.Bone;
  forearmBone: THREE.Bone;
  cuffMesh: THREE.Mesh;
  upperArmGroup: THREE.Group;
  thumb: FingerChain;
  fingers: FingerChain[];
  applyPose: (pose: HandGripPose, dt: number) => void;
}

export interface VirtualHandsRig {
  group: THREE.Group;
  rightHand: ArticulatedHand;
  leftHand: ArticulatedHand;
  setTarget: (
    activeSide: 'right' | 'both' | 'idle',
    worldPos: THREE.Vector3,
    tiltRad: number,
    gripAmount: number,
    gripStyle: GripStyle,
    gesture: HandGestureState,
    dt: number,
    elapsed: number,
    liveCameraRight?: MappedCameraHand | null,
    liveCameraLeft?: MappedCameraHand | null,
    hideSyntheticForCamera?: boolean,
    allowReticleWithoutCamera?: boolean
  ) => void;
  dispose: () => void;
}

interface FingerBuildSpec {
  name: string;
  basePos: [number, number, number];
  rotY: number;
  rotZ: number;
  segLengths: [number, number, number];
  baseRadius: number;
  tipRadius: number;
}

function appendLoftedLimb(
  positions: number[],
  normals: number[],
  uvs: number[],
  skinIndices: number[],
  skinWeights: number[],
  indices: number[],
  handedness: 1 | -1,
  radialSegs: number,
  slices: number,
  evalRing: (t: number, theta: number) => {
    px: number;
    py: number;
    pz: number;
    u: number;
    v: number;
    b0: number;
    b1: number;
    w0: number;
    w1: number;
  }
) {
  const startVert = positions.length / 3;

  for (let s = 0; s < slices; s++) {
    const t = s / (slices - 1);
    for (let r = 0; r < radialSegs; r++) {
      const theta = (r / radialSegs) * Math.PI * 2;
      const sample = evalRing(t, theta);
      positions.push(sample.px, sample.py, sample.pz);
      normals.push(0, 1, 0);
      uvs.push(sample.u, sample.v);
      skinIndices.push(sample.b0, sample.b1, 0, 0);
      skinWeights.push(sample.w0, sample.w1, 0, 0);
    }
  }

  for (let s = 0; s < slices - 1; s++) {
    for (let r = 0; r < radialSegs; r++) {
      const nextR = (r + 1) % radialSegs;
      const a = startVert + s * radialSegs + r;
      const b = startVert + s * radialSegs + nextR;
      const c = startVert + (s + 1) * radialSegs + nextR;
      const d = startVert + (s + 1) * radialSegs + r;
      if (handedness === 1) {
        indices.push(a, b, d, b, c, d);
      } else {
        indices.push(a, d, b, b, d, c);
      }
    }
  }
}

function appendEndCap(
  positions: number[],
  normals: number[],
  uvs: number[],
  skinIndices: number[],
  skinWeights: number[],
  indices: number[],
  handedness: 1 | -1,
  radialSegs: number,
  ringStartVert: number,
  centerPos: [number, number, number],
  boneIdx: number,
  flipWinding: boolean
) {
  const centerIdx = positions.length / 3;
  positions.push(centerPos[0], centerPos[1], centerPos[2]);
  normals.push(0, 0, flipWinding ? 1 : -1);
  uvs.push(0.5, 0.5);
  skinIndices.push(boneIdx, 0, 0, 0);
  skinWeights.push(1, 0, 0, 0);

  for (let r = 0; r < radialSegs; r++) {
    const nextR = (r + 1) % radialSegs;
    const v1 = ringStartVert + r;
    const v2 = ringStartVert + nextR;
    const invert = (handedness === -1) !== flipWinding;
    if (!invert) {
      indices.push(centerIdx, v1, v2);
    } else {
      indices.push(centerIdx, v2, v1);
    }
  }
}

function buildSculptedSkinnedHand(
  handedness: 1 | -1,
  skinMat: THREE.Material,
  nailMat: THREE.Material,
  sleeveMat: THREE.Material,
  hasSacredThread: boolean
): ArticulatedHand {
  const root = new THREE.Group();

  // Bone indices:
  // 0: wristBone
  // 1: forearmBone
  // 2..4: thumb (prox, mid, dist)
  // 5..7: index
  // 8..10: middle
  // 11..13: ring
  // 14..16: pinky
  const bones: THREE.Bone[] = [];

  const wristBone = new THREE.Bone();
  wristBone.position.set(0, 0, 0);
  bones.push(wristBone); // 0

  const forearmBone = new THREE.Bone();
  forearmBone.position.set(0, 0, 0);
  wristBone.add(forearmBone);
  bones.push(forearmBone); // 1

  const fingerSpecs: FingerBuildSpec[] = [
    {
      name: 'thumb',
      basePos: [-0.031 * handedness, -0.008, -0.018],
      rotY: 0.52 * handedness,
      rotZ: -0.44 * handedness,
      segLengths: [0.028, 0.023, 0.02],
      baseRadius: 0.0102,
      tipRadius: 0.0074
    },
    {
      name: 'index',
      basePos: [-0.025 * handedness, 0.002, -0.088],
      rotY: 0.04 * handedness,
      rotZ: 0,
      segLengths: [0.035, 0.025, 0.02],
      baseRadius: 0.0086,
      tipRadius: 0.0063
    },
    {
      name: 'middle',
      basePos: [-0.007 * handedness, 0.003, -0.092],
      rotY: 0,
      rotZ: 0,
      segLengths: [0.039, 0.027, 0.021],
      baseRadius: 0.0088,
      tipRadius: 0.0065
    },
    {
      name: 'ring',
      basePos: [0.011 * handedness, 0.001, -0.088],
      rotY: -0.03 * handedness,
      rotZ: 0,
      segLengths: [0.035, 0.025, 0.019],
      baseRadius: 0.0082,
      tipRadius: 0.006
    },
    {
      name: 'pinky',
      basePos: [0.027 * handedness, -0.002, -0.08],
      rotY: -0.08 * handedness,
      rotZ: 0,
      segLengths: [0.027, 0.019, 0.016],
      baseRadius: 0.0071,
      tipRadius: 0.0052
    }
  ];

  const fingerChains: FingerChain[] = fingerSpecs.map((spec) => {
    const prox = new THREE.Bone();
    prox.position.set(spec.basePos[0], spec.basePos[1], spec.basePos[2]);
    prox.rotation.y = spec.rotY;
    prox.rotation.z = spec.rotZ;
    wristBone.add(prox);
    bones.push(prox);

    const mid = new THREE.Bone();
    mid.position.set(0, 0, -spec.segLengths[0]);
    prox.add(mid);
    bones.push(mid);

    const dist = new THREE.Bone();
    dist.position.set(0, 0, -spec.segLengths[1]);
    mid.add(dist);
    bones.push(dist);

    return { proximal: prox, middle: mid, distal: dist };
  });

  // Update world matrices in bind pose so geometry vertices & bone bind pose match identically
  wristBone.updateMatrixWorld(true);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const indices: number[] = [];

  // 1. Continuous anatomical Forearm -> Wrist -> Palm lofted surface
  const PALM_RADIAL = 24;
  const PALM_SLICES = 22;
  const zMin = -0.092; // MCP knuckle ridge
  const zMax = 0.36;   // Forearm junction with cotton sleeve

  const palmVertStart = positions.length / 3;
  appendLoftedLimb(
    positions,
    normals,
    uvs,
    skinIndices,
    skinWeights,
    indices,
    handedness,
    PALM_RADIAL,
    PALM_SLICES,
    (t, theta) => {
      // Nonlinear slice spacing: denser around wrist/palm/knuckles, smoother along forearm
      const uT = t < 0.65 ? (t / 0.65) * 0.65 : 0.65 + ((t - 0.65) / 0.35) * 0.35;
      const z = zMax - uT * (zMax - zMin); // +0.36 down to -0.092

      let rx = 0.026;
      let ry = 0.019;
      let shiftX = 0;
      let shiftY = 0;

      if (z > 0.02) {
        // Forearm taper: fuller near elbow (z=0.36 -> rx=0.041, ry=0.036), sleek wrist (z=0.02 -> rx=0.026, ry=0.017)
        const ft = (z - 0.02) / (zMax - 0.02);
        const swell = Math.sin(ft * Math.PI * 0.72);
        rx = 0.0255 + swell * 0.0165;
        ry = 0.0175 + swell * 0.0155;
      } else {
        // Anatomical palm expansion from wrist (z=0.02) to knuckles (z=-0.092)
        const pt = Math.min(1, Math.max(0, (0.02 - z) / 0.112));
        rx = 0.0255 + Math.sin(pt * Math.PI * 0.62) * 0.0145;
        ry = 0.0175 - pt * 0.0042;
        // Slight palmar concave hollow on underside (-Y) & dorsal arch (+Y)
        const isDorsal = Math.sin(theta) > 0;
        if (!isDorsal) {
          ry *= 0.88 - Math.sin(pt * Math.PI) * 0.14;
        }
        // Subtle thenar muscle fullness on thumb side (-X * handedness)
        const thumbSide = Math.cos(theta) * handedness < -0.25;
        if (thumbSide && pt > 0.12 && pt < 0.72) {
          const thenarFactor = Math.sin(((pt - 0.12) / 0.6) * Math.PI);
          rx += thenarFactor * 0.0055;
          shiftY -= thenarFactor * 0.003;
          shiftX -= handedness * thenarFactor * 0.0025;
        }
        // 4 subtle dorsal knuckle mounds near MCP ridge (pt > 0.78)
        if (isDorsal && pt > 0.75) {
          const kWave = Math.pow(Math.abs(Math.sin(Math.cos(theta) * Math.PI * 2.1)), 2);
          ry += kWave * 0.0028 * ((pt - 0.75) / 0.25);
        }
      }

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = (cosT * rx) * handedness + shiftX;
      const py = sinT * ry + shiftY;
      const pz = z;

      // Smooth skin weight blend across wrist (z in [-0.01, +0.05])
      const wForearm = z <= 0.0 ? 0 : z >= 0.055 ? 1 : z / 0.055;
      const smoothW1 = wForearm * wForearm * (3 - 2 * wForearm);

      return {
        px,
        py,
        pz,
        u: theta / (Math.PI * 2),
        v: (zMax - z) / (zMax - zMin),
        b0: 0, // wristBone
        b1: 1, // forearmBone
        w0: 1 - smoothW1,
        w1: smoothW1
      };
    }
  );

  // Cap closed distal knuckle edge cleanly inside finger bases
  const lastPalmRing = palmVertStart + (PALM_SLICES - 1) * PALM_RADIAL;
  appendEndCap(
    positions,
    normals,
    uvs,
    skinIndices,
    skinWeights,
    indices,
    handedness,
    PALM_RADIAL,
    lastPalmRing,
    [0, 0, zMin - 0.004],
    0,
    false
  );

  // 2. Five seamless sculpted multi-phalanx fingers in exact bone world space
  const FINGER_RADIAL = 14;
  const FINGER_SLICES = 18;
  const _localVec = new THREE.Vector3();

  fingerSpecs.forEach((spec, fIdx) => {
    const baseBoneIndex = 2 + fIdx * 3; // prox, mid, dist
    const chain = fingerChains[fIdx];
    const [l0, l1, l2] = spec.segLengths;
    const totalLen = l0 + l1 + l2;
    const overlapBack = 0.01; // nest cleanly inside MCP ridge with zero seam

    // Build basis transform from finger proximal bone into hand root space
    const fingerMat = chain.proximal.matrixWorld;

    const ringVertStart = positions.length / 3;
    appendLoftedLimb(
      positions,
      normals,
      uvs,
      skinIndices,
      skinWeights,
      indices,
      handedness,
      FINGER_RADIAL,
      FINGER_SLICES,
      (t, theta) => {
        const distAlong = -overlapBack + t * (totalLen + overlapBack);
        const normAlong = Math.max(0, Math.min(1, distAlong / totalLen));

        // Organic phalanx silhouette: subtle joint swells at PIP (l0) and DIP (l0+l1), tapered fingertip
        let r = spec.baseRadius + (spec.tipRadius - spec.baseRadius) * normAlong;
        const pipDelta = Math.abs(distAlong - l0) / 0.012;
        const dipDelta = Math.abs(distAlong - (l0 + l1)) / 0.01;
        if (pipDelta < 1) r *= 1 + (1 - pipDelta * pipDelta) * 0.09;
        if (dipDelta < 1) r *= 1 + (1 - dipDelta * dipDelta) * 0.06;

        // Rounded anatomical fingertip dome on final 12%
        if (normAlong > 0.88) {
          const tipT = (normAlong - 0.88) / 0.12;
          r *= Math.sqrt(Math.max(0.06, 1 - tipT * tipT * 0.86));
        }

        // Slightly flatter palmar/dorsal oval cross-section
        const lx = Math.cos(theta) * r * handedness;
        const ly = Math.sin(theta) * r * 0.88;
        const lz = -distAlong;

        _localVec.set(lx, ly, lz).applyMatrix4(fingerMat);

        // Smooth bone skin weights across [wrist/prox -> prox/mid -> mid/dist]
        let b0 = baseBoneIndex;
        let b1 = baseBoneIndex;
        let w0 = 1;
        let w1 = 0;
        const blendSpan = 0.008;

        if (distAlong < 0.004) {
          const alpha = Math.max(0, Math.min(1, (distAlong + overlapBack) / (overlapBack + 0.004)));
          b0 = 0; // wrist/palm
          b1 = baseBoneIndex; // prox
          w1 = alpha * alpha * (3 - 2 * alpha);
          w0 = 1 - w1;
        } else if (distAlong < l0 + blendSpan) {
          const alpha = Math.max(0, Math.min(1, (distAlong - (l0 - blendSpan)) / (2 * blendSpan)));
          b0 = baseBoneIndex;
          b1 = baseBoneIndex + 1;
          w1 = alpha * alpha * (3 - 2 * alpha);
          w0 = 1 - w1;
        } else if (distAlong < l0 + l1 + blendSpan) {
          const alpha = Math.max(
            0,
            Math.min(1, (distAlong - (l0 + l1 - blendSpan)) / (2 * blendSpan))
          );
          b0 = baseBoneIndex + 1;
          b1 = baseBoneIndex + 2;
          w1 = alpha * alpha * (3 - 2 * alpha);
          w0 = 1 - w1;
        } else {
          b0 = baseBoneIndex + 2;
          b1 = baseBoneIndex + 2;
          w0 = 1;
          w1 = 0;
        }

        return {
          px: _localVec.x,
          py: _localVec.y,
          pz: _localVec.z,
          u: theta / (Math.PI * 2),
          v: normAlong,
          b0,
          b1,
          w0,
          w1
        };
      }
    );

    // Closed fingertip apex
    const lastTipRing = ringVertStart + (FINGER_SLICES - 1) * FINGER_RADIAL;
    _localVec.set(0, 0, -(totalLen + 0.002)).applyMatrix4(fingerMat);
    appendEndCap(
      positions,
      normals,
      uvs,
      skinIndices,
      skinWeights,
      indices,
      handedness,
      FINGER_RADIAL,
      lastTipRing,
      [_localVec.x, _localVec.y, _localVec.z],
      baseBoneIndex + 2,
      false
    );

    // Attach contoured keratin fingernail directly onto the distal bone
    const nailGeo = new THREE.SphereGeometry(spec.tipRadius * 0.74, 12, 10);
    nailGeo.scale(0.92, 0.24, 1.38);
    const nail = new THREE.Mesh(nailGeo, nailMat);
    nail.position.set(0, spec.tipRadius * 0.66, -l2 * 0.56);
    chain.distal.add(nail);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const skinnedMesh = new THREE.SkinnedMesh(geo, skinMat);
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;

  skinnedMesh.add(wristBone);
  const skeleton = new THREE.Skeleton(bones);
  skinnedMesh.bind(skeleton);
  root.add(skinnedMesh);

  // Sacred Kalava thread wrapped flush around the wrist bone
  if (hasSacredThread && handedness === 1) {
    const threadMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.78,
      metalness: 0.04
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.36,
      metalness: 0.5
    });
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.0258, 0.0024, 8, 28), threadMat);
    r1.scale.set(1.02, 0.72, 1.0);
    r1.position.set(0, 0, 0.022);
    wristBone.add(r1);

    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0018, 8, 28), goldMat);
    r2.scale.set(1.02, 0.72, 1.0);
    r2.position.set(0, 0, 0.027);
    wristBone.add(r2);
  }

  // Tailored cotton kurta sleeve cuff & upper arm spanning seamlessly from forearm to elbow & shoulder
  const upperArmGroup = new THREE.Group();
  const cuffGeo = new THREE.CylinderGeometry(0.037, 0.043, 1.0, 20);
  cuffGeo.rotateX(Math.PI / 2);
  cuffGeo.translate(0, 0, 0.5);
  const cuffMesh = new THREE.Mesh(cuffGeo, sleeveMat);
  cuffMesh.position.set(0, 0, 0.28);
  cuffMesh.scale.set(1, 1, 0.22);
  cuffMesh.castShadow = true;
  forearmBone.add(cuffMesh);

  const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), sleeveMat);
  elbowJoint.castShadow = true;
  upperArmGroup.add(elbowJoint);

  const upperSleeveGeo = new THREE.CylinderGeometry(0.043, 0.054, 0.95, 20);
  upperSleeveGeo.rotateX(Math.PI / 2);
  upperSleeveGeo.translate(0, 0, 0.475);
  const upperSleeve = new THREE.Mesh(upperSleeveGeo, sleeveMat);
  upperSleeve.castShadow = true;
  upperArmGroup.add(upperSleeve);

  const thumb = fingerChains[0];
  const fingers = fingerChains.slice(1);

  let curPose: HandGripPose = computeHandGripPose(0, 'kalash', 'idle');

  const applyPose = (target: HandGripPose, dt: number) => {
    const lambda = 16;
    curPose = {
      thumbCurl: THREE.MathUtils.damp(curPose.thumbCurl, target.thumbCurl, lambda, dt),
      indexCurl: THREE.MathUtils.damp(curPose.indexCurl, target.indexCurl, lambda, dt),
      middleCurl: THREE.MathUtils.damp(curPose.middleCurl, target.middleCurl, lambda, dt),
      ringCurl: THREE.MathUtils.damp(curPose.ringCurl, target.ringCurl, lambda, dt),
      pinkyCurl: THREE.MathUtils.damp(curPose.pinkyCurl, target.pinkyCurl, lambda, dt),
      spread: THREE.MathUtils.damp(curPose.spread, target.spread, lambda, dt)
    };

    // Remember: negative rotation.x bends forward -Z fingers DOWNWARD (-Y, palmar curl)!
    const curls = [curPose.indexCurl, curPose.middleCurl, curPose.ringCurl, curPose.pinkyCurl];
    fingers.forEach((f, i) => {
      const c = curls[i];
      f.proximal.rotation.x = -c * 0.72;
      f.middle.rotation.x = -c * 0.92;
      f.distal.rotation.x = -c * 0.56;
      const spreadFactor = (i - 1.5) * curPose.spread * handedness;
      f.proximal.rotation.y = -spreadFactor;
    });

    thumb.proximal.rotation.x = -curPose.thumbCurl * 0.55;
    thumb.middle.rotation.x = -curPose.thumbCurl * 0.78;
    thumb.distal.rotation.x = -curPose.thumbCurl * 0.45;
    thumb.proximal.rotation.z = (-0.44 - curPose.thumbCurl * 0.24) * handedness;
  };

  return {
    root,
    skinnedMesh,
    skeleton,
    wristBone,
    forearmBone,
    cuffMesh,
    upperArmGroup,
    thumb,
    fingers,
    applyPose
  };
}

export function createVirtualHandsRig(
  skinTexture: THREE.Texture,
  skinBump: THREE.Texture,
  sleeveTexture: THREE.Texture,
  hasSacredThread: boolean
): VirtualHandsRig {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: skinTexture,
    bumpMap: skinBump,
    bumpScale: 0.0024,
    roughness: 0.54,
    metalness: 0.0,
    sheen: 0.16,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color(0xe6a88a),
    envMapIntensity: 0.48
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8c8ba,
    roughness: 0.25,
    metalness: 0.02,
    clearcoat: 0.75,
    clearcoatRoughness: 0.2
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0xf4eee4,
    map: sleeveTexture,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.25
  });

  const rightHand = buildSculptedSkinnedHand(1, skinMat, nailMat, sleeveMat, hasSacredThread);
  const leftHand = buildSculptedSkinnedHand(-1, skinMat, nailMat, sleeveMat, hasSacredThread);

  const rightRestPos = new THREE.Vector3(0.36, 0.125, 0.68);
  const leftRestPos = new THREE.Vector3(-0.36, 0.125, 0.68);

  rightHand.root.position.copy(rightRestPos);
  leftHand.root.position.copy(leftRestPos);
  rightHand.root.rotation.set(-0.1, -0.22, -0.24);
  leftHand.root.rotation.set(-0.1, 0.22, 0.24);

  // Subtle 3D palm anchor reticle shown ONLY when live webcam tracking drives hands directly
  const cameraAnchorGroup = new THREE.Group();
  const anchorRingMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const anchorRing = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.034, 24), anchorRingMat);
  anchorRing.rotation.x = -Math.PI / 2;
  const anchorCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.85 })
  );
  cameraAnchorGroup.add(anchorRing, anchorCore);
  cameraAnchorGroup.visible = false;

  group.add(
    rightHand.root,
    leftHand.root,
    rightHand.upperArmGroup,
    leftHand.upperArmGroup,
    cameraAnchorGroup
  );

  const _targetR = new THREE.Vector3();
  const _targetL = new THREE.Vector3();
  const _elbowVec = new THREE.Vector3();
  const _shoulderVec = new THREE.Vector3();
  const _wristWorld = new THREE.Vector3();
  const _localTarget = new THREE.Vector3();
  const _invRootMat = new THREE.Matrix4();
  const _dummyMat = new THREE.Matrix4();
  const _upAxis = new THREE.Vector3(0, 1, 0);
  const _originVec = new THREE.Vector3(0, 0, 0);
  const idlePose = computeHandGripPose(0.14, 'kalash', 'idle');

  const updateArmIK = (hand: ArticulatedHand, handedness: 1 | -1) => {
    const shoulder: [number, number, number] = [0.38 * handedness, 0.2, 1.38];
    hand.root.updateMatrixWorld(true);
    hand.wristBone.getWorldPosition(_wristWorld);

    const elbow = solveArmElbowPosition(
      shoulder,
      [_wristWorld.x, _wristWorld.y, _wristWorld.z],
      0.72,
      0.66,
      handedness
    );
    _elbowVec.set(elbow[0], elbow[1], elbow[2]);
    _shoulderVec.set(shoulder[0], shoulder[1], shoulder[2]);

    // Aim forearmBone (+Z direction) smoothly toward solved elbow without distorting palm
    _invRootMat.copy(hand.root.matrixWorld).invert();
    _localTarget.copy(_elbowVec).applyMatrix4(_invRootMat);
    // lookAt aligns -Z by default; flip target across origin so +Z points back toward elbow!
    _localTarget.negate();
    _dummyMat.lookAt(_originVec, _localTarget, _upAxis);
    hand.forearmBone.quaternion.setFromRotationMatrix(_dummyMat);

    // Stretch sleeve cuff seamlessly from bare skin (z = 0.28) directly into solved elbow joint
    const wristToElbow = _wristWorld.distanceTo(_elbowVec);
    hand.cuffMesh.scale.set(1, 1, Math.max(0.08, wristToElbow - 0.27));

    // Upper sleeve arm connects from elbow back to shoulder
    hand.upperArmGroup.position.copy(_elbowVec);
    _dummyMat.lookAt(_elbowVec, _shoulderVec, _upAxis);
    hand.upperArmGroup.quaternion.setFromRotationMatrix(_dummyMat);
    // Rotate Y 180 deg because lookAt aligns -Z while cylinder extends +Z
    hand.upperArmGroup.rotateY(Math.PI);
  };

  const applyCameraPose = (
    hand: ArticulatedHand,
    camHand: MappedCameraHand,
    handedness: 1 | -1,
    safeDt: number
  ) => {
    _targetR.set(camHand.worldPos.x, camHand.worldPos.y, camHand.worldPos.z);
    hand.root.position.lerp(_targetR, 1 - Math.exp(-20 * safeDt));
    hand.root.rotation.x = THREE.MathUtils.damp(hand.root.rotation.x, -0.06, 16, safeDt);
    hand.root.rotation.y = THREE.MathUtils.damp(hand.root.rotation.y, 0.14 * handedness, 16, safeDt);
    hand.root.rotation.z = THREE.MathUtils.damp(
      hand.root.rotation.z,
      (-0.34 - camHand.wristRollRad * 0.65) * handedness,
      16,
      safeDt
    );

    const camPose: HandGripPose = {
      thumbCurl: camHand.fingerCurls.thumb,
      indexCurl: camHand.fingerCurls.index,
      middleCurl: camHand.fingerCurls.middle,
      ringCurl: camHand.fingerCurls.ring,
      pinkyCurl: camHand.fingerCurls.pinky,
      spread: camHand.isOpenPalm ? 0.18 : 0.05
    };
    hand.applyPose(camPose, safeDt);
  };

  const setTarget = (
    activeSide: 'right' | 'both' | 'idle',
    worldPos: THREE.Vector3,
    tiltRad: number,
    gripAmount: number,
    gripStyle: GripStyle,
    gesture: HandGestureState,
    dt: number,
    elapsed: number,
    liveCameraRight?: MappedCameraHand | null,
    liveCameraLeft?: MappedCameraHand | null,
    hideSyntheticForCamera = false,
    allowReticleWithoutCamera = false
  ) => {
    const safeDt = Math.min(dt, 0.24);

    if (hideSyntheticForCamera) {
      rightHand.root.visible = false;
      leftHand.root.visible = false;
      rightHand.upperArmGroup.visible = false;
      leftHand.upperArmGroup.visible = false;

      const showReticle =
        Boolean(liveCameraRight?.detected) ||
        (allowReticleWithoutCamera && activeSide !== 'idle');

      cameraAnchorGroup.visible = showReticle;
      if (showReticle) {
        const ax =
          activeSide === 'idle' && liveCameraRight?.detected
            ? liveCameraRight.worldPos.x
            : worldPos.x;
        const ay =
          activeSide === 'idle' && liveCameraRight?.detected
            ? liveCameraRight.worldPos.y
            : worldPos.y;
        const az =
          activeSide === 'idle' && liveCameraRight?.detected
            ? liveCameraRight.worldPos.z
            : worldPos.z;
        _targetR.set(ax, ay, az);
        cameraAnchorGroup.position.lerp(_targetR, 1 - Math.exp(-22 * safeDt));
        const activeColor =
          liveCameraRight?.isPinching || activeSide !== 'idle' ? 0x10b981 : 0xf59e0b;
        anchorRing.scale.setScalar(
          liveCameraRight?.isPinching || activeSide !== 'idle' ? 0.68 : 0.96
        );
        anchorRingMat.color.setHex(activeColor);
        anchorRingMat.opacity = activeSide === 'idle' && !liveCameraRight?.detected ? 0.35 : 0.65;
      }
      return;
    }

    rightHand.root.visible = true;
    leftHand.root.visible = true;
    rightHand.upperArmGroup.visible = true;
    leftHand.upperArmGroup.visible = true;
    cameraAnchorGroup.visible = false;

    if (liveCameraRight?.detected && activeSide === 'idle') {
      applyCameraPose(rightHand, liveCameraRight, 1, safeDt);
      if (liveCameraLeft?.detected) {
        applyCameraPose(leftHand, liveCameraLeft, -1, safeDt);
      } else {
        const breathe = Math.sin(elapsed * 1.8) * 0.008;
        _targetL.set(leftRestPos.x, leftRestPos.y + breathe, leftRestPos.z);
        leftHand.root.position.lerp(_targetL, 1 - Math.exp(-8 * safeDt));
        leftHand.applyPose(idlePose, safeDt);
      }
      updateArmIK(rightHand, 1);
      updateArmIK(leftHand, -1);
      return;
    }

    const activePose = computeHandGripPose(gripAmount, gripStyle, gesture);

    if (activeSide === 'idle') {
      const breathe = Math.sin(elapsed * 1.8) * 0.008;
      _targetR.set(rightRestPos.x, rightRestPos.y + breathe, rightRestPos.z);
      _targetL.set(leftRestPos.x, leftRestPos.y + breathe * 0.85, leftRestPos.z);

      rightHand.root.position.lerp(_targetR, 1 - Math.exp(-8 * safeDt));
      leftHand.root.position.lerp(_targetL, 1 - Math.exp(-8 * safeDt));

      rightHand.root.rotation.x = THREE.MathUtils.damp(rightHand.root.rotation.x, -0.1, 8, safeDt);
      rightHand.root.rotation.y = THREE.MathUtils.damp(rightHand.root.rotation.y, -0.24, 8, safeDt);
      rightHand.root.rotation.z = THREE.MathUtils.damp(rightHand.root.rotation.z, -0.26, 8, safeDt);

      leftHand.root.rotation.x = THREE.MathUtils.damp(leftHand.root.rotation.x, -0.1, 8, safeDt);
      leftHand.root.rotation.y = THREE.MathUtils.damp(leftHand.root.rotation.y, 0.24, 8, safeDt);
      leftHand.root.rotation.z = THREE.MathUtils.damp(leftHand.root.rotation.z, 0.26, 8, safeDt);

      rightHand.applyPose(gesture === 'reach' ? activePose : idlePose, safeDt);
      leftHand.applyPose(idlePose, safeDt);
      updateArmIK(rightHand, 1);
      updateArmIK(leftHand, -1);
      return;
    }

    // Precision grip offsets placing palm & fingers flush against vessel belly / rim (zero clipping)
    const offsetX =
      gesture === 'reach'
        ? 0.07
        : gripStyle === 'kalash'
        ? 0.056
        : gripStyle === 'cradle'
        ? 0.07
        : 0.036;
    const offsetY =
      gesture === 'reach'
        ? 0.08
        : gripStyle === 'kalash'
        ? 0.068
        : gripStyle === 'cradle'
        ? 0.018
        : 0.032;
    const offsetZ = gesture === 'reach' ? 0.12 : gripStyle === 'kalash' ? 0.052 : 0.085;

    _targetR.set(worldPos.x + offsetX, worldPos.y + offsetY, worldPos.z + offsetZ);
    rightHand.root.position.lerp(_targetR, 1 - Math.exp(-24 * safeDt));

    const targetRotZ =
      gesture === 'reach'
        ? -0.28
        : gripStyle === 'kalash'
        ? -1.32 + tiltRad * 0.34
        : gripStyle === 'handle'
        ? -1.16
        : -0.38;
    const targetRotX =
      gesture === 'reach'
        ? -0.06
        : gripStyle === 'cradle'
        ? 0.05
        : -0.08 + tiltRad * 0.12;
    const targetRotY = gripStyle === 'kalash' ? 0.3 : 0.14;

    rightHand.root.rotation.x = THREE.MathUtils.damp(rightHand.root.rotation.x, targetRotX, 14, safeDt);
    rightHand.root.rotation.y = THREE.MathUtils.damp(rightHand.root.rotation.y, targetRotY, 14, safeDt);
    rightHand.root.rotation.z = THREE.MathUtils.damp(rightHand.root.rotation.z, targetRotZ, 14, safeDt);

    rightHand.applyPose(activePose, safeDt);

    if (activeSide === 'both') {
      _targetL.set(worldPos.x - 0.088, worldPos.y + 0.015, worldPos.z + 0.075);
      leftHand.root.position.lerp(_targetL, 1 - Math.exp(-12 * safeDt));
      leftHand.root.rotation.x = THREE.MathUtils.damp(leftHand.root.rotation.x, 0.04, 10, safeDt);
      leftHand.root.rotation.y = THREE.MathUtils.damp(leftHand.root.rotation.y, -0.2, 10, safeDt);
      leftHand.root.rotation.z = THREE.MathUtils.damp(leftHand.root.rotation.z, 0.38, 10, safeDt);
      leftHand.applyPose(activePose, safeDt);
    } else if (liveCameraLeft?.detected) {
      applyCameraPose(leftHand, liveCameraLeft, -1, safeDt);
    } else {
      _targetL.set(leftRestPos.x + 0.03, leftRestPos.y + 0.01, leftRestPos.z - 0.03);
      leftHand.root.position.lerp(_targetL, 1 - Math.exp(-8 * safeDt));
      leftHand.root.rotation.x = THREE.MathUtils.damp(leftHand.root.rotation.x, -0.1, 8, safeDt);
      leftHand.root.rotation.y = THREE.MathUtils.damp(leftHand.root.rotation.y, 0.24, 8, safeDt);
      leftHand.root.rotation.z = THREE.MathUtils.damp(leftHand.root.rotation.z, 0.26, 8, safeDt);
      leftHand.applyPose(idlePose, safeDt);
    }

    updateArmIK(rightHand, 1);
    updateArmIK(leftHand, -1);
  };

  const dispose = () => {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).geometry.dispose();
      }
    });
    skinMat.dispose();
    nailMat.dispose();
    sleeveMat.dispose();
  };

  return { group, rightHand, leftHand, setTarget, dispose };
}
