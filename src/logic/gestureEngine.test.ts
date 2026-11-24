import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIENCES, getStepGestureSpec } from '../data/experiences';
import { NormalizedLandmark } from './collisionPhysics';
import {
  cancelGestureAction,
  computeCuppedHandsConfidence,
  computeNamasteConfidence,
  createInitialGestureState,
  extractHandFeatureFrame,
  GESTURE_DEFINITIONS,
  stepGestureRecognizer
} from './gestureEngine';

/**
 * Generates synthetic 21-landmark MediaPipe hands with realistic finger geometry
 * for Namaste, Cupped Hands, Gripped Fist, Thumb-Index Pinch, and Neutral Open Palm.
 */
function makeSyntheticLandmarks(
  pose: 'open' | 'pinch' | 'grip' | 'cupped' | 'namaste',
  centerX: number,
  centerY: number,
  rollOffsetY = 0,
  scale = 0.15
): NormalizedLandmark[] {
  const wrist = { x: centerX, y: centerY + scale * 0.7, z: 0 };
  const middleMcp = { x: centerX, y: centerY - scale * 0.3, z: 0 };
  const indexMcp = { x: centerX - scale * 0.25, y: centerY - scale * 0.2, z: 0 };
  const ringMcp = { x: centerX + scale * 0.22, y: centerY - scale * 0.2, z: 0 };
  const pinkyMcp = {
    x: centerX + scale * 0.42,
    y: centerY - scale * 0.2 + rollOffsetY,
    z: 0
  };

  let fingerExtend = 1.25;
  let thumbTip = { x: centerX - scale * 0.52, y: centerY + scale * 0.1, z: 0 };
  let indexTip = { x: centerX - scale * 0.28, y: centerY - scale * 1.4, z: 0 };

  if (pose === 'cupped') {
    fingerExtend = 0.76;
    thumbTip = { x: centerX - scale * 0.44, y: centerY - scale * 0.28, z: 0 };
    indexTip = { x: centerX - scale * 0.24, y: centerY - scale * 0.85, z: 0 };
  } else if (pose === 'grip') {
    fingerExtend = 0.25;
    thumbTip = { x: centerX - scale * 0.14, y: centerY - scale * 0.18, z: 0 };
    indexTip = { x: centerX - scale * 0.2, y: centerY - scale * 0.26, z: 0 };
  } else if (pose === 'pinch') {
    fingerExtend = 0.68;
    thumbTip = { x: centerX - scale * 0.24, y: centerY - scale * 0.48, z: 0 };
    indexTip = { x: centerX - scale * 0.22, y: centerY - scale * 0.46, z: 0 };
  } else if (pose === 'namaste') {
    fingerExtend = 1.1;
    thumbTip = { x: centerX - scale * 0.36, y: centerY - scale * 0.25, z: 0 };
    indexTip = { x: centerX - scale * 0.2, y: centerY - scale * 1.15, z: 0 };
  }

  const pts: NormalizedLandmark[] = Array.from({ length: 21 }, () => ({ ...middleMcp }));
  pts[0] = wrist;
  pts[4] = thumbTip;
  pts[5] = indexMcp;
  pts[8] = indexTip;
  pts[9] = middleMcp;
  pts[12] = { x: centerX, y: middleMcp.y - scale * fingerExtend, z: 0 };
  pts[13] = ringMcp;
  pts[16] = { x: ringMcp.x, y: ringMcp.y - scale * fingerExtend * 0.92, z: 0 };
  pts[17] = pinkyMcp;
  pts[20] = { x: pinkyMcp.x, y: pinkyMcp.y - scale * fingerExtend * 0.78, z: 0 };
  return pts;
}

test('all 9 traditions map steps to culturally faithful low-compute gestures', () => {
  for (const exp of EXPERIENCES) {
    for (const step of exp.steps) {
      const meta = getStepGestureSpec(step);
      assert.ok(GESTURE_DEFINITIONS[meta.gestureId], `Valid gesture for ${exp.id}/${step.id}`);
      assert.ok(meta.hint.en.length > 8 && meta.hint.hi.length > 8);
    }
  }

  const sikh = EXPERIENCES.find((e) => e.id === 'sikh')!;
  assert.equal(getStepGestureSpec(sikh.steps[0]).gestureId, 'sweep-chaur');
  assert.equal(getStepGestureSpec(sikh.steps[1]).gestureId, 'cupped-bhog');
  assert.equal(getStepGestureSpec(sikh.steps[2]).gestureId, 'still-reflection');

  const islamic = EXPERIENCES.find((e) => e.id === 'islamic')!;
  assert.equal(getStepGestureSpec(islamic.steps[0]).gestureId, 'pinch-release-leaf');
  assert.equal(getStepGestureSpec(islamic.steps[2]).gestureId, 'pinch-tasbih');
  assert.equal(getStepGestureSpec(islamic.steps[3]).gestureId, 'still-reflection');

  const shiva = EXPERIENCES.find((e) => e.id === 'shiva')!;
  assert.equal(getStepGestureSpec(shiva.steps[0]).gestureId, 'vessel-pour');
  assert.equal(getStepGestureSpec(shiva.steps[2]).gestureId, 'pinch-release-leaf');
  assert.equal(getStepGestureSpec(shiva.steps[3]).gestureId, 'namaste-flowers');
  assert.equal(getStepGestureSpec(shiva.steps[5]).gestureId, 'pinch-hold-flame');
  assert.equal(getStepGestureSpec(shiva.steps[6]).gestureId, 'circular-aarti');
});

test('multi-frame stability prevents false triggers from a single stray frame', () => {
  const lm = makeSyntheticLandmarks('pinch', 0.5, 0.5);
  const feat = extractHandFeatureFrame(lm, 'Right');
  let state = createInitialGestureState('pinch-hold-flame');

  // Single frame should NOT jump to DETECTED or COMPLETED
  const out1 = stepGestureRecognizer(state, 'pinch-hold-flame', null, feat, 65);
  assert.equal(out1.state.phase, 'IDLE');
  assert.equal(out1.justCompleted, false);

  // Neutral open hand resets stability counter
  const openFeat = extractHandFeatureFrame(makeSyntheticLandmarks('open', 0.5, 0.5), 'Right');
  const out2 = stepGestureRecognizer(out1.state, 'pinch-hold-flame', null, openFeat, 65);
  assert.equal(out2.state.stableDetectFrames, 0);
  assert.equal(out2.state.phase, 'IDLE');
});

test('Namaste + gentle downward forward motion triggers Pushpa Arpan flower offering and enters cooldown', () => {
  const left = extractHandFeatureFrame(makeSyntheticLandmarks('namaste', 0.46, 0.45), 'Left')!;
  const right = extractHandFeatureFrame(makeSyntheticLandmarks('namaste', 0.52, 0.45), 'Right')!;
  assert.ok(computeNamasteConfidence(left, right) > 0.7);

  let state = createInitialGestureState('namaste-flowers');
  let completed = false;

  // Hold Namaste steady through detection & confirmation
  for (let i = 0; i < 8; i++) {
    const res = stepGestureRecognizer(state, 'namaste-flowers', left, right, 70);
    state = res.state;
  }
  assert.equal(state.phase, 'ACTION');

  // Move hands gently downward (higher Y) to release flowers
  const leftDip = extractHandFeatureFrame(makeSyntheticLandmarks('namaste', 0.46, 0.62), 'Left')!;
  const rightDip = extractHandFeatureFrame(makeSyntheticLandmarks('namaste', 0.52, 0.62), 'Right')!;
  const dipOut = stepGestureRecognizer(state, 'namaste-flowers', leftDip, rightDip, 70);
  completed = dipOut.justCompleted;
  state = dipOut.state;

  assert.equal(completed, true);
  assert.equal(state.phase, 'COOLDOWN');

  // Subsequent frame during cooldown does NOT double-trigger
  const dupOut = stepGestureRecognizer(state, 'namaste-flowers', leftDip, rightDip, 70);
  assert.equal(dupOut.justCompleted, false);
  assert.equal(dupOut.state.phase, 'COOLDOWN');
});

test('Cupped hands + upward/forward motion triggers Bhog offering', () => {
  const left = extractHandFeatureFrame(makeSyntheticLandmarks('cupped', 0.45, 0.55), 'Left')!;
  const right = extractHandFeatureFrame(makeSyntheticLandmarks('cupped', 0.55, 0.55), 'Right')!;
  assert.ok(computeCuppedHandsConfidence(left, right) > 0.7);

  let state = createInitialGestureState('cupped-bhog');
  for (let i = 0; i < 9; i++) {
    state = stepGestureRecognizer(state, 'cupped-bhog', left, right, 70).state;
  }
  assert.equal(state.phase, 'ACTION');

  // Slight upward lift (-Y) & larger palm scale (forward)
  const leftUp = extractHandFeatureFrame(makeSyntheticLandmarks('cupped', 0.45, 0.36, 0, 0.19), 'Left')!;
  const rightUp = extractHandFeatureFrame(makeSyntheticLandmarks('cupped', 0.55, 0.36, 0, 0.19), 'Right')!;
  const out = stepGestureRecognizer(state, 'cupped-bhog', leftUp, rightUp, 80);
  assert.equal(out.justCompleted, true);
  assert.equal(out.state.phase, 'COOLDOWN');
});

test('Vessel grip drives continuous Kalash tilt pouring and upright stops pour cleanly', () => {
  const uprightGrip = extractHandFeatureFrame(makeSyntheticLandmarks('grip', 0.5, 0.5, 0), 'Right')!;
  let state = createInitialGestureState('vessel-pour');

  for (let i = 0; i < 8; i++) {
    state = stepGestureRecognizer(state, 'vessel-pour', null, uprightGrip, 70).state;
  }
  assert.equal(state.phase, 'ACTION');

  // Tilted wrist (+rollOffsetY) increases pour tilt
  const tiltedGrip = extractHandFeatureFrame(makeSyntheticLandmarks('grip', 0.5, 0.5, 0.08), 'Right')!;
  const pourOut = stepGestureRecognizer(state, 'vessel-pour', null, tiltedGrip, 70);
  assert.ok(pourOut.activePourTiltRad > 0.45, 'Tilting wrist drives pouring tilt angle');

  // Returning wrist upright drops tilt cleanly near 0
  const uprightAgain = stepGestureRecognizer(pourOut.state, 'vessel-pour', null, uprightGrip, 70);
  assert.ok(uprightAgain.activePourTiltRad <= 0.1, 'Returning upright stops pour cleanly');

  // Marking pour complete transitions cleanly to cooldown
  const doneOut = stepGestureRecognizer(uprightAgain.state, 'vessel-pour', null, tiltedGrip, 70, {
    pourStepComplete: true
  });
  assert.equal(doneOut.justCompleted, true);
  assert.equal(doneOut.state.phase, 'COOLDOWN');
});

test('Pinch -> move -> open palm triggers Bilva / Tulsi leaf offering', () => {
  const pinch = extractHandFeatureFrame(makeSyntheticLandmarks('pinch', 0.5, 0.5), 'Right')!;
  let state = createInitialGestureState('pinch-release-leaf');

  for (let i = 0; i < 7; i++) {
    state = stepGestureRecognizer(state, 'pinch-release-leaf', null, pinch, 70).state;
  }
  assert.equal(state.phase, 'ACTION');

  const open = extractHandFeatureFrame(makeSyntheticLandmarks('open', 0.5, 0.45), 'Right')!;
  const releaseOut = stepGestureRecognizer(state, 'pinch-release-leaf', null, open, 70);
  assert.equal(releaseOut.justCompleted, true);
});

test('Pinch hold ignites Diya flame without needing matchstick drag', () => {
  const pinch = extractHandFeatureFrame(makeSyntheticLandmarks('pinch', 0.5, 0.5), 'Right')!;
  let state = createInitialGestureState('pinch-hold-flame');
  let ignited = false;

  for (let i = 0; i < 12; i++) {
    const out = stepGestureRecognizer(state, 'pinch-hold-flame', null, pinch, 70);
    state = out.state;
    if (out.justCompleted) {
      ignited = true;
      break;
    }
  }
  assert.equal(ignited, true);
});

test('Circular Aarti tracks user hand circle trajectory and Chaur Sahib tracks horizontal sweep', () => {
  const baseCup = extractHandFeatureFrame(makeSyntheticLandmarks('cupped', 0.5, 0.5), 'Right')!;
  let aartiState = createInitialGestureState('circular-aarti');

  for (let i = 0; i < 8; i++) {
    aartiState = stepGestureRecognizer(aartiState, 'circular-aarti', null, baseCup, 70).state;
  }
  assert.equal(aartiState.phase, 'ACTION');

  let aartiCompleted = false;
  for (let step = 0; step < 18; step++) {
    const ang = (step / 14) * Math.PI * 2;
    const cx = 0.5 + Math.cos(ang) * 0.12;
    const cy = 0.5 + Math.sin(ang) * 0.12;
    const pt = extractHandFeatureFrame(makeSyntheticLandmarks('cupped', cx, cy), 'Right')!;
    const out = stepGestureRecognizer(aartiState, 'circular-aarti', null, pt, 70);
    aartiState = out.state;
    if (out.justCompleted) {
      aartiCompleted = true;
      break;
    }
  }
  assert.equal(aartiCompleted, true);

  // Sikh Chaur Sahib horizontal sweep
  const baseGrip = extractHandFeatureFrame(makeSyntheticLandmarks('grip', 0.5, 0.5), 'Right')!;
  let chaurState = createInitialGestureState('sweep-chaur');
  for (let i = 0; i < 8; i++) {
    chaurState = stepGestureRecognizer(chaurState, 'sweep-chaur', null, baseGrip, 70).state;
  }
  assert.equal(chaurState.phase, 'ACTION');

  let chaurCompleted = false;
  const xs = [0.38, 0.62, 0.36, 0.64];
  for (const x of xs) {
    const pt = extractHandFeatureFrame(makeSyntheticLandmarks('grip', x, 0.5), 'Right')!;
    const out = stepGestureRecognizer(chaurState, 'sweep-chaur', null, pt, 70);
    chaurState = out.state;
    if (out.justCompleted) {
      chaurCompleted = true;
      break;
    }
  }
  assert.equal(chaurCompleted, true);
});

test('Cancel action and neutral pose cancel smoothly without triggering completion', () => {
  const grip = extractHandFeatureFrame(makeSyntheticLandmarks('grip', 0.5, 0.5), 'Right')!;
  let state = createInitialGestureState('sweep-chaur');
  for (let i = 0; i < 8; i++) {
    state = stepGestureRecognizer(state, 'sweep-chaur', null, grip, 70).state;
  }
  assert.equal(state.phase, 'ACTION');

  const cancelled = cancelGestureAction(state);
  assert.equal(cancelled.phase, 'COOLDOWN');
  assert.equal(cancelled.actionProgress, 0);

  // Dropping back to flat neutral palm also cancels cleanly without completion
  const neutral = extractHandFeatureFrame(makeSyntheticLandmarks('open', 0.5, 0.7), 'Right')!;
  let cur = state;
  let justCancelled = false;
  for (let i = 0; i < 7; i++) {
    const out = stepGestureRecognizer(cur, 'sweep-chaur', null, neutral, 70);
    cur = out.state;
    assert.equal(out.justCompleted, false);
    if (out.justCancelled) {
      justCancelled = true;
      break;
    }
  }
  assert.equal(justCancelled, true);
  assert.equal(cur.phase, 'IDLE');
});
