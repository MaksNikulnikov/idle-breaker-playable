import {
  _decorator,
  Component,
  director,
  EventKeyboard,
  EventMouse,
  EventTouch,
  game,
  Game,
  input,
  Input,
  KeyCode,
  Node,
  Quat,
  RigidBody,
  SkeletalAnimation,
  sys,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';

const { ccclass, disallowMultiple, property, requireComponent } = _decorator;

export const PLAYER_ATTACK_STARTED_EVENT = 'player-attack-started';
export const PLAYER_ATTACK_ENDED_EVENT = 'player-attack-ended';

const UP = new Vec3(0, 1, 0);
const MIN_INPUT_LENGTH = 0.05;
const JOYSTICK_MAX_DISTANCE = 58;
const MOUSE_CLICK_DRAG_THRESHOLD = 8;

@ccclass('PlayerController')
@disallowMultiple
@requireComponent(RigidBody)
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
  public attackLockDuration = 1;

  @property
  public touchDeadZone = 10;

  @property
  public visualYawOffset = 180;

  @property({ type: Node })
  public visualRoot: Node | null = null;

  @property({ type: Node })
  public animationRoot: Node | null = null;

  @property
  public touchJoystickOnDesktop = false;

  private readonly inputVector = new Vec2();
  private readonly keyboardVector = new Vec2();
  private readonly mouseStart = new Vec2();
  private readonly mouseLocation = new Vec2();
  private readonly touchStart = new Vec2();
  private readonly movement = new Vec3();
  private readonly faceView = new Vec3();
  private readonly velocity = new Vec3();
  private readonly facingRotation = new Quat();
  private readonly desiredRotation = new Quat();
  private readonly visualOffsetRotation = new Quat();
  private readonly joystickLocalPosition = new Vec3();
  private readonly joystickHandlePosition = new Vec3();

  private rigidBody: RigidBody | null = null;
  private animation: SkeletalAnimation | null = null;
  private inputSurface: Node | null = null;
  private joystickRoot: Node | null = null;
  private joystickHandle: Node | null = null;
  private activeClip = '';
  private activeTouchId: number | null = null;
  private touchActive = false;
  private touchDragged = false;
  private mousePressed = false;
  private mouseDragged = false;
  private attackTimeRemaining = 0;
  private moveLeft = false;
  private moveRight = false;
  private moveForward = false;
  private moveBackward = false;
  private browserPointerReleaseTimer = 0;
  private browserSafetyHooksBound = false;

  private readonly resetInputOnBrowserBlur = (): void => {
    this.resetInputState();
  };

  private readonly deferPointerReleaseReset = (): void => {
    if (this.browserPointerReleaseTimer !== 0) {
      return;
    }

    this.browserPointerReleaseTimer = window.setTimeout(() => {
      this.browserPointerReleaseTimer = 0;
      this.resetPointerInput();
      this.resetMouseInput();
    }, 0);
  };

  public onLoad(): void {
    this.rigidBody = this.getComponent(RigidBody);

    const animationNode = this.animationRoot ?? this.visualRoot ?? this.node;
    this.animation =
      animationNode.getComponent(SkeletalAnimation) ?? this.getComponent(SkeletalAnimation);
    this.resolveJoystickReferences();
  }

  public onEnable(): void {
    this.resolveJoystickReferences();
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    game.on(Game.EVENT_HIDE, this.resetInputState, this);
    game.on(Game.EVENT_SHOW, this.resetInputState, this);
    this.inputSurface?.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    this.bindBrowserSafetyHooks();
  }

  public onDisable(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    game.off(Game.EVENT_HIDE, this.resetInputState, this);
    game.off(Game.EVENT_SHOW, this.resetInputState, this);
    this.inputSurface?.off(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    this.unbindBrowserSafetyHooks();
    this.resetInputState();
  }

  public update(deltaTime: number): void {
    this.releaseStaleTouch();

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

  public hasActiveGameplayInput(): boolean {
    return (
      this.attackTimeRemaining > 0 ||
      this.touchActive ||
      this.mousePressed ||
      this.moveLeft ||
      this.moveRight ||
      this.moveForward ||
      this.moveBackward ||
      this.inputVector.lengthSqr() > MIN_INPUT_LENGTH * MIN_INPUT_LENGTH
    );
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
    const animationRuntime = this.attackDuration / safeAttackSpeed;
    this.attackTimeRemaining = Math.max(animationRuntime, this.attackLockDuration);
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

  private onMouseDown(event: EventMouse): void {
    if (this.shouldUseTouchJoystick()) {
      return;
    }

    this.resetPointerInput();
    this.mousePressed = true;
    this.mouseDragged = false;
    event.getUILocation(this.mouseStart);
  }

  private onMouseMove(event: EventMouse): void {
    if (this.shouldUseTouchJoystick() || !this.mousePressed) {
      return;
    }

    event.getUILocation(this.mouseLocation);

    if (
      Vec2.squaredDistance(this.mouseStart, this.mouseLocation) >
      MOUSE_CLICK_DRAG_THRESHOLD ** 2
    ) {
      this.mouseDragged = true;
    }
  }

  private onMouseUp(): void {
    if (this.shouldUseTouchJoystick()) {
      if (this.touchActive) {
        this.endTouch(false);
      }

      return;
    }

    const shouldAttack = this.mousePressed && !this.mouseDragged;
    this.resetMouseInput();
    this.resetPointerInput();

    if (shouldAttack) {
      this.attack();
    }
  }

  private onMouseLeave(): void {
    if (this.shouldUseTouchJoystick()) {
      this.endTouch(false);
      return;
    }

    this.resetMouseInput();
    this.resetPointerInput();
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
    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    this.releaseStaleTouch();

    if (this.touchActive) {
      return;
    }

    this.activeTouchId = event.getID();
    this.touchActive = true;
    this.touchDragged = false;
    event.getUILocation(this.touchStart);
    this.inputVector.set(0, 0);
  }

  private onTouchMove(event: EventTouch): void {
    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    if (!this.isActiveTouchEvent(event)) {
      return;
    }

    const location = event.getUILocation();
    this.inputVector.set(location.x - this.touchStart.x, location.y - this.touchStart.y);

    if (this.inputVector.length() < this.touchDeadZone) {
      this.inputVector.set(0, 0);
      this.updateJoystickHandle(this.inputVector);
      return;
    }

    this.touchDragged = true;
    this.showJoystickAtTouchStart();
    this.updateJoystickHandle(this.inputVector);
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    if (!this.isActiveTouchEvent(event)) {
      return;
    }

    this.endTouch(true);
  }

  private onTouchCancel(event: EventTouch): void {
    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    if (!this.isActiveTouchEvent(event)) {
      return;
    }

    this.endTouch(false);
  }

  private endTouch(shouldAttackOnTap: boolean): void {
    const wasTap = this.touchActive && !this.touchDragged;
    this.resetPointerInput();

    if (shouldAttackOnTap && wasTap) {
      this.attack();
    }
  }

  private resolveJoystickReferences(): void {
    const canvas = director.getScene()?.getChildByName('HudCanvas') ?? null;
    this.inputSurface = canvas;
    this.joystickRoot = canvas?.getChildByName('JoystickRoot') ?? null;
    this.joystickHandle = this.joystickRoot?.getChildByName('JoystickHandle') ?? null;
    this.hideJoystick();
  }

  private showJoystickAtTouchStart(): void {
    if (this.joystickRoot === null) {
      this.resolveJoystickReferences();
    }

    if (this.joystickRoot === null) {
      return;
    }

    const canvasTransform = this.joystickRoot.parent?.getComponent(UITransform) ?? null;
    this.joystickLocalPosition.set(this.touchStart.x, this.touchStart.y, 0);

    if (canvasTransform !== null) {
      canvasTransform.convertToNodeSpaceAR(this.joystickLocalPosition, this.joystickLocalPosition);
    }

    this.joystickRoot.setPosition(this.joystickLocalPosition);
    this.joystickRoot.active = true;
  }

  private updateJoystickHandle(delta: Vec2): void {
    if (this.joystickHandle === null) {
      return;
    }

    const length = delta.length();

    if (length <= 0.001) {
      this.joystickHandle.setPosition(0, 0, 0);
      return;
    }

    const distance = Math.min(JOYSTICK_MAX_DISTANCE, length);
    this.joystickHandlePosition.set(
      (delta.x / length) * distance,
      (delta.y / length) * distance,
      0,
    );
    this.joystickHandle.setPosition(this.joystickHandlePosition);
  }

  private hideJoystick(): void {
    this.joystickRoot?.setPosition(0, 0, 0);
    this.joystickHandle?.setPosition(0, 0, 0);

    if (this.joystickRoot !== null) {
      this.joystickRoot.active = false;
    }
  }

  private releaseStaleTouch(): void {
    if (
      this.touchActive &&
      this.activeTouchId !== null &&
      input.getTouch(this.activeTouchId) === undefined
    ) {
      this.resetPointerInput();
    }
  }

  private isActiveTouchEvent(event: EventTouch): boolean {
    const touchId = event.getID();
    return this.activeTouchId === null || touchId === null || touchId === this.activeTouchId;
  }

  private shouldUseTouchJoystick(): boolean {
    return sys.isMobile || this.touchJoystickOnDesktop;
  }

  private bindBrowserSafetyHooks(): void {
    if (this.browserSafetyHooksBound || !sys.isBrowser) {
      return;
    }

    window.addEventListener('blur', this.resetInputOnBrowserBlur);
    window.addEventListener('pagehide', this.resetInputOnBrowserBlur);
    window.addEventListener('pointerup', this.deferPointerReleaseReset);
    window.addEventListener('pointercancel', this.deferPointerReleaseReset);
    window.addEventListener('mouseup', this.deferPointerReleaseReset);
    window.addEventListener('touchend', this.deferPointerReleaseReset);
    window.addEventListener('touchcancel', this.deferPointerReleaseReset);
    document.addEventListener('visibilitychange', this.resetInputOnBrowserBlur);
    this.browserSafetyHooksBound = true;
  }

  private unbindBrowserSafetyHooks(): void {
    if (!this.browserSafetyHooksBound || !sys.isBrowser) {
      return;
    }

    window.removeEventListener('blur', this.resetInputOnBrowserBlur);
    window.removeEventListener('pagehide', this.resetInputOnBrowserBlur);
    window.removeEventListener('pointerup', this.deferPointerReleaseReset);
    window.removeEventListener('pointercancel', this.deferPointerReleaseReset);
    window.removeEventListener('mouseup', this.deferPointerReleaseReset);
    window.removeEventListener('touchend', this.deferPointerReleaseReset);
    window.removeEventListener('touchcancel', this.deferPointerReleaseReset);
    document.removeEventListener('visibilitychange', this.resetInputOnBrowserBlur);

    if (this.browserPointerReleaseTimer !== 0) {
      window.clearTimeout(this.browserPointerReleaseTimer);
      this.browserPointerReleaseTimer = 0;
    }

    this.browserSafetyHooksBound = false;
  }

  private resetPointerInput(): void {
    this.activeTouchId = null;
    this.touchActive = false;
    this.touchDragged = false;
    this.inputVector.set(0, 0);
    this.hideJoystick();
  }

  private resetMouseInput(): void {
    this.mousePressed = false;
    this.mouseDragged = false;
    this.mouseStart.set(0, 0);
    this.mouseLocation.set(0, 0);
  }

  private resetInputState(): void {
    this.resetPointerInput();
    this.resetMouseInput();
    this.keyboardVector.set(0, 0);
    this.moveLeft = false;
    this.moveRight = false;
    this.moveForward = false;
    this.moveBackward = false;
    this.move(0, 0, 0);
  }
}
