import { Node, Prefab, tween, Tween, UIOpacity, Vec3 } from 'cc';

import type { TransientEffectPools } from './TransientEffectPools';

type ImpactBurstFeedbackOptions = {
  effectPools: TransientEffectPools;
  getFeedbackLayer: () => Node | null;
};

export class ImpactBurstFeedback {
  private readonly options: ImpactBurstFeedbackOptions;

  public constructor(options: ImpactBurstFeedbackOptions) {
    this.options = options;
  }

  public spawn(uiPosition: Vec3, prefab: Prefab | null, scale = 1): void {
    const layer = this.options.getFeedbackLayer();

    if (layer === null || prefab === null) {
      return;
    }

    const node = this.options.effectPools.getNode(
      this.options.effectPools.impactBurstPool,
      prefab,
      layer,
    );

    if (node === null) {
      return;
    }

    node.name = 'ImpactBurst';
    node.setPosition(uiPosition);
    node.setScale(0.35 * scale, 0.35 * scale, 1);

    const opacity = node.getComponent(UIOpacity);

    if (opacity === null) {
      this.options.effectPools.recycle(this.options.effectPools.impactBurstPool, node);
      return;
    }

    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    opacity.opacity = 255;

    tween(node)
      .to(0.18, { scale: new Vec3(1.2 * scale, 1.2 * scale, 1) }, { easing: 'quadOut' })
      .call(() => this.options.effectPools.recycle(this.options.effectPools.impactBurstPool, node))
      .start();
    tween(opacity).to(0.18, { opacity: 0 }, { easing: 'quadIn' }).start();
  }
}
