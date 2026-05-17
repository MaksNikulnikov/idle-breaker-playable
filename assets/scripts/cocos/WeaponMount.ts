import {
  _decorator,
  Component,
  instantiate,
  Node,
  Prefab,
  Quat,
  SkeletalAnimation,
  tween,
  Tween,
  Vec3,
} from 'cc';

const { ccclass, disallowMultiple, property } = _decorator;

const DEFAULT_RIGHT_HAND_SOCKET_PATH =
  'Armature.001/Hips/Spine/Chest/Shoulder_R/UpperArm_R/LowerArm_R/Hand_R/Weapon_R';

@ccclass('WeaponMount')
@disallowMultiple
export class WeaponMount extends Component {
  @property({ type: Node })
  public animationRoot: Node | null = null;

  @property({ type: Node })
  public socket: Node | null = null;

  @property
  public jointPath = DEFAULT_RIGHT_HAND_SOCKET_PATH;

  @property({ type: [Prefab] })
  public levelWeaponPrefabs: Prefab[] = [];

  @property
  public initialLevel = 1;

  @property
  public weaponLocalPosition = new Vec3();

  @property
  public weaponLocalEuler = new Vec3();

  @property
  public weaponLocalScale = new Vec3(1, 1, 1);

  private readonly localRotation = new Quat();
  private readonly appliedWeaponScale = new Vec3(1, 1, 1);
  private readonly equipFeedback = { scale: 1 };
  private activeWeapon: Node | null = null;
  private animation: SkeletalAnimation | null = null;
  private socketRegistered = false;

  public onLoad(): void {
    this.animation = this.resolveSkeletalAnimation();
    this.registerSocket();
  }

  public start(): void {
    this.registerSocket();
    this.equipWeaponLevel(this.initialLevel, false);
  }

  public lateUpdate(): void {
    this.applyActiveWeaponTransform();
  }

  public equipWeaponLevel(level: number, animate = true): void {
    this.registerSocket();

    if (this.socket === null || this.levelWeaponPrefabs.length === 0) {
      return;
    }

    const prefabIndex = Math.max(
      0,
      Math.min(Math.floor(level) - 1, this.levelWeaponPrefabs.length - 1),
    );
    const prefab = this.levelWeaponPrefabs[prefabIndex];

    if (prefab === null) {
      return;
    }

    this.clearActiveWeapon();

    this.activeWeapon = instantiate(prefab);
    this.activeWeapon.name = `EquippedWeapon_L${prefabIndex + 1}`;
    this.activeWeapon.setParent(this.socket, false);
    this.applyActiveWeaponTransform();

    if (animate) {
      this.playEquipFeedback();
    }
  }

  public playEquipFeedback(): void {
    Tween.stopAllByTarget(this.equipFeedback);
    this.equipFeedback.scale = 1.45;

    tween(this.equipFeedback).to(0.22, { scale: 1 }, { easing: 'backOut' }).start();
  }

  private registerSocket(): void {
    if (
      this.socketRegistered ||
      this.animation === null ||
      this.socket === null ||
      this.jointPath.trim() === ''
    ) {
      return;
    }

    const jointPath = this.jointPath.trim();
    const existingSockets = this.animation.sockets.filter(
      (socket) => socket.target !== this.socket && socket.path !== jointPath,
    );

    existingSockets.push(new SkeletalAnimation.Socket(jointPath, this.socket));
    this.animation.sockets = existingSockets;
    this.animation.rebuildSocketAnimations();
    this.socketRegistered = true;
  }

  private applyActiveWeaponTransform(): void {
    if (this.activeWeapon === null || !this.activeWeapon.isValid) {
      return;
    }

    this.activeWeapon.setPosition(this.weaponLocalPosition);
    Quat.fromEuler(
      this.localRotation,
      this.weaponLocalEuler.x,
      this.weaponLocalEuler.y,
      this.weaponLocalEuler.z,
    );
    this.activeWeapon.setRotation(this.localRotation);
    this.appliedWeaponScale.set(
      this.weaponLocalScale.x * this.equipFeedback.scale,
      this.weaponLocalScale.y * this.equipFeedback.scale,
      this.weaponLocalScale.z * this.equipFeedback.scale,
    );
    this.activeWeapon.setScale(this.appliedWeaponScale);
  }

  private resolveSkeletalAnimation(): SkeletalAnimation | null {
    const configuredAnimation = this.animationRoot?.getComponent(SkeletalAnimation) ?? null;

    if (configuredAnimation !== null) {
      return configuredAnimation;
    }

    return this.findSkeletalAnimation(this.node);
  }

  private findSkeletalAnimation(root: Node): SkeletalAnimation | null {
    const animation = root.getComponent(SkeletalAnimation);

    if (animation !== null) {
      return animation;
    }

    for (const child of root.children) {
      const childAnimation = this.findSkeletalAnimation(child);

      if (childAnimation !== null) {
        return childAnimation;
      }
    }

    return null;
  }

  private clearActiveWeapon(): void {
    Tween.stopAllByTarget(this.equipFeedback);
    this.equipFeedback.scale = 1;

    if (this.activeWeapon !== null && this.activeWeapon.isValid) {
      this.activeWeapon.destroy();
      this.activeWeapon = null;
    }

    if (this.socket === null) {
      return;
    }

    for (const child of [...this.socket.children]) {
      child.destroy();
    }
  }
}
