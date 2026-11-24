import * as THREE from 'three';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ChowkiBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
  floorY: number;
}

export interface LingamCollider {
  x: number;
  z: number;
  jalahariRadius: number;
  jalahariTopY: number;
  lingamRadius: number;
  lingamTopY: number;
}

export interface StaticPropCircle {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
}

export const DEFAULT_CHOWKI_BOUNDS: ChowkiBounds = {
  minX: -0.88,
  maxX: 0.88,
  minZ: -0.34,
  maxZ: 0.68,
  topY: 0.0,
  floorY: -0.34
};

export const DEFAULT_SHIVA_COLLIDER: LingamCollider = {
  x: 0,
  z: -0.05,
  jalahariRadius: 0.34,
  jalahariTopY: 0.165,
  lingamRadius: 0.145,
  lingamTopY: 0.54
};

// ============================================================================
// 3D COLLIDERS & RIGID BODY ENGINE
// ============================================================================

export type ColliderType = 'box' | 'sphere' | 'cylinder' | 'compound';

export abstract class Collider3D {
  abstract readonly type: ColliderType;
  abstract getBoundingRadius(): number;
}

export class BoxCollider extends Collider3D {
  readonly type = 'box';
  readonly halfExtents: THREE.Vector3;

  constructor(halfExtents: THREE.Vector3) {
    super();
    this.halfExtents = halfExtents.clone();
  }

  getBoundingRadius(): number {
    return this.halfExtents.length();
  }
}

export class SphereCollider extends Collider3D {
  readonly type = 'sphere';
  readonly radius: number;

  constructor(radius: number) {
    super();
    this.radius = radius;
  }

  getBoundingRadius(): number {
    return this.radius;
  }
}

export class CylinderCollider extends Collider3D {
  readonly type = 'cylinder';
  readonly radius: number;
  readonly height: number;
  readonly halfHeight: number;

  constructor(radius: number, height: number) {
    super();
    this.radius = radius;
    this.height = height;
    this.halfHeight = height * 0.5;
  }

  getBoundingRadius(): number {
    return Math.hypot(this.radius, this.halfHeight);
  }
}

export interface CompoundPart {
  collider: Collider3D;
  offset: THREE.Vector3;
}

export class CompoundCollider extends Collider3D {
  readonly type = 'compound';
  readonly parts: CompoundPart[];

  constructor(parts: CompoundPart[]) {
    super();
    this.parts = parts.map((p) => ({
      collider: p.collider,
      offset: p.offset.clone()
    }));
  }

  getBoundingRadius(): number {
    let maxR = 0;
    for (const p of this.parts) {
      maxR = Math.max(maxR, p.offset.length() + p.collider.getBoundingRadius());
    }
    return maxR;
  }
}

export interface RigidBody3DOptions {
  id: string;
  position?: THREE.Vector3;
  quaternion?: THREE.Quaternion;
  velocity?: THREE.Vector3;
  angularVelocity?: THREE.Vector3;
  mass?: number;
  collider: Collider3D;
  restitution?: number;
  friction?: number;
  isKinematic?: boolean;
  linearDamping?: number;
  angularDamping?: number;
}

export class RigidBody3D {
  readonly id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  mass: number;
  invMass: number;
  collider: Collider3D;
  restitution: number;
  friction: number;
  isKinematic: boolean;
  linearDamping: number;
  angularDamping: number;
  isGrounded: boolean = false;

  constructor(opts: RigidBody3DOptions) {
    this.id = opts.id;
    this.position = (opts.position ?? new THREE.Vector3()).clone();
    this.quaternion = (opts.quaternion ?? new THREE.Quaternion()).clone();
    this.velocity = (opts.velocity ?? new THREE.Vector3()).clone();
    this.angularVelocity = (opts.angularVelocity ?? new THREE.Vector3()).clone();
    this.mass = opts.mass ?? 1.0;
    this.isKinematic = opts.isKinematic ?? false;
    this.invMass = this.isKinematic || this.mass <= 0 ? 0 : 1 / this.mass;
    this.collider = opts.collider;
    this.restitution = opts.restitution ?? 0.15;
    this.friction = opts.friction ?? 0.45;
    this.linearDamping = opts.linearDamping ?? 0.98;
    this.angularDamping = opts.angularDamping ?? 0.92;
  }

  setKinematic(kinematic: boolean) {
    this.isKinematic = kinematic;
    this.invMass = kinematic || this.mass <= 0 ? 0 : 1 / this.mass;
    if (kinematic) {
      this.velocity.set(0, 0, 0);
      this.angularVelocity.set(0, 0, 0);
    }
  }

  applyImpulse(impulse: THREE.Vector3) {
    if (this.isKinematic) return;
    this.velocity.addScaledVector(impulse, this.invMass);
  }
}

export interface ContactManifold {
  normal: THREE.Vector3; // Points from body A to body B
  penetration: number;
  contactPoint: THREE.Vector3;
}

export interface StaticBodyDef {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  collider: Collider3D;
}

export class PhysicsWorld {
  gravity: THREE.Vector3 = new THREE.Vector3(0, -9.81, 0);
  readonly staticBodies = new Map<string, StaticBodyDef>();
  readonly dynamicBodies = new Map<string, RigidBody3D>();

  addStaticBody(id: string, position: THREE.Vector3, collider: Collider3D, quaternion?: THREE.Quaternion) {
    this.staticBodies.set(id, {
      id,
      position: position.clone(),
      quaternion: (quaternion ?? new THREE.Quaternion()).clone(),
      collider
    });
  }

  addDynamicBody(body: RigidBody3D) {
    this.dynamicBodies.set(body.id, body);
  }

  removeBody(id: string) {
    this.staticBodies.delete(id);
    this.dynamicBodies.delete(id);
  }

  getBody(id: string): RigidBody3D | undefined {
    return this.dynamicBodies.get(id);
  }

  /**
   * Resolves a kinematic movement request (e.g. from user hand/mouse drag)
   * so that the held solid body is physically blocked by static obstacles
   * (Shiva Lingam, Yoni base, Chowki table, Naga canopy, floor).
   */
  resolveKinematicMove(body: RigidBody3D, desiredPos: THREE.Vector3): THREE.Vector3 {
    const resolved = desiredPos.clone();
    const radius = body.collider.getBoundingRadius();

    // 1. Check against all static obstacles
    for (const [, sb] of this.staticBodies) {
      if (sb.collider.type === 'cylinder') {
        const cyl = sb.collider as CylinderCollider;
        const dx = resolved.x - sb.position.x;
        const dz = resolved.z - sb.position.z;
        const horizDist = Math.hypot(dx, dz);
        const minY = sb.position.y - cyl.halfHeight;
        const maxY = sb.position.y + cyl.halfHeight;

        // If within vertical cylinder slab
        if (resolved.y + radius >= minY && resolved.y - radius <= maxY) {
          const minD = cyl.radius + radius;
          if (horizDist < minD) {
            const nx = horizDist > 1e-4 ? dx / horizDist : 1;
            const nz = horizDist > 1e-4 ? dz / horizDist : 0;
            resolved.x = sb.position.x + nx * minD;
            resolved.z = sb.position.z + nz * minD;
          }
        }
      } else if (sb.collider.type === 'box') {
        const box = sb.collider as BoxCollider;
        const minX = sb.position.x - box.halfExtents.x;
        const maxX = sb.position.x + box.halfExtents.x;
        const minY = sb.position.y - box.halfExtents.y;
        const maxY = sb.position.y + box.halfExtents.y;
        const minZ = sb.position.z - box.halfExtents.z;
        const maxZ = sb.position.z + box.halfExtents.z;

        // Table surface support: don't allow dipping below the solid tabletop
        if (resolved.x >= minX - radius && resolved.x <= maxX + radius &&
            resolved.z >= minZ - radius && resolved.z <= maxZ + radius) {
          if (resolved.y - radius < maxY && resolved.y + radius > minY) {
            resolved.y = Math.max(resolved.y, maxY + radius);
          }
        }
      } else if (sb.collider.type === 'sphere') {
        const sph = sb.collider as SphereCollider;
        const delta = resolved.clone().sub(sb.position);
        const dist = delta.length();
        const minD = sph.radius + radius;
        if (dist < minD) {
          const norm = dist > 1e-4 ? delta.normalize() : new THREE.Vector3(0, 1, 0);
          resolved.copy(sb.position).addScaledVector(norm, minD);
        }
      }
    }

    return resolved;
  }

  /**
   * Advances the physics world by dt seconds using fixed substeps.
   */
  step(dt: number) {
    const clampedDt = Math.min(dt, 0.05);
    const subSteps = 3;
    const subDt = clampedDt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this.singleSubStep(subDt);
    }
  }

  private singleSubStep(dt: number) {
    // 1. Integrate forces and velocities for dynamic bodies
    for (const [, body] of this.dynamicBodies) {
      if (body.isKinematic) continue;

      // Gravity
      body.velocity.addScaledVector(this.gravity, dt);

      // Damping
      body.velocity.multiplyScalar(Math.pow(body.linearDamping, dt * 60));
      body.angularVelocity.multiplyScalar(Math.pow(body.angularDamping, dt * 60));

      // Tentative position integration
      body.position.addScaledVector(body.velocity, dt);

      // Integrate orientation via angular velocity
      if (body.angularVelocity.lengthSq() > 1e-5) {
        const angLen = body.angularVelocity.length();
        const angAxis = body.angularVelocity.clone().divideScalar(angLen);
        const rotQ = new THREE.Quaternion().setFromAxisAngle(angAxis, angLen * dt);
        body.quaternion.premultiply(rotQ).normalize();
      }

      body.isGrounded = false;
    }

    // 2. Resolve Dynamic vs Static Collisions
    for (const [, dynBody] of this.dynamicBodies) {
      if (dynBody.isKinematic) continue;

      for (const [, staticBody] of this.staticBodies) {
        const contact = this.testCollision(
          dynBody.position,
          dynBody.quaternion,
          dynBody.collider,
          staticBody.position,
          staticBody.quaternion,
          staticBody.collider
        );

        if (contact && contact.penetration > 0) {
          // Positional projection (resolve overlap)
          dynBody.position.addScaledVector(contact.normal, contact.penetration);

          // Velocity impulse along contact normal
          const vDotN = dynBody.velocity.dot(contact.normal);
          if (vDotN < 0) {
            const restitution = dynBody.restitution;
            const impulseMag = -(1 + restitution) * vDotN;
            dynBody.velocity.addScaledVector(contact.normal, impulseMag);

            // Friction impulse along tangent
            const vTangent = dynBody.velocity.clone().sub(contact.normal.clone().multiplyScalar(dynBody.velocity.dot(contact.normal)));
            const tanLen = vTangent.length();
            if (tanLen > 1e-4) {
              const maxFriction = impulseMag * dynBody.friction;
              const frictionF = Math.min(tanLen, maxFriction);
              dynBody.velocity.sub(vTangent.normalize().multiplyScalar(frictionF));
            }

            // Flag as grounded if contact normal points upwards
            if (contact.normal.y > 0.6) {
              dynBody.isGrounded = true;
            }
          }
        }
      }
    }

    // 3. Resolve Dynamic vs Dynamic Collisions
    const dynList = Array.from(this.dynamicBodies.values());
    for (let i = 0; i < dynList.length; i++) {
      for (let j = i + 1; j < dynList.length; j++) {
        const a = dynList[i];
        const b = dynList[j];
        if (a.isKinematic && b.isKinematic) continue;

        const contact = this.testCollision(
          a.position,
          a.quaternion,
          a.collider,
          b.position,
          b.quaternion,
          b.collider
        );

        if (contact && contact.penetration > 0) {
          const totalInvMass = a.invMass + b.invMass;
          if (totalInvMass <= 0) continue;

          // Push apart proportional to inverse mass
          if (!a.isKinematic) a.position.addScaledVector(contact.normal, -contact.penetration * (a.invMass / totalInvMass));
          if (!b.isKinematic) b.position.addScaledVector(contact.normal, contact.penetration * (b.invMass / totalInvMass));

          // Relative velocity
          const vRel = b.velocity.clone().sub(a.velocity);
          const vDotN = vRel.dot(contact.normal);
          if (vDotN < 0) {
            const e = Math.min(a.restitution, b.restitution);
            const jMag = -(1 + e) * vDotN / totalInvMass;
            const imp = contact.normal.clone().multiplyScalar(jMag);
            if (!a.isKinematic) a.velocity.sub(imp.clone().multiplyScalar(a.invMass));
            if (!b.isKinematic) b.velocity.add(imp.clone().multiplyScalar(b.invMass));
          }
        }
      }
    }
  }

  private testCollision(
    posA: THREE.Vector3,
    quatA: THREE.Quaternion,
    colA: Collider3D,
    posB: THREE.Vector3,
    quatB: THREE.Quaternion,
    colB: Collider3D
  ): ContactManifold | null {
    // 1. Sphere vs Sphere
    if (colA.type === 'sphere' && colB.type === 'sphere') {
      const sA = colA as SphereCollider;
      const sB = colB as SphereCollider;
      const delta = posA.clone().sub(posB);
      const dist = delta.length();
      const minD = sA.radius + sB.radius;
      if (dist < minD) {
        const normal = dist > 1e-4 ? delta.normalize() : new THREE.Vector3(0, 1, 0);
        return {
          normal,
          penetration: minD - dist,
          contactPoint: posB.clone().addScaledVector(normal, sB.radius)
        };
      }
      return null;
    }

    // 2. Sphere (A) vs Box (B)
    if (colA.type === 'sphere' && colB.type === 'box') {
      const sph = colA as SphereCollider;
      const box = colB as BoxCollider;

      // Transform sphere position to box local space
      const invB = quatB.clone().invert();
      const localSphPos = posA.clone().sub(posB).applyQuaternion(invB);

      // Clamp to box extents
      const closestLocal = new THREE.Vector3(
        Math.max(-box.halfExtents.x, Math.min(box.halfExtents.x, localSphPos.x)),
        Math.max(-box.halfExtents.y, Math.min(box.halfExtents.y, localSphPos.y)),
        Math.max(-box.halfExtents.z, Math.min(box.halfExtents.z, localSphPos.z))
      );

      const deltaLocal = localSphPos.clone().sub(closestLocal);
      const distSq = deltaLocal.lengthSq();

      if (distSq < sph.radius * sph.radius) {
        const dist = Math.sqrt(distSq);
        let normalLocal: THREE.Vector3;
        let pen: number;

        if (dist > 1e-4) {
          normalLocal = deltaLocal.clone().divideScalar(dist);
          pen = sph.radius - dist;
        } else {
          // Center inside box: push out along nearest face
          const dx = box.halfExtents.x - Math.abs(localSphPos.x);
          const dy = box.halfExtents.y - Math.abs(localSphPos.y);
          const dz = box.halfExtents.z - Math.abs(localSphPos.z);
          if (dy <= dx && dy <= dz) {
            normalLocal = new THREE.Vector3(0, localSphPos.y >= 0 ? 1 : -1, 0);
            pen = sph.radius + dy;
          } else if (dx <= dz) {
            normalLocal = new THREE.Vector3(localSphPos.x >= 0 ? 1 : -1, 0, 0);
            pen = sph.radius + dx;
          } else {
            normalLocal = new THREE.Vector3(0, 0, localSphPos.z >= 0 ? 1 : -1);
            pen = sph.radius + dz;
          }
        }

        const worldNormal = normalLocal.applyQuaternion(quatB).normalize();
        const worldClosest = closestLocal.applyQuaternion(quatB).add(posB);
        return {
          normal: worldNormal,
          penetration: pen,
          contactPoint: worldClosest
        };
      }
      return null;
    }

    // 3. Sphere (A) vs Cylinder (B)
    if (colA.type === 'sphere' && colB.type === 'cylinder') {
      const sph = colA as SphereCollider;
      const cyl = colB as CylinderCollider;

      const dx = posA.x - posB.x;
      const dz = posA.z - posB.z;
      const horizDist = Math.hypot(dx, dz);
      const minY = posB.y - cyl.halfHeight;
      const maxY = posB.y + cyl.halfHeight;

      // Within vertical cylinder bounds
      if (posA.y + sph.radius >= minY && posA.y - sph.radius <= maxY) {
        const minD = cyl.radius + sph.radius;
        if (horizDist < minD) {
          const horizNorm = horizDist > 1e-4
            ? new THREE.Vector3(dx / horizDist, 0, dz / horizDist)
            : new THREE.Vector3(1, 0, 0);

          return {
            normal: horizNorm,
            penetration: minD - horizDist,
            contactPoint: new THREE.Vector3(posB.x + horizNorm.x * cyl.radius, posA.y, posB.z + horizNorm.z * cyl.radius)
          };
        }
      }
      return null;
    }

    // 4. Compound Colliders recursion
    if (colA.type === 'compound') {
      const comp = colA as CompoundCollider;
      for (const part of comp.parts) {
        const partPos = posA.clone().add(part.offset.clone().applyQuaternion(quatA));
        const res = this.testCollision(partPos, quatA, part.collider, posB, quatB, colB);
        if (res) return res;
      }
      return null;
    }
    if (colB.type === 'compound') {
      const comp = colB as CompoundCollider;
      for (const part of comp.parts) {
        const partPos = posB.clone().add(part.offset.clone().applyQuaternion(quatB));
        const res = this.testCollision(posA, quatA, colA, partPos, quatB, part.collider);
        if (res) return res;
      }
      return null;
    }

    return null;
  }
}

// ============================================================================
// COMPATIBILITY HELPERS FOR UI & GESTURE SYSTEM
// ============================================================================

export interface MappedCameraHand {
  detected: boolean;
  handedness: 'Left' | 'Right';
  worldPos: Vec3;
  gripStrength: number;
  isPinching: boolean;
  isOpenPalm: boolean;
  wristRollRad: number;
  fingerCurls: {
    thumb: number;
    index: number;
    middle: number;
    ring: number;
    pinky: number;
  };
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export function isInsideChowki(x: number, z: number, bounds = DEFAULT_CHOWKI_BOUNDS): boolean {
  return x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
}

export function resolveHandCollision(
  desired: Vec3,
  handRadius: number,
  heldRadius: number,
  heldHeight: number,
  hasLingam: boolean,
  staticProps: StaticPropCircle[],
  heldId: string | null,
  bounds = DEFAULT_CHOWKI_BOUNDS,
  lingam = DEFAULT_SHIVA_COLLIDER
): Vec3 {
  let x = Math.max(-0.92, Math.min(0.92, desired.x));
  let y = desired.y;
  let z = Math.max(-0.26, Math.min(0.86, desired.z));

  const effectiveRadius = Math.max(handRadius, heldRadius);

  const overTable = isInsideChowki(x, z, bounds);
  const surfaceY = overTable ? bounds.topY + 0.006 : bounds.floorY;
  const minCenterY = surfaceY + Math.max(0.044, heldId ? 0.012 : 0.044);
  if (y < minCenterY) {
    y = minCenterY;
  }

  if (hasLingam) {
    const dx = x - lingam.x;
    const dz = z - lingam.z;
    const horizDist = Math.hypot(dx, dz);

    const clearanceCrownY = lingam.lingamTopY + (heldId ? 0.035 : 0.02);
    if (y < clearanceCrownY) {
      const minRad = lingam.lingamRadius + effectiveRadius + 0.018;
      if (horizDist < minRad) {
        const nx = horizDist > 1e-4 ? dx / horizDist : 0.7;
        const nz = horizDist > 1e-4 ? dz / horizDist : 0.7;
        x = lingam.x + nx * minRad;
        z = lingam.z + nz * minRad;
      }
    }

    if (y < lingam.jalahariTopY + 0.025) {
      const minJalaRad = lingam.jalahariRadius + (heldId ? effectiveRadius * 0.75 : handRadius);
      const jDist = Math.hypot(x - lingam.x, z - lingam.z);
      if (jDist < minJalaRad) {
        if (desired.y >= lingam.jalahariTopY - 0.02) {
          y = Math.max(y, lingam.jalahariTopY + 0.03);
        } else {
          const nx = jDist > 1e-4 ? (x - lingam.x) / jDist : 0.7;
          const nz = jDist > 1e-4 ? (z - lingam.z) / jDist : 0.7;
          x = lingam.x + nx * minJalaRad;
          z = lingam.z + nz * minJalaRad;
        }
      }
    }
  }

  if (heldId && y < 0.16 + heldHeight * 0.25) {
    for (let i = 0; i < staticProps.length; i++) {
      const p = staticProps[i];
      if (p.id === heldId) continue;
      if (y > p.y + p.height + 0.02) continue;
      const dx = x - p.x;
      const dz = z - p.z;
      const dist = Math.hypot(dx, dz);
      const minSep = heldRadius + p.radius + 0.012;
      if (dist < minSep) {
        const nx = dist > 1e-4 ? dx / dist : 1;
        const nz = dist > 1e-4 ? dz / dist : 0;
        x = p.x + nx * minSep;
        z = p.z + nz * minSep;
      }
    }
  }

  return { x, y, z };
}

export function resolveObjectSupportY(
  x: number,
  z: number,
  propId: string,
  hasLingam: boolean,
  bhogPlate: StaticPropCircle | null,
  bounds = DEFAULT_CHOWKI_BOUNDS,
  lingam = DEFAULT_SHIVA_COLLIDER
): number {
  if (
    bhogPlate &&
    propId !== bhogPlate.id &&
    (propId.startsWith('bhog-item-') || propId.startsWith('krishna-item-'))
  ) {
    const distPlate = Math.hypot(x - bhogPlate.x, z - bhogPlate.z);
    if (distPlate <= bhogPlate.radius * 0.94) {
      return bhogPlate.y + 0.015;
    }
  }

  if (hasLingam) {
    const distLingam = Math.hypot(x - lingam.x, z - lingam.z);
    if (distLingam < lingam.lingamRadius * 0.88 && (propId === 'bilva-patra' || propId.includes('patra'))) {
      return lingam.lingamTopY + 0.002;
    }
    if (distLingam <= lingam.jalahariRadius && distLingam >= lingam.lingamRadius * 0.95) {
      return lingam.jalahariTopY + 0.004;
    }
  }

  if (isInsideChowki(x, z, bounds)) {
    const onRunner = Math.abs(x) <= 0.74 && z >= 0.14 && z <= 0.68;
    return bounds.topY + (onRunner ? 0.009 : 0.002);
  }

  return bounds.floorY;
}

export function resolvePropSeparation(
  x: number,
  z: number,
  movingId: string,
  movingRadius: number,
  staticProps: StaticPropCircle[],
  hasLingam: boolean,
  lingam = DEFAULT_SHIVA_COLLIDER
): { x: number; z: number } {
  let outX = x;
  let outZ = z;

  if (hasLingam && movingId !== 'bilva-patra' && movingId !== 'pushpa-shiva') {
    const dx = outX - lingam.x;
    const dz = outZ - lingam.z;
    const d = Math.hypot(dx, dz);
    const minD = lingam.jalahariRadius + movingRadius + 0.012;
    if (d < minD) {
      const nx = d > 1e-4 ? dx / d : 0;
      const nz = d > 1e-4 ? dz / d : 1;
      outX = lingam.x + nx * minD;
      outZ = lingam.z + nz * minD;
    }
  }

  for (let i = 0; i < staticProps.length; i++) {
    const p = staticProps[i];
    if (p.id === movingId) continue;
    if (movingId.startsWith('bhog-item-') && p.id === 'bhog-shiva') continue;
    if (p.id.startsWith('bhog-item-') && movingId === 'bhog-shiva') continue;
    if (movingId.startsWith('krishna-item-') && p.id === 'makhan-bowl') continue;
    if (p.id.startsWith('krishna-item-') && movingId === 'makhan-bowl') continue;

    const dx = outX - p.x;
    const dz = outZ - p.z;
    const dist = Math.hypot(dx, dz);
    const minSep = movingRadius + p.radius + 0.01;
    if (dist < minSep) {
      const nx = dist > 1e-4 ? dx / dist : 1;
      const nz = dist > 1e-4 ? dz / dist : 0;
      outX = p.x + nx * minSep;
      outZ = p.z + nz * minSep;
    }
  }

  return { x: outX, z: outZ };
}

export const HAND_LANDMARK_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export interface HandCalibrationSummary {
  ready: boolean;
  detectedSides: Array<'Left' | 'Right'>;
  primaryPose: 'pinch' | 'open' | 'relaxed' | 'none';
  tiltDegrees: number;
}

export function computeHandCalibrationSummary(
  right: MappedCameraHand | null,
  left: MappedCameraHand | null
): HandCalibrationSummary {
  const detectedSides: Array<'Left' | 'Right'> = [];
  if (left?.detected) detectedSides.push('Left');
  if (right?.detected) detectedSides.push('Right');
  const primary = right?.detected ? right : left?.detected ? left : null;
  if (!primary) {
    return { ready: false, detectedSides, primaryPose: 'none', tiltDegrees: 0 };
  }
  const primaryPose = primary.isPinching
    ? 'pinch'
    : primary.isOpenPalm
    ? 'open'
    : 'relaxed';
  return {
    ready: true,
    detectedSides,
    primaryPose,
    tiltDegrees: Math.round((primary.wristRollRad * 180) / Math.PI)
  };
}

export function mapLandmarksToHandState(
  landmarks: NormalizedLandmark[],
  handedness: 'Left' | 'Right'
): MappedCameraHand {
  if (landmarks.length < 21) {
    return {
      detected: false,
      handedness,
      worldPos: { x: 0.35, y: 0.22, z: 0.45 },
      gripStrength: 0,
      isPinching: false,
      isOpenPalm: true,
      wristRollRad: 0,
      fingerCurls: { thumb: 0.1, index: 0.1, middle: 0.1, ring: 0.1, pinky: 0.1 }
    };
  }

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];

  const palmScale = Math.max(
    0.05,
    Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y, middleMcp.z - wrist.z)
  );

  const palmCenterX = 1 - (wrist.x * 0.45 + middleMcp.x * 0.55);
  const palmCenterY = wrist.y * 0.45 + middleMcp.y * 0.55;

  const worldX = Math.max(-0.78, Math.min(0.78, (palmCenterX - 0.5) * 1.65));
  const worldY = Math.max(0.06, Math.min(0.76, (0.85 - palmCenterY) * 0.92));
  const depthNorm = Math.max(0, Math.min(1, (palmScale - 0.1) / 0.2));
  const worldZ = Math.max(-0.08, Math.min(0.58, 0.52 - depthNorm * 0.56));

  const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y, thumbTip.z - indexTip.z);
  const isPinching = pinchDist < 0.08;

  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const wristRollRad = Math.atan2(dx, -dy);

  return {
    detected: true,
    handedness,
    worldPos: { x: worldX, y: worldY, z: worldZ },
    gripStrength: isPinching ? 0.95 : 0.2,
    isPinching,
    isOpenPalm: !isPinching,
    wristRollRad,
    fingerCurls: { thumb: 0.2, index: isPinching ? 0.8 : 0.2, middle: 0.2, ring: 0.2, pinky: 0.2 }
  };
}
