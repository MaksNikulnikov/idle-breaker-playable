import { _decorator, Collider, Component, Enum, Node, Prefab, tween, Tween, Vec3 } from 'cc';

const { ccclass, disallowMultiple, property, requireComponent } = _decorator;

export enum ResourceKind {
  Wood = 0,
  Metal = 1,
}

Enum(ResourceKind);

@ccclass('BreakableResource')
@disallowMultiple
@requireComponent(Collider)
export class BreakableResource extends Component {
  @property
  public resourceId = '';

  @property({ type: Enum(ResourceKind) })
  public resourceKind = ResourceKind.Wood;

  @property
  public requiredWeaponLevel = 1;

  @property
  public rewardAmount = 1;

  @property
  public maxHits = 3;

  @property({ type: [Node] })
  public damageStateNodes: Node[] = [];

  @property
  public feedbackHeight = 1.4;

  @property({ type: Prefab })
  public targetHintPrefab: Prefab | null = null;

  private collider: Collider | null = null;
  private readonly baseScale = new Vec3(1, 1, 1);
  private runtimeIdOverride = '';

  public onLoad(): void {
    this.collider = this.getComponent(Collider);
    this.node.getScale(this.baseScale);
  }

  public getRuntimeId(): string {
    if (this.runtimeIdOverride !== '') {
      return this.runtimeIdOverride;
    }

    return this.resourceId.trim() || this.node.name;
  }

  public assignRuntimeId(runtimeId: string): void {
    this.runtimeIdOverride = runtimeId.trim();
  }

  public getFeedbackWorldPosition(out: Vec3 = new Vec3()): Vec3 {
    this.node.getWorldPosition(out);

    const bounds = this.collider?.worldBounds ?? null;

    if (bounds !== null) {
      out.x = bounds.center.x;
      out.z = bounds.center.z;
    }

    out.y += this.feedbackHeight;
    return out;
  }

  public getHitWorldPosition(out: Vec3 = new Vec3()): Vec3 {
    this.node.getWorldPosition(out);

    const bounds = this.collider?.worldBounds ?? null;

    if (bounds !== null) {
      out.set(bounds.center.x, bounds.center.y + 0.35, bounds.center.z);
    }

    return out;
  }

  public getTargetHintWorldBounds(outCenter: Vec3, outSize: Vec3): void {
    this.node.getWorldPosition(outCenter);
    outSize.set(1, 1, 1);

    const bounds = this.collider?.worldBounds ?? null;

    if (bounds === null) {
      return;
    }

    outCenter.set(bounds.center.x, 0, bounds.center.z);
    outSize.set(bounds.halfExtents.x * 2, bounds.halfExtents.y * 2, bounds.halfExtents.z * 2);
  }

  public getTargetHintPrefab(): Prefab | null {
    return this.targetHintPrefab;
  }

  public showDamageStage(stageIndex: number): void {
    const visibleIndex = Math.max(0, Math.min(stageIndex, this.damageStateNodes.length - 1));

    for (let index = 0; index < this.damageStateNodes.length; index += 1) {
      this.damageStateNodes[index].active = index === visibleIndex;
    }
  }

  public setCollected(collected: boolean): void {
    if (!collected) {
      Tween.stopAllByTarget(this.node);
      this.node.active = true;
      this.node.setScale(this.baseScale);

      if (this.collider !== null) {
        this.collider.enabled = true;
      }

      return;
    }

    if (this.collider !== null) {
      this.collider.enabled = false;
    }
  }

  public playHitFeedback(): void {
    if (!this.node.active) {
      return;
    }

    const enlargedScale = new Vec3(
      this.baseScale.x * 1.08,
      this.baseScale.y * 1.08,
      this.baseScale.z * 1.08,
    );

    Tween.stopAllByTarget(this.node);
    this.node.setScale(this.baseScale);

    tween(this.node)
      .to(0.06, { scale: enlargedScale }, { easing: 'quadOut' })
      .to(0.1, { scale: this.baseScale.clone() }, { easing: 'quadIn' })
      .start();
  }

  public playCollectedFeedback(): void {
    if (!this.node.active) {
      return;
    }

    const enlargedScale = new Vec3(
      this.baseScale.x * 1.16,
      this.baseScale.y * 1.16,
      this.baseScale.z * 1.16,
    );

    Tween.stopAllByTarget(this.node);

    tween(this.node)
      .to(0.08, { scale: enlargedScale }, { easing: 'quadOut' })
      .to(0.18, { scale: Vec3.ZERO }, { easing: 'backIn' })
      .call(() => {
        this.node.active = false;
        this.node.setScale(this.baseScale);
      })
      .start();
  }
}
