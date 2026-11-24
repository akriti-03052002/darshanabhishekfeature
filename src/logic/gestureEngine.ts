import type { NormalizedLandmark } from './collisionPhysics';

export type RitualGestureId =
  | 'vessel-pour'
  | 'pinch-hold-flame'
  | 'circular-aarti'
  | 'sweep-chaur'
  | 'pinch-tasbih'
  | 'bowl-resonate'
  | 'still-reflection'
  | 'namaste-flowers'
  | 'cupped-bhog'
  | 'pinch-release-leaf';

export type GestureIconKey =
  | 'namaste'
  | 'cupped'
  | 'pour'
  | 'pinch-release'
  | 'pinch-flame'
  | 'aarti-circle'
  | 'chaur-sweep'
  | 'tasbih'
  | 'bowl'
  | 'reflection';

export type GesturePhase = 'IDLE' | 'DETECTED' | 'CONFIRMATION' | 'ACTION' | 'COMPLETED' | 'COOLDOWN';

export interface GestureDefinition {
  id: RitualGestureId;
  iconKey: GestureIconKey;
  name: { hi: string; en: string };
  requiredHands: 'single' | 'both';
  description?: string;
}

export const GESTURE_DEFINITIONS: Record<RitualGestureId, GestureDefinition> = {
  'namaste-flowers': {
    id: 'namaste-flowers',
    iconKey: 'namaste',
    name: { hi: 'नमस्ते मुद्रा', en: 'Namaste Gesture' },
    requiredHands: 'both',
    description: 'Join both palms in Namaste and dip forward to offer flowers'
  },
  'cupped-bhog': {
    id: 'cupped-bhog',
    iconKey: 'cupped',
    name: { hi: 'अंजलि मुद्रा', en: 'Cupped Hands (Anjali)' },
    requiredHands: 'both',
    description: 'Cup both hands together and lift upward/forward to offer Bhog'
  },
  'vessel-pour': {
    id: 'vessel-pour',
    iconKey: 'pour',
    name: { hi: 'कलश अभिषेक', en: 'Kalash Pour' },
    requiredHands: 'single',
    description: 'Grip vessel and tilt wrist forward to pour; upright stops stream'
  },
  'pinch-release-leaf': {
    id: 'pinch-release-leaf',
    iconKey: 'pinch-release',
    name: { hi: 'पत्र समर्पण', en: 'Leaf Offering' },
    requiredHands: 'single',
    description: 'Pinch leaf, move toward altar, and open hand to place'
  },
  'pinch-hold-flame': {
    id: 'pinch-hold-flame',
    iconKey: 'pinch-flame',
    name: { hi: 'दीप प्रज्वलन', en: 'Light Flame' },
    requiredHands: 'single',
    description: 'Hold pinch gesture steadily near wick to ignite Diya'
  },
  'circular-aarti': {
    id: 'circular-aarti',
    iconKey: 'aarti-circle',
    name: { hi: 'आरती परिक्रमा', en: 'Circular Aarti' },
    requiredHands: 'single',
    description: 'Hold Aarti thali and move hand in gentle clockwise circles'
  },
  'sweep-chaur': {
    id: 'sweep-chaur',
    iconKey: 'chaur-sweep',
    name: { hi: 'चौर साहिब सेवा', en: 'Chaur Sahib Seva' },
    requiredHands: 'single',
    description: 'Hold handle and sweep gently side-to-side in reverence'
  },
  'pinch-tasbih': {
    id: 'pinch-tasbih',
    iconKey: 'tasbih',
    name: { hi: 'तस्बीह जप', en: 'Tasbih Bead Count' },
    requiredHands: 'single',
    description: 'Pinch and release thumb and index to advance beads'
  },
  'bowl-resonate': {
    id: 'bowl-resonate',
    iconKey: 'bowl',
    name: { hi: 'सिंगिंग बाउल', en: 'Singing Bowl Resonate' },
    requiredHands: 'single',
    description: 'Circle hand gently around rim with mallet to resonate'
  },
  'still-reflection': {
    id: 'still-reflection',
    iconKey: 'reflection',
    name: { hi: 'शांत ध्यान', en: 'Still Reflection' },
    requiredHands: 'both',
    description: 'Hold hands calm and still for quiet inner meditation'
  }
};

export interface HandFeatureFrame {
  handedness: 'Left' | 'Right';
  center: { x: number; y: number; z: number };
  scale: number;
  pinchDist: number;
  fingerExtension: number;
  wristRoll: number;
  isPinch: boolean;
  isGrip: boolean;
  isCupped: boolean;
  isNamaste: boolean;
  isOpen: boolean;
  landmarks: NormalizedLandmark[];
}

export interface GestureRecognizerState {
  gestureId: RitualGestureId | null;
  phase: GesturePhase;
  confidence: number;
  stableDetectFrames: number;
  actionProgress: number;
  cursorOffset: { x: number; y: number; z: number };
  paused: boolean;
  activePourTiltRad: number;
  basePos?: { x: number; y: number; z: number } | null;
  lastPos?: { x: number; y: number; z: number } | null;
  abortFrames?: number;
  cooldownTimerMs?: number;
}

export interface GestureStepOutput {
  state: GestureRecognizerState;
  justCompleted: boolean;
  justCancelled: boolean;
  activePourTiltRad: number;
}

export function extractHandFeatureFrame(
  landmarks: NormalizedLandmark[] | null | undefined,
  handedness: 'Left' | 'Right'
): HandFeatureFrame | null {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const middleTip = landmarks[12];
  const ringMcp = landmarks[13];
  const ringTip = landmarks[16];
  const pinkyMcp = landmarks[17];
  const pinkyTip = landmarks[20];

  const scale = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.15;
  const center = {
    x: (middleMcp.x + wrist.x) * 0.5,
    y: (middleMcp.y + wrist.y) * 0.5,
    z: (middleMcp.z + wrist.z) * 0.5
  };

  const pinchDist = Math.hypot(
    thumbTip.x - indexTip.x,
    thumbTip.y - indexTip.y,
    thumbTip.z - indexTip.z
  );

  const indexExt = Math.hypot(indexTip.x - indexMcp.x, indexTip.y - indexMcp.y) / scale;
  const middleExt = Math.hypot(middleTip.x - middleMcp.x, middleTip.y - middleMcp.y) / scale;
  const ringExt = Math.hypot(ringTip.x - ringMcp.x, ringTip.y - ringMcp.y) / scale;
  const pinkyExt = Math.hypot(pinkyTip.x - pinkyMcp.x, pinkyTip.y - pinkyMcp.y) / scale;
  const fingerExtension = (indexExt + middleExt + ringExt + pinkyExt) / 4;

  const rollDiff = pinkyMcp.y - indexMcp.y;
  const wristRoll = rollDiff / scale;

  const isPinch = pinchDist < 0.28 * scale;
  const isGrip = fingerExtension < 0.5 && !isPinch;
  const isCupped = fingerExtension >= 0.5 && fingerExtension < 0.95 && !isPinch;
  const isNamaste = fingerExtension >= 0.95 && !isPinch && indexTip.y < indexMcp.y;
  const isOpen = fingerExtension >= 1.05 && !isPinch;

  return {
    handedness,
    center,
    scale,
    pinchDist,
    fingerExtension,
    wristRoll,
    isPinch,
    isGrip,
    isCupped,
    isNamaste,
    isOpen,
    landmarks
  };
}

export function computeNamasteConfidence(
  left: HandFeatureFrame | null,
  right: HandFeatureFrame | null
): number {
  if (!left || !right) return 0;
  const dist = Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y);
  if (dist > 0.28) return 0;
  if (!left.isNamaste && !left.isOpen && left.fingerExtension < 0.8) return 0;
  if (!right.isNamaste && !right.isOpen && right.fingerExtension < 0.8) return 0;
  const closeness = Math.max(0, 1 - dist / 0.25);
  const ext = Math.min(1, (left.fingerExtension + right.fingerExtension) / 2);
  return closeness * 0.5 + ext * 0.5;
}

export function computeCuppedHandsConfidence(
  left: HandFeatureFrame | null,
  right: HandFeatureFrame | null
): number {
  if (!left || !right) return 0;
  const dist = Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y);
  if (dist > 0.35) return 0;
  if (!left.isCupped && left.fingerExtension > 1.05) return 0;
  if (!right.isCupped && right.fingerExtension > 1.05) return 0;
  const closeness = Math.max(0, 1 - dist / 0.32);
  const cuppedness = (left.isCupped ? 0.5 : 0.2) + (right.isCupped ? 0.5 : 0.2);
  return closeness * 0.4 + cuppedness * 0.6;
}

export function createInitialGestureState(gestureId: RitualGestureId | null, paused = false): GestureRecognizerState {
  return {
    gestureId,
    phase: 'IDLE',
    confidence: 0,
    stableDetectFrames: 0,
    actionProgress: 0,
    cursorOffset: { x: 0, y: 0, z: 0 },
    paused,
    activePourTiltRad: 0,
    basePos: null,
    lastPos: null,
    abortFrames: 0,
    cooldownTimerMs: 0
  };
}

export function cancelGestureAction(state: GestureRecognizerState): GestureRecognizerState {
  return {
    ...state,
    phase: 'COOLDOWN',
    actionProgress: 0,
    confidence: 0,
    stableDetectFrames: 0,
    cursorOffset: { x: 0, y: 0, z: 0 },
    basePos: null,
    lastPos: null,
    abortFrames: 0,
    cooldownTimerMs: 1200
  };
}

export function stepGestureRecognizer(
  state: GestureRecognizerState,
  gestureId: RitualGestureId | null,
  left: HandFeatureFrame | null,
  right: HandFeatureFrame | null,
  dtMs: number,
  options?: { pourStepComplete?: boolean }
): GestureStepOutput {
  const primaryHand = right || left;

  if (state.paused) {
    return {
      state: { ...state, confidence: 0 },
      justCompleted: false,
      justCancelled: false,
      activePourTiltRad: 0
    };
  }

  // Handle cooldown
  if (state.phase === 'COOLDOWN') {
    const remaining = (state.cooldownTimerMs ?? 800) - dtMs;
    if (remaining <= 0) {
      return {
        state: createInitialGestureState(gestureId),
        justCompleted: false,
        justCancelled: false,
        activePourTiltRad: 0
      };
    }
    return {
      state: { ...state, cooldownTimerMs: remaining },
      justCompleted: false,
      justCancelled: false,
      activePourTiltRad: 0
    };
  }

  if (!gestureId) {
    return {
      state: { ...state, phase: 'IDLE', confidence: 0, stableDetectFrames: 0 },
      justCompleted: false,
      justCancelled: false,
      activePourTiltRad: 0
    };
  }

  // Evaluate gesture match
  let matches = false;
  let confidence = 0;

  switch (gestureId) {
    case 'namaste-flowers': {
      confidence = computeNamasteConfidence(left, right);
      matches = confidence > 0.65;
      break;
    }
    case 'cupped-bhog': {
      confidence = computeCuppedHandsConfidence(left, right);
      matches = confidence > 0.65;
      break;
    }
    case 'vessel-pour': {
      if (primaryHand && (primaryHand.isGrip || primaryHand.fingerExtension < 0.65)) {
        matches = true;
        confidence = 0.9;
      }
      break;
    }
    case 'pinch-release-leaf':
    case 'pinch-hold-flame':
    case 'pinch-tasbih': {
      if (primaryHand && primaryHand.isPinch) {
        matches = true;
        confidence = 0.92;
      }
      break;
    }
    case 'circular-aarti': {
      if (primaryHand && (primaryHand.isCupped || primaryHand.isGrip || primaryHand.fingerExtension < 0.9)) {
        matches = true;
        confidence = 0.88;
      }
      break;
    }
    case 'sweep-chaur': {
      if (primaryHand && (primaryHand.isGrip || primaryHand.fingerExtension < 0.65)) {
        matches = true;
        confidence = 0.9;
      }
      break;
    }
    case 'bowl-resonate': {
      if (primaryHand && (primaryHand.isGrip || primaryHand.isCupped)) {
        matches = true;
        confidence = 0.85;
      }
      break;
    }
    case 'still-reflection': {
      const nam = computeNamasteConfidence(left, right);
      const cup = computeCuppedHandsConfidence(left, right);
      confidence = Math.max(nam, cup);
      matches = confidence > 0.6;
      break;
    }
  }

  let nextPhase: GesturePhase = state.phase;
  let stableFrames = state.stableDetectFrames;
  let actionProgress = state.actionProgress;
  let justCompleted = false;
  let justCancelled = false;
  let activePourTiltRad = state.activePourTiltRad;
  let basePos = state.basePos || null;
  let lastPos = state.lastPos || null;
  let abortFrames = state.abortFrames || 0;
  let cursorOffset = { ...state.cursorOffset };

  // Phase transitions: IDLE -> DETECTED -> CONFIRMATION -> ACTION
  if (state.phase === 'IDLE' || state.phase === 'DETECTED' || state.phase === 'CONFIRMATION') {
    if (matches) {
      stableFrames++;
      if (stableFrames >= 6) {
        nextPhase = 'ACTION';
        actionProgress = 0;
        const refHand = right || left;
        if (refHand) {
          basePos = { ...refHand.center };
          lastPos = { ...refHand.center };
        }
      } else if (stableFrames >= 4) {
        nextPhase = 'CONFIRMATION';
      } else if (stableFrames >= 2) {
        nextPhase = 'DETECTED';
      }
    } else {
      stableFrames = 0;
      nextPhase = 'IDLE';
      confidence = 0;
    }
  } else if (state.phase === 'ACTION') {
    const curHand = right || left;

    // Check cancellation by open / neutral hand
    const isNeutralOpen =
      curHand &&
      curHand.isOpen &&
      gestureId !== 'pinch-release-leaf' &&
      gestureId !== 'namaste-flowers';

    if (isNeutralOpen || !curHand) {
      abortFrames++;
      if (abortFrames >= 3) {
        justCancelled = true;
        return {
          state: {
            ...state,
            phase: 'IDLE',
            confidence: 0,
            stableDetectFrames: 0,
            actionProgress: 0,
            cursorOffset: { x: 0, y: 0, z: 0 },
            basePos: null,
            lastPos: null,
            abortFrames: 0
          },
          justCompleted: false,
          justCancelled: true,
          activePourTiltRad: 0
        };
      }
    } else {
      abortFrames = 0;
    }

    if (curHand) {
      const curPos = curHand.center;
      if (basePos) {
        cursorOffset = {
          x: curPos.x - basePos.x,
          y: curPos.y - basePos.y,
          z: curPos.z - basePos.z
        };
      }

      // Gesture-specific action progress and completion logic
      switch (gestureId) {
        case 'namaste-flowers': {
          if (basePos && curPos.y - basePos.y > 0.08) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
            actionProgress = 1;
          }
          break;
        }
        case 'cupped-bhog': {
          const dy = basePos ? basePos.y - curPos.y : 0;
          const scaleInc = basePos ? curHand.scale > 0.17 : false;
          if (dy > 0.08 || scaleInc) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
            actionProgress = 1;
          }
          break;
        }
        case 'vessel-pour': {
          activePourTiltRad = Math.max(0, Math.min(1.4, curHand.wristRoll * 1.5));
          if (options?.pourStepComplete) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
            actionProgress = 1;
          }
          break;
        }
        case 'pinch-release-leaf': {
          if (curHand.isOpen || curHand.fingerExtension > 0.85) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
            actionProgress = 1;
          }
          break;
        }
        case 'pinch-hold-flame': {
          if (curHand.isPinch) {
            actionProgress += dtMs / 300;
            if (actionProgress >= 1) {
              justCompleted = true;
              nextPhase = 'COOLDOWN';
              actionProgress = 1;
            }
          }
          break;
        }
        case 'circular-aarti': {
          if (lastPos) {
            const stepDist = Math.hypot(curPos.x - lastPos.x, curPos.y - lastPos.y);
            actionProgress = Math.min(1, actionProgress + stepDist / 0.7);
          }
          if (actionProgress >= 1) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
          }
          break;
        }
        case 'sweep-chaur': {
          if (lastPos) {
            const stepX = Math.abs(curPos.x - lastPos.x);
            actionProgress = Math.min(1, actionProgress + stepX / 0.55);
          }
          if (actionProgress >= 1) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
          }
          break;
        }
        case 'pinch-tasbih': {
          if (!curHand.isPinch && state.confidence > 0.8) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
            actionProgress = 1;
          }
          break;
        }
        case 'bowl-resonate': {
          if (lastPos) {
            const stepDist = Math.hypot(curPos.x - lastPos.x, curPos.y - lastPos.y);
            actionProgress = Math.min(1, actionProgress + stepDist / 0.8);
          }
          if (actionProgress >= 1) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
          }
          break;
        }
        case 'still-reflection': {
          actionProgress += dtMs / 450;
          if (actionProgress >= 1) {
            justCompleted = true;
            nextPhase = 'COOLDOWN';
            actionProgress = 1;
          }
          break;
        }
      }

      lastPos = { ...curPos };
    }
  }

  return {
    state: {
      gestureId,
      phase: nextPhase,
      confidence,
      stableDetectFrames: stableFrames,
      actionProgress,
      cursorOffset,
      paused: state.paused,
      activePourTiltRad,
      basePos,
      lastPos,
      abortFrames,
      cooldownTimerMs: nextPhase === 'COOLDOWN' ? 1000 : 0
    },
    justCompleted,
    justCancelled,
    activePourTiltRad
  };
}
