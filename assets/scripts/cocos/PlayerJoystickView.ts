import { director, Node, UITransform, Vec2, Vec3 } from 'cc';

const JOYSTICK_MAX_DISTANCE = 58;

export class PlayerJoystickView {
  private inputSurface: Node | null = null;
  private joystickRoot: Node | null = null;
  private joystickHandle: Node | null = null;
  private readonly localPosition = new Vec3();
  private readonly handlePosition = new Vec3();

  public resolve(): void {
    const canvas = director.getScene()?.getChildByName('HudCanvas') ?? null;
    this.inputSurface = canvas;
    this.joystickRoot = canvas?.getChildByName('JoystickRoot') ?? null;
    this.joystickHandle = this.joystickRoot?.getChildByName('JoystickHandle') ?? null;
    this.hide();
  }

  public getInputSurface(): Node | null {
    return this.inputSurface;
  }

  public showAt(screenPosition: Vec2): void {
    if (this.joystickRoot === null) {
      this.resolve();
    }

    if (this.joystickRoot === null) {
      return;
    }

    const canvasTransform = this.joystickRoot.parent?.getComponent(UITransform) ?? null;
    this.localPosition.set(screenPosition.x, screenPosition.y, 0);

    if (canvasTransform !== null) {
      canvasTransform.convertToNodeSpaceAR(this.localPosition, this.localPosition);
    }

    this.joystickRoot.setPosition(this.localPosition);
    this.joystickRoot.active = true;
  }

  public updateHandle(delta: Vec2): void {
    if (this.joystickHandle === null) {
      return;
    }

    const length = delta.length();

    if (length <= 0.001) {
      this.joystickHandle.setPosition(0, 0, 0);
      return;
    }

    const distance = Math.min(JOYSTICK_MAX_DISTANCE, length);
    this.handlePosition.set((delta.x / length) * distance, (delta.y / length) * distance, 0);
    this.joystickHandle.setPosition(this.handlePosition);
  }

  public hide(): void {
    this.joystickRoot?.setPosition(0, 0, 0);
    this.joystickHandle?.setPosition(0, 0, 0);

    if (this.joystickRoot !== null) {
      this.joystickRoot.active = false;
    }
  }
}
