import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  RigidBody3D,
  PhysicsWorld,
  BoxCollider,
  SphereCollider,
  CylinderCollider,
  CompoundCollider
} from './collisionPhysics';
import {
  calculatePhysicalVesselPour,
  VesselOpeningSpec
} from './ritualEngine';

describe('Rigid Body Collision Physics', () => {
  it('prevents a solid falling sphere from passing through the solid altar table', () => {
    const world = new PhysicsWorld();
    
    // Add Table Collider at y = 0
    world.addStaticBody(
      'table',
      new THREE.Vector3(0, -0.05, 0.17),
      new BoxCollider(new THREE.Vector3(1.76, 0.10, 1.02))
    );

    // Dynamic Vessel Sphere at y = 0.30 falling under gravity
    const kalash = new RigidBody3D({
      id: 'kalash',
      position: new THREE.Vector3(0, 0.30, 0.20),
      mass: 1.2,
      collider: new SphereCollider(0.07),
      restitution: 0.15,
      friction: 0.5
    });
    world.addDynamicBody(kalash);

    // Simulate 60 physics steps (0.5 seconds of free fall)
    const dt = 1 / 60;
    for (let step = 0; step < 60; step++) {
      world.step(dt);
    }

    // The vessel radius is 0.07. Table top is y = 0.
    // The vessel center must settle at y >= 0.07 with zero penetration!
    assert.ok(
      kalash.position.y >= 0.069,
      `Vessel penetrated table! Position Y is ${kalash.position.y}, expected >= 0.07`
    );
    assert.ok(
      Math.abs(kalash.velocity.y) < 0.15,
      `Vessel should have settled on table, but vertical velocity is ${kalash.velocity.y}`
    );
  });

  it('prevents a solid vessel from passing through the solid Shiva Lingam', () => {
    const world = new PhysicsWorld();
    
    // Shiva Lingam cylinder at x = 0, z = -0.05, radius 0.145, y from 0.16 to 0.54
    world.addStaticBody(
      'shiva-lingam',
      new THREE.Vector3(0, 0.35, -0.05),
      new CylinderCollider(0.145, 0.38)
    );

    // Held vessel moving horizontally toward the Lingam center
    const kalash = new RigidBody3D({
      id: 'kalash',
      position: new THREE.Vector3(0.30, 0.35, -0.05),
      mass: 1.2,
      collider: new SphereCollider(0.07),
      isKinematic: true
    });
    world.addDynamicBody(kalash);

    // Attempt to push the vessel directly to x = 0 (inside the Lingam)
    const desiredPos = new THREE.Vector3(0.05, 0.35, -0.05);
    const resolvedPos = world.resolveKinematicMove(kalash, desiredPos);

    // Distance to Lingam center must be >= (Lingam radius 0.145 + Vessel radius 0.07) = 0.215
    const dist = Math.hypot(resolvedPos.x - 0, resolvedPos.z - (-0.05));
    assert.ok(
      dist >= 0.214,
      `Vessel passed into Lingam! Distance is ${dist}, required >= 0.215`
    );
  });
});

describe('Physical Vessel Pouring Logic', () => {
  const kalashSpec: VesselOpeningSpec = {
    localOpeningCenter: new THREE.Vector3(0, 0.148, 0),
    localOpeningNormal: new THREE.Vector3(0, 1, 0),
    rimRadius: 0.048,
    containerHeight: 0.148,
    fullCapacityLitres: 1.0
  };

  it('does NOT pour when vessel is perfectly upright', () => {
    const vesselPos = new THREE.Vector3(0, 0.60, 0.10);
    const vesselQuat = new THREE.Quaternion(); // Identity = upright
    const liquidVolume = 1.0; // 100% full

    const pour = calculatePhysicalVesselPour(kalashSpec, vesselPos, vesselQuat, liquidVolume);

    assert.equal(pour.isPouring, false, 'Upright vessel should NOT pour');
    assert.equal(pour.flowRate, 0, 'Flow rate must be 0 when upright');
  });

  it('does NOT pour when vessel is slightly tilted and opening remains above liquid level', () => {
    const vesselPos = new THREE.Vector3(0, 0.60, 0.10);
    const vesselQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.15); // ~8.6 deg
    const liquidVolume = 0.5; // 50% full

    const pour = calculatePhysicalVesselPour(kalashSpec, vesselPos, vesselQuat, liquidVolume);

    assert.equal(pour.isPouring, false, 'Half-full vessel tilted only 8.6° should NOT pour');
    assert.equal(pour.flowRate, 0);
  });

  it('does NOT pour when vessel opening faces upwards', () => {
    const vesselPos = new THREE.Vector3(0, 0.60, 0.10);
    // Tilted backwards so opening tilts up towards ceiling
    const vesselQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.2);
    const liquidVolume = 0.8;

    const pour = calculatePhysicalVesselPour(kalashSpec, vesselPos, vesselQuat, liquidVolume);

    assert.equal(pour.isPouring, false, 'Upward opening must NOT pour');
    assert.equal(pour.flowRate, 0);
  });

  it('pours water from the lowest point of the rim when tilted past spill threshold', () => {
    const vesselPos = new THREE.Vector3(0, 0.60, 0.10);
    // Tilted 60 degrees around X axis so rim tilts forward towards -Z (towards Lingam)
    const tiltAngle = Math.PI / 3; // 60 deg
    const vesselQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tiltAngle);
    const liquidVolume = 0.8;

    const pour = calculatePhysicalVesselPour(kalashSpec, vesselPos, vesselQuat, liquidVolume);

    assert.equal(pour.isPouring, true, 'Vessel tilted 60° with 80% volume MUST pour');
    assert.ok(pour.flowRate > 0.25, `Expected substantial flow rate, got ${pour.flowRate}`);
    
    // The spill point must be at the lowest edge of the rim opening
    assert.ok(
      pour.emissionPoint.y < vesselPos.y + kalashSpec.containerHeight,
      'Emission point must be at the downward-tilted rim lip'
    );
    // Initial velocity must point in the direction of the tilt and downward
    assert.ok(pour.emissionVelocity.y < 0, 'Velocity Y must be directed downward');
    assert.ok(pour.emissionVelocity.z < 0, 'Velocity Z must be directed towards Lingam (-Z)');
  });

  it('does NOT pour when vessel is empty, even when completely upside down', () => {
    const vesselPos = new THREE.Vector3(0, 0.60, 0.10);
    const vesselQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI); // Inverted 180°
    const liquidVolume = 0.0; // Completely empty

    const pour = calculatePhysicalVesselPour(kalashSpec, vesselPos, vesselQuat, liquidVolume);

    assert.equal(pour.isPouring, false, 'Empty vessel must never pour');
    assert.equal(pour.flowRate, 0);
  });

  it('redirects water emission direction when vessel is rotated sideways', () => {
    const vesselPos = new THREE.Vector3(0, 0.60, 0.10);
    // Tilted 50° to the side (around Z axis so it points towards +X)
    const vesselQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 3.6);
    const liquidVolume = 0.9;

    const pour = calculatePhysicalVesselPour(kalashSpec, vesselPos, vesselQuat, liquidVolume);

    assert.equal(pour.isPouring, true);
    // Velocity X must point rightwards (+X) because the vessel is tilted to the right!
    assert.ok(
      pour.emissionVelocity.x > 0.2,
      `Expected positive X velocity when tilting sideways to right, got ${pour.emissionVelocity.x}`
    );
  });
});
