import { Color, Label, Node, NodePool, Prefab, tween, Tween, UIOpacity, Vec3 } from 'cc';

import type { TransientEffectPools } from './TransientEffectPools';

type WarmupNode = {
  node: Node;
  pool: NodePool;
};

type FloatingLabelFeedbackOptions = {
  effectPools: TransientEffectPools;
  getFeedbackLayer: () => Node | null;
};

export class FloatingLabelFeedback {
  private readonly options: FloatingLabelFeedbackOptions;

  public constructor(options: FloatingLabelFeedbackOptions) {
    this.options = options;
  }

  public spawn(text: string, uiPosition: Vec3, color: Color, prefab: Prefab | null): void {
    const layer = this.options.getFeedbackLayer();

    if (layer === null || prefab === null) {
      return;
    }

    const node = this.options.effectPools.getNode(
      this.options.effectPools.floatingLabelPool,
      prefab,
      layer,
    );

    if (node === null) {
      return;
    }

    node.name = 'FloatingLabel';
    node.setPosition(uiPosition);
    node.setScale(0.85, 0.85, 1);

    const label = node.getComponent(Label);
    const opacity = node.getComponent(UIOpacity);

    if (label === null || opacity === null) {
      this.options.effectPools.recycle(this.options.effectPools.floatingLabelPool, node);
      return;
    }

    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    label.string = text;
    label.color = color;
    opacity.opacity = 255;

    const endPosition = uiPosition.clone();
    endPosition.y += 62;

    tween(node)
      .to(0.1, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'backOut' })
      .start();
    tween(node)
      .to(0.48, { position: endPosition }, { easing: 'quadOut' })
      .call(() =>
        this.options.effectPools.recycle(this.options.effectPools.floatingLabelPool, node),
      )
      .start();
    tween(opacity).delay(0.2).to(0.24, { opacity: 0 }, { easing: 'quadIn' }).start();
  }

  public addWarmupNode(warmupNodes: WarmupNode[], layer: Node, prefab: Prefab | null): void {
    const node = this.options.effectPools.getNode(
      this.options.effectPools.floatingLabelPool,
      prefab,
      layer,
    );

    if (node === null) {
      return;
    }

    const label = node.getComponent(Label);
    const opacity = node.getComponent(UIOpacity);

    if (label === null || opacity === null) {
      this.options.effectPools.recycle(this.options.effectPools.floatingLabelPool, node);
      return;
    }

    node.name = 'RenderWarmup_Label';
    node.setPosition(0, 0, 0);
    node.setScale(0.001, 0.001, 1);
    label.string = '0123456789LVUPGRADE';
    label.color = Color.WHITE;
    opacity.opacity = 255;
    warmupNodes.push({ node, pool: this.options.effectPools.floatingLabelPool });
  }
}
