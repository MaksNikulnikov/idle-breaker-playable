import { instantiate, Node, Prefab, tween, Tween, UIOpacity, Vec3 } from 'cc';

import { applyLayerRecursive } from './NodeLayerUtils';
import { PlayableFeedbackLayout } from './PlayableFeedbackLayout';
import { WeaponUpgradePopupView } from './WeaponUpgradePopupView';

type WeaponUpgradePopupPresenterOptions = {
  layout: PlayableFeedbackLayout;
  getLayer: () => Node | null;
  getHudCanvas: () => Node | null;
};

export class WeaponUpgradePopupPresenter {
  private readonly options: WeaponUpgradePopupPresenterOptions;
  private root: Node | null = null;
  private dimmer: Node | null = null;
  private card: Node | null = null;
  private opacity: UIOpacity | null = null;

  public constructor(options: WeaponUpgradePopupPresenterOptions) {
    this.options = options;
  }

  public show(
    prefab: Prefab | null,
    level: number,
    weaponName: string,
    unlockText: string,
    powerBonus: number,
  ): void {
    const layer = this.options.getLayer();

    if (layer === null || prefab === null) {
      return;
    }

    this.destroy();

    const root = instantiate(prefab);
    root.name = 'WeaponUpgradePopup';
    applyLayerRecursive(root, layer.layer);
    layer.addChild(root);

    const popupView = root.getComponent(WeaponUpgradePopupView);
    const opacity = root.getComponent(UIOpacity);

    if (popupView === null || opacity === null || !popupView.hasRequiredReferences()) {
      root.destroy();
      return;
    }

    opacity.opacity = 0;
    popupView.applyContent(level, weaponName, unlockText, powerBonus);
    popupView.clearWeaponIcon();
    this.populateWeaponIcon(popupView, level);

    this.root = root;
    this.dimmer = popupView.dimmer;
    this.card = popupView.card;
    this.opacity = opacity;
    this.refreshLayout();
    this.playShowAnimation(root, opacity, popupView.card);
  }

  public refreshLayout(): void {
    if (this.root === null || !this.root.isValid) {
      this.clearReferences();
      return;
    }

    this.options.layout.refreshUpgradePopupLayout(
      this.root,
      this.dimmer,
      this.card,
      this.options.getLayer(),
      this.options.getHudCanvas(),
    );
  }

  public destroy(): void {
    if (this.root === null || !this.root.isValid) {
      this.clearReferences();
      return;
    }

    Tween.stopAllByTarget(this.root);

    if (this.card !== null) {
      Tween.stopAllByTarget(this.card);
    }

    if (this.opacity !== null) {
      Tween.stopAllByTarget(this.opacity);
    }

    this.root.destroy();
    this.clearReferences();
  }

  private populateWeaponIcon(popupView: WeaponUpgradePopupView, level: number): void {
    const iconRoot = popupView.weaponIconRoot;

    if (iconRoot === null || !popupView.applyWeaponIcon(level)) {
      return;
    }

    Tween.stopAllByTarget(iconRoot);
    iconRoot.setScale(0.72, 0.72, 1);
    tween(iconRoot)
      .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
  }

  private playShowAnimation(root: Node, opacity: UIOpacity, card: Node | null): void {
    const targetScale = this.options.layout.getUpgradePopupScale(this.options.getHudCanvas());
    tween(opacity).to(0.12, { opacity: 255 }, { easing: 'quadOut' }).start();

    if (card !== null) {
      card.setScale(targetScale * 0.78, targetScale * 0.78, 1);
      tween(card)
        .to(
          0.2,
          { scale: new Vec3(targetScale * 1.05, targetScale * 1.05, 1) },
          { easing: 'backOut' },
        )
        .to(0.08, { scale: new Vec3(targetScale, targetScale, 1) }, { easing: 'quadIn' })
        .delay(1.02)
        .to(
          0.16,
          { scale: new Vec3(targetScale * 0.92, targetScale * 0.92, 1) },
          { easing: 'quadIn' },
        )
        .start();
    }

    tween(opacity).delay(1.3).to(0.16, { opacity: 0 }, { easing: 'quadIn' }).start();
    tween(root)
      .delay(1.5)
      .call(() => {
        if (this.root === root) {
          this.clearReferences();
        }

        root.destroy();
      })
      .start();
  }

  private clearReferences(): void {
    this.root = null;
    this.dimmer = null;
    this.card = null;
    this.opacity = null;
  }
}
