import {
  _decorator,
  Camera,
  Color,
  Component,
  Graphics,
  instantiate,
  Node,
  NodePool,
  Prefab,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';

import { drawDashedZone } from './DashedZoneRenderer';
import { FloatingLabelFeedback } from './FloatingLabelFeedback';
import { ImpactBurstFeedback } from './ImpactBurstFeedback';
import { applyLayerRecursive } from './NodeLayerUtils';
import { PlayableFeedbackLayout } from './PlayableFeedbackLayout';
import { PlayableHudView } from './PlayableHudView';
import { PickupRewardFeedback, type PickupRewardConfig } from './PickupRewardFeedback';
import { RuntimeHealthBar } from './RuntimeHealthBar';
import { StarBurstFeedback, type StarBurstConfig } from './StarBurstFeedback';
import { TransientEffectPools, type TransientRewardKind } from './TransientEffectPools';
import { UiPopAnimator } from './UiPopAnimator';
import { WeaponUpgradePopupPresenter } from './WeaponUpgradePopupPresenter';
import { WorldTrackedZoneView, type WorldTrackedZoneConfig } from './WorldTrackedZoneView';

const { ccclass, disallowMultiple, property } = _decorator;

type RewardKind = TransientRewardKind;
type HealthBarVisibility = 'visible' | 'hide-soon' | 'hidden';

const DEFAULT_HUD_TARGET_SCREEN_WIDTH = 396;
const DEFAULT_UPGRADE_ZONE_WIDTH = 294;
const DEFAULT_UPGRADE_ZONE_HEIGHT = 162;
const DEFAULT_UPGRADE_ZONE_RADIUS = 36;
const DEFAULT_UPGRADE_ZONE_DASH_LENGTH = 20;
const DEFAULT_UPGRADE_ZONE_GAP_LENGTH = 12;
const DEFAULT_TARGET_HINT_ZONE_PADDING = 22;
const DEFAULT_TARGET_HINT_ZONE_MIN_WIDTH = 70;
const DEFAULT_TARGET_HINT_ZONE_MIN_HEIGHT = 44;
const TMP_VEC3_A = new Vec3();
const TMP_VEC3_B = new Vec3();
const TMP_VEC3_C = new Vec3();
const TMP_VEC3_D = new Vec3();

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
  public targetHintLayer: Node | null = null;

  @property({ type: Node })
  public rewardLayer: Node | null = null;

  @property({ type: PlayableHudView })
  public hudView: PlayableHudView | null = null;

  @property({ type: Prefab })
  public healthBarPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public upgradeStationZonePrefab: Prefab | null = null;

  @property({ type: Prefab })
  public weaponUpgradePopupPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public floatingLabelPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public impactBurstPrefab: Prefab | null = null;

  @property({ type: Prefab })
  public pickupBadgePrefab: Prefab | null = null;

  @property({ type: Prefab })
  public starBurstPrefab: Prefab | null = null;

  @property
  public pickupPrewarmCountPerResource = 8;

  @property
  public impactPrewarmCount = 6;

  @property
  public starPrewarmCount = 28;

  @property
  public floatingLabelPrewarmCount = 8;

  @property
  public pickupMinScatterDistance = 90;

  @property
  public pickupMaxScatterDistance = 165;

  @property
  public pickupMinArcHeight = 62;

  @property
  public pickupMaxArcHeight = 118;

  @property
  public pickupMinFallDistance = 32;

  @property
  public pickupMaxFallDistance = 70;

  @property
  public hitStarMinCount = 5;

  @property
  public hitStarMaxCount = 8;

  @property
  public landingStarMinCount = 2;

  @property
  public landingStarMaxCount = 5;

  @property
  public topHudTargetScreenWidth = DEFAULT_HUD_TARGET_SCREEN_WIDTH;

  @property
  public upgradeStationZoneWidth = DEFAULT_UPGRADE_ZONE_WIDTH;

  @property
  public upgradeStationZoneHeight = DEFAULT_UPGRADE_ZONE_HEIGHT;

  @property
  public upgradeStationZoneRadius = DEFAULT_UPGRADE_ZONE_RADIUS;

  @property
  public upgradeStationZoneDashLength = DEFAULT_UPGRADE_ZONE_DASH_LENGTH;

  @property
  public upgradeStationZoneGapLength = DEFAULT_UPGRADE_ZONE_GAP_LENGTH;

  @property
  public targetHintZoneWidth = DEFAULT_UPGRADE_ZONE_WIDTH;

  @property
  public targetHintZoneHeight = DEFAULT_UPGRADE_ZONE_HEIGHT;

  @property
  public targetHintZoneRadius = DEFAULT_UPGRADE_ZONE_RADIUS;

  @property
  public targetHintZoneDashLength = DEFAULT_UPGRADE_ZONE_DASH_LENGTH;

  @property
  public targetHintZoneGapLength = DEFAULT_UPGRADE_ZONE_GAP_LENGTH;

  @property
  public targetHintZonePadding = DEFAULT_TARGET_HINT_ZONE_PADDING;

  @property
  public targetHintZoneMinWidth = DEFAULT_TARGET_HINT_ZONE_MIN_WIDTH;

  @property
  public targetHintZoneMinHeight = DEFAULT_TARGET_HINT_ZONE_MIN_HEIGHT;

  @property
  public targetHintBlinkCount = 2;

  @property
  public targetHintBlinkSeconds = 0.16;

  private readonly resourceHealthBars = new Map<string, RuntimeHealthBar>();
  private readonly effectPools = new TransientEffectPools();
  private readonly layout = new PlayableFeedbackLayout();
  private readonly popAnimator = new UiPopAnimator();
  private readonly floatingLabelFeedback = new FloatingLabelFeedback({
    effectPools: this.effectPools,
    getFeedbackLayer: () => this.getFeedbackLayer(),
  });
  private readonly impactBurstFeedback = new ImpactBurstFeedback({
    effectPools: this.effectPools,
    getFeedbackLayer: () => this.getFeedbackLayer(),
  });
  private readonly starBurstFeedback = new StarBurstFeedback({
    effectPools: this.effectPools,
    getFeedbackLayer: () => this.getFeedbackLayer(),
  });
  private readonly pickupRewardFeedback = new PickupRewardFeedback({
    effectPools: this.effectPools,
    getFeedbackLayer: () => this.getFeedbackLayer(),
    getResourceIconFrame: (kind) => this.hudView?.getResourceIconFrame(kind) ?? null,
    tryGetCounterPosition: (kind, out) => this.tryGetCounterFeedbackPosition(kind, out),
    spawnLandingStars: (uiPosition) => this.spawnLandingStars(uiPosition),
    playHudCounterPop: (kind) => this.playHudCounterPop(kind),
  });
  private readonly upgradeStationZone = new WorldTrackedZoneView({
    name: 'UpgradeStationZone',
    getLayer: () => this.getTargetHintLayer(),
    getWorldCamera: () => this.worldCamera,
  });
  private readonly weaponUpgradePopupPresenter = new WeaponUpgradePopupPresenter({
    layout: this.layout,
    getLayer: () => this.getRewardLayer(),
    getHudCanvas: () => this.hudCanvas,
  });
  private targetHintNode: Node | null = null;
  private targetHintGraphics: Graphics | null = null;
  private targetHintOpacity: UIOpacity | null = null;
  private targetHintPrefab: Prefab | null = null;
  private targetHintHasWorldSize = false;
  private readonly targetHintWorldPosition = new Vec3();
  private readonly targetHintWorldSize = new Vec3();
  private readonly targetHintRenderedSize = new Vec3(
    DEFAULT_UPGRADE_ZONE_WIDTH,
    DEFAULT_UPGRADE_ZONE_HEIGHT,
    0,
  );
  private transientRenderWarmupDone = false;
  private gateHealthBar: RuntimeHealthBar | null = null;

  public hasRequiredReferences(): boolean {
    return (
      this.worldCamera !== null &&
      this.hudCanvas !== null &&
      this.feedbackLayer !== null &&
      this.targetHintLayer !== null &&
      this.rewardLayer !== null &&
      this.hudView !== null &&
      this.hudView.hasRequiredReferences() &&
      this.healthBarPrefab !== null &&
      this.upgradeStationZonePrefab !== null &&
      this.weaponUpgradePopupPrefab !== null &&
      this.floatingLabelPrefab !== null &&
      this.impactBurstPrefab !== null &&
      this.pickupBadgePrefab !== null &&
      this.starBurstPrefab !== null
    );
  }

  public refreshLayout(): void {
    if (this.hudCanvas === null || !this.hudCanvas.isValid) {
      return;
    }

    this.layout.fitHudCanvasToScreen(this.hudCanvas);
    this.layout.pinTopHudPanel(this.hudView, this.hudCanvas, this.topHudTargetScreenWidth);
    this.layout.refreshFullscreenLayer(this.feedbackLayer, this.hudCanvas);
    this.layout.refreshFullscreenLayer(this.rewardLayer, this.hudCanvas);
    this.layout.refreshCompletionOverlayLayout(this.hudView, this.hudCanvas);

    if (this.feedbackLayer !== null && this.feedbackLayer.isValid) {
      this.feedbackLayer.setSiblingIndex(0);
    }

    if (this.rewardLayer !== null && this.rewardLayer.isValid) {
      this.rewardLayer.setSiblingIndex(this.hudCanvas.children.length - 1);
    }

    this.weaponUpgradePopupPresenter.refreshLayout();
    this.refreshUpgradeStationZoneLayout();
    this.refreshTargetHintLayout();
    this.layout.markClean();
  }

  public refreshLayoutIfNeeded(): void {
    if (this.layout.shouldRefreshLayout()) {
      this.refreshLayout();
    }
  }

  public updateHealthBars(deltaTime: number): void {
    for (const bar of this.resourceHealthBars.values()) {
      bar.update(deltaTime);
    }

    this.gateHealthBar?.update(deltaTime);
    this.upgradeStationZone.update(deltaTime);
  }

  public clearTransientFeedback(): void {
    this.weaponUpgradePopupPresenter.destroy();
    this.effectPools.clearActive();
    this.setUpgradeStationZone(TMP_VEC3_A, false);
    this.hideTargetHint();
  }

  public onDestroy(): void {
    this.weaponUpgradePopupPresenter.destroy();
    this.effectPools.clearActive();
    this.effectPools.clearPools();
    this.upgradeStationZone.destroy();
    this.destroyTargetHint();
  }

  public setUpgradeStationZone(worldPosition: Vec3, visible: boolean): void {
    this.upgradeStationZone.setVisible(
      worldPosition,
      visible,
      this.upgradeStationZonePrefab,
      this.getUpgradeStationZoneConfig(),
    );
  }

  public prepareTargetHint(prefab: Prefab | null): void {
    this.ensureTargetHint(prefab);
  }

  public playTargetHint(
    worldPosition: Vec3,
    worldSize: Vec3 | null = null,
    prefab: Prefab | null = null,
  ): void {
    this.ensureTargetHint(prefab);

    if (
      this.targetHintNode === null ||
      this.targetHintGraphics === null ||
      this.targetHintOpacity === null
    ) {
      return;
    }

    this.targetHintWorldPosition.set(worldPosition);
    this.targetHintHasWorldSize = worldSize !== null;

    if (worldSize !== null) {
      this.targetHintWorldSize.set(worldSize);
    }

    this.updateTargetHintZoneLayout();

    if (!this.tryWorldToTargetHintPosition(worldPosition, TMP_VEC3_C)) {
      return;
    }

    this.targetHintNode.setPosition(TMP_VEC3_C);
    this.targetHintNode.active = true;
    this.targetHintNode.setScale(1, 1, 1);
    this.targetHintOpacity.opacity = 0;

    Tween.stopAllByTarget(this.targetHintNode);
    Tween.stopAllByTarget(this.targetHintOpacity);

    let opacityTween = tween(this.targetHintOpacity);
    const blinkCount = Math.max(1, Math.floor(this.targetHintBlinkCount));
    const blinkSeconds = Math.max(0.04, this.targetHintBlinkSeconds);

    for (let index = 0; index < blinkCount; index += 1) {
      opacityTween = opacityTween
        .to(blinkSeconds, { opacity: 255 }, { easing: 'quadOut' })
        .to(blinkSeconds, { opacity: 55 }, { easing: 'quadIn' });
    }

    opacityTween
      .to(blinkSeconds, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        if (this.targetHintNode !== null) {
          this.targetHintNode.active = false;
        }
      })
      .start();

    tween(this.targetHintNode)
      .to(blinkSeconds, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'quadOut' })
      .to(blinkSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
      .union()
      .repeat(blinkCount)
      .start();
  }

  public syncTargetHint(worldPosition: Vec3, worldSize: Vec3 | null = null): void {
    if (
      this.targetHintNode === null ||
      this.targetHintGraphics === null ||
      !this.targetHintNode.isValid
    ) {
      return;
    }

    this.targetHintWorldPosition.set(worldPosition);
    this.targetHintHasWorldSize = worldSize !== null;

    if (worldSize !== null) {
      this.targetHintWorldSize.set(worldSize);
    }

    if (this.targetHintNode.active) {
      this.syncTargetHintPosition();
    }
  }

  public hideTargetHint(): void {
    if (this.targetHintNode !== null) {
      Tween.stopAllByTarget(this.targetHintNode);
      this.targetHintNode.active = false;
    }

    if (this.targetHintOpacity !== null) {
      Tween.stopAllByTarget(this.targetHintOpacity);
      this.targetHintOpacity.opacity = 0;
    }

    this.targetHintHasWorldSize = false;
  }

  public prewarmTransientEffects(): void {
    const layer = this.getFeedbackLayer();

    if (layer === null) {
      return;
    }

    this.prewarmPickupPool('wood', layer);
    this.prewarmPickupPool('metal', layer);
    this.effectPools.prewarmPool(
      this.effectPools.impactBurstPool,
      this.impactBurstPrefab,
      layer,
      this.impactPrewarmCount,
    );
    this.effectPools.prewarmPool(
      this.effectPools.starPool,
      this.starBurstPrefab,
      layer,
      this.starPrewarmCount,
    );
    this.effectPools.prewarmPool(
      this.effectPools.floatingLabelPool,
      this.floatingLabelPrefab,
      layer,
      this.floatingLabelPrewarmCount,
    );
  }

  public warmupTransientRenderers(): void {
    if (this.transientRenderWarmupDone) {
      return;
    }

    const layer = this.getFeedbackLayer();

    if (layer === null) {
      return;
    }

    const warmupNodes: Array<{ node: Node; pool: NodePool }> = [];
    this.addPooledWarmupNode(
      warmupNodes,
      this.effectPools.impactBurstPool,
      this.impactBurstPrefab,
      layer,
    );
    this.addPooledWarmupNode(warmupNodes, this.effectPools.starPool, this.starBurstPrefab, layer);
    this.addPickupWarmupNode(warmupNodes, 'wood', layer);
    this.addPickupWarmupNode(warmupNodes, 'metal', layer);
    this.floatingLabelFeedback.addWarmupNode(warmupNodes, layer, this.floatingLabelPrefab);

    if (warmupNodes.length === 0) {
      return;
    }

    this.transientRenderWarmupDone = true;
    this.scheduleOnce(() => {
      for (const { node, pool } of warmupNodes) {
        this.effectPools.recycle(pool, node);
      }
    }, 0.08);
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
    if (
      this.floatingLabelPrefab === null ||
      !this.tryWorldToFeedbackPosition(worldPosition, TMP_VEC3_A)
    ) {
      return;
    }

    this.floatingLabelFeedback.spawn(text, TMP_VEC3_A, color, this.floatingLabelPrefab);
  }

  public spawnImpactBurst(worldPosition: Vec3, scale = 1): void {
    if (!this.tryWorldToFeedbackPosition(worldPosition, TMP_VEC3_A)) {
      return;
    }

    this.impactBurstFeedback.spawn(TMP_VEC3_A, this.impactBurstPrefab, scale);
  }

  public spawnPickupRewards(kind: RewardKind, sourceWorldPosition: Vec3): void {
    if (!this.tryWorldToFeedbackPosition(sourceWorldPosition, TMP_VEC3_A)) {
      return;
    }

    this.pickupRewardFeedback.spawnRewards(
      kind,
      TMP_VEC3_A,
      this.pickupBadgePrefab,
      this.getPickupRewardConfig(),
    );
  }

  public spawnHitStars(worldPosition: Vec3): void {
    if (!this.tryWorldToFeedbackPosition(worldPosition, TMP_VEC3_A)) {
      return;
    }

    this.starBurstFeedback.spawn(TMP_VEC3_A, this.starBurstPrefab, this.getHitStarConfig());
  }

  public playWeaponUpgrade(
    level: number,
    weaponName: string,
    unlockText: string,
    powerBonus: number,
  ): void {
    this.popAnimator.play(this.hudView?.getWeaponCounterNode() ?? null);
    this.popAnimator.play(this.hudView?.getObjectiveFeedbackNode() ?? null);
    this.weaponUpgradePopupPresenter.show(
      this.weaponUpgradePopupPrefab,
      level,
      weaponName,
      unlockText,
      powerBonus,
    );
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

  private addPooledWarmupNode(
    warmupNodes: Array<{ node: Node; pool: NodePool }>,
    pool: NodePool,
    prefab: Prefab | null,
    layer: Node,
  ): void {
    const node = this.effectPools.getNode(pool, prefab, layer);

    if (node === null) {
      return;
    }

    node.name = 'RenderWarmup';
    node.setPosition(0, 0, 0);
    node.setScale(0.001, 0.001, 1);

    const opacity = node.getComponent(UIOpacity);

    if (opacity !== null) {
      opacity.opacity = 255;
    }

    warmupNodes.push({ node, pool });
  }

  private addPickupWarmupNode(
    warmupNodes: Array<{ node: Node; pool: NodePool }>,
    kind: RewardKind,
    layer: Node,
  ): void {
    this.pickupRewardFeedback.addWarmupNode(warmupNodes, kind, layer, this.pickupBadgePrefab);
  }

  private spawnLandingStars(uiPosition: Vec3): void {
    this.starBurstFeedback.spawn(uiPosition, this.starBurstPrefab, this.getLandingStarConfig());
  }

  private getHitStarConfig(): StarBurstConfig {
    return {
      minCount: this.hitStarMinCount,
      maxCount: this.hitStarMaxCount,
      minDistance: 72,
      maxDistance: 148,
      minScale: 0.9,
      maxScale: 1.35,
    };
  }

  private getLandingStarConfig(): StarBurstConfig {
    return {
      minCount: this.landingStarMinCount,
      maxCount: this.landingStarMaxCount,
      minDistance: 34,
      maxDistance: 72,
      minScale: 0.58,
      maxScale: 0.86,
    };
  }

  private prewarmPickupPool(kind: RewardKind, layer: Node): void {
    this.pickupRewardFeedback.prewarmPool(
      kind,
      layer,
      this.pickupBadgePrefab,
      this.pickupPrewarmCountPerResource,
    );
  }

  private getPickupRewardConfig(): PickupRewardConfig {
    return {
      minScatterDistance: this.pickupMinScatterDistance,
      maxScatterDistance: this.pickupMaxScatterDistance,
      minArcHeight: this.pickupMinArcHeight,
      maxArcHeight: this.pickupMaxArcHeight,
      minFallDistance: this.pickupMinFallDistance,
      maxFallDistance: this.pickupMaxFallDistance,
    };
  }

  private getUpgradeStationZoneConfig(): WorldTrackedZoneConfig {
    return {
      width: this.upgradeStationZoneWidth,
      height: this.upgradeStationZoneHeight,
      radius: this.upgradeStationZoneRadius,
      dashLength: this.upgradeStationZoneDashLength,
      gapLength: this.upgradeStationZoneGapLength,
    };
  }

  private playHudCounterPop(kind: RewardKind): void {
    this.popAnimator.play(this.hudView?.getResourceCounterNode(kind) ?? null);
  }

  private tryWorldToFeedbackPosition(worldPosition: Vec3, out: Vec3): boolean {
    const layer = this.getFeedbackLayer();

    if (this.worldCamera === null || layer === null) {
      return false;
    }

    this.worldCamera.convertToUINode(worldPosition, layer, out);
    return true;
  }

  private tryWorldToTargetHintPosition(worldPosition: Vec3, out: Vec3): boolean {
    const layer = this.getTargetHintLayer();

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

    target.getWorldPosition(TMP_VEC3_B);
    layerTransform.convertToNodeSpaceAR(TMP_VEC3_B, out);
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

  private getRewardLayer(): Node | null {
    if (this.rewardLayer === null || !this.rewardLayer.isValid) {
      return null;
    }

    this.layout.refreshFullscreenLayer(this.rewardLayer, this.hudCanvas);
    this.rewardLayer.setSiblingIndex((this.hudCanvas?.children.length ?? 1) - 1);

    return this.rewardLayer;
  }

  private getFeedbackLayer(): Node | null {
    if (this.feedbackLayer === null || !this.feedbackLayer.isValid) {
      return null;
    }

    this.layout.refreshFullscreenLayer(this.feedbackLayer, this.hudCanvas);
    this.feedbackLayer.setSiblingIndex(0);

    return this.feedbackLayer;
  }

  private getTargetHintLayer(): Node | null {
    if (this.targetHintLayer === null || !this.targetHintLayer.isValid) {
      return null;
    }

    this.layout.refreshFullscreenLayer(this.targetHintLayer, this.targetHintLayer.parent);
    return this.targetHintLayer;
  }

  private ensureTargetHint(prefab: Prefab | null): void {
    if (prefab === null) {
      return;
    }

    if (
      this.targetHintNode !== null &&
      this.targetHintNode.isValid &&
      this.targetHintGraphics !== null &&
      this.targetHintOpacity !== null &&
      this.targetHintPrefab === prefab
    ) {
      return;
    }

    const layer = this.getTargetHintLayer();

    if (layer === null || this.worldCamera === null) {
      return;
    }

    this.destroyTargetHint();

    this.targetHintNode = instantiate(prefab);
    this.targetHintNode.name = 'TargetHintZone';
    this.targetHintPrefab = prefab;
    applyLayerRecursive(this.targetHintNode, layer.layer);
    layer.addChild(this.targetHintNode);
    this.targetHintNode.active = false;
    this.targetHintNode
      .getComponent(UITransform)
      ?.setContentSize(this.targetHintRenderedSize.x, this.targetHintRenderedSize.y);
    this.targetHintOpacity = this.targetHintNode.getComponent(UIOpacity);
    this.targetHintGraphics = this.targetHintNode.getComponent(Graphics);

    if (this.targetHintOpacity === null || this.targetHintGraphics === null) {
      this.destroyTargetHint();
      return;
    }

    this.targetHintOpacity.opacity = 0;
    this.drawTargetHintZone();
  }

  private refreshTargetHintLayout(): void {
    if (
      this.targetHintNode === null ||
      this.targetHintGraphics === null ||
      !this.targetHintNode.isValid
    ) {
      return;
    }

    this.updateTargetHintZoneLayout();

    this.syncTargetHintPosition();
  }

  private destroyTargetHint(): void {
    if (this.targetHintNode !== null && this.targetHintNode.isValid) {
      this.targetHintNode.destroy();
    }

    this.targetHintNode = null;
    this.targetHintGraphics = null;
    this.targetHintOpacity = null;
    this.targetHintPrefab = null;
  }

  private syncTargetHintPosition(): void {
    if (this.targetHintNode === null || !this.targetHintNode.active) {
      return;
    }

    if (this.tryWorldToTargetHintPosition(this.targetHintWorldPosition, TMP_VEC3_C)) {
      this.targetHintNode.setPosition(TMP_VEC3_C);
    }
  }

  private refreshUpgradeStationZoneLayout(): void {
    this.upgradeStationZone.refreshLayout(this.getUpgradeStationZoneConfig());
  }

  private drawTargetHintZone(): void {
    if (this.targetHintGraphics === null) {
      return;
    }

    drawDashedZone(
      this.targetHintGraphics,
      this.targetHintRenderedSize.x,
      this.targetHintRenderedSize.y,
      this.targetHintZoneRadius,
      this.targetHintZoneDashLength,
      this.targetHintZoneGapLength,
    );
  }

  private updateTargetHintZoneLayout(): void {
    if (this.targetHintNode === null || this.targetHintGraphics === null) {
      return;
    }

    const hasMeasuredSize =
      this.targetHintHasWorldSize &&
      this.tryMeasureWorldFootprint(
        this.targetHintWorldPosition,
        this.targetHintWorldSize,
        this.targetHintRenderedSize,
      );

    if (!hasMeasuredSize) {
      this.targetHintRenderedSize.set(this.targetHintZoneWidth, this.targetHintZoneHeight, 0);
    }

    this.targetHintNode
      .getComponent(UITransform)
      ?.setContentSize(this.targetHintRenderedSize.x, this.targetHintRenderedSize.y);
    this.drawTargetHintZone();
  }

  private tryMeasureWorldFootprint(worldPosition: Vec3, worldSize: Vec3, outSize: Vec3): boolean {
    const layer = this.getTargetHintLayer();

    if (this.worldCamera === null || layer === null) {
      return false;
    }

    const halfX = Math.max(0.05, Math.abs(worldSize.x) * 0.5);
    const halfZ = Math.max(0.05, Math.abs(worldSize.z) * 0.5);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const corner of [
      [-halfX, -halfZ],
      [-halfX, halfZ],
      [halfX, -halfZ],
      [halfX, halfZ],
    ] as const) {
      TMP_VEC3_C.set(worldPosition.x + corner[0], worldPosition.y, worldPosition.z + corner[1]);
      this.worldCamera.convertToUINode(TMP_VEC3_C, layer, TMP_VEC3_D);
      minX = Math.min(minX, TMP_VEC3_D.x);
      maxX = Math.max(maxX, TMP_VEC3_D.x);
      minY = Math.min(minY, TMP_VEC3_D.y);
      maxY = Math.max(maxY, TMP_VEC3_D.y);
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    ) {
      return false;
    }

    const padding = Math.max(0, this.targetHintZonePadding);
    const width = Math.max(this.targetHintZoneMinWidth, maxX - minX + padding * 2);
    const height = Math.max(this.targetHintZoneMinHeight, maxY - minY + padding * 2);
    outSize.set(width, height, 0);
    return true;
  }
}
