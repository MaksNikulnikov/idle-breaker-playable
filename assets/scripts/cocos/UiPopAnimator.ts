import { Node, tween, Tween, Vec3 } from 'cc';

export class UiPopAnimator {
  private readonly baseScales = new Map<Node, Vec3>();

  public play(node: Node | null): void {
    if (node === null) {
      return;
    }

    let baseScale = this.baseScales.get(node);

    if (baseScale === undefined) {
      baseScale = new Vec3();
      node.getScale(baseScale);
      this.baseScales.set(node, baseScale.clone());
    }

    const enlargedScale = new Vec3(baseScale.x * 1.16, baseScale.y * 1.16, baseScale.z);

    Tween.stopAllByTarget(node);
    node.setScale(baseScale);

    tween(node)
      .to(0.08, { scale: enlargedScale }, { easing: 'quadOut' })
      .to(0.12, { scale: baseScale.clone() }, { easing: 'quadIn' })
      .start();
  }
}
