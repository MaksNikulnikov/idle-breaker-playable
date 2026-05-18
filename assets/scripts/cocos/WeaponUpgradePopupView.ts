import { _decorator, Component, Label, Node, Sprite, SpriteFrame } from 'cc';

const { ccclass, disallowMultiple, property } = _decorator;

@ccclass('WeaponUpgradePopupView')
@disallowMultiple
export class WeaponUpgradePopupView extends Component {
  @property({ type: Node })
  public card: Node | null = null;

  @property({ type: Node })
  public dimmer: Node | null = null;

  @property({ type: Label })
  public weaponNameLabel: Label | null = null;

  @property({ type: Label })
  public levelLabel: Label | null = null;

  @property({ type: Label })
  public unlockLabel: Label | null = null;

  @property({ type: Node })
  public weaponIconRoot: Node | null = null;

  @property({ type: Sprite })
  public weaponIconSprite: Sprite | null = null;

  @property({ type: Sprite })
  public powerIconSprite: Sprite | null = null;

  @property({ type: Label })
  public powerLabel: Label | null = null;

  @property({ type: [SpriteFrame] })
  public weaponIconFrames: SpriteFrame[] = [];

  public applyContent(
    level: number,
    weaponName: string,
    unlockText: string,
    powerBonus: number,
  ): void {
    if (this.weaponNameLabel !== null) {
      this.weaponNameLabel.string = weaponName;
    }

    if (this.levelLabel !== null) {
      this.levelLabel.string = `LVL ${level}`;
    }

    if (this.unlockLabel !== null) {
      this.unlockLabel.string = unlockText;
    }

    if (this.powerLabel !== null) {
      this.powerLabel.string = `+ ${powerBonus}`;
    }
  }

  public clearWeaponIcon(): void {
    const iconSprite = this.getWeaponIconSprite();

    if (iconSprite !== null) {
      iconSprite.spriteFrame = null;
    }

    if (this.weaponIconRoot === null) {
      return;
    }

    for (const child of [...this.weaponIconRoot.children]) {
      child.destroy();
    }
  }

  public applyWeaponIcon(level: number): boolean {
    const iconSprite = this.getWeaponIconSprite();
    const spriteFrame = this.getWeaponIconFrame(level);

    if (iconSprite === null || spriteFrame === null) {
      return false;
    }

    iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    iconSprite.spriteFrame = spriteFrame;
    return true;
  }

  public hasRequiredReferences(): boolean {
    return (
      this.card !== null &&
      this.dimmer !== null &&
      this.weaponNameLabel !== null &&
      this.levelLabel !== null &&
      this.unlockLabel !== null &&
      this.weaponIconRoot !== null &&
      this.getWeaponIconSprite() !== null &&
      this.powerIconSprite !== null &&
      this.powerLabel !== null &&
      this.weaponIconFrames.length > 0
    );
  }

  public getWeaponIconSprite(): Sprite | null {
    return this.weaponIconSprite ?? this.weaponIconRoot?.getComponent(Sprite) ?? null;
  }

  private getWeaponIconFrame(level: number): SpriteFrame | null {
    if (this.weaponIconFrames.length === 0) {
      return null;
    }

    const frameIndex = Math.max(
      0,
      Math.min(Math.floor(level) - 1, this.weaponIconFrames.length - 1),
    );
    return this.weaponIconFrames[frameIndex] ?? null;
  }
}
