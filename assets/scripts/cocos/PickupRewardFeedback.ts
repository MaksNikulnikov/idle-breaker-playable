import {
  Color,
  instantiate,
  Label,
  Node,
  NodePool,
  Prefab,
  Sprite,
  SpriteFrame,
  tween,
  Vec3,
} from 'cc';

import { applyLayerRecursive } from './NodeLayerUtils';
import type { TransientEffectPools, TransientRewardKind } from './TransientEffectPools';

export type PickupRewardConfig = {
  minScatterDistance: number;
  maxScatterDistance: number;
  minArcHeight: number;
  maxArcHeight: number;
  minFallDistance: number;
  maxFallDistance: number;
};

type WarmupNode = {
  node: Node;
  pool: NodePool;
};

type PickupRewardFeedbackOptions = {
  effectPools: TransientEffectPools;
  getFeedbackLayer: () => Node | null;
  getResourceIconFrame: (kind: TransientRewardKind) => SpriteFrame | null;
  tryGetCounterPosition: (kind: TransientRewardKind, out: Vec3) => boolean;
  spawnLandingStars: (uiPosition: Vec3) => void;
  playHudCounterPop: (kind: TransientRewardKind) => void;
};

export class PickupRewardFeedback {
  private readonly options: PickupRewardFeedbackOptions;
  private readonly targetPosition = new Vec3();

  public constructor(options: PickupRewardFeedbackOptions) {
    this.options = options;
  }

  public spawnRewards(
    kind: TransientRewardKind,
    startPosition: Vec3,
    prefab: Prefab | null,
    config: PickupRewardConfig,
  ): void {
    this.targetPosition.set(0, 0, 0);

    if (!this.options.tryGetCounterPosition(kind, this.targetPosition)) {
      this.targetPosition.set(startPosition.x, startPosition.y + 120, 0);
    }

    const count = Math.floor(Math.random() * 3) + 1;

    for (let index = 0; index < count; index += 1) {
      this.spawnBadge(kind, startPosition, this.targetPosition, index, count, prefab, config);
    }
  }

  public prewarmPool(
    kind: TransientRewardKind,
    layer: Node,
    prefab: Prefab | null,
    targetSize: number,
  ): void {
    if (prefab === null) {
      return;
    }

    const pool = this.options.effectPools.getPickupPool(kind);
    const normalizedTargetSize = Math.max(0, Math.floor(targetSize));

    while (pool.size() < normalizedTargetSize) {
      const node = instantiate(prefab);
      node.active = false;
      applyLayerRecursive(node, layer.layer);

      if (!this.configureBadge(node, kind)) {
        node.destroy();
        return;
      }

      pool.put(node);
    }
  }

  public addWarmupNode(
    warmupNodes: WarmupNode[],
    kind: TransientRewardKind,
    layer: Node,
    prefab: Prefab | null,
  ): void {
    const pool = this.options.effectPools.getPickupPool(kind);
    const node = this.options.effectPools.getNode(pool, prefab, layer);

    if (node === null) {
      return;
    }

    if (!this.configureBadge(node, kind)) {
      this.options.effectPools.recycle(pool, node);
      return;
    }

    node.name = `RenderWarmup_${kind}`;
    node.setPosition(0, 0, 0);
    node.setScale(0.001, 0.001, 1);
    warmupNodes.push({ node, pool });
  }

  private spawnBadge(
    kind: TransientRewardKind,
    startPosition: Vec3,
    targetPosition: Vec3,
    index: number,
    count: number,
    prefab: Prefab | null,
    config: PickupRewardConfig,
  ): void {
    const layer = this.options.getFeedbackLayer();

    if (layer === null || prefab === null) {
      return;
    }

    const pickupPool = this.options.effectPools.getPickupPool(kind);
    const node = this.options.effectPools.getNode(pickupPool, prefab, layer);

    if (node === null) {
      return;
    }

    node.name = `Pickup_${kind}`;
    node.setPosition(startPosition);
    node.setScale(0.18, 0.18, 1);
    node.setRotationFromEuler(0, 0, getRandomRange(-14, 14));

    if (!this.configureBadge(node, kind)) {
      this.options.effectPools.recycle(pickupPool, node);
      return;
    }

    const offsetIndex = index - (count - 1) / 2;
    const side = offsetIndex === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(offsetIndex);
    const scatterDistance =
      getRandomRange(config.minScatterDistance, config.maxScatterDistance) +
      Math.abs(offsetIndex) * 22;
    const landingPosition = startPosition.clone();
    landingPosition.x += side * scatterDistance + getRandomRange(-28, 28);
    landingPosition.y -= getRandomRange(config.minFallDistance, config.maxFallDistance);

    const apexPosition = startPosition.clone();
    apexPosition.x += (landingPosition.x - startPosition.x) * getRandomRange(0.34, 0.52);
    apexPosition.y += getRandomRange(config.minArcHeight, config.maxArcHeight);

    const squashScale = getRandomRange(0.82, 0.94);

    tween(node)
      .delay(index * 0.025)
      .to(0.16, { position: apexPosition, scale: new Vec3(1.08, 1.08, 1) }, { easing: 'quadOut' })
      .to(
        0.24,
        { position: landingPosition, scale: new Vec3(squashScale, squashScale, 1) },
        { easing: 'quadIn' },
      )
      .call(() => this.options.spawnLandingStars(landingPosition))
      .delay(0.16)
      .to(0.34, { position: targetPosition, scale: new Vec3(0.34, 0.34, 1) }, { easing: 'quadIn' })
      .call(() => {
        this.options.playHudCounterPop(kind);
        this.options.effectPools.recycle(pickupPool, node);
      })
      .start();
  }

  private configureBadge(root: Node, kind: TransientRewardKind): boolean {
    const background = root.getChildByName('Background')?.getComponent(Sprite) ?? null;
    const label = root.getChildByName('Text')?.getComponent(Label) ?? null;
    const iconFrame = this.options.getResourceIconFrame(kind);

    if (background === null || label === null || iconFrame === null) {
      return false;
    }

    background.spriteFrame = iconFrame;
    background.sizeMode = Sprite.SizeMode.CUSTOM;
    background.color = Color.WHITE;
    label.node.active = false;
    return true;
  }
}

function getRandomRange(min: number, max: number): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return lower + Math.random() * (upper - lower);
}
