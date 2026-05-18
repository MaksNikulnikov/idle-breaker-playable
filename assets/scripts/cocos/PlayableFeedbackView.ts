import {
  _decorator,
  Camera,
  Color,
  Component,
  director,
  EventHandler,
  Graphics,
  instantiate,
  Label,
  Node,
  NodePool,
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
const DEFAULT_HUD_TARGET_SCREEN_WIDTH = 396;
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
  public targetHintLayer: Node | null = null;

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
  private readonly uiBaseScales = new Map<Node, Vec3>();
  private readonly woodPickupPool = new NodePool();
  private readonly metalPickupPool = new NodePool();
  private readonly impactBurstPool = new NodePool();
  private readonly starPool = new NodePool();
  private readonly floatingLabelPool = new NodePool();
  private readonly activeTransientNodes = new Map<Node, NodePool>();
  private upgradePopupNode: Node | null = null;
  private upgradePopupDim: Node | null = null;
  private upgradePopupCard: Node | null = null;
  private upgradeStationZoneNode: Node | null = null;
  private upgradeStationZoneGraphics: Graphics | null = null;
  private upgradeStationZoneOpacity: UIOpacity | null = null;
  private upgradeStationZoneAnchor: Node | null = null;
  private upgradeStationZoneTracker: UICoordinateTracker | null = null;
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
  private lastLayoutWidth = -1;
  private lastLayoutHeight = -1;
  private lastLayoutScaleX = -1;
  private lastLayoutScaleY = -1;
  private transientRenderWarmupDone = false;
  private gateHealthBar: RuntimeHealthBar | null = null;
  private completionContentRoot: Node | null = null;
  private upgradeStationZoneVisible = false;
  private upgradeStationZonePulseTime = 0;

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
    this.refreshUpgradeStationZoneLayout();
    this.refreshTargetHintLayout();
    this.markLayoutClean();
  }

  public refreshLayoutIfNeeded(): void {
    if (this.shouldRefreshLayout()) {
      this.refreshLayout();
    }
  }

  public updateHealthBars(deltaTime: number): void {
    for (const bar of this.resourceHealthBars.values()) {
      bar.update(deltaTime);
    }

    this.gateHealthBar?.update(deltaTime);
    this.updateUpgradeStationZone(deltaTime);
  }

  public clearTransientFeedback(): void {
    this.destroyUpgradePopup();
    this.clearActiveTransientEffects();
    this.setUpgradeStationZone(TMP_VEC3_A, false);
    this.hideTargetHint();
  }

  public onDestroy(): void {
    this.destroyUpgradePopup();
    this.clearActiveTransientEffects();
    this.woodPickupPool.clear();
    this.metalPickupPool.clear();
    this.impactBurstPool.clear();
    this.starPool.clear();
    this.floatingLabelPool.clear();
    this.destroyUpgradeStationZone();
    this.destroyTargetHint();
  }

  public setUpgradeStationZone(worldPosition: Vec3, visible: boolean): void {
    this.ensureUpgradeStationZone();
    this.upgradeStationZoneVisible = visible;

    if (
      this.upgradeStationZoneNode === null ||
      this.upgradeStationZoneAnchor === null ||
      this.upgradeStationZoneTracker === null
    ) {
      return;
    }

    this.upgradeStationZoneNode.active = visible;
    this.upgradeStationZoneAnchor.active = visible;

    if (!visible) {
      return;
    }

    this.upgradeStationZoneAnchor.setWorldPosition(worldPosition);
    this.upgradeStationZoneTracker.update();
  }

  public handleUpgradeStationZoneCoordinateSync(position: Vec3): void {
    this.upgradeStationZoneNode?.setPosition(position);
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
    this.prewarmPool(this.impactBurstPool, this.impactBurstPrefab, layer, this.impactPrewarmCount);
    this.prewarmPool(this.starPool, this.starBurstPrefab, layer, this.starPrewarmCount);
    this.prewarmPool(
      this.floatingLabelPool,
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
    this.addPooledWarmupNode(warmupNodes, this.impactBurstPool, this.impactBurstPrefab, layer);
    this.addPooledWarmupNode(warmupNodes, this.starPool, this.starBurstPrefab, layer);
    this.addPickupWarmupNode(warmupNodes, 'wood', layer);
    this.addPickupWarmupNode(warmupNodes, 'metal', layer);
    this.addFloatingLabelWarmupNode(warmupNodes, layer);

    if (warmupNodes.length === 0) {
      return;
    }

    this.transientRenderWarmupDone = true;
    this.scheduleOnce(() => {
      for (const { node, pool } of warmupNodes) {
        this.recycleEffectNode(pool, node);
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

    const layer = this.getFeedbackLayer();

    if (layer === null) {
      return;
    }

    const node = this.getPooledEffectNode(this.floatingLabelPool, this.floatingLabelPrefab, layer);

    if (node === null) {
      return;
    }

    node.name = 'FloatingLabel';
    node.setPosition(TMP_VEC3_A);
    node.setScale(0.85, 0.85, 1);

    const label = node.getComponent(Label);
    const opacity = node.getComponent(UIOpacity);

    if (label === null || opacity === null) {
      this.recycleEffectNode(this.floatingLabelPool, node);
      return;
    }

    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    label.string = text;
    label.color = color;
    opacity.opacity = 255;

    const endPosition = TMP_VEC3_A.clone();
    endPosition.y += 62;

    tween(node)
      .to(0.1, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'backOut' })
      .start();
    tween(node)
      .to(0.48, { position: endPosition }, { easing: 'quadOut' })
      .call(() => this.recycleEffectNode(this.floatingLabelPool, node))
      .start();
    tween(opacity).delay(0.2).to(0.24, { opacity: 0 }, { easing: 'quadIn' }).start();
  }

  public spawnImpactBurst(worldPosition: Vec3, scale = 1): void {
    if (!this.tryWorldToFeedbackPosition(worldPosition, TMP_VEC3_A)) {
      return;
    }

    const layer = this.getFeedbackLayer();

    if (layer === null) {
      return;
    }

    const node = this.getPooledEffectNode(this.impactBurstPool, this.impactBurstPrefab, layer);

    if (node === null) {
      return;
    }

    node.name = 'ImpactBurst';
    node.setPosition(TMP_VEC3_A);
    node.setScale(0.35 * scale, 0.35 * scale, 1);

    const opacity = node.getComponent(UIOpacity);

    if (opacity === null) {
      this.recycleEffectNode(this.impactBurstPool, node);
      return;
    }

    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(opacity);
    opacity.opacity = 255;

    tween(node)
      .to(0.18, { scale: new Vec3(1.2 * scale, 1.2 * scale, 1) }, { easing: 'quadOut' })
      .call(() => this.recycleEffectNode(this.impactBurstPool, node))
      .start();
    tween(opacity).to(0.18, { opacity: 0 }, { easing: 'quadIn' }).start();
  }

  public spawnPickupRewards(kind: RewardKind, sourceWorldPosition: Vec3): void {
    if (!this.tryWorldToFeedbackPosition(sourceWorldPosition, TMP_VEC3_A)) {
      return;
    }

    const targetPosition = new Vec3();

    if (!this.tryGetCounterFeedbackPosition(kind, targetPosition)) {
      targetPosition.set(TMP_VEC3_A.x, TMP_VEC3_A.y + 120, 0);
    }

    const count = Math.floor(Math.random() * 3) + 1;

    for (let index = 0; index < count; index += 1) {
      this.spawnPickupBadge(kind, TMP_VEC3_A, targetPosition, index, count);
    }
  }

  public spawnHitStars(worldPosition: Vec3): void {
    if (!this.tryWorldToFeedbackPosition(worldPosition, TMP_VEC3_A)) {
      return;
    }

    this.spawnStarBurstAtUiPosition(
      TMP_VEC3_A,
      this.hitStarMinCount,
      this.hitStarMaxCount,
      72,
      148,
      0.9,
      1.35,
    );
  }

  public playWeaponUpgrade(
    level: number,
    weaponName: string,
    unlockText: string,
    powerBonus: number,
  ): void {
    this.playNodePop(this.hudView?.getWeaponCounterNode() ?? null);
    this.playNodePop(this.hudView?.getObjectiveFeedbackNode() ?? null);
    this.showWeaponUpgradePopup(level, weaponName, unlockText, powerBonus);
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

    const pickupPool = this.getPickupPool(kind);
    const node = this.getPooledEffectNode(pickupPool, this.pickupBadgePrefab, layer);

    if (node === null) {
      return;
    }

    node.name = `Pickup_${kind}`;
    node.setPosition(startPosition);
    node.setScale(0.18, 0.18, 1);
    node.setRotationFromEuler(0, 0, this.getRandomRange(-14, 14));

    if (!this.configurePickupBadge(node, kind)) {
      this.recycleEffectNode(pickupPool, node);
      return;
    }

    const offsetIndex = index - (count - 1) / 2;
    const side = offsetIndex === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(offsetIndex);
    const scatterDistance =
      this.getRandomRange(this.pickupMinScatterDistance, this.pickupMaxScatterDistance) +
      Math.abs(offsetIndex) * 22;
    const landingPosition = startPosition.clone();
    landingPosition.x += side * scatterDistance + this.getRandomRange(-28, 28);
    landingPosition.y -= this.getRandomRange(
      this.pickupMinFallDistance,
      this.pickupMaxFallDistance,
    );

    const apexPosition = startPosition.clone();
    apexPosition.x += (landingPosition.x - startPosition.x) * this.getRandomRange(0.34, 0.52);
    apexPosition.y += this.getRandomRange(this.pickupMinArcHeight, this.pickupMaxArcHeight);

    const squashScale = this.getRandomRange(0.82, 0.94);

    tween(node)
      .delay(index * 0.025)
      .to(0.16, { position: apexPosition, scale: new Vec3(1.08, 1.08, 1) }, { easing: 'quadOut' })
      .to(
        0.24,
        { position: landingPosition, scale: new Vec3(squashScale, squashScale, 1) },
        { easing: 'quadIn' },
      )
      .call(() => this.spawnLandingStars(landingPosition))
      .delay(0.16)
      .to(0.34, { position: targetPosition, scale: new Vec3(0.34, 0.34, 1) }, { easing: 'quadIn' })
      .call(() => {
        this.playHudCounterPop(kind);
        this.recycleEffectNode(pickupPool, node);
      })
      .start();
  }

  private addPooledWarmupNode(
    warmupNodes: Array<{ node: Node; pool: NodePool }>,
    pool: NodePool,
    prefab: Prefab | null,
    layer: Node,
  ): void {
    const node = this.getPooledEffectNode(pool, prefab, layer);

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
    const pool = this.getPickupPool(kind);
    const node = this.getPooledEffectNode(pool, this.pickupBadgePrefab, layer);

    if (node === null) {
      return;
    }

    if (!this.configurePickupBadge(node, kind)) {
      this.recycleEffectNode(pool, node);
      return;
    }

    node.name = `RenderWarmup_${kind}`;
    node.setPosition(0, 0, 0);
    node.setScale(0.001, 0.001, 1);
    warmupNodes.push({ node, pool });
  }

  private addFloatingLabelWarmupNode(
    warmupNodes: Array<{ node: Node; pool: NodePool }>,
    layer: Node,
  ): void {
    const node = this.getPooledEffectNode(this.floatingLabelPool, this.floatingLabelPrefab, layer);

    if (node === null) {
      return;
    }

    const label = node.getComponent(Label);
    const opacity = node.getComponent(UIOpacity);

    if (label === null || opacity === null) {
      this.recycleEffectNode(this.floatingLabelPool, node);
      return;
    }

    node.name = 'RenderWarmup_Label';
    node.setPosition(0, 0, 0);
    node.setScale(0.001, 0.001, 1);
    label.string = '0123456789LVUPGRADE';
    label.color = Color.WHITE;
    opacity.opacity = 255;
    warmupNodes.push({ node, pool: this.floatingLabelPool });
  }

  private spawnLandingStars(uiPosition: Vec3): void {
    this.spawnStarBurstAtUiPosition(
      uiPosition,
      this.landingStarMinCount,
      this.landingStarMaxCount,
      34,
      72,
      0.58,
      0.86,
    );
  }

  private spawnStarBurstAtUiPosition(
    uiPosition: Vec3,
    minCount: number,
    maxCount: number,
    minDistance: number,
    maxDistance: number,
    minScale: number,
    maxScale: number,
  ): void {
    const layer = this.getFeedbackLayer();

    if (layer === null || this.starBurstPrefab === null) {
      return;
    }

    const count = this.getRandomInteger(minCount, maxCount);

    for (let index = 0; index < count; index += 1) {
      const node = this.getPooledEffectNode(this.starPool, this.starBurstPrefab, layer);

      if (node === null) {
        return;
      }

      const opacity = node.getComponent(UIOpacity);

      if (opacity === null) {
        this.recycleEffectNode(this.starPool, node);
        continue;
      }

      const angle = (Math.PI * 2 * index) / count + this.getRandomRange(-0.42, 0.42);
      const distance = this.getRandomRange(minDistance, maxDistance);
      const targetPosition = new Vec3(
        uiPosition.x + Math.cos(angle) * distance,
        uiPosition.y + Math.sin(angle) * distance,
        uiPosition.z,
      );
      const scale = this.getRandomRange(minScale, maxScale);

      Tween.stopAllByTarget(node);
      Tween.stopAllByTarget(opacity);
      node.setPosition(uiPosition);
      node.setScale(scale, scale, 1);
      node.setRotationFromEuler(0, 0, this.getRandomRange(-35, 35));
      opacity.opacity = 245;

      tween(node)
        .to(0.84, { position: targetPosition, scale: Vec3.ZERO }, { easing: 'quadOut' })
        .call(() => this.recycleEffectNode(this.starPool, node))
        .start();
      tween(opacity).delay(0.24).to(0.52, { opacity: 0 }, { easing: 'quadIn' }).start();
    }
  }

  private configurePickupBadge(root: Node, kind: RewardKind): boolean {
    const background = root.getChildByName('Background')?.getComponent(Sprite) ?? null;
    const label = root.getChildByName('Text')?.getComponent(Label) ?? null;
    const iconFrame = this.getResourceIconFrame(kind);

    if (background === null || label === null) {
      return false;
    }

    if (iconFrame === null) {
      return false;
    }

    background.spriteFrame = iconFrame;
    background.sizeMode = Sprite.SizeMode.CUSTOM;
    background.color = Color.WHITE;
    label.node.active = false;
    return true;
  }

  private getResourceIconFrame(kind: RewardKind) {
    return this.hudView?.getResourceIconFrame(kind) ?? null;
  }

  private prewarmPickupPool(kind: RewardKind, layer: Node): void {
    if (this.pickupBadgePrefab === null) {
      return;
    }

    const pool = this.getPickupPool(kind);
    const targetSize = Math.max(0, Math.floor(this.pickupPrewarmCountPerResource));

    while (pool.size() < targetSize) {
      const node = instantiate(this.pickupBadgePrefab);
      node.active = false;
      applyLayerRecursive(node, layer.layer);

      if (!this.configurePickupBadge(node, kind)) {
        node.destroy();
        return;
      }

      pool.put(node);
    }
  }

  private getPickupPool(kind: RewardKind): NodePool {
    return kind === 'wood' ? this.woodPickupPool : this.metalPickupPool;
  }

  private prewarmPool(
    pool: NodePool,
    prefab: Prefab | null,
    layer: Node,
    targetSize: number,
  ): void {
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

  private getPooledEffectNode(pool: NodePool, prefab: Prefab | null, layer: Node): Node | null {
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
    this.activeTransientNodes.set(node, pool);
    return node;
  }

  private recycleEffectNode(pool: NodePool, node: Node): void {
    if (!node.isValid) {
      return;
    }

    Tween.stopAllByTarget(node);
    const opacity = node.getComponent(UIOpacity);

    if (opacity !== null) {
      Tween.stopAllByTarget(opacity);
    }

    node.active = false;
    this.activeTransientNodes.delete(node);
    pool.put(node);
  }

  private clearActiveTransientEffects(): void {
    for (const [node] of Array.from(this.activeTransientNodes)) {
      if (!node.isValid) {
        continue;
      }

      Tween.stopAllByTarget(node);
      const opacity = node.getComponent(UIOpacity);

      if (opacity !== null) {
        Tween.stopAllByTarget(opacity);
      }

      node.destroy();
    }

    this.activeTransientNodes.clear();
  }

  private getRandomRange(min: number, max: number): number {
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    return lower + Math.random() * (upper - lower);
  }

  private getRandomInteger(min: number, max: number): number {
    const lower = Math.ceil(Math.min(min, max));
    const upper = Math.floor(Math.max(min, max));
    return lower + Math.floor(Math.random() * (upper - lower + 1));
  }

  private showWeaponUpgradePopup(
    level: number,
    weaponName: string,
    unlockText: string,
    powerBonus: number,
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
    popupView.applyContent(level, weaponName, unlockText, powerBonus);
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
    const fitScreenScale = this.getScreenWidthScale(panelWidth, this.topHudTargetScreenWidth);
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

  private shouldRefreshLayout(): boolean {
    const visibleSize = view.getVisibleSize();
    const scaleX = view.getScaleX();
    const scaleY = view.getScaleY();

    return (
      Math.abs(visibleSize.width - this.lastLayoutWidth) > 0.5 ||
      Math.abs(visibleSize.height - this.lastLayoutHeight) > 0.5 ||
      Math.abs(scaleX - this.lastLayoutScaleX) > 0.0001 ||
      Math.abs(scaleY - this.lastLayoutScaleY) > 0.0001
    );
  }

  private markLayoutClean(): void {
    const visibleSize = view.getVisibleSize();
    this.lastLayoutWidth = visibleSize.width;
    this.lastLayoutHeight = visibleSize.height;
    this.lastLayoutScaleX = view.getScaleX();
    this.lastLayoutScaleY = view.getScaleY();
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

  private getTargetHintLayer(): Node | null {
    if (this.targetHintLayer === null || !this.targetHintLayer.isValid) {
      return null;
    }

    this.refreshFullscreenLayer(this.targetHintLayer, this.targetHintLayer.parent);
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

  private ensureUpgradeStationZone(): void {
    if (
      this.upgradeStationZoneNode !== null &&
      this.upgradeStationZoneNode.isValid &&
      this.upgradeStationZoneGraphics !== null
    ) {
      return;
    }

    const layer = this.getTargetHintLayer();

    if (layer === null || this.worldCamera === null) {
      return;
    }

    this.upgradeStationZoneNode = new Node('UpgradeStationZone');
    this.upgradeStationZoneNode.layer = layer.layer;
    layer.addChild(this.upgradeStationZoneNode);
    this.upgradeStationZoneNode.active = false;

    const transform = this.upgradeStationZoneNode.addComponent(UITransform);
    transform.setContentSize(this.upgradeStationZoneWidth, this.upgradeStationZoneHeight);

    this.upgradeStationZoneOpacity = this.upgradeStationZoneNode.addComponent(UIOpacity);
    this.upgradeStationZoneOpacity.opacity = 0;

    this.upgradeStationZoneGraphics = this.upgradeStationZoneNode.addComponent(Graphics);
    this.drawUpgradeStationZone();

    this.upgradeStationZoneAnchor = new Node('UpgradeStationZone_WorldAnchor');
    director.getScene()?.addChild(this.upgradeStationZoneAnchor);

    this.upgradeStationZoneTracker =
      this.upgradeStationZoneAnchor.addComponent(UICoordinateTracker);
    this.upgradeStationZoneTracker.camera = this.worldCamera;
    this.upgradeStationZoneTracker.target = layer;
    this.upgradeStationZoneTracker.useScale = false;
    this.upgradeStationZoneTracker.syncEvents = [this.createUpgradeStationZoneSyncEvent()];
  }

  private refreshUpgradeStationZoneLayout(): void {
    if (this.upgradeStationZoneNode === null || !this.upgradeStationZoneNode.isValid) {
      return;
    }

    this.upgradeStationZoneNode
      .getComponent(UITransform)
      ?.setContentSize(this.upgradeStationZoneWidth, this.upgradeStationZoneHeight);
    this.drawUpgradeStationZone();

    if (this.upgradeStationZoneTracker !== null) {
      this.upgradeStationZoneTracker.target = this.getTargetHintLayer();
      this.upgradeStationZoneTracker.update();
    }
  }

  private updateUpgradeStationZone(deltaTime: number): void {
    if (!this.upgradeStationZoneVisible || this.upgradeStationZoneNode === null) {
      return;
    }

    this.upgradeStationZonePulseTime += deltaTime;
    const pulse = 1 + Math.sin(this.upgradeStationZonePulseTime * 5.5) * 0.045;
    const opacity = 185 + Math.sin(this.upgradeStationZonePulseTime * 5.5) * 38;

    this.upgradeStationZoneNode.setScale(pulse, pulse, 1);

    if (this.upgradeStationZoneOpacity !== null) {
      this.upgradeStationZoneOpacity.opacity = Math.max(120, Math.min(230, opacity));
    }
  }

  private drawUpgradeStationZone(): void {
    if (this.upgradeStationZoneGraphics === null) {
      return;
    }

    this.drawDashedZone(
      this.upgradeStationZoneGraphics,
      this.upgradeStationZoneWidth,
      this.upgradeStationZoneHeight,
      this.upgradeStationZoneRadius,
      this.upgradeStationZoneDashLength,
      this.upgradeStationZoneGapLength,
    );
  }

  private drawTargetHintZone(): void {
    if (this.targetHintGraphics === null) {
      return;
    }

    this.drawDashedZone(
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

  private drawDashedZone(
    graphics: Graphics,
    zoneWidth: number,
    zoneHeight: number,
    zoneRadius: number,
    zoneDashLength: number,
    zoneGapLength: number,
  ): void {
    graphics.clear();
    graphics.lineWidth = 5;
    graphics.strokeColor = new Color(255, 255, 255, 230);
    graphics.fillColor = new Color(255, 255, 255, 18);

    const width = Math.max(40, zoneWidth);
    const height = Math.max(40, zoneHeight);
    const radius = Math.max(0, Math.min(zoneRadius, width / 2, height / 2));
    const left = -width / 2;
    const right = width / 2;
    const bottom = -height / 2;
    const top = height / 2;

    graphics.roundRect(left, bottom, width, height, radius);
    graphics.fill();

    const points = this.createRoundedRectPoints(left, right, top, bottom, radius);
    this.drawDashedPolyline(graphics, points, true, zoneDashLength, zoneGapLength);
  }

  private createRoundedRectPoints(
    left: number,
    right: number,
    top: number,
    bottom: number,
    radius: number,
  ): Vec3[] {
    const points: Vec3[] = [];
    const segmentsPerCorner = 8;

    this.appendLinePoints(points, left + radius, top, right - radius, top, 8);
    this.appendArcPoints(points, right - radius, top - radius, radius, 90, 0, segmentsPerCorner);
    this.appendLinePoints(points, right, top - radius, right, bottom + radius, 8);
    this.appendArcPoints(
      points,
      right - radius,
      bottom + radius,
      radius,
      0,
      -90,
      segmentsPerCorner,
    );
    this.appendLinePoints(points, right - radius, bottom, left + radius, bottom, 8);
    this.appendArcPoints(
      points,
      left + radius,
      bottom + radius,
      radius,
      -90,
      -180,
      segmentsPerCorner,
    );
    this.appendLinePoints(points, left, bottom + radius, left, top - radius, 8);
    this.appendArcPoints(points, left + radius, top - radius, radius, 180, 90, segmentsPerCorner);

    return points;
  }

  private appendLinePoints(
    points: Vec3[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    segments: number,
  ): void {
    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments;
      points.push(new Vec3(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 0));
    }
  }

  private appendArcPoints(
    points: Vec3[],
    centerX: number,
    centerY: number,
    radius: number,
    fromDegrees: number,
    toDegrees: number,
    segments: number,
  ): void {
    for (let index = 1; index <= segments; index += 1) {
      const t = index / segments;
      const radians = ((fromDegrees + (toDegrees - fromDegrees) * t) * Math.PI) / 180;
      points.push(
        new Vec3(centerX + Math.cos(radians) * radius, centerY + Math.sin(radians) * radius, 0),
      );
    }
  }

  private drawDashedPolyline(
    graphics: Graphics,
    points: Vec3[],
    closed: boolean,
    zoneDashLength: number,
    zoneGapLength: number,
  ): void {
    if (points.length < 2) {
      return;
    }

    let drawing = true;
    const dashLength = Math.max(1, zoneDashLength);
    const gapLength = Math.max(1, zoneGapLength);
    let remaining = dashLength;

    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];

      if (!closed && index === points.length - 1) {
        break;
      }

      let segmentStartX = start.x;
      let segmentStartY = start.y;
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      let segmentRemaining = Math.hypot(deltaX, deltaY);

      if (segmentRemaining <= 0.001) {
        continue;
      }

      const directionX = deltaX / segmentRemaining;
      const directionY = deltaY / segmentRemaining;

      while (segmentRemaining > 0.001) {
        const step = Math.min(remaining, segmentRemaining);
        const segmentEndX = segmentStartX + directionX * step;
        const segmentEndY = segmentStartY + directionY * step;

        if (drawing) {
          graphics.moveTo(segmentStartX, segmentStartY);
          graphics.lineTo(segmentEndX, segmentEndY);
        }

        segmentStartX = segmentEndX;
        segmentStartY = segmentEndY;
        segmentRemaining -= step;
        remaining -= step;

        if (remaining <= 0.001) {
          drawing = !drawing;
          remaining = drawing ? dashLength : gapLength;
        }
      }
    }

    graphics.stroke();
  }

  private createUpgradeStationZoneSyncEvent(): EventHandler {
    const event = new EventHandler();
    event.target = this.node;
    event.component = 'PlayableFeedbackView';
    event.handler = 'handleUpgradeStationZoneCoordinateSync';
    return event;
  }

  private destroyUpgradeStationZone(): void {
    if (this.upgradeStationZoneNode !== null && this.upgradeStationZoneNode.isValid) {
      this.upgradeStationZoneNode.destroy();
    }

    if (this.upgradeStationZoneAnchor !== null && this.upgradeStationZoneAnchor.isValid) {
      this.upgradeStationZoneAnchor.destroy();
    }

    this.upgradeStationZoneNode = null;
    this.upgradeStationZoneGraphics = null;
    this.upgradeStationZoneOpacity = null;
    this.upgradeStationZoneAnchor = null;
    this.upgradeStationZoneTracker = null;
    this.upgradeStationZoneVisible = false;
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
