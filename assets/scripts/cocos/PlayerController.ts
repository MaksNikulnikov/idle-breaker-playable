import {
  _decorator,
  Component,
  EventKeyboard,
  EventMouse,
  EventTouch,
  game,
  Game,
  input,
  Input,
  KeyCode,
  Node,
  RigidBody,
  SkeletalAnimation,
  sys,
  Vec2,
} from 'cc';

import { createPlayerLocomotionPlan, PlayerAttackState } from '../application';
import { BrowserInputSafety } from './BrowserInputSafety';
import { PlayerAnimationView } from './PlayerAnimationView';
import { PlayerInputState, type PlayerMoveKey } from './PlayerInputState';
import { PlayerJoystickView } from './PlayerJoystickView';
import { PlayerMovementView } from './PlayerMovementView';

const { ccclass, disallowMultiple, property, requireComponent } = _decorator;

export const PLAYER_ATTACK_STARTED_EVENT = 'player-attack-started';
export const PLAYER_ATTACK_ENDED_EVENT = 'player-attack-ended';

const MIN_INPUT_LENGTH = 0.05;
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
  public touchJoystickOnDesktop = true;

  @property
  public controlsEnabled = true;

  private readonly inputState = new PlayerInputState();
  private readonly inputVector = new Vec2();
  private readonly mouseStart = new Vec2();
  private readonly mouseLocation = new Vec2();
  private readonly touchStart = new Vec2();
  private readonly attackState = new PlayerAttackState();
  private readonly animationView = new PlayerAnimationView();
  private readonly joystickView = new PlayerJoystickView();
  private readonly movementView = new PlayerMovementView();
  private readonly browserInputSafety = new BrowserInputSafety({
    resetInput: () => this.resetInputState(),
    resetPointerInput: () => this.resetPointerInput(),
    resetMouseInput: () => this.resetMouseInput(),
  });

  public onLoad(): void {
    this.movementView.bind(this.node, this.getComponent(RigidBody), this.visualRoot);
    const animationNode = this.animationRoot ?? this.visualRoot ?? this.node;
    this.animationView.bind(
      animationNode.getComponent(SkeletalAnimation) ?? this.getComponent(SkeletalAnimation),
    );
    this.animationView.prewarm([this.idleClip, this.runClip, this.attackClip]);
    this.joystickView.resolve();
  }

  public onEnable(): void {
    this.joystickView.resolve();
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
    this.joystickView.getInputSurface()?.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    this.browserInputSafety.bind();
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
    this.joystickView.getInputSurface()?.off(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    this.browserInputSafety.unbind();
    this.resetInputState();
  }

  public update(deltaTime: number): void {
    this.releaseStaleTouch();

    if (!this.controlsEnabled) {
      this.resetInputState();
      this.animationView.play(this.idleClip, 0.12);
      return;
    }

    if (this.attackState.isAttacking) {
      const attackEnded = this.attackState.tick(deltaTime);
      this.movementView.applyVelocity(0, 0, deltaTime);

      if (!attackEnded) {
        return;
      }

      this.node.emit(PLAYER_ATTACK_ENDED_EVENT);
    }

    this.resolveInput();

    const locomotion = createPlayerLocomotionPlan({
      inputX: this.inputVector.x,
      inputY: this.inputVector.y,
      moveSpeed: this.moveSpeed,
      minInputLength: MIN_INPUT_LENGTH,
    });

    this.movementView.applyVelocity(locomotion.velocityX, locomotion.velocityZ, deltaTime);

    if (!locomotion.hasMovement) {
      this.playLocomotionAnimation(this.idleClip);
      return;
    }

    this.movementView.rotateVisual(locomotion, this.visualYawOffset, this.rotationSpeed, deltaTime);
    this.playLocomotionAnimation(this.runClip);
  }

  public hasActiveGameplayInput(): boolean {
    if (!this.controlsEnabled) {
      return false;
    }

    return this.attackState.isAttacking || this.inputState.hasActiveGameplayInput(MIN_INPUT_LENGTH);
  }

  public setControlsEnabled(enabled: boolean): void {
    if (this.controlsEnabled === enabled) {
      return;
    }

    this.controlsEnabled = enabled;

    if (enabled) {
      return;
    }

    const wasAttacking = this.attackState.cancel();
    this.resetInputState();
    this.animationView.play(this.idleClip, 0.12, true);

    if (wasAttacking) {
      this.node.emit(PLAYER_ATTACK_ENDED_EVENT);
    }
  }

  private resolveInput(): void {
    if (this.inputState.touchActive) {
      return;
    }

    this.inputState.syncKeyboardInput();
    this.syncInputVectorFromState();
  }

  private playLocomotionAnimation(clipName: string): void {
    if (this.attackState.isAttacking) {
      return;
    }

    this.animationView.play(clipName, 0.12);
  }

  private attack(): void {
    if (!this.controlsEnabled) {
      return;
    }

    const attack = this.attackState.start({
      animationDuration: this.attackDuration,
      attackSpeed: this.attackSpeed,
      lockDuration: this.attackLockDuration,
    });

    if (!attack.started) {
      return;
    }

    this.animationView.play(this.attackClip, 0.05, true, attack.playbackSpeed, true);
    this.node.emit(PLAYER_ATTACK_STARTED_EVENT, attack.lockTime);
  }

  private onKeyDown(event: EventKeyboard): void {
    if (!this.controlsEnabled) {
      return;
    }

    this.setKey(event.keyCode, true);
  }

  private onKeyUp(event: EventKeyboard): void {
    if (!this.controlsEnabled) {
      return;
    }

    this.setKey(event.keyCode, false);
  }

  private onMouseDown(event: EventMouse): void {
    if (!this.controlsEnabled) {
      return;
    }

    if (this.shouldUseDesktopJoystick()) {
      this.resetPointerInput();
      event.getUILocation(this.touchStart);
      this.beginJoystickPointer(null, this.touchStart);
      return;
    }

    if (this.shouldUseTouchJoystick()) {
      return;
    }

    this.resetPointerInput();
    this.inputState.beginMouse();
    event.getUILocation(this.mouseStart);
  }

  private onMouseMove(event: EventMouse): void {
    if (!this.controlsEnabled) {
      return;
    }

    if (this.shouldUseDesktopJoystick()) {
      if (!this.inputState.touchActive) {
        return;
      }

      event.getUILocation(this.mouseLocation);
      this.moveJoystickPointer(this.mouseLocation);
      return;
    }

    if (this.shouldUseTouchJoystick() || !this.inputState.mousePressed) {
      return;
    }

    event.getUILocation(this.mouseLocation);

    if (
      Vec2.squaredDistance(this.mouseStart, this.mouseLocation) >
      MOUSE_CLICK_DRAG_THRESHOLD ** 2
    ) {
      this.inputState.markMouseDragged();
    }
  }

  private onMouseUp(): void {
    if (!this.controlsEnabled) {
      this.resetInputState();
      return;
    }

    if (this.shouldUseDesktopJoystick()) {
      if (this.inputState.touchActive) {
        this.endTouch(true);
      }

      return;
    }

    if (this.shouldUseTouchJoystick()) {
      if (this.inputState.touchActive) {
        this.endTouch(false);
      }

      return;
    }

    const shouldAttack = this.inputState.shouldAttackFromMouseRelease();
    this.resetMouseInput();
    this.resetPointerInput();

    if (shouldAttack) {
      this.attack();
    }
  }

  private onMouseLeave(): void {
    if (!this.controlsEnabled) {
      this.resetInputState();
      return;
    }

    if (this.shouldUseDesktopJoystick()) {
      this.endTouch(false);
      return;
    }

    if (this.shouldUseTouchJoystick()) {
      this.endTouch(false);
      return;
    }

    this.resetMouseInput();
    this.resetPointerInput();
  }

  private setKey(keyCode: KeyCode, pressed: boolean): void {
    if (!this.controlsEnabled) {
      return;
    }

    const moveKey = this.getMoveKey(keyCode);

    if (moveKey !== null) {
      this.inputState.setMoveKey(moveKey, pressed);
      return;
    }

    switch (keyCode) {
      case KeyCode.SPACE:
      case KeyCode.ENTER:
        if (pressed) {
          this.attack();
        }
        break;
    }
  }

  private getMoveKey(keyCode: KeyCode): PlayerMoveKey | null {
    switch (keyCode) {
      case KeyCode.KEY_A:
      case KeyCode.ARROW_LEFT:
        return 'left';
      case KeyCode.KEY_D:
      case KeyCode.ARROW_RIGHT:
        return 'right';
      case KeyCode.KEY_W:
      case KeyCode.ARROW_UP:
        return 'forward';
      case KeyCode.KEY_S:
      case KeyCode.ARROW_DOWN:
        return 'backward';
      default:
        return null;
    }
  }

  private onTouchStart(event: EventTouch): void {
    if (!this.controlsEnabled) {
      return;
    }

    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    this.releaseStaleTouch();

    if (this.inputState.touchActive) {
      return;
    }

    event.getUILocation(this.touchStart);
    this.beginJoystickPointer(event.getID(), this.touchStart);
  }

  private onTouchMove(event: EventTouch): void {
    if (!this.controlsEnabled) {
      return;
    }

    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    if (!this.isActiveTouchEvent(event)) {
      return;
    }

    this.moveJoystickPointer(event.getUILocation());
  }

  private beginJoystickPointer(pointerId: number | null, screenPosition: Vec2): void {
    this.inputState.beginTouch(pointerId);
    this.touchStart.set(screenPosition.x, screenPosition.y);
    this.syncInputVectorFromState();
  }

  private moveJoystickPointer(screenPosition: Vec2): void {
    this.inputState.setInputVector(
      screenPosition.x - this.touchStart.x,
      screenPosition.y - this.touchStart.y,
    );
    this.syncInputVectorFromState();

    if (this.inputVector.length() < this.touchDeadZone) {
      this.inputState.setInputVector(0, 0);
      this.syncInputVectorFromState();
      this.joystickView.updateHandle(this.inputVector);
      return;
    }

    this.inputState.markTouchDragged();
    this.joystickView.showAt(this.touchStart);
    this.joystickView.updateHandle(this.inputVector);
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.controlsEnabled) {
      this.resetInputState();
      return;
    }

    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    if (!this.isActiveTouchEvent(event)) {
      return;
    }

    this.endTouch(true);
  }

  private onTouchCancel(event: EventTouch): void {
    if (!this.controlsEnabled) {
      this.resetInputState();
      return;
    }

    if (!this.shouldUseTouchJoystick()) {
      return;
    }

    if (!this.isActiveTouchEvent(event)) {
      return;
    }

    this.endTouch(false);
  }

  private endTouch(shouldAttackOnTap: boolean): void {
    const wasTap = this.inputState.isTouchTap();
    this.resetPointerInput();

    if (shouldAttackOnTap && wasTap) {
      this.attack();
    }
  }

  private releaseStaleTouch(): void {
    if (
      this.inputState.touchActive &&
      this.inputState.activeTouchId !== null &&
      input.getTouch(this.inputState.activeTouchId) === undefined
    ) {
      this.resetPointerInput();
    }
  }

  private isActiveTouchEvent(event: EventTouch): boolean {
    const touchId = event.getID();
    return this.inputState.isActiveTouchEvent(touchId);
  }

  private shouldUseTouchJoystick(): boolean {
    return sys.isMobile || this.touchJoystickOnDesktop;
  }

  private shouldUseDesktopJoystick(): boolean {
    return !sys.isMobile && this.touchJoystickOnDesktop;
  }

  private resetPointerInput(): void {
    this.inputState.resetPointerInput();
    this.syncInputVectorFromState();
    this.joystickView.hide();
  }

  private resetMouseInput(): void {
    this.inputState.resetMouseInput();
    this.mouseStart.set(0, 0);
    this.mouseLocation.set(0, 0);
  }

  private resetInputState(): void {
    this.inputState.resetAll();
    this.syncInputVectorFromState();
    this.joystickView.hide();
    this.mouseStart.set(0, 0);
    this.mouseLocation.set(0, 0);
    this.movementView.applyVelocity(0, 0, 0);
  }

  private syncInputVectorFromState(): void {
    this.inputVector.set(this.inputState.inputX, this.inputState.inputY);
  }
}
