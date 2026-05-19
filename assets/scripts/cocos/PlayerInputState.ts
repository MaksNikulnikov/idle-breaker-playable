export type PlayerMoveKey = 'left' | 'right' | 'forward' | 'backward';

export class PlayerInputState {
  private _inputX = 0;
  private _inputY = 0;
  private _activeTouchId: number | null = null;
  private _touchActive = false;
  private _touchDragged = false;
  private _mousePressed = false;
  private _mouseDragged = false;
  private moveLeft = false;
  private moveRight = false;
  private moveForward = false;
  private moveBackward = false;

  public get inputX(): number {
    return this._inputX;
  }

  public get inputY(): number {
    return this._inputY;
  }

  public get activeTouchId(): number | null {
    return this._activeTouchId;
  }

  public get touchActive(): boolean {
    return this._touchActive;
  }

  public get mousePressed(): boolean {
    return this._mousePressed;
  }

  public beginMouse(): void {
    this._mousePressed = true;
    this._mouseDragged = false;
  }

  public markMouseDragged(): void {
    if (this._mousePressed) {
      this._mouseDragged = true;
    }
  }

  public shouldAttackFromMouseRelease(): boolean {
    return this._mousePressed && !this._mouseDragged;
  }

  public beginTouch(touchId: number | null): void {
    this._activeTouchId = touchId;
    this._touchActive = true;
    this._touchDragged = false;
    this.setInputVector(0, 0);
  }

  public markTouchDragged(): void {
    if (this._touchActive) {
      this._touchDragged = true;
    }
  }

  public isTouchTap(): boolean {
    return this._touchActive && !this._touchDragged;
  }

  public isActiveTouchEvent(touchId: number | null): boolean {
    return this._activeTouchId === null || touchId === null || touchId === this._activeTouchId;
  }

  public setMoveKey(key: PlayerMoveKey, pressed: boolean): void {
    switch (key) {
      case 'left':
        this.moveLeft = pressed;
        break;
      case 'right':
        this.moveRight = pressed;
        break;
      case 'forward':
        this.moveForward = pressed;
        break;
      case 'backward':
        this.moveBackward = pressed;
        break;
    }
  }

  public syncKeyboardInput(): void {
    if (this._touchActive) {
      return;
    }

    this.setInputVector(
      Number(this.moveRight) - Number(this.moveLeft),
      Number(this.moveForward) - Number(this.moveBackward),
    );
  }

  public setInputVector(x: number, y: number): void {
    this._inputX = x;
    this._inputY = y;
  }

  public hasActiveGameplayInput(minInputLength: number): boolean {
    return (
      this._touchActive ||
      this._mousePressed ||
      this.moveLeft ||
      this.moveRight ||
      this.moveForward ||
      this.moveBackward ||
      this.getInputLengthSquared() > minInputLength * minInputLength
    );
  }

  public resetPointerInput(): void {
    this._activeTouchId = null;
    this._touchActive = false;
    this._touchDragged = false;
    this.setInputVector(0, 0);
  }

  public resetMouseInput(): void {
    this._mousePressed = false;
    this._mouseDragged = false;
  }

  public resetKeyboardInput(): void {
    this.moveLeft = false;
    this.moveRight = false;
    this.moveForward = false;
    this.moveBackward = false;
  }

  public resetAll(): void {
    this.resetPointerInput();
    this.resetMouseInput();
    this.resetKeyboardInput();
  }

  private getInputLengthSquared(): number {
    return this._inputX * this._inputX + this._inputY * this._inputY;
  }
}
