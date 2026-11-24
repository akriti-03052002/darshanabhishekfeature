// src/logic/physicsEngine.ts

/**
 * Very lightweight physics helper that re‑uses the existing collision logic
 * from `collisionPhysics.ts`. It does **not** depend on an external physics
 * library (e.g., Rapier) because the sandbox cannot download additional
 * native binaries. The engine simply resolves hand and object positions each
 * frame using the helper functions.
 */
import { resolveHandCollision, resolveObjectSupportY, DEFAULT_CHOWKI_BOUNDS, DEFAULT_SHIVA_COLLIDER } from "./collisionPhysics";
import type { Vec3, StaticPropCircle } from "./collisionPhysics";

export class PhysicsEngine {
  private staticProps: StaticPropCircle[] = [];
  private hasLingam: boolean = true;

  constructor(staticProps: StaticPropCircle[], hasLingam: boolean = true) {
    this.staticProps = staticProps;
    this.hasLingam = hasLingam;
  }

  /**
   * Resolve the virtual hand position against the scene geometry.
   * `desired` is the raw world position calculated from hand tracking.
   */
  resolveHand(desired: Vec3, handRadius: number, heldRadius: number, heldHeight: number, heldId: string | null): Vec3 {
    return resolveHandCollision(
      desired,
      handRadius,
      heldRadius,
      heldHeight,
      this.hasLingam,
      this.staticProps,
      heldId,
      undefined,
      DEFAULT_SHIVA_COLLIDER
    );
  }

  /** Resolve Y‑position (height) for a placed prop so it rests on the floor/chowki/etc. */
  resolveSupportY(x: number, z: number, propId: string, bhogPlate: StaticPropCircle | null): number {
    return resolveObjectSupportY(
      x,
      z,
      propId,
      this.hasLingam,
      bhogPlate,
      DEFAULT_CHOWKI_BOUNDS,
      DEFAULT_SHIVA_COLLIDER
    );
  }
}
