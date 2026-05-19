import { Node, Quat, RigidBody, Vec3 } from 'cc';

import type { PlayerLocomotionPlan } from '../application';

const UP = new Vec3(0, 1, 0);

export class PlayerMovementView {
  private node: Node | null = null;
  private visualRoot: Node | null = null;
  private rigidBody: RigidBody | null = null;
  private readonly movement = new Vec3();
  private readonly faceView = new Vec3();
  private readonly velocity = new Vec3();
  private readonly facingRotation = new Quat();
  private readonly desiredRotation = new Quat();
  private readonly visualOffsetRotation = new Quat();

  public bind(node: Node, rigidBody: RigidBody | null, visualRoot: Node | null): void {
    this.node = node;
    this.rigidBody = rigidBody;
    this.visualRoot = visualRoot ?? node;
  }

  public applyVelocity(velocityX: number, velocityZ: number, deltaTime: number): void {
    this.velocity.set(velocityX, 0, velocityZ);

    if (this.rigidBody !== null) {
      this.rigidBody.setLinearVelocity(this.velocity);
      return;
    }

    if (this.node === null) {
      return;
    }

    this.movement.set(this.velocity);
    this.movement.multiplyScalar(deltaTime);
    this.node.translate(this.movement, Node.NodeSpace.WORLD);
  }

  public rotateVisual(
    locomotion: PlayerLocomotionPlan,
    visualYawOffset: number,
    rotationSpeed: number,
    deltaTime: number,
  ): void {
    const target = this.visualRoot;

    if (target === null) {
      return;
    }

    this.faceView.set(locomotion.facingX, 0, locomotion.facingZ);

    Quat.fromViewUp(this.facingRotation, this.faceView, UP);
    Quat.fromEuler(this.visualOffsetRotation, 0, visualYawOffset, 0);
    Quat.multiply(this.facingRotation, this.facingRotation, this.visualOffsetRotation);
    Quat.slerp(
      this.desiredRotation,
      target.worldRotation,
      this.facingRotation,
      Math.min(1, rotationSpeed * deltaTime),
    );
    target.setWorldRotation(this.desiredRotation);
  }
}
