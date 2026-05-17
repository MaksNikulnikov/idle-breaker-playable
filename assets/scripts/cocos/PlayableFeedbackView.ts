import {
  _decorator,
  Camera,
  Color,
  Component,
  director,
  EventHandler,
  instantiate,
  Label,
  Node,
  Prefab,
  Sprite,
  tween,
  Tween,
  UICoordinateTracker,
  UIOpacity,
  UITransform,
  Vec3,
  view,
  Widget,
} from 'cc';

import { HealthBarView } from './HealthBarView';
import { PlayableHudView } from './PlayableHudView';
import { WeaponUpgradePopupView } from './WeaponUpgradePopupView';

const { ccclass, disallowMultiple, property } = _decorator;

type RewardKind = 'wood' | 'metal';
type HealthBarVisibility = 'visible' | 'hide-soon' | 'hidden';

const HUD_TOP_MARGIN = 0;
const HUD_SIDE_MARGIN = 16;
const HUD_TARGET_SCREEN_WIDTH = 330;
const POPUP_SIDE_MARGIN = 32;
const POPUP_VERTICAL_MARGIN = 112;
const POPUP_TARGET_SCREEN_WIDTH = 370;
const POPUP_TARGET_SCREEN_HEIGHT = 280;
const UPGRADE_CARD_WIDTH = 440;
const UPGRADE_CARD_HEIGHT = 328;
const VICTORY_CONTENT_WIDTH = 360;
const VICTORY_CONTENT_HEIGHT = 230;
const VICTORY_TARGET_SCREEN_WIDTH = 340;
const VICTORY_TARGET_SCREEN_HEIGHT = 210;
const TMP_VEC3_A = new Vec3();
const TMP_VEC3_C = new Vec3();

function applyLayerRecursive(root: Node, layer: number): void {
  root.layer = layer;

  for (const child of root.children) {
    applyLayerRecursive(child, layer);
  }
}

class RuntimeHealthBar {
  private readonly node: Node;
  private readonly anchorNode: Node;
  private readonly view: HealthBarView;
  private readonly tracker: UICoordinateTracker;

  public constructor(parent: Node, name: string, prefab: Prefab, camera: Camera) {
    this.node = instantiate(prefab);
    this.node.name = name;
    applyLayerRecursive(this.node, parent.layer);
    parent.addChild(this.node);

    const healthBarView = this.node.getComponent(HealthBarView);

    if (healthBarView === null) {
      this.node.destroy();
      throw new Error('HealthBar prefab must have HealthBarView attached to its root node.');
    }

    this.view = healthBarView;

    if (!this.view.resolveReferences()) {
      this.node.destroy();
      throw new Error('HealthBarView must reference a cc.ProgressBar component.');
    }

    this.anchorNode = new Node(`${name}_WorldAnchor`);
    director.getScene()?.addChild(this.anchorNode);

    this.tracker = this.anchorNode.addComponent(UICoordinateTracker);
    this.tracker.camera = camera;
    this.tracker.target = parent;
    this.tracker.useScale = false;
    this.tracker.syncEvents = [this.createTrackerSyncEvent()];
  }

  public setWorldPosition(position: Vec3): void {
    this.anchorNode.setWorldPosition(position);
    this.tracker.update();
  }

  public setProgress(current: number, max: number): void {
    this.anchorNode.active = true;
    this.view.setProgress(current, max);
  }

  public hideAfter(delaySeconds: number): void {
    this.view.hideAfter(delaySeconds);
  }

  public setVisible(visible: boolean): void {
    this.anchorNode.active = visible;
    this.view.setVisible(visible);
  }

  public update(deltaTime: number): void {
    this.view.tick(deltaTime);
  }

  private createTrackerSyncEvent(): EventHandler {
    const event = new EventHandler();
    event.target = this.node;
    event.component = 'HealthBarView';
    event.handler = 'handleCoordinateSync';
    return event;
  }
}

@ccclass('PlayableFeedbackView')
@disallowMultiple
export class PlayableFeedbackView extends Component {
  @property({ type: Camera })
  public worldCamera: Camera | null = null;

  @property({ type: Node })
  public hudCanvas: Node | null = null;

  @property({ type: Node })
  public feedbackLayer: Node | null = null;

  @property({ type: Node })
  public rewardLayer: Node | null = null;

  @property({ type: PlayableHudView })
  public hudView: PlayableHudView | null = null;

  @property({ type: Prefab })
  public healthBarPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public weaponUpgradePopupPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public floatingLabelPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public impactBurstPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public pickupBadgePrefab: Prefab | null = null;

  private readonly resourceHealthBars = new Map<string, RuntimeHealthBar>();
  private readonly uiBaseScales = new Map<Node, Vec3>();
  private upgradePopupNode: Node | null = null;
  private upgradePopupDim: Node | null = null;
  private upgradePopupCard: Node | null = null;
  private gateHealthBar: RuntimeHealthBar | null = null;
  private completionContentRoot: Node | null = null;

  public hasRequiredReferences(): boolean {
    return (
      this.worldCamera !== null &&
      this.hudCanvas !== null &&
      this.feedbackLayer !== null &&
      this.rewardLayer !== null &&
      this.hudView !== null &&
      this.hudView.hasRequiredReferences() &&
      this.healthBarPrefab !== null &&
      this.weaponUpgradePopupPrefab !== null &&
      this.floatingLabelPrefab !== null &&
      this.impactBurstPrefab !== null &&
      this.pickupBadgePrefab !== null
    );
  }

  public refreshLayout(): void {
    if (this.hudCanvas === null || !this.hudCanvas.isValid) {
      return;
    }

    this.fitHudCanvasToScreen();
    this.pinTopHudPanel();
    this.refreshFullscreenLayer(this.feedbackLayer, this.hudCanvas);
    this.refreshFullscreenLayer(this.rewardLayer, this.hudCanvas);
    this.refreshFullscreenLayer(this.hudView?.getCompletionOverlay() ?? null, this.hudCanvas);
    this.refreshCompletionOverlayLayout();

    if (this.feedbackLayer !== null && this.feedbackLayer.isValid) {
      this.feedbackLayer.setSiblingIndex(0);
    }

    if (this.rewardLayer !== null && this.rewardLayer.isValid) {
      this.rewardLayer.setSiblingIndex(this.hudCanvas.children.length - 1);
    }

    this.refreshUpgradePopupLayout();
  }

  public updateHealthBars(deltaTime: number): void {
    for (const bar of this.resourceHealthBars.values()) {
      bar.update(deltaTime);
    }

    this.gateHealthBar?.update(deltaTime);
  }

  public clearTransientFeedback(): void {
    this.destroyUpgradePopup();
  }

  public onDestroy(): void {
    this.destroyUpgradePopup();
  }

  public setResourceHealthBar(
    resourceId: string,
    worldPosition: Vec3,
    current: number,
    max: number,
    visibility: HealthBarVisibility,
  ): void {
    const bar = this.getResourceHealthBar(resourceId);

    if (bar === null) {
      return;
    }

    bar.setWorldPosition(worldPosition);
    bar.setProgress(current, max);
    this.applyHealthBarVisibility(bar, visibility, 0.25);
  }

  public setGateHealthBar(
    worldPosition: Vec3,
    current: number,
    max: number,
    visibility: HealthBarVisibility,
  ): void {
    const bar = this.getGateHealthBar();

    if (bar === null) {
      return;
    }

    bar.setWorldPosition(worldPosition);
    bar.setProgress(current, max);
    this.applyHealthBarVisibility(bar, visibility, 0.35);
  }

  public updateResourceHealthBarPosition(resourceId: string, worldPosition: Vec3): void {
    this.resourceHealthBars.get(resourceId)?.setWorldPosition(worldPosition);
  }

  public updateGateHealthBarPosition(worldPosition: Vec3): void {
    this.gateHealthBar?.setWorldPosition(worldPosition);
  }

  public hideResourceHealthBar(resourceId: string, delaySeconds: number): void {
    this.resourceHealthBars.get(resourceId)?.hideAfter(delaySeconds);
  }

  public hideGateHealthBar(delaySeconds: number): void {
    this.gateHealthBar?.hideAfter(delaySeconds);
  }

  public spawnFloatingLabel(text: string, worldPosition: Vec3, color: Color): void {
    if (this.floatingLabelPrefab === null || !this.tryWorldToFeedbackPosition(worldPosition, TMP_VEC3_A)) {
      return;
    }

    const layer = this.getFeedbackLayer();

    if (layer === null) {
      return;
    }

    const node = instantiate(this.floatingLabelPrefab);
    node.name = 'FloatingLabel';
    applyLayerRecursive(node, layer.layer);
    layer.addChild(node);
    node.setPosition(TMP_VEC3_A);
    node.setScale(0.85, 0.85, 1);

    const label = node.getComponent(Label);
    const opacity = node.getComponent(UIOpacity);

    if (label === null || opacity === null) {
      node.destroy();
      return;
    }

    label.string = text;
    label.color = color;

    const endPosition = TMP_VEC3_A.clone();
    endPosition.y += 62;

    tween(node)
      .to(0.1, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'backOut' })
      .start();
    tween(node)
      .to(0.48, { position: endPosition }, { easing: 'quadOut' })
      .call(() => node.destroy())
      .start();
    tween(opacity).delay(0.2).to(0.24, { opacity: 0 }, { easing: 'quadIn' }).start();
  }

  public spawnImpactBurst(worldPosition: Vec3, scale = 1): void {
    if (this.impactBurstPrefab === null || !this.tryWorldToFeedbackPosition(worldPosition, TMP_VEC3_A)) {
      return;
    }

    const layer = this.getFeedbackLayer();

    if (layer === null) {
      return;
    }

    const node = instantiate(this.impactBurstPrefab);
    node.name = 'ImpactBurst';
    applyLayerRecursive(node, layer.layer);
    layer.addChild(node);
    node.setPosition(TMP_VEC3_A);
    node.setScale(0.35 * scale, 0.35 * scale, 1);

    const opacity = node.getComponent(UIOpacity);

    if (opacity === null) {
      node.destroy();
      return;
    }

    tween(node)
      .to(0.18, { scale: new Vec3(1.2 * scale, 1.2 * scale, 1) }, { easing: 'quadOut' })
      .call(() => node.destroy())
      .start();
    tween(opacity).to(0.18, { opacity: 0 }, { easing: 'quadIn' }).start();
  }

  public spawnPickupRewards(
    kind: RewardKind,
    rewardAmount: number,
    sourceWorldPosition: Vec3,
  ): void {
    if (!this.tryWorldToFeedbackPosition(sourceWorldPosition, TMP_VEC3_A)) {
      return;
    }

    const targetPosition = new Vec3();

    if (!this.tryGetCounterFeedbackPosition(kind, targetPosition)) {
      targetPosition.set(TMP_VEC3_A.x, TMP_VEC3_A.y + 110, 0);
    }

    const count = Math.max(1, rewardAmount);

    for (let index = 0; index < count; index += 1) {
      this.spawnPickupBadge(kind, TMP_VEC3_A, targetPosition, index, count);
    }
  }

  public playWeaponUpgrade(level: number, weaponName: string, unlockText: string): void {
    this.playNodePop(this.hudView?.getWeaponCounterNode() ?? null);
    this.playNodePop(this.hudView?.getObjectiveFeedbackNode() ?? null);
    this.showWeaponUpgradePopup(level, weaponName, unlockText);
  }

  private applyHealthBarVisibility(
    bar: RuntimeHealthBar,
    visibility: HealthBarVisibility,
    hideDelay: number,
  ): void {
    if (visibility === 'visible') {
      bar.setVisible(true);
      return;
    }

    if (visibility === 'hide-soon') {
      bar.hideAfter(hideDelay);
      return;
    }

    bar.setVisible(false);
  }

  private spawnPickupBadge(
    kind: RewardKind,
    startPosition: Vec3,
    targetPosition: Vec3,
    index: number,
    count: number,
  ): void {
    const layer = this.getFeedbackLayer();

    if (layer === null || this.pickupBadgePrefab === null) {
      return;
    }

    const node = instantiate(this.pickupBadgePrefab);
    node.name = `Pickup_${kind}`;
    applyLayerRecursive(node, layer.layer);
    layer.addChild(node);
    node.setPosition(startPosition);
    node.setScale(Vec3.ZERO);

    if (!this.configurePickupBadge(node, kind)) {
      node.destroy();
      return;
    }

    const offsetIndex = index - (count - 1) / 2;
    const scatterPosition = startPosition.clone();
    scatterPosition.x += offsetIndex * 34;
    scatterPosition.y += 54 + Math.abs(offsetIndex) * 10;

    tween(node)
      .to(0.13, { position: scatterPosition, scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .delay(0.12 + index * 0.04)
      .to(0.42, { position: targetPosition }, { easing: 'quadIn' })
      .call(() => {
        this.playHudCounterPop(kind);
        node.destroy();
      })
      .start();
  }

  private configurePickupBadge(root: Node, kind: RewardKind): boolean {
    const background = root.getChildByName('Background')?.getComponent(Sprite) ?? null;
    const label = root.getChildByName('Text')?.getComponent(Label) ?? null;

    if (background === null || label === null) {
      return false;
    }

    background.color =
      kind === 'wood' ? new Color(166, 105, 48, 255) : new Color(128, 157, 171, 255);
    label.string = kind === 'wood' ? 'WOOD' : 'METAL';
    return true;
  }

  private showWeaponUpgradePopup(
    level: number,
    weaponName: string,
    unlockText: string,
  ): void {
    const layer = this.getRewardLayer();

    if (layer === null || this.weaponUpgradePopupPrefab === null) {
      return;
    }

    this.destroyUpgradePopup();

    const root = instantiate(this.weaponUpgradePopupPrefab);
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
    popupView.applyContent(level, weaponName, unlockText);
    popupView.clearWeaponIcon();
    this.populateWeaponIcon(popupView, level);

    this.upgradePopupNode = root;
    this.upgradePopupDim = popupView.dimmer;
    this.upgradePopupCard = popupView.card;
    this.refreshUpgradePopupLayout();

    const targetScale = this.getUpgradePopupScale();
    tween(opacity).to(0.12, { opacity: 255 }, { easing: 'quadOut' }).start();

    if (popupView.card !== null) {
      popupView.card.setScale(targetScale * 0.78, targetScale * 0.78, 1);
      tween(popupView.card)
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
        if (this.upgradePopupNode === root) {
          this.upgradePopupNode = null;
          this.upgradePopupDim = null;
          this.upgradePopupCard = null;
        }

        root.destroy();
      })
      .start();
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

  private playHudCounterPop(kind: RewardKind): void {
    this.playNodePop(this.hudView?.getResourceCounterNode(kind) ?? null);
  }

  private playNodePop(node: Node | null): void {
    if (node === null) {
      return;
    }

    let baseScale = this.uiBaseScales.get(node);

    if (baseScale === undefined) {
      baseScale = new Vec3();
      node.getScale(baseScale);
      this.uiBaseScales.set(node, baseScale.clone());
    }

    const enlargedScale = new Vec3(baseScale.x * 1.16, baseScale.y * 1.16, baseScale.z);

    Tween.stopAllByTarget(node);
    node.setScale(baseScale);

    tween(node)
      .to(0.08, { scale: enlargedScale }, { easing: 'quadOut' })
      .to(0.12, { scale: baseScale.clone() }, { easing: 'quadIn' })
      .start();
  }

  private tryWorldToFeedbackPosition(worldPosition: Vec3, out: Vec3): boolean {
    const layer = this.getFeedbackLayer();

    if (this.worldCamera === null || layer === null) {
      return false;
    }

    this.worldCamera.convertToUINode(worldPosition, layer, out);
    return true;
  }

  private tryGetCounterFeedbackPosition(kind: RewardKind, out: Vec3): boolean {
    const layer = this.getFeedbackLayer();
    const layerTransform = layer?.getComponent(UITransform) ?? null;
    const target = this.hudView?.getResourceCounterNode(kind) ?? null;

    if (layerTransform === null || target === null) {
      return false;
    }

    target.getWorldPosition(TMP_VEC3_C);
    layerTransform.convertToNodeSpaceAR(TMP_VEC3_C, out);
    return true;
  }

  private getResourceHealthBar(resourceId: string): RuntimeHealthBar | null {
    const layer = this.getFeedbackLayer();

    if (layer === null || this.worldCamera === null || this.healthBarPrefab === null) {
      return null;
    }

    let bar = this.resourceHealthBars.get(resourceId);

    if (bar === undefined) {
      bar = new RuntimeHealthBar(
        layer,
        `HealthBar_${resourceId}`,
        this.healthBarPrefab,
        this.worldCamera,
      );
      this.resourceHealthBars.set(resourceId, bar);
    }

    return bar;
  }

  private getGateHealthBar(): RuntimeHealthBar | null {
    const layer = this.getFeedbackLayer();

    if (layer === null || this.worldCamera === null || this.healthBarPrefab === null) {
      return null;
    }

    this.gateHealthBar ??= new RuntimeHealthBar(
      layer,
      'HealthBar_ExitGate',
      this.healthBarPrefab,
      this.worldCamera,
    );
    return this.gateHealthBar;
  }

  private refreshUpgradePopupLayout(): void {
    if (this.upgradePopupNode === null || !this.upgradePopupNode.isValid) {
      return;
    }

    const target = this.rewardLayer ?? this.hudCanvas;

    if (target === null) {
      return;
    }

    this.refreshFullscreenLayer(this.upgradePopupNode, target);

    const dim =
      this.upgradePopupDim !== null && this.upgradePopupDim.isValid
        ? this.upgradePopupDim
        : this.upgradePopupNode.getChildByName('Dim');

    if (dim !== null) {
      this.refreshFullscreenLayer(dim, this.upgradePopupNode);
      dim.setSiblingIndex(0);
    }

    if (this.upgradePopupCard !== null && this.upgradePopupCard.isValid) {
      const scale = this.getUpgradePopupScale();
      this.upgradePopupCard.setScale(scale, scale, 1);
      this.upgradePopupCard.setPosition(0, 0, 0);
    }
  }

  private getUpgradePopupScale(): number {
    const availableWidth = Math.max(1, this.getHudWidth() - POPUP_SIDE_MARGIN * 2);
    const availableHeight = Math.max(1, this.getHudHeight() - POPUP_VERTICAL_MARGIN * 2);
    const fitCanvasScale = Math.min(
      availableWidth / UPGRADE_CARD_WIDTH,
      availableHeight / UPGRADE_CARD_HEIGHT,
    );
    const fitScreenScale = Math.min(
      this.getScreenWidthScale(UPGRADE_CARD_WIDTH, POPUP_TARGET_SCREEN_WIDTH),
      this.getScreenHeightScale(UPGRADE_CARD_HEIGHT, POPUP_TARGET_SCREEN_HEIGHT),
    );

    return Math.min(0.92, Math.max(0.56, Math.min(fitCanvasScale, fitScreenScale)));
  }

  private fitHudCanvasToScreen(): void {
    if (this.hudCanvas === null) {
      return;
    }

    const widget = this.hudCanvas.getComponent(Widget);

    if (widget === null) {
      return;
    }

    widget.target = null;
    widget.isAlignTop = true;
    widget.top = 0;
    widget.isAlignBottom = true;
    widget.bottom = 0;
    widget.isAlignLeft = true;
    widget.left = 0;
    widget.isAlignRight = true;
    widget.right = 0;
    widget.isAlignHorizontalCenter = false;
    widget.isAlignVerticalCenter = false;
    widget.alignMode = Widget.AlignMode.ALWAYS;
    widget.updateAlignment();
  }

  private pinTopHudPanel(): void {
    const panel = this.hudView?.getTopPanelNode() ?? null;

    if (panel === null) {
      return;
    }

    const widget = panel.getComponent(Widget);

    if (widget === null) {
      return;
    }

    widget.target = this.hudCanvas;
    widget.isAlignTop = true;
    widget.top = HUD_TOP_MARGIN;
    widget.isAlignBottom = false;
    widget.isAlignLeft = false;
    widget.isAlignRight = false;
    widget.isAlignHorizontalCenter = true;
    widget.horizontalCenter = 0;
    widget.isAlignVerticalCenter = false;
    widget.alignMode = Widget.AlignMode.ALWAYS;
    widget.updateAlignment();

    const transform = panel.getComponent(UITransform);
    const canvasWidth = this.getHudWidth();
    const panelWidth = transform?.contentSize.width ?? 360;
    const fitCanvasScale = (canvasWidth - HUD_SIDE_MARGIN * 2) / panelWidth;
    const fitScreenScale = this.getScreenWidthScale(panelWidth, HUD_TARGET_SCREEN_WIDTH);
    const scale = Math.min(1, Math.max(0.58, Math.min(fitCanvasScale, fitScreenScale)));
    panel.setScale(scale, scale, 1);
  }

  private refreshCompletionOverlayLayout(): void {
    const overlay = this.hudView?.getCompletionOverlay() ?? null;

    if (overlay === null || !overlay.isValid) {
      this.completionContentRoot = null;
      return;
    }

    const dimmer = overlay.getChildByName('VictoryDimmer');

    if (dimmer !== null) {
      this.refreshFullscreenLayer(dimmer, overlay);
      dimmer.setSiblingIndex(0);
    }

    const contentRoot = this.getCompletionContentRoot(overlay);

    if (contentRoot === null) {
      return;
    }

    const scale = this.getCompletionOverlayScale();
    contentRoot.setPosition(0, 0, 0);
    contentRoot.setScale(scale, scale, 1);
    contentRoot.setSiblingIndex(overlay.children.length - 1);
  }

  private getCompletionContentRoot(overlay: Node): Node | null {
    if (this.completionContentRoot !== null && this.completionContentRoot.isValid) {
      return this.completionContentRoot;
    }

    const contentRoot = overlay.getChildByName('VictoryContentRoot');

    this.completionContentRoot = contentRoot;
    return contentRoot;
  }

  private getCompletionOverlayScale(): number {
    const availableWidth = Math.max(1, this.getHudWidth() - POPUP_SIDE_MARGIN * 2);
    const availableHeight = Math.max(1, this.getHudHeight() - POPUP_VERTICAL_MARGIN * 2);
    const fitCanvasScale = Math.min(
      availableWidth / VICTORY_CONTENT_WIDTH,
      availableHeight / VICTORY_CONTENT_HEIGHT,
    );
    const fitScreenScale = Math.min(
      this.getScreenWidthScale(VICTORY_CONTENT_WIDTH, VICTORY_TARGET_SCREEN_WIDTH),
      this.getScreenHeightScale(VICTORY_CONTENT_HEIGHT, VICTORY_TARGET_SCREEN_HEIGHT),
    );

    return Math.min(1, Math.max(0.58, Math.min(fitCanvasScale, fitScreenScale)));
  }

  private getScreenWidthScale(contentWidth: number, targetScreenWidth: number): number {
    return targetScreenWidth / Math.max(1, contentWidth * Math.max(0.0001, view.getScaleX()));
  }

  private getScreenHeightScale(contentHeight: number, targetScreenHeight: number): number {
    return targetScreenHeight / Math.max(1, contentHeight * Math.max(0.0001, view.getScaleY()));
  }

  private refreshFullscreenLayer(node: Node | null, target: Node | null): void {
    if (node === null || target === null || !node.isValid || !target.isValid) {
      return;
    }

    const targetTransform = target.getComponent(UITransform);
    const layerTransform = node.getComponent(UITransform);

    if (layerTransform === null) {
      return;
    }

    if (targetTransform !== null) {
      layerTransform.setContentSize(targetTransform.contentSize);
    }

    node.setPosition(0, 0, 0);

    const widget = node.getComponent(Widget);

    if (widget === null) {
      return;
    }

    widget.target = target;
    widget.isAlignTop = true;
    widget.top = 0;
    widget.isAlignBottom = true;
    widget.bottom = 0;
    widget.isAlignLeft = true;
    widget.left = 0;
    widget.isAlignRight = true;
    widget.right = 0;
    widget.isAlignHorizontalCenter = false;
    widget.isAlignVerticalCenter = false;
    widget.alignMode = Widget.AlignMode.ALWAYS;
    widget.updateAlignment();
  }

  private getRewardLayer(): Node | null {
    if (this.rewardLayer === null || !this.rewardLayer.isValid) {
      return null;
    }

    this.refreshFullscreenLayer(this.rewardLayer, this.hudCanvas);
    this.rewardLayer.setSiblingIndex((this.hudCanvas?.children.length ?? 1) - 1);

    return this.rewardLayer;
  }

  private getFeedbackLayer(): Node | null {
    if (this.feedbackLayer === null || !this.feedbackLayer.isValid) {
      return null;
    }

    this.refreshFullscreenLayer(this.feedbackLayer, this.hudCanvas);
    this.feedbackLayer.setSiblingIndex(0);

    return this.feedbackLayer;
  }

  private destroyUpgradePopup(): void {
    if (this.upgradePopupNode === null || !this.upgradePopupNode.isValid) {
      this.upgradePopupNode = null;
      return;
    }

    Tween.stopAllByTarget(this.upgradePopupNode);
    this.upgradePopupNode.destroy();
    this.upgradePopupNode = null;
    this.upgradePopupDim = null;
    this.upgradePopupCard = null;
  }

  private getHudWidth(): number {
    return this.hudCanvas?.getComponent(UITransform)?.contentSize.width ?? 720;
  }

  private getHudHeight(): number {
    return this.hudCanvas?.getComponent(UITransform)?.contentSize.height ?? 1280;
  }
}
