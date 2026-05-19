import { instantiate, Node, NodePool, Prefab, tween, Tween, Vec3 } from 'cc';

import { applyLayerRecursive } from './NodeLayerUtils';

const HIDDEN_RENDER_SCALE = 0.001;
const ATTACK_SLASH_LIFETIME_SECONDS = 0.24;
const WARMUP_LIFETIME_SECONDS = 0.08;

export class AttackSlashFeedback {
  private readonly pool = new NodePool();
  private readonly activeSlashes = new Set<Node>();
  private readonly baseScale = new Vec3(1, 1, 1);
  private baseScaleCaptured = false;
  private renderWarmupDone = false;

  public prewarm(prefab: Prefab | null, count: number): void {
    if (prefab === null) {
      return;
    }

    const targetSize = Math.max(0, Math.floor(count));

    while (this.pool.size() < targetSize) {
      const slash = instantiate(prefab);
      slash.active = false;
      this.captureBaseScale(slash);
      this.pool.put(slash);
    }
  }

  public warmupRenderer(prefab: Prefab | null, parent: Node | null): void {
    if (this.renderWarmupDone || prefab === null || parent === null || !parent.isValid) {
      return;
    }

    const slash = this.getNode(prefab);

    if (slash === null) {
      return;
    }

    slash.name = 'AttackSlashWarmup';
    slash.active = true;
    slash.setParent(parent, false);
    slash.setScale(HIDDEN_RENDER_SCALE, HIDDEN_RENDER_SCALE, HIDDEN_RENDER_SCALE);
    applyLayerRecursive(slash, parent.layer);
    this.activeSlashes.add(slash);
    this.renderWarmupDone = true;
    this.recycleAfter(slash, WARMUP_LIFETIME_SECONDS);
  }

  public play(prefab: Prefab | null, parent: Node | null): void {
    if (prefab === null || parent === null || !parent.isValid) {
      return;
    }

    const slash = this.getNode(prefab);

    if (slash === null) {
      return;
    }

    slash.name = 'AttackSlash';
    slash.active = true;
    slash.setParent(parent, false);
    slash.setScale(this.baseScale);
    applyLayerRecursive(slash, parent.layer);
    this.activeSlashes.add(slash);
    this.recycleAfter(slash, ATTACK_SLASH_LIFETIME_SECONDS);
  }

  public recycleActive(): void {
    for (const slash of Array.from(this.activeSlashes)) {
      this.recycle(slash);
    }
  }

  public clear(): void {
    this.recycleActive();
    this.pool.clear();
  }

  private getNode(prefab: Prefab): Node | null {
    const slash = this.pool.size() > 0 ? this.pool.get() : instantiate(prefab);

    if (slash === null || !slash.isValid) {
      return null;
    }

    this.captureBaseScale(slash);
    return slash;
  }

  private recycleAfter(slash: Node, seconds: number): void {
    Tween.stopAllByTarget(slash);
    tween(slash)
      .delay(seconds)
      .call(() => {
        if (this.activeSlashes.has(slash)) {
          this.recycle(slash);
        }
      })
      .start();
  }

  private recycle(slash: Node): void {
    if (!this.activeSlashes.has(slash)) {
      return;
    }

    if (!slash.isValid) {
      this.activeSlashes.delete(slash);
      return;
    }

    Tween.stopAllByTarget(slash);
    slash.active = false;
    slash.setScale(this.baseScale);
    this.activeSlashes.delete(slash);
    this.pool.put(slash);
  }

  private captureBaseScale(slash: Node): void {
    if (this.baseScaleCaptured) {
      return;
    }

    slash.getScale(this.baseScale);
    this.baseScaleCaptured = true;
  }
}
