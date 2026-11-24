import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceGazeHold,
  advanceMotionProgress,
  computeFluidDynamics,
  computeHandGripPose,
  computePourRate,
  computeStreamArcPoints,
  formatRitualProgress,
  mapDeviceOrientationToLook,
  solveArmElbowPosition,
  stepOfferingDrop
} from './ritualEngine';
import { EXPERIENCES, getExperienceById } from '../data/experiences';
import { TRADITION_VISUAL_CONFIGS } from '../data/traditionVisualConfig';
import {
  computeHandCalibrationSummary,
  DEFAULT_SHIVA_COLLIDER,
  HAND_LANDMARK_CONNECTIONS,
  mapLandmarksToHandState,
  resolveHandCollision,
  resolveObjectSupportY,
  resolvePropSeparation
} from './collisionPhysics';

test('all 9 spiritual experiences are prepopulated with steps and imagery', () => {
  assert.equal(EXPERIENCES.length, 9);
  const ids = EXPERIENCES.map((e) => e.id);
  for (const requiredId of ['shiva', 'krishna', 'balaji', 'durga', 'buddha', 'sikh', 'christian', 'islamic', 'mahavir']) {
    assert.ok(ids.includes(requiredId as any), `Missing experience ${requiredId}`);
  }
  for (const exp of EXPERIENCES) {
    assert.ok(exp.steps.length >= 3, `${exp.id} should have at least 3 ritual steps`);
    assert.ok(exp.imageUrl.startsWith('/src/assets/images/'), `${exp.id} must use generated local asset`);
  }
  assert.equal(getExperienceById('shiva').steps.length, 7);
});

test('computePourRate stays zero upright and increases smoothly with vessel tilt', () => {
  assert.equal(computePourRate(0.1, 0.05), 0);
  assert.equal(computePourRate(0.32, 0.05), 0);
  const midPour = computePourRate(0.85, 0.1);
  const highPour = computePourRate(1.4, 0.1);
  assert.ok(midPour > 0.15 && midPour < 0.8);
  assert.ok(highPour > 0.9);
  const offTarget = computePourRate(1.1, 0.9, 0.4);
  assert.ok(offTarget < computePourRate(1.1, 0.1, 0.4));
});

test('computeFluidDynamics differentiates thicker slower milk from clear faster water', () => {
  const water = computeFluidDynamics(false, 0.8);
  const milk = computeFluidDynamics(true, 0.8);
  assert.ok(milk.streamRadius > water.streamRadius);
  assert.ok(milk.flowSpeed < water.flowSpeed);
  assert.ok(milk.coatingDecayRate < water.coatingDecayRate);
});

test('computeStreamArcPoints traces downward curve from spout to targetY', () => {
  const buf = new Float32Array(12 * 3);
  const count = computeStreamArcPoints(0.1, 0.85, 0.0, 0.75, 0.35, -1, 0, buf, 12);
  assert.equal(count, 12);
  assert.ok(Math.abs(buf[1] - 0.85) < 1e-5);
  assert.ok(Math.abs(buf[(count - 1) * 3 + 1] - 0.35) < 1e-5);
  assert.ok(buf[(count - 1) * 3] < buf[0]);
  assert.equal(computeStreamArcPoints(0.1, 0.85, 0.0, 0.0, 0.35, -1, 0, buf, 12), 0);
});

test('solveArmElbowPosition keeps anatomical bone lengths and downward-outward elbow pole', () => {
  const shoulder: [number, number, number] = [0.34, 0.48, 1.38];
  const wrist: [number, number, number] = [0.16, 0.62, 0.02];
  const upperLen = 0.72;
  const forearmLen = 0.78;
  const elbow = solveArmElbowPosition(shoulder, wrist, upperLen, forearmLen, 1);
  const dUpper = Math.hypot(elbow[0] - shoulder[0], elbow[1] - shoulder[1], elbow[2] - shoulder[2]);
  assert.ok(Math.abs(dUpper - upperLen) < 1e-3);
  assert.ok(elbow[1] < shoulder[1]);
  assert.ok(elbow[0] > wrist[0]);
});

test('stepOfferingDrop applies gravity and settles cleanly at floor height', () => {
  let body = { x: 0.2, y: 0.5, z: 0.1, vx: 0, vy: 0, vz: 0, settled: false };
  for (let i = 0; i < 120; i++) {
    body = stepOfferingDrop(body, 0.0, 0.05, 0.0, 0.8, 0.016);
    if (body.settled) break;
  }
  assert.equal(body.settled, true);
  assert.ok(Math.abs(body.y - 0.05) < 1e-4);
  assert.ok(Math.abs(body.x) < 1e-3);
});

test('advanceMotionProgress accumulates smoothly and clamps at 1', () => {
  let progress = 0;
  progress = advanceMotionProgress(progress, 1.6, 3.2);
  assert.equal(progress, 0.5);
  progress = advanceMotionProgress(progress, 2.0, 3.2);
  assert.equal(progress, 1);
});

test('advanceGazeHold fills on target and decays off target', () => {
  const step1 = advanceGazeHold(true, 0.5, 0.625, 1.25);
  assert.equal(step1.progress, 1);
  assert.equal(step1.triggered, true);

  const stepOff = advanceGazeHold(false, 0.5, 0.1, 1.25);
  assert.ok(stepOff.progress < 0.5 && stepOff.progress > 0);
  assert.equal(stepOff.triggered, false);
});

test('computeHandGripPose curls fingers distinctly per object style and opens on reach/release', () => {
  const openHand = computeHandGripPose(0, 'kalash');
  const closedKalash = computeHandGripPose(1, 'kalash');
  const closedPinch = computeHandGripPose(1, 'pinch');
  const reachPose = computeHandGripPose(1, 'kalash', 'reach');
  assert.ok(closedKalash.middleCurl > openHand.middleCurl);
  assert.ok(closedKalash.ringCurl > closedPinch.ringCurl);
  assert.ok(reachPose.spread > closedKalash.spread);
  assert.ok(reachPose.indexCurl < openHand.indexCurl);
});

test('mapDeviceOrientationToLook handles wrap-around yaw and clamps pitch', () => {
  const look = mapDeviceOrientationToLook(5, 65, 0, 355);
  assert.ok(Math.abs(look.yawRad - (10 * Math.PI) / 180) < 1e-5);
  assert.equal(look.pitchRad, 0);

  const extreme = mapDeviceOrientationToLook(0, 180, 0, 0);
  assert.equal(extreme.pitchRad, 0.65);
});

test('formatRitualProgress outputs clean tabular ratio', () => {
  assert.equal(formatRitualProgress(3, 7), '3 / 7');
  assert.equal(formatRitualProgress(9, 7), '7 / 7');
});

test('resolveHandCollision prevents hands from clipping through chowki table or Shiva Lingam', () => {
  const clampedTable = resolveHandCollision(
    { x: 0.3, y: -0.15, z: 0.35 },
    0.044,
    0,
    0,
    true,
    [],
    null
  );
  assert.ok(clampedTable.y >= 0.045, 'Hand must stay above chowki table surface');

  const clampedLingam = resolveHandCollision(
    { x: 0.02, y: 0.25, z: -0.05 },
    0.044,
    0.072,
    0.148,
    true,
    [],
    'kalash-water'
  );
  const radialDist = Math.hypot(
    clampedLingam.x - DEFAULT_SHIVA_COLLIDER.x,
    clampedLingam.z - DEFAULT_SHIVA_COLLIDER.z
  );
  assert.ok(
    radialDist >= DEFAULT_SHIVA_COLLIDER.lingamRadius + 0.072,
    'Hand + Kalash must not pass through Shiva Lingam shaft'
  );
});

test('resolveObjectSupportY rests Bhog and Makhan items inside serving plate without clipping', () => {
  const plate = { id: 'bhog-shiva', x: -0.56, y: 0.01, z: 0.24, radius: 0.075, height: 0.048 };
  const insidePlateY = resolveObjectSupportY(-0.55, 0.25, 'bhog-item-pom', true, plate);
  const onChowkiY = resolveObjectSupportY(-0.2, 0.35, 'bhog-item-pom', true, plate);
  assert.ok(insidePlateY > plate.y, 'Bhog item must sit above the offering plate floor');
  assert.ok(onChowkiY > 0 && onChowkiY < plate.y + 0.014, 'Bhog item rests cleanly on chowki runner');

  const makhanPlate = { id: 'makhan-bowl', x: -0.46, y: 0.01, z: 0.48, radius: 0.088, height: 0.05 };
  const makhanInsideY = resolveObjectSupportY(-0.45, 0.48, 'krishna-item-mishri', false, makhanPlate);
  assert.ok(makhanInsideY > makhanPlate.y, 'Krishna Makhan/Mishri item rests cleanly inside silver tray');
});

test('resolvePropSeparation pushes vessels and plates apart cleanly without overlap', () => {
  const resting = [{ id: 'kalash-milk', x: -0.32, y: 0.01, z: 0.52, radius: 0.072, height: 0.148 }];
  const separated = resolvePropSeparation(-0.33, 0.52, 'kalash-water', 0.072, resting, true);
  const dist = Math.hypot(separated.x - resting[0].x, separated.z - resting[0].z);
  assert.ok(dist >= 0.144, 'Non-overlapping props maintain physical separation');
});

test('mapLandmarksToHandState and calibration summary detect hands, pinch, open palm & tilt', () => {
  assert.equal(HAND_LANDMARK_CONNECTIONS.length, 21);

  const openLandmarks = Array.from({ length: 21 }, (_, idx) => {
    if (idx === 0) return { x: 0.3, y: 0.7, z: 0 };
    if (idx === 4) return { x: 0.18, y: 0.55, z: 0 };
    if (idx === 5) return { x: 0.26, y: 0.52, z: 0 };
    if (idx === 8) return { x: 0.25, y: 0.32, z: 0 };
    if (idx === 9) return { x: 0.3, y: 0.5, z: 0 };
    if (idx === 12) return { x: 0.3, y: 0.3, z: 0 };
    if (idx === 13) return { x: 0.34, y: 0.52, z: 0 };
    if (idx === 16) return { x: 0.35, y: 0.33, z: 0 };
    if (idx === 17) return { x: 0.38, y: 0.54, z: 0 };
    if (idx === 20) return { x: 0.4, y: 0.38, z: 0 };
    return { x: 0.3, y: 0.55, z: 0 };
  });
  const openState = mapLandmarksToHandState(openLandmarks, 'Right');
  assert.equal(openState.isOpenPalm, true);
  assert.equal(openState.isPinching, false);
  assert.ok(openState.worldPos.x > 0, 'Webcam X on left side mirrors to right hand space');

  const pinchLandmarks = openLandmarks.map((lm, idx) =>
    idx === 8 ? { x: 0.19, y: 0.54, z: 0 } : lm
  );
  const pinchState = mapLandmarksToHandState(pinchLandmarks, 'Right');
  assert.equal(pinchState.isPinching, true);
  assert.ok(pinchState.gripStrength > 0.8);

  const noneSummary = computeHandCalibrationSummary(null, null);
  assert.equal(noneSummary.ready, false);
  assert.equal(noneSummary.primaryPose, 'none');

  const readySummary = computeHandCalibrationSummary(pinchState, openState);
  assert.equal(readySummary.ready, true);
  assert.deepEqual(readySummary.detectedSides, ['Left', 'Right']);
  assert.equal(readySummary.primaryPose, 'pinch');
});

test('TRADITION_VISUAL_CONFIGS configures calibrated altar, runner and lighting for all 9 traditions', () => {
  for (const exp of EXPERIENCES) {
    const cfg = TRADITION_VISUAL_CONFIGS[exp.id];
    assert.ok(cfg, `Missing visual config for ${exp.id}`);
    assert.equal(cfg.id, exp.id);
    assert.ok(
      ['dark-basalt', 'makrana-marble', 'carved-teak', 'walnut-teak'].includes(cfg.altarSurface),
      `${exp.id} must have valid altar surface`
    );
    assert.ok(Number.isFinite(cfg.panoramaYCenter));
    assert.ok(cfg.lighting.keyPos.length === 3);
    assert.ok(cfg.lighting.keyIntensity > 0.5 && cfg.lighting.hemiIntensity > 0.3);
    assert.ok(cfg.lighting.backdropBrightness > 0.5 && cfg.lighting.backdropBrightness <= 1.2);
  }
});
