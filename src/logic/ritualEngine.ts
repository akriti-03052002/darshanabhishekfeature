import * as THREE from 'three';

export interface HandGripPose {
  thumbCurl: number;
  indexCurl: number;
  middleCurl: number;
  ringCurl: number;
  pinkyCurl: number;
  spread: number;
}

export type GripStyle = 'kalash' | 'pinch' | 'cradle' | 'handle' | 'tasbih' | 'wick';
export type HandGestureState = 'idle' | 'reach' | 'grip' | 'pour' | 'wave' | 'release';

export interface FluidDynamicsParams {
  streamRadius: number;
  flowSpeed: number;
  coatingGainRate: number;
  coatingDecayRate: number;
  splashScale: number;
}

export interface DropBodyState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  settled: boolean;
}

export interface VesselOpeningSpec {
  rimRadius: number;
  localOpeningCenter?: THREE.Vector3;
  localOpeningNormal?: THREE.Vector3;
  rimHeight?: number;
  containerHeight?: number;
  fullCapacityLitres?: number;
  neckConstrictionRadius?: number;
}

export interface PhysicalPourResult {
  isPouring: boolean;
  flowRate: number; // 0..1
  emissionPoint: THREE.Vector3;
  emissionVelocity: THREE.Vector3;
  tiltAngleRad: number;
  lipImmersionDepth: number;
}

/**
 * Calculates physical fluid pour from a 3D vessel using real world orientation,
 * gravity vector (0, -1, 0), lowest point on the circular rim opening, and internal liquid level plane.
 */
export function calculatePhysicalVesselPour(
  spec: VesselOpeningSpec,
  vesselWorldPos: THREE.Vector3,
  vesselWorldQuat: THREE.Quaternion,
  liquidVolumeFraction: number,
  vesselLinearVelocity?: THREE.Vector3
): PhysicalPourResult {
  const gDown = new THREE.Vector3(0, -1, 0);
  const localOpeningNormal = spec.localOpeningNormal ? spec.localOpeningNormal.clone() : new THREE.Vector3(0, 1, 0);
  const localOpeningCenter = spec.localOpeningCenter ? spec.localOpeningCenter.clone() : new THREE.Vector3(0, spec.rimHeight ?? 0.148, 0);

  // 1. If empty, liquid never pours
  if (liquidVolumeFraction <= 0.001) {
    const defaultCenter = localOpeningCenter.clone().applyQuaternion(vesselWorldQuat).add(vesselWorldPos);
    return {
      isPouring: false,
      flowRate: 0,
      emissionPoint: defaultCenter,
      emissionVelocity: new THREE.Vector3(0, 0, 0),
      tiltAngleRad: 0,
      lipImmersionDepth: 0
    };
  }

  // 2. World opening normal
  const worldNormal = localOpeningNormal.applyQuaternion(vesselWorldQuat).normalize();

  // Angle between opening normal and world UP (0, 1, 0)
  const upDot = THREE.MathUtils.clamp(worldNormal.dot(new THREE.Vector3(0, 1, 0)), -1, 1);
  const tiltAngleRad = Math.acos(upDot);

  // If opening is pointing almost straight up, zero flow
  if (upDot >= 0.992) {
    const center = localOpeningCenter.clone().applyQuaternion(vesselWorldQuat).add(vesselWorldPos);
    return {
      isPouring: false,
      flowRate: 0,
      emissionPoint: center,
      emissionVelocity: new THREE.Vector3(0, 0, 0),
      tiltAngleRad,
      lipImmersionDepth: 0
    };
  }

  // 3. World opening center
  const worldOpeningCenter = localOpeningCenter.clone().applyQuaternion(vesselWorldQuat).add(vesselWorldPos);

  // 4. Project gravity down vector onto the circular rim opening plane
  // plane normal is worldNormal
  const gDotN = gDown.dot(worldNormal);
  const gProj = gDown.clone().sub(worldNormal.clone().multiplyScalar(gDotN));
  const projLen = gProj.length();

  let lipDir: THREE.Vector3;
  if (projLen > 1e-4) {
    lipDir = gProj.divideScalar(projLen);
  } else {
    // If opening faces straight down, pick negative local Z
    lipDir = new THREE.Vector3(0, 0, -1).applyQuaternion(vesselWorldQuat).normalize();
  }

  // 5. Lowest point on the rim circle in world space (the spill lip)
  const emissionPoint = worldOpeningCenter.clone().addScaledVector(lipDir, spec.rimRadius);

  // 6. Physical spill angle based on internal liquid volume and Kalash narrow-neck geometry
  // A traditional temple Kalash has a bulbous base and constricted neck, holding fluid
  // securely until tilted past ~18°-25° even when full, and past 45°-60° when half-empty.
  const emptyFrac = 1 - Math.min(0.98, liquidVolumeFraction);
  const neckConstrictionOffset = 0.032;
  const spillAngleRad = Math.max(
    0.28, // minimum ~16° tilt required before liquid reaches the flared rim lip
    Math.atan2(
      2 * spec.rimRadius * emptyFrac + neckConstrictionOffset,
      spec.containerHeight * 0.88
    )
  );

  if (tiltAngleRad <= spillAngleRad) {
    return {
      isPouring: false,
      flowRate: 0,
      emissionPoint,
      emissionVelocity: new THREE.Vector3(0, 0, 0),
      tiltAngleRad,
      lipImmersionDepth: 0
    };
  }

  // 7. Immersion depth and Torricelli flow rate
  const deltaTilt = tiltAngleRad - spillAngleRad;
  const effectiveHead = spec.containerHeight * 0.5 + spec.rimRadius;
  const lipImmersionDepth = Math.sin(deltaTilt) * effectiveHead;

  // Flow rate scales smoothly from 0 to 1 with immersion depth
  const normalizedImmersion = THREE.MathUtils.clamp(lipImmersionDepth / (spec.containerHeight * 0.35), 0, 1);
  const rawFlow = Math.sqrt(normalizedImmersion);
  const flowRate = THREE.MathUtils.clamp(
    rawFlow * Math.min(1.0, liquidVolumeFraction * 3.5),
    0,
    1
  );

  const isPouring = flowRate > 0.02;

  // 8. Physical emission velocity:
  // Liquid spills along the lip direction with downward gravitational momentum
  const exitDir = lipDir.clone().multiplyScalar(0.75).add(gDown.clone().multiplyScalar(0.65)).normalize();
  const spillSpeed = 0.85 + flowRate * 1.35;
  const emissionVelocity = exitDir.multiplyScalar(spillSpeed);

  if (vesselLinearVelocity) {
    emissionVelocity.addScaledVector(vesselLinearVelocity, 0.45);
  }

  return {
    isPouring,
    flowRate,
    emissionPoint,
    emissionVelocity,
    tiltAngleRad,
    lipImmersionDepth
  };
}

/**
 * Computes realistic continuous pour rate (0..1) based on vessel tilt angle (radians)
 * and horizontal/depth distance from the sacred target crown.
 */
export function computePourRate(
  tiltRadians: number,
  horizontalDistToTarget: number,
  targetRadius = 0.42
): number {
  const minTilt = 0.32; // ~18.3 deg before liquid reaches spout lip
  const maxTilt = 1.45; // ~83 deg full stream
  if (tiltRadians <= minTilt) return 0;

  const tiltFactor = Math.min(1, (tiltRadians - minTilt) / (maxTilt - minTilt));
  const smoothTilt = tiltFactor * tiltFactor * (3 - 2 * tiltFactor);

  if (horizontalDistToTarget > targetRadius * 1.45) {
    return smoothTilt * 0.35;
  }
  return smoothTilt;
}

/**
 * Differentiates physical fluid stream behavior between clear water (jal) and thicker milk (dugdha).
 */
export function computeFluidDynamics(isMilk: boolean, pourRate: number): FluidDynamicsParams {
  const clamped = Math.max(0, Math.min(1, pourRate));
  if (isMilk) {
    return {
      streamRadius: 0.016 * (0.55 + clamped * 0.65),
      flowSpeed: 0.72,
      coatingGainRate: 1.55,
      coatingDecayRate: 0.008, // rich creamy film clings long to the sacred stone
      splashScale: 1.15
    };
  }
  return {
    streamRadius: 0.0105 * (0.48 + clamped * 0.65),
    flowSpeed: 1.28,
    coatingGainRate: 1.35,
    coatingDecayRate: 0.012, // realistic surface wetness retention (remains glossy & dripping for over 60 seconds)
    splashScale: 0.92
  };
}

/**
 * Generates parabolic stream trajectory points in-place without allocating new vectors.
 */
export function computeStreamArcPoints(
  spoutX: number,
  spoutY: number,
  spoutZ: number,
  pourRate: number,
  targetY: number,
  pourDirX: number,
  pourDirZ: number,
  outCoords: Float32Array,
  segments = 12
): number {
  if (pourRate <= 0.01) return 0;
  const totalDrop = Math.max(0.06, spoutY - targetY);
  const forwardReach = 0.04 + pourRate * 0.14;
  const count = Math.min(segments, Math.floor(outCoords.length / 3));

  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const x = spoutX + pourDirX * forwardReach * t;
    const y = spoutY - totalDrop * (t * t * 0.85 + t * 0.15);
    const z = spoutZ + pourDirZ * forwardReach * t;
    outCoords[i * 3] = x;
    outCoords[i * 3 + 1] = y;
    outCoords[i * 3 + 2] = z;
  }
  return count;
}

/**
 * Solves a natural 2-bone analytical shoulder-elbow-wrist position for first-person arm IK
 * with slight outward/downward anatomical pole bias.
 */
export function solveArmElbowPosition(
  shoulder: [number, number, number],
  wrist: [number, number, number],
  upperLen: number,
  forearmLen: number,
  handedness: 1 | -1
): [number, number, number] {
  const dx = wrist[0] - shoulder[0];
  const dy = wrist[1] - shoulder[1];
  const dz = wrist[2] - shoulder[2];
  const rawDist = Math.hypot(dx, dy, dz);
  const minDist = Math.abs(upperLen - forearmLen) + 0.02;
  const maxDist = upperLen + forearmLen - 0.01;
  const d = Math.max(minDist, Math.min(maxDist, rawDist || minDist));

  const dirX = rawDist > 1e-5 ? dx / rawDist : 0;
  const dirY = rawDist > 1e-5 ? dy / rawDist : -0.5;
  const dirZ = rawDist > 1e-5 ? dz / rawDist : -0.8;

  const cosA = (upperLen * upperLen + d * d - forearmLen * forearmLen) / (2 * upperLen * d);
  const clampedCos = Math.max(-1, Math.min(1, cosA));
  const along = upperLen * clampedCos;
  const perp = upperLen * Math.sqrt(Math.max(0, 1 - clampedCos * clampedCos));

  // Pole direction: elbow hangs naturally downward and slightly outward
  let poleX = 0.45 * handedness;
  let poleY = -0.88;
  let poleZ = 0.14;
  const dot = poleX * dirX + poleY * dirY + poleZ * dirZ;
  poleX -= dot * dirX;
  poleY -= dot * dirY;
  poleZ -= dot * dirZ;
  const poleLen = Math.hypot(poleX, poleY, poleZ) || 1;

  return [
    shoulder[0] + dirX * along + (poleX / poleLen) * perp,
    shoulder[1] + dirY * along + (poleY / poleLen) * perp,
    shoulder[2] + dirZ * along + (poleZ / poleLen) * perp
  ];
}

/**
 * Steps rigid-body gravity & damped contact settling onto a target surface height.
 */
export function stepOfferingDrop(
  state: DropBodyState,
  targetX: number,
  floorY: number,
  targetZ: number,
  massKg: number,
  dt: number
): DropBodyState {
  if (state.settled) return state;
  const safeDt = Math.min(0.06, Math.max(0.001, dt));
  const gravity = -14.2 * (0.85 + Math.min(1.5, massKg) * 0.2);

  let vx = (targetX - state.x) * 12.5;
  let vz = (targetZ - state.z) * 12.5;
  let vy = state.vy + gravity * safeDt;

  let x = state.x + vx * safeDt;
  let y = state.y + vy * safeDt;
  let z = state.z + vz * safeDt;
  let settled = false;

  if (y <= floorY) {
    y = floorY;
    if (Math.abs(vy) < 0.35 && Math.hypot(targetX - x, targetZ - z) < 0.02) {
      x = targetX;
      z = targetZ;
      vx = 0;
      vy = 0;
      vz = 0;
      settled = true;
    } else {
      vy = -vy * (massKg > 0.6 ? 0.14 : 0.2);
    }
  }

  return { x, y, z, vx, vy, vz, settled };
}

/**
 * Computes accumulated Aarti / Chaur Sahib rhythmic progress (0..1) from user motion.
 */
export function advanceMotionProgress(
  currentProgress: number,
  motionDistance: number,
  requiredDistance = 3.2
): number {
  if (motionDistance <= 0) return Math.min(1, Math.max(0, currentProgress));
  return Math.min(1, Math.max(0, currentProgress + motionDistance / requiredDistance));
}

/**
 * Computes VR gaze-and-hold radial progress (0..1).
 */
export function advanceGazeHold(
  isGazingTarget: boolean,
  currentProgress: number,
  dt: number,
  dwellSeconds = 1.25
): { progress: number; triggered: boolean } {
  if (!isGazingTarget) {
    return {
      progress: Math.max(0, currentProgress - dt * 2.4),
      triggered: false
    };
  }
  const next = Math.min(1, currentProgress + dt / Math.max(0.2, dwellSeconds));
  return {
    progress: next,
    triggered: next >= 1
  };
}

/**
 * Computes anatomically plausible finger curl angles (in radians) for the virtual hand
 * based on grip amount (0 = relaxed open, 1 = full grip) and object type.
 */
export function computeHandGripPose(
  gripAmount: number,
  style: GripStyle,
  gesture: HandGestureState = 'grip'
): HandGripPose {
  if (gesture === 'idle') {
    return {
      thumbCurl: 0.22,
      indexCurl: 0.2,
      middleCurl: 0.28,
      ringCurl: 0.36,
      pinkyCurl: 0.44,
      spread: 0.07
    };
  }
  if (gesture === 'reach') {
    return {
      thumbCurl: 0.08,
      indexCurl: 0.1,
      middleCurl: 0.12,
      ringCurl: 0.16,
      pinkyCurl: 0.2,
      spread: 0.18
    };
  }
  if (gesture === 'release') {
    return {
      thumbCurl: 0.05,
      indexCurl: 0.06,
      middleCurl: 0.08,
      ringCurl: 0.1,
      pinkyCurl: 0.14,
      spread: 0.2
    };
  }

  const g = Math.min(1, Math.max(0, gripAmount));

  switch (style) {
    case 'kalash':
      return {
        thumbCurl: 0.25 + g * 0.58,
        indexCurl: 0.2 + g * 0.94,
        middleCurl: 0.22 + g * 0.98,
        ringCurl: 0.25 + g * 1.0,
        pinkyCurl: 0.28 + g * 0.92,
        spread: 0.16 - g * 0.08
      };
    case 'pinch':
      return {
        thumbCurl: 0.2 + g * 0.8,
        indexCurl: 0.18 + g * 0.9,
        middleCurl: 0.15 + g * 0.42,
        ringCurl: 0.22 + g * 0.35,
        pinkyCurl: 0.26 + g * 0.3,
        spread: 0.12 - g * 0.06
      };
    case 'cradle':
      return {
        thumbCurl: 0.12 + g * 0.28,
        indexCurl: 0.12 + g * 0.32,
        middleCurl: 0.14 + g * 0.34,
        ringCurl: 0.16 + g * 0.36,
        pinkyCurl: 0.18 + g * 0.38,
        spread: 0.14
      };
    case 'handle':
      return {
        thumbCurl: 0.28 + g * 0.68,
        indexCurl: 0.24 + g * 1.15,
        middleCurl: 0.24 + g * 1.18,
        ringCurl: 0.26 + g * 1.15,
        pinkyCurl: 0.28 + g * 1.08,
        spread: 0.1 - g * 0.06
      };
    case 'tasbih':
      return {
        thumbCurl: 0.24 + g * 0.65,
        indexCurl: 0.22 + g * 0.72,
        middleCurl: 0.3 + g * 0.55,
        ringCurl: 0.35 + g * 0.6,
        pinkyCurl: 0.4 + g * 0.65,
        spread: 0.09
      };
    case 'wick':
      return {
        thumbCurl: 0.2 + g * 0.55,
        indexCurl: 0.08 + g * 0.18,
        middleCurl: 0.35 + g * 0.65,
        ringCurl: 0.4 + g * 0.75,
        pinkyCurl: 0.45 + g * 0.8,
        spread: 0.08
      };
  }
}

/**
 * Converts Euler device orientation angles (alpha, beta, gamma in degrees)
 * into clean pitch/yaw offsets clamped for comfortable VR Box viewing.
 */
export function mapDeviceOrientationToLook(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  baselineAlphaDeg: number
): { yawRad: number; pitchRad: number } {
  let deltaAlpha = alphaDeg - baselineAlphaDeg;
  while (deltaAlpha > 180) deltaAlpha -= 360;
  while (deltaAlpha < -180) deltaAlpha += 360;

  const yawRad = (deltaAlpha * Math.PI) / 180;
  const rawPitch = ((betaDeg - 65) * Math.PI) / 180;
  const pitchRad = Math.max(-0.65, Math.min(0.65, rawPitch * 0.65 + gammaDeg * 0.002));
  return { yawRad, pitchRad };
}

export function formatRitualProgress(completedCount: number, totalCount: number): string {
  const safeTotal = Math.max(1, totalCount);
  const safeDone = Math.min(safeTotal, Math.max(0, completedCount));
  return `${safeDone} / ${safeTotal}`;
}
