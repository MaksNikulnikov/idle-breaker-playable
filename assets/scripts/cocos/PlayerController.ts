import {
  _decorator,
  Component,
  EventKeyboard,
  EventTouch,
  input,
  Input,
  KeyCode,
  Node,
  Quat,
  RigidBody,
  SkeletalAnimation,
  Vec2,
  Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

export const PLAYER_ATTACK_STARTED_EVENT = 'player-attack-started';
export const PLAYER_ATTACK_ENDED_EVENT = 'player-attack-ended';

const UP = new Vec3(0, 1, 0);
const MIN_INPUT_LENGTH = 0.05;

@ccclass('PlayerController')
export class PlayerController extends Component {
  @property
  public moveSpeed = 4.2;

  @property
  public rotationSpeed = 14;

  @property
  public idleClip = 'Armature.001|Armature.001|IDLE';

  @property
  public runClip = 'Armature.001|Armature.001|RUN';

  @property
  public attackClip = 'Armature.001|Armature.001|AXE';

  @property
  public attackDuration = 2.4;

  @property
  public attackSpeed = 2.4;

  @property
  public touchDeadZone = 10;

  @property
  public visualYawOffset = 180;

  @property({ type: Node })
  public visualRoot: Node | null = null;

  @property({ type: Node })
  public animationRoot: Node | null = null;

  private readonly inputVector = new Vec2();
  private readonly keyboardVector = new Vec2();
  private readonly touchStart = new Vec2();
  private readonly movement = new Vec3();
  private readonly faceView = new Vec3();
  private readonly velocity = new Vec3();
  private readonly facingRotation = new Quat();
  private readonly desiredRotation = new Quat();
  private readonly visualOffsetRotation = new Quat();

  private rigidBody: RigidBody | null = null;
  private animation: SkeletalAnimation | null = null;
  private activeClip = '';
  private touchActive = false;
  private touchDragged = false;
  private attackTimeRemaining = 0;
  private moveLeft = false;
  private moveRight = false;
  private moveForward = false;
  private moveBackward = false;

  public onLoad(): void {
    this.rigidBody = this.getComponent(RigidBody);

    const animationNode = this.animationRoot ?? this.visualRoot ?? this.node;
    this.animation =
      animationNode.getComponent(SkeletalAnimation) ?? this.getComponent(SkeletalAnimation);
  }

  public onEnable(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  public onDisable(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    this.move(0, 0, 0);
  }

  public update(deltaTime: number): void {
    if (this.attackTimeRemaining > 0) {
      this.attackTimeRemaining = Math.max(0, this.attackTimeRemaining - deltaTime);
      this.move(0, 0, deltaTime);

      if (this.attackTimeRemaining > 0) {
        return;
      }

      this.node.emit(PLAYER_ATTACK_ENDED_EVENT);
    }

    this.resolveInput();

    const hasInput = this.inputVector.lengthSqr() > MIN_INPUT_LENGTH * MIN_INPUT_LENGTH;
    if (!hasInput) {
      this.move(0, 0, deltaTime);
      this.playLocomotionAnimation(this.idleClip);
      return;
    }

    this.inputVector.normalize();
    this.move(this.inputVector.x, -this.inputVector.y, deltaTime);
    this.rotateVisual(deltaTime);
    this.playLocomotionAnimation(this.runClip);
  }

  private resolveInput(): void {
    if (this.touchActive) {
      return;
    }

    this.keyboardVector.set(
      Number(this.moveRight) - Number(this.moveLeft),
      Number(this.moveForward) - Number(this.moveBackward),
    );
    this.inputVector.set(this.keyboardVector);
  }

  private move(x: number, z: number, deltaTime: number): void {
    this.velocity.set(x * this.moveSpeed, 0, z * this.moveSpeed);

    if (this.rigidBody !== null) {
      this.rigidBody.setLinearVelocity(this.velocity);
      return;
    }

    this.movement.set(this.velocity);
    this.movement.multiplyScalar(deltaTime);
    this.node.translate(this.movement, Node.NodeSpace.WORLD);
  }

  private rotateVisual(deltaTime: number): void {
    const target = this.visualRoot ?? this.node;
    this.movement.set(this.inputVector.x, 0, -this.inputVector.y);
    this.faceView.set(-this.movement.x, 0, -this.movement.z);

    Quat.fromViewUp(this.facingRotation, this.faceView, UP);
    Quat.fromEuler(this.visualOffsetRotation, 0, this.visualYawOffset, 0);
    Quat.multiply(this.facingRotation, this.facingRotation, this.visualOffsetRotation);

    Quat.slerp(
      this.desiredRotation,
      target.worldRotation,
      this.facingRotation,
      Math.min(1, this.rotationSpeed * deltaTime),
    );
    target.setWorldRotation(this.desiredRotation);
  }

  private playLocomotionAnimation(clipName: string): void {
    if (this.attackTimeRemaining > 0) {
      return;
    }

    this.playAnimation(clipName, 0.12);
  }

  private attack(): void {
    if (this.attackTimeRemaining > 0) {
      return;
    }

    const safeAttackSpeed = Math.max(0.01, this.attackSpeed);
    this.attackTimeRemaining = this.attackDuration / safeAttackSpeed;
    this.playAnimation(this.attackClip, 0.05, true, safeAttackSpeed, true);
    this.node.emit(PLAYER_ATTACK_STARTED_EVENT, this.attackTimeRemaining);
  }

  private playAnimation(
    clipName: string,
    fadeDuration: number,
    force = false,
    speed = 1,
    rewind = false,
  ): void {
    if (this.animation === null || (!force && this.activeClip === clipName)) {
      return;
    }

    const state = this.animation.getState(clipName);
    if (!state) {
      return;
    }

    state.speed = speed;
    if (rewind) {
      state.time = 0;
    }
    this.animation.crossFade(clipName, fadeDuration);
    this.activeClip = clipName;
  }

  private onKeyDown(event: EventKeyboard): void {
    this.setKey(event.keyCode, true);
  }

  private onKeyUp(event: EventKeyboard): void {
    this.setKey(event.keyCode, false);
  }

  private setKey(keyCode: KeyCode, pressed: boolean): void {
    switch (keyCode) {
      case KeyCode.KEY_A:
      case KeyCode.ARROW_LEFT:
        this.moveLeft = pressed;
        break;
      case KeyCode.KEY_D:
      case KeyCode.ARROW_RIGHT:
        this.moveRight = pressed;
        break;
      case KeyCode.KEY_W:
      case KeyCode.ARROW_UP:
        this.moveForward = pressed;
        break;
      case KeyCode.KEY_S:
      case KeyCode.ARROW_DOWN:
        this.moveBackward = pressed;
        break;
      case KeyCode.SPACE:
      case KeyCode.ENTER:
        if (pressed) {
          this.attack();
        }
        break;
    }
  }

  private onTouchStart(event: EventTouch): void {
    this.touchActive = true;
    this.touchDragged = false;
    event.getUILocation(this.touchStart);
    this.inputVector.set(0, 0);
  }

  private onTouchMove(event: EventTouch): void {
    const location = event.getUILocation();
    this.inputVector.set(location.x - this.touchStart.x, location.y - this.touchStart.y);

    if (this.inputVector.length() < this.touchDeadZone) {
      this.inputVector.set(0, 0);
      return;
    }

    this.touchDragged = true;
  }

  private onTouchEnd(): void {
    const wasTap = this.touchActive && !this.touchDragged;
    this.touchActive = false;
    this.touchDragged = false;
    this.inputVector.set(0, 0);

    if (wasTap) {
      this.attack();
    }
  }
}
