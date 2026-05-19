import { instantiate, Node, NodePool, Prefab, Tween, UIOpacity } from 'cc';

import { applyLayerRecursive } from './NodeLayerUtils';

export type TransientRewardKind = 'wood' | 'metal';

export class TransientEffectPools {
  public readonly woodPickupPool = new NodePool();
  public readonly metalPickupPool = new NodePool();
  public readonly impactBurstPool = new NodePool();
  public readonly starPool = new NodePool();
  public readonly floatingLabelPool = new NodePool();

  private readonly activeNodes = new Map<Node, NodePool>();

  public getPickupPool(kind: TransientRewardKind): NodePool {
    return kind === 'wood' ? this.woodPickupPool : this.metalPickupPool;
  }

  public prewarmPool(pool: NodePool, prefab: Prefab | null, layer: Node, targetSize: number): void {
    if (prefab === null) {
      return;
    }

    const normalizedTargetSize = Math.max(0, Math.floor(targetSize));

    while (pool.size() < normalizedTargetSize) {
      const node = instantiate(prefab);
      node.active = false;
      applyLayerRecursive(node, layer.layer);
      pool.put(node);
    }
  }

  public getNode(pool: NodePool, prefab: Prefab | null, layer: Node): Node | null {
    if (prefab === null) {
      return null;
    }

    const node = pool.size() > 0 ? pool.get() : instantiate(prefab);

    if (node === null || !node.isValid) {
      return null;
    }

    node.active = true;
    applyLayerRecursive(node, layer.layer);
    layer.addChild(node);
    this.activeNodes.set(node, pool);
    return node;
  }

  public recycle(pool: NodePool, node: Node): void {
    if (!node.isValid) {
      return;
    }

    this.stopNodeTweens(node);
    node.active = false;
    this.activeNodes.delete(node);
    pool.put(node);
  }

  public clearActive(): void {
    for (const [node] of Array.from(this.activeNodes)) {
      if (!node.isValid) {
        continue;
      }

      this.stopNodeTweens(node);
      node.destroy();
    }

    this.activeNodes.clear();
  }

  public clearPools(): void {
    this.woodPickupPool.clear();
    this.metalPickupPool.clear();
    this.impactBurstPool.clear();
    this.starPool.clear();
    this.floatingLabelPool.clear();
  }

  private stopNodeTweens(node: Node): void {
    Tween.stopAllByTarget(node);
    const opacity = node.getComponent(UIOpacity);

    if (opacity !== null) {
      Tween.stopAllByTarget(opacity);
    }
  }
}
