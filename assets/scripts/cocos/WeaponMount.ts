import {
  _decorator,
  Component,
  instantiate,
  Node,
  NodePool,
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

  @property({ type: Prefab })
  public attackSlashPrefab: Prefab | null = null;

  @property
  public attackSlashPrewarmCount = 2;

  private readonly localRotation = new Quat();
  private readonly appliedWeaponScale = new Vec3(1, 1, 1);
  private readonly attackSlashBaseScale = new Vec3(1, 1, 1);
  private readonly equipFeedback = { scale: 1 };
  private readonly attackSlashPool = new NodePool();
  private readonly activeAttackSlashes = new Set<Node>();
  private activeWeapon: Node | null = null;
  private animation: SkeletalAnimation | null = null;
  private socketRegistered = false;
  private attackSlashBaseScaleCaptured = false;
  private attackSlashRenderWarmupDone = false;

  public onLoad(): void {
    this.animation = this.resolveSkeletalAnimation();
    this.registerSocket();
  }

  public start(): void {
    this.registerSocket();
    this.equipWeaponLevel(this.initialLevel, false);
    this.prewarmAttackSlashPool();
    this.warmupAttackSlashRenderer();
  }

  public lateUpdate(): void {
    this.applyActiveWeaponTransform();
  }

  public onDestroy(): void {
    this.recycleActiveAttackSlashes();
    this.attackSlashPool.clear();
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

    this.prewarmAttackSlashPool();
  }

  public playEquipFeedback(): void {
    Tween.stopAllByTarget(this.equipFeedback);
    this.equipFeedback.scale = 1.45;

    tween(this.equipFeedback).to(0.22, { scale: 1 }, { easing: 'backOut' }).start();
  }

  public playAttackSlash(): void {
    if (this.socket === null || this.attackSlashPrefab === null) {
      return;
    }

    const slashParent =
      this.activeWeapon !== null && this.activeWeapon.isValid ? this.activeWeapon : this.socket;
    const slash = this.getAttackSlashNode();

    if (slash === null) {
      return;
    }

    slash.name = 'AttackSlash';
    slash.active = true;
    slash.setParent(slashParent, false);
    slash.setScale(this.attackSlashBaseScale);
    this.applyLayerRecursive(slash, slashParent.layer);
    this.activeAttackSlashes.add(slash);

    Tween.stopAllByTarget(slash);
    tween(slash)
      .delay(0.24)
      .call(() => {
        if (this.activeAttackSlashes.has(slash)) {
          this.recycleAttackSlash(slash);
        }
      })
      .start();
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
    this.recycleActiveAttackSlashes();

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

  private applyLayerRecursive(root: Node, layer: number): void {
    root.layer = layer;

    for (const child of root.children) {
      this.applyLayerRecursive(child, layer);
    }
  }

  private prewarmAttackSlashPool(): void {
    if (this.attackSlashPrefab === null) {
      return;
    }

    const targetSize = Math.max(0, Math.floor(this.attackSlashPrewarmCount));

    while (this.attackSlashPool.size() < targetSize) {
      const slash = instantiate(this.attackSlashPrefab);
      slash.active = false;
      this.captureAttackSlashBaseScale(slash);
      this.attackSlashPool.put(slash);
    }
  }

  private getAttackSlashNode(): Node | null {
    if (this.attackSlashPrefab === null) {
      return null;
    }

    const slash =
      this.attackSlashPool.size() > 0
        ? this.attackSlashPool.get()
        : instantiate(this.attackSlashPrefab);

    if (slash === null || !slash.isValid) {
      return null;
    }

    this.captureAttackSlashBaseScale(slash);
    return slash;
  }

  private warmupAttackSlashRenderer(): void {
    if (
      this.attackSlashRenderWarmupDone ||
      this.socket === null ||
      this.attackSlashPrefab === null
    ) {
      return;
    }

    const slashParent =
      this.activeWeapon !== null && this.activeWeapon.isValid ? this.activeWeapon : this.socket;
    const slash = this.getAttackSlashNode();

    if (slash === null) {
      return;
    }

    slash.name = 'AttackSlashWarmup';
    slash.active = true;
    slash.setParent(slashParent, false);
    slash.setScale(0.001, 0.001, 0.001);
    this.applyLayerRecursive(slash, slashParent.layer);
    this.activeAttackSlashes.add(slash);
    this.attackSlashRenderWarmupDone = true;
    this.scheduleOnce(() => {
      if (this.activeAttackSlashes.has(slash)) {
        this.recycleAttackSlash(slash);
      }
    }, 0.08);
  }

  private recycleAttackSlash(slash: Node): void {
    if (!this.activeAttackSlashes.has(slash)) {
      return;
    }

    if (!slash.isValid) {
      this.activeAttackSlashes.delete(slash);
      return;
    }

    Tween.stopAllByTarget(slash);
    slash.active = false;
    slash.setScale(this.attackSlashBaseScale);
    this.activeAttackSlashes.delete(slash);
    this.attackSlashPool.put(slash);
  }

  private recycleActiveAttackSlashes(): void {
    for (const slash of Array.from(this.activeAttackSlashes)) {
      this.recycleAttackSlash(slash);
    }
  }

  private captureAttackSlashBaseScale(slash: Node): void {
    if (this.attackSlashBaseScaleCaptured) {
      return;
    }

    slash.getScale(this.attackSlashBaseScale);
    this.attackSlashBaseScaleCaptured = true;
  }
}
