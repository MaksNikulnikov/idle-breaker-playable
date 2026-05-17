import { _decorator, Component, Node, Vec3 } from 'cc';

const { ccclass, disallowMultiple, property } = _decorator;

const MIN_SMOOTH_TIME = 0.001;

@ccclass('CameraFollow')
@disallowMultiple
export class CameraFollow extends Component {
  @property({ type: Node })
  public target: Node | null = null;

  @property
  public offset = new Vec3(0, 11.5, 7.8);

  @property
  public useInitialOffset = false;

  @property
  public deadZoneRadius = 0.45;

  @property
  public smoothTime = 0.26;

  @property
  public maxSpeed = 28;

  private readonly focus = new Vec3();
  private readonly desiredFocus = new Vec3();
  private readonly velocity = new Vec3();
  private readonly targetPosition = new Vec3();
  private readonly cameraPosition = new Vec3();

  public onLoad(): void {
    this.resetFollowState();
  }

  public lateUpdate(deltaTime: number): void {
    if (this.target === null) {
      return;
    }

    this.target.getWorldPosition(this.targetPosition);
    this.updateDesiredFocus();

    this.focus.x = this.smoothDamp(this.focus.x, this.desiredFocus.x, 'x', deltaTime);
    this.focus.z = this.smoothDamp(this.focus.z, this.desiredFocus.z, 'z', deltaTime);
    this.applyCameraPosition();
  }

  public resetFollowState(): void {
    if (this.target === null) {
      return;
    }

    this.target.getWorldPosition(this.targetPosition);
    this.focus.set(this.targetPosition);
    this.desiredFocus.set(this.targetPosition);
    this.velocity.set(0, 0, 0);

    if (this.useInitialOffset) {
      this.node.getWorldPosition(this.cameraPosition);
      Vec3.subtract(this.offset, this.cameraPosition, this.focus);
    }

    this.applyCameraPosition();
  }

  private updateDesiredFocus(): void {
    const deadZone = Math.max(0, this.deadZoneRadius);
    const deltaX = this.targetPosition.x - this.focus.x;
    const deltaZ = this.targetPosition.z - this.focus.z;
    const distance = Math.hypot(deltaX, deltaZ);

    this.desiredFocus.set(this.focus);

    if (distance <= deadZone || distance <= 0.0001) {
      return;
    }

    const edgeScale = deadZone / distance;
    this.desiredFocus.x = this.targetPosition.x - deltaX * edgeScale;
    this.desiredFocus.z = this.targetPosition.z - deltaZ * edgeScale;
  }

  private applyCameraPosition(): void {
    this.cameraPosition.set(
      this.focus.x + this.offset.x,
      this.focus.y + this.offset.y,
      this.focus.z + this.offset.z,
    );
    this.node.setWorldPosition(this.cameraPosition);
  }

  private smoothDamp(current: number, target: number, axis: 'x' | 'z', deltaTime: number): number {
    if (deltaTime <= 0) {
      return current;
    }

    const smoothTime = Math.max(MIN_SMOOTH_TIME, this.smoothTime);
    const omega = 2 / smoothTime;
    const delta = omega * deltaTime;
    const exponential = 1 / (1 + delta + 0.48 * delta * delta + 0.235 * delta * delta * delta);
    const maxChange = Math.max(0, this.maxSpeed) * smoothTime;
    const currentVelocity = this.velocity[axis];
    const originalTarget = target;

    let change = current - target;
    change = Math.min(Math.max(change, -maxChange), maxChange);
    target = current - change;

    const temp = (currentVelocity + omega * change) * deltaTime;
    let nextVelocity = (currentVelocity - omega * temp) * exponential;
    let output = target + (change + temp) * exponential;
    const targetIsAhead = originalTarget - current > 0;
    const outputPassedTarget = output > originalTarget;

    if (targetIsAhead === outputPassedTarget) {
      output = originalTarget;
      nextVelocity = 0;
    }

    this.velocity[axis] = nextVelocity;

    return output;
  }
}
