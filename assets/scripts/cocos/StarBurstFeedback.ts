import { Node, Prefab, tween, Tween, UIOpacity, Vec3 } from 'cc';

import type { TransientEffectPools } from './TransientEffectPools';

export type StarBurstConfig = {
  minCount: number;
  maxCount: number;
  minDistance: number;
  maxDistance: number;
  minScale: number;
  maxScale: number;
};

type StarBurstFeedbackOptions = {
  effectPools: TransientEffectPools;
  getFeedbackLayer: () => Node | null;
};

export class StarBurstFeedback {
  private readonly options: StarBurstFeedbackOptions;

  public constructor(options: StarBurstFeedbackOptions) {
    this.options = options;
  }

  public spawn(uiPosition: Vec3, prefab: Prefab | null, config: StarBurstConfig): void {
    const layer = this.options.getFeedbackLayer();

    if (layer === null || prefab === null) {
      return;
    }

    const count = getRandomInteger(config.minCount, config.maxCount);

    for (let index = 0; index < count; index += 1) {
      const node = this.options.effectPools.getNode(
        this.options.effectPools.starPool,
        prefab,
        layer,
      );

      if (node === null) {
        return;
      }

      const opacity = node.getComponent(UIOpacity);

      if (opacity === null) {
        this.options.effectPools.recycle(this.options.effectPools.starPool, node);
        continue;
      }

      const angle = (Math.PI * 2 * index) / count + getRandomRange(-0.42, 0.42);
      const distance = getRandomRange(config.minDistance, config.maxDistance);
      const targetPosition = new Vec3(
        uiPosition.x + Math.cos(angle) * distance,
        uiPosition.y + Math.sin(angle) * distance,
        uiPosition.z,
      );
      const scale = getRandomRange(config.minScale, config.maxScale);

      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(opacity);
      node.setPosition(uiPosition);
      node.setScale(scale, scale, 1);
      node.setRotationFromEuler(0, 0, getRandomRange(-35, 35));
      opacity.opacity = 245;

      tween(node)
        .to(0.84, { position: targetPosition, scale: Vec3.ZERO }, { easing: 'quadOut' })
        .call(() => this.options.effectPools.recycle(this.options.effectPools.starPool, node))
        .start();
      tween(opacity).delay(0.24).to(0.52, { opacity: 0 }, { easing: 'quadIn' }).start();
    }
  }
}

function getRandomRange(min: number, max: number): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return lower + Math.random() * (upper - lower);
}

function getRandomInteger(min: number, max: number): number {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}
