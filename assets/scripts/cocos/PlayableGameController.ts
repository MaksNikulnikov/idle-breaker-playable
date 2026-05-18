import {
  _decorator,
  Collider,
  Color,
  Component,
  director,
  ITriggerEvent,
  Node,
  Prefab,
  Vec3,
} from 'cc';

import { DEFAULT_PLAYABLE_CONFIG, openStoreUrl } from '../application';
import {
  createInitialPlayableState,
  createPlayableSnapshot,
  stepPlayableState,
  type GameCommand,
  type GameEvent,
  type PlayableConfig,
  type PlayableSnapshot,
  type PlayableState,
  type ResourceDefinition,
  type ResourceState,
} from '../domain';
import { BreakableResource, ResourceKind as CocosResourceKind } from './BreakableResource';
import { ExitGate } from './ExitGate';
import { PlayableFeedbackView } from './PlayableFeedbackView';
import { PlayableHudView } from './PlayableHudView';
import { PlayerController } from './PlayerController';
import { WeaponMount } from './WeaponMount';

const { ccclass, disallowMultiple, property } = _decorator;

export const PLAYABLE_STATE_CHANGED_EVENT = 'playable-state-changed';
export const PLAYABLE_EVENTS_EVENT = 'playable-events';

type RewardKind = 'wood' | 'metal';
type TargetHintCandidate = {
  key: string;
  objectiveKey: string;
  useWorldBounds: boolean;
  prefab: Prefab | null;
};

const TMP_VEC3_A = new Vec3();
const TMP_VEC3_B = new Vec3();
const TMP_VEC3_C = new Vec3();
const TMP_VEC3_D = new Vec3();

@ccclass('PlayableGameController')
@disallowMultiple
export class PlayableGameController extends Component {
  @property
  public startOnLoad = true;

  @property
  public autoUpgradeWhenAffordable = false;

  @property({ type: ExitGate })
  public exitGate: ExitGate | null = null;

  @property({ type: Collider })
  public upgradeStationTrigger: Collider | null = null;

  @property({ type: Node })
  public upgradeStationAnchor: Node | null = null;

  @property({ type: PlayableHudView })
  public hudView: PlayableHudView | null = null;

  @property({ type: PlayableFeedbackView })
  public feedbackView: PlayableFeedbackView | null = null;

  @property
  public targetHintIdleDelay = 3;

  @property
  public initialTargetHintIdleDelay = 2;

  @property
  public storeUrl = 'https://play.google.com/store';

  @property
  public openStoreAutomaticallyOnCompletion = false;

  @property({ type: Node })
  public storeButton: Node | null = null;

  private config: PlayableConfig = DEFAULT_PLAYABLE_CONFIG;
  private state: PlayableState = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
  private snapshot: PlayableSnapshot = createPlayableSnapshot(this.state, this.config);
  private appliedWeaponLevel = 0;
  private readonly resources: BreakableResource[] = [];
  private readonly resourcesById = new Map<string, BreakableResource>();
  private weaponMount: WeaponMount | null = null;
  private playerController: PlayerController | null = null;
  private boundUpgradeStationTrigger: Collider | null = null;
  private boundStoreButton: Node | null = null;
  private targetHintCooldownRemaining = 0;
  private targetHintObjectiveKey = '';
  private targetHintTargetKey = '';
  private targetHintShownOnce = false;
  private completionAdActionTriggered = false;

  public onEnable(): void {
    this.bindUpgradeStationTrigger();
    this.bindStoreButton();
  }

  public onDisable(): void {
    this.unbindUpgradeStationTrigger();
    this.unbindStoreButton();
  }

  public start(): void {
    this.validateSceneReferences();
    this.refreshSceneConfig();
    this.bindUpgradeStationTrigger();
    this.bindStoreButton();
    this.feedbackView?.refreshLayout();
    this.feedbackView?.prewarmTransientEffects();
    this.feedbackView?.warmupTransientRenderers();
    this.prewarmTargetHints();
    this.state = createInitialPlayableState(this.config);
    this.armInitialTargetHintDelay();
    const snapshot = this.refreshSnapshot();
    this.applySnapshot(snapshot);
    this.syncFeedbackState(snapshot);

    if (this.startOnLoad) {
      this.dispatch({ type: 'start' });
      return;
    }

    this.emitStateChanged([]);
  }

  public update(deltaTime: number): void {
    this.feedbackView?.refreshLayoutIfNeeded();
    this.updateFeedback(deltaTime);
    this.updateTargetHint(deltaTime);
  }

  public getSnapshot(): PlayableSnapshot {
    return this.snapshot;
  }

  public hitResource(resource: BreakableResource | string): void {
    const resourceId = typeof resource === 'string' ? resource : resource.getRuntimeId();
    this.dispatch({ type: 'hitResource', resourceId });
  }

  public hitGate(): void {
    this.dispatch({ type: 'hitGate' });
  }

  public tryUpgrade(): void {
    this.dispatch({ type: 'tryUpgrade' });
  }

  public openStore(): void {
    if (this.completionAdActionTriggered) {
      return;
    }

    if (openStoreUrl(this.storeUrl)) {
      this.completionAdActionTriggered = true;
    }
  }

  public resetGame(): void {
    this.appliedWeaponLevel = 0;
    this.completionAdActionTriggered = false;
    this.resetTargetHintTracking();
    this.armInitialTargetHintDelay();
    this.feedbackView?.clearTransientFeedback();
    this.refreshSceneConfig();
    this.prewarmTargetHints();
    this.dispatch({ type: 'reset' });
  }

  private dispatch(command: GameCommand): void {
    const result = stepPlayableState(this.state, command, this.config);
    this.state = result.state;

    const snapshot = this.refreshSnapshot();
    this.applySnapshot(snapshot);
    this.syncFeedbackState(snapshot);
    this.playEventFeedback(result.events, snapshot);
    this.emitStateChanged(result.events);
    this.handleAutomaticProgression(result.events);
    this.handleTargetHintEvents(result.events, snapshot);
  }

  private applySnapshot(snapshot: PlayableSnapshot): void {
    this.applyResources(snapshot.resources);
    this.applyGate(snapshot);
    this.applyWeapon(snapshot);
    this.hudView?.applySnapshot(snapshot);
    this.applyUpgradeStation(snapshot);
  }

  private applyResources(resources: ResourceState[]): void {
    const components = this.resolveResources();

    for (const component of components) {
      const state = this.findResourceState(resources, component.getRuntimeId());

      if (state === null) {
        continue;
      }

      component.setCollected(state.collected);

      if (!state.collected) {
        component.showDamageStage(state.maxHits - state.hitsRemaining);
      }
    }
  }

  private applyGate(snapshot: PlayableSnapshot): void {
    const gate = this.resolveExitGate();

    if (gate === null || gate.getRuntimeId() !== snapshot.gate.id) {
      return;
    }

    gate.setDestroyed(snapshot.gate.destroyed);

    if (!snapshot.gate.destroyed) {
      gate.showDamageStage(snapshot.gate.maxHits - snapshot.gate.hitsRemaining);
    }
  }

  private applyWeapon(snapshot: PlayableSnapshot): void {
    const mount = this.resolveWeaponMount();

    if (mount === null || this.appliedWeaponLevel === snapshot.weaponLevel) {
      return;
    }

    mount.equipWeaponLevel(snapshot.weaponLevel);
    this.appliedWeaponLevel = snapshot.weaponLevel;
  }

  private handleAutomaticProgression(events: GameEvent[]): void {
    if (!this.autoUpgradeWhenAffordable) {
      return;
    }

    for (const event of events) {
      if (event.type === 'upgrade_available') {
        this.tryUpgrade();
        return;
      }
    }
  }

  private emitStateChanged(events: GameEvent[]): void {
    const snapshot = this.getSnapshot();
    this.node.emit(PLAYABLE_EVENTS_EVENT, events, snapshot);
    this.node.emit(PLAYABLE_STATE_CHANGED_EVENT, snapshot);
  }

  private refreshSnapshot(): PlayableSnapshot {
    this.snapshot = createPlayableSnapshot(this.state, this.config);
    return this.snapshot;
  }

  private resolveResources(): BreakableResource[] {
    if (this.resources.length === 0) {
      this.refreshSceneConfig();
    }

    return this.resources.filter((resource) => resource !== null && resource.isValid);
  }

  private resolveExitGate(): ExitGate | null {
    if (this.exitGate !== null && this.exitGate.isValid) {
      return this.exitGate;
    }

    const scene = director.getScene();
    this.exitGate = scene === null ? null : this.findExitGateInTree(scene);
    return this.exitGate;
  }

  private resolveWeaponMount(): WeaponMount | null {
    if (this.weaponMount !== null && this.weaponMount.isValid) {
      return this.weaponMount;
    }

    const scene = director.getScene();
    this.weaponMount = scene === null ? null : this.findWeaponMountInTree(scene);
    return this.weaponMount;
  }

  private resolvePlayerController(): PlayerController | null {
    if (this.playerController !== null && this.playerController.isValid) {
      return this.playerController;
    }

    const scene = director.getScene();
    this.playerController = scene === null ? null : this.findPlayerInTree(scene);
    return this.playerController;
  }

  private resolveUpgradeStationTrigger(): Collider | null {
    if (this.upgradeStationTrigger !== null && this.upgradeStationTrigger.isValid) {
      return this.upgradeStationTrigger;
    }

    const scene = director.getScene();
    this.upgradeStationTrigger =
      scene === null ? null : this.findColliderByNodeName(scene, 'UpgradeStationTrigger');
    return this.upgradeStationTrigger;
  }

  private validateSceneReferences(): void {
    if (
      this.hudView !== null &&
      this.hudView.hasRequiredReferences() &&
      this.feedbackView !== null &&
      this.feedbackView.hasRequiredReferences()
    ) {
      return;
    }

    console.warn(
      'PlayableGameController has missing scene references. Fill them in the Inspector before preview/build.',
    );
  }

  private syncFeedbackState(snapshot: PlayableSnapshot): void {
    if (this.feedbackView === null) {
      return;
    }

    for (const resource of snapshot.resources) {
      const component = this.findResourceComponent(resource.id);

      if (component === null) {
        continue;
      }

      component.getFeedbackWorldPosition(TMP_VEC3_A);
      this.feedbackView.setResourceHealthBar(
        resource.id,
        TMP_VEC3_A,
        resource.hitsRemaining,
        resource.maxHits,
        !resource.collected ? 'visible' : component.node.active ? 'hide-soon' : 'hidden',
      );
    }

    const gate = this.resolveExitGate();

    if (gate !== null) {
      gate.getFeedbackWorldPosition(TMP_VEC3_A);
      this.feedbackView.setGateHealthBar(
        TMP_VEC3_A,
        snapshot.gate.hitsRemaining,
        snapshot.gate.maxHits,
        !snapshot.gate.destroyed ? 'visible' : gate.node.active ? 'hide-soon' : 'hidden',
      );
    }

    this.syncUpgradeStationZone(snapshot);
  }

  private updateFeedback(deltaTime: number): void {
    this.updateHealthBarPositions();
    this.syncUpgradeStationZone(this.getSnapshot());
    this.feedbackView?.updateHealthBars(deltaTime);
  }

  private updateTargetHint(
    deltaTime: number,
    snapshot: PlayableSnapshot = this.getSnapshot(),
  ): void {
    if (this.feedbackView === null) {
      return;
    }

    const target = this.resolveTargetHint(snapshot, TMP_VEC3_A, TMP_VEC3_D);

    if (target === null) {
      this.resetTargetHintTracking();
      this.feedbackView.hideTargetHint();
      return;
    }

    const objectiveChanged = target.objectiveKey !== this.targetHintObjectiveKey;
    const targetChanged = target.key !== this.targetHintTargetKey;
    this.targetHintObjectiveKey = target.objectiveKey;
    this.targetHintTargetKey = target.key;
    this.feedbackView.syncTargetHint(TMP_VEC3_A, target.useWorldBounds ? TMP_VEC3_D : null);

    if (objectiveChanged) {
      if (!this.targetHintShownOnce) {
        this.targetHintCooldownRemaining = this.getCurrentTargetHintDelay();
        return;
      }

      this.playTargetHintAt(TMP_VEC3_A, target.useWorldBounds ? TMP_VEC3_D : null, target.prefab);
      return;
    }

    if (targetChanged) {
      this.targetHintCooldownRemaining = this.getCurrentTargetHintDelay();
    }

    if (this.isPlayerCurrentlyActive()) {
      this.targetHintCooldownRemaining = this.getCurrentTargetHintDelay();
      return;
    }

    this.targetHintCooldownRemaining -= deltaTime;

    if (this.targetHintCooldownRemaining <= 0) {
      this.playTargetHintAt(TMP_VEC3_A, target.useWorldBounds ? TMP_VEC3_D : null, target.prefab);
    }
  }

  private handleTargetHintEvents(events: GameEvent[], snapshot: PlayableSnapshot): void {
    if (events.length === 0) {
      return;
    }

    const shouldDelayHint = events.some(
      (event) =>
        event.type === 'resource_hit' ||
        event.type === 'resource_collected' ||
        event.type === 'gate_hit' ||
        event.type === 'gate_destroyed',
    );

    if (shouldDelayHint) {
      this.targetHintCooldownRemaining = Math.max(0, this.targetHintIdleDelay);
      this.feedbackView?.hideTargetHint();
    }

    this.updateTargetHint(0, snapshot);
  }

  private playTargetHintAt(
    worldPosition: Vec3,
    worldSize: Vec3 | null,
    prefab: Prefab | null,
  ): void {
    this.targetHintShownOnce = true;
    this.targetHintCooldownRemaining = Math.max(0, this.targetHintIdleDelay);
    this.feedbackView?.playTargetHint(worldPosition, worldSize, prefab);
  }

  private resetTargetHintTracking(): void {
    this.targetHintCooldownRemaining = 0;
    this.targetHintObjectiveKey = '';
    this.targetHintTargetKey = '';
  }

  private armInitialTargetHintDelay(): void {
    this.targetHintShownOnce = false;
    this.targetHintCooldownRemaining = Math.max(0, this.initialTargetHintIdleDelay);
  }

  private getCurrentTargetHintDelay(): number {
    return Math.max(
      0,
      this.targetHintShownOnce ? this.targetHintIdleDelay : this.initialTargetHintIdleDelay,
    );
  }

  private playEventFeedback(events: GameEvent[], snapshot: PlayableSnapshot): void {
    for (const event of events) {
      switch (event.type) {
        case 'resource_hit':
          this.playResourceHitFeedback(event.resourceId, snapshot, event.kind);
          break;
        case 'resource_collected':
          this.playResourceCollectedFeedback(event.resourceId);
          break;
        case 'resource_locked':
          this.playResourceLockedFeedback(event.resourceId, event.requiredWeaponLevel);
          break;
        case 'gate_hit':
          this.playGateHitFeedback(snapshot);
          break;
        case 'gate_locked':
          this.playGateLockedFeedback(event.requiredWeaponLevel);
          break;
        case 'gate_destroyed':
          this.playGateDestroyedFeedback();
          break;
        case 'weapon_upgraded':
          this.playWeaponUpgradedFeedback(event.level);
          break;
        case 'upgrade_available':
          this.playUpgradeAvailableFeedback();
          break;
        case 'playable_completed':
          this.handlePlayableCompleted();
          break;
        default:
          break;
      }
    }
  }

  private handlePlayableCompleted(): void {
    if (this.openStoreAutomaticallyOnCompletion && !this.completionAdActionTriggered) {
      this.openStore();
    }
  }

  private playResourceHitFeedback(
    resourceId: string,
    snapshot: PlayableSnapshot,
    kind: RewardKind,
  ): void {
    const resource = this.findResourceComponent(resourceId);

    if (resource === null) {
      return;
    }

    resource.playHitFeedback();
    resource.getFeedbackWorldPosition(TMP_VEC3_A);
    resource.getHitWorldPosition(TMP_VEC3_B);
    this.feedbackView?.spawnFloatingLabel(
      this.getDamageText(snapshot),
      TMP_VEC3_A,
      new Color(255, 245, 220, 255),
    );
    this.resolveWeaponMount()?.playAttackSlash();
    this.feedbackView?.spawnPickupRewards(kind, TMP_VEC3_B);
    this.feedbackView?.spawnHitStars(TMP_VEC3_B);
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_B, 1.15);
  }

  private playResourceCollectedFeedback(resourceId: string): void {
    const resource = this.findResourceComponent(resourceId);

    if (resource === null) {
      return;
    }

    resource.getFeedbackWorldPosition(TMP_VEC3_A);
    resource.getHitWorldPosition(TMP_VEC3_B);
    resource.playCollectedFeedback();
    this.feedbackView?.hideResourceHealthBar(resourceId, 0.25);
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_B, 1.45);
  }

  private playResourceLockedFeedback(resourceId: string, requiredWeaponLevel: number): void {
    const resource = this.findResourceComponent(resourceId);

    if (resource === null) {
      return;
    }

    resource.getFeedbackWorldPosition(TMP_VEC3_A);
    this.feedbackView?.spawnFloatingLabel(
      `LVL ${requiredWeaponLevel}`,
      TMP_VEC3_A,
      new Color(255, 120, 90, 255),
    );
  }

  private playGateHitFeedback(snapshot: PlayableSnapshot): void {
    const gate = this.resolveExitGate();

    if (gate === null) {
      return;
    }

    gate.playHitFeedback();
    gate.getFeedbackWorldPosition(TMP_VEC3_A);
    gate.getHitWorldPosition(TMP_VEC3_B);
    this.feedbackView?.spawnFloatingLabel(
      this.getDamageText(snapshot),
      TMP_VEC3_A,
      new Color(255, 245, 220, 255),
    );
    this.resolveWeaponMount()?.playAttackSlash();
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_B, 1.35);
  }

  private playGateLockedFeedback(requiredWeaponLevel: number): void {
    const gate = this.resolveExitGate();

    if (gate === null) {
      return;
    }

    gate.getFeedbackWorldPosition(TMP_VEC3_A);
    this.feedbackView?.spawnFloatingLabel(
      `LVL ${requiredWeaponLevel}`,
      TMP_VEC3_A,
      new Color(255, 120, 90, 255),
    );
  }

  private playGateDestroyedFeedback(): void {
    const gate = this.resolveExitGate();

    if (gate === null) {
      return;
    }

    gate.getFeedbackWorldPosition(TMP_VEC3_A);
    gate.getHitWorldPosition(TMP_VEC3_B);
    gate.playDestroyedFeedback();
    this.feedbackView?.hideGateHealthBar(0.35);
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_B, 1.75);
  }

  private playWeaponUpgradedFeedback(level: number): void {
    this.feedbackView?.playWeaponUpgrade(
      level,
      this.getWeaponDisplayName(level),
      this.getWeaponUnlockText(level),
      this.getWeaponPowerBonus(level),
    );
  }

  private playUpgradeAvailableFeedback(): void {
    if (this.upgradeStationAnchor === null) {
      return;
    }

    this.upgradeStationAnchor.getWorldPosition(TMP_VEC3_A);
    TMP_VEC3_A.y += 1.25;
    this.feedbackView?.spawnFloatingLabel('UPGRADE', TMP_VEC3_A, new Color(112, 255, 162, 255));
  }

  private updateHealthBarPositions(): void {
    if (this.feedbackView === null) {
      return;
    }

    for (const resourceId in this.state.resources) {
      const resourceState = this.state.resources[resourceId];
      const resource = this.findResourceComponent(resourceState.id);

      if (resource === null || !resource.node.active) {
        continue;
      }

      resource.getFeedbackWorldPosition(TMP_VEC3_A);
      this.feedbackView.updateResourceHealthBarPosition(resourceState.id, TMP_VEC3_A);
    }

    const gate = this.resolveExitGate();

    if (gate === null || !gate.node.active) {
      return;
    }

    gate.getFeedbackWorldPosition(TMP_VEC3_A);
    this.feedbackView.updateGateHealthBarPosition(TMP_VEC3_A);
  }

  private resolveTargetHint(
    snapshot: PlayableSnapshot,
    outPosition: Vec3,
    outSize: Vec3,
  ): TargetHintCandidate | null {
    if (snapshot.completed) {
      return null;
    }

    if (snapshot.canUpgrade) {
      return null;
    }

    if (snapshot.weaponLevel < 3) {
      return this.resolveResourceTargetHint(snapshot, outPosition, outSize);
    }

    const gate = this.resolveExitGate();

    if (gate === null || snapshot.gate.destroyed) {
      return null;
    }

    gate.getTargetHintWorldBounds(outPosition, outSize);
    return {
      key: gate.getRuntimeId(),
      objectiveKey: 'gate',
      useWorldBounds: true,
      prefab: gate.getTargetHintPrefab(),
    };
  }

  private resolveResourceTargetHint(
    snapshot: PlayableSnapshot,
    outPosition: Vec3,
    outSize: Vec3,
  ): TargetHintCandidate | null {
    const player = this.resolvePlayerController();
    const targetLevel = snapshot.weaponLevel;
    let bestResource: BreakableResource | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    if (player !== null) {
      player.node.getWorldPosition(TMP_VEC3_B);
    }

    for (const resourceState of snapshot.resources) {
      if (resourceState.collected || resourceState.requiredWeaponLevel !== targetLevel) {
        continue;
      }

      const resource = this.findResourceComponent(resourceState.id);

      if (resource === null || !resource.node.activeInHierarchy) {
        continue;
      }

      resource.getHitWorldPosition(TMP_VEC3_C);

      const distance =
        player === null
          ? 0
          : (TMP_VEC3_C.x - TMP_VEC3_B.x) ** 2 + (TMP_VEC3_C.z - TMP_VEC3_B.z) ** 2;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestResource = resource;
      }
    }

    if (bestResource === null) {
      return null;
    }

    bestResource.getTargetHintWorldBounds(outPosition, outSize);

    return {
      key: bestResource.getRuntimeId(),
      objectiveKey: targetLevel === 1 ? 'wood' : 'metal',
      useWorldBounds: true,
      prefab: bestResource.getTargetHintPrefab(),
    };
  }

  private prewarmTargetHints(): void {
    if (this.feedbackView === null) {
      return;
    }

    for (const resource of this.resolveResources()) {
      this.feedbackView.prepareTargetHint(resource.getTargetHintPrefab());
    }

    this.feedbackView.prepareTargetHint(this.resolveExitGate()?.getTargetHintPrefab() ?? null);
  }

  private isPlayerCurrentlyActive(): boolean {
    return this.resolvePlayerController()?.hasActiveGameplayInput() ?? false;
  }

  private getWeaponDisplayName(level: number): string {
    if (level >= 3) {
      return 'HAMMER';
    }

    if (level === 2) {
      return 'METAL PIPE';
    }

    return 'WOODEN PLANK';
  }

  private getWeaponUnlockText(level: number): string {
    if (level >= 3) {
      return 'GATE UNLOCKED';
    }

    return 'BOXES UNLOCKED';
  }

  private getWeaponPowerBonus(level: number): number {
    if (level >= 3) {
      return 250;
    }

    return 150;
  }

  private getDamageText(snapshot: PlayableSnapshot): string {
    if (snapshot.weaponLevel === 1) {
      return '45';
    }

    if (snapshot.weaponLevel === 2) {
      return '75';
    }

    return '110';
  }

  private findResourceComponent(resourceId: string): BreakableResource | null {
    return this.resourcesById.get(resourceId) ?? null;
  }

  private refreshSceneConfig(): void {
    this.resources.length = 0;
    this.resourcesById.clear();

    const scene = director.getScene();
    const sceneResources = scene === null ? [] : this.findResourcesInTree(scene);
    const usedIds = new Map<string, number>();
    const definitions: ResourceDefinition[] = [];

    for (const resource of sceneResources) {
      const id = this.createUniqueResourceId(resource, usedIds);
      resource.assignRuntimeId(id);
      this.resources.push(resource);
      this.resourcesById.set(id, resource);
      definitions.push(this.createResourceDefinition(resource, id));
    }

    this.config = {
      ...DEFAULT_PLAYABLE_CONFIG,
      resources: definitions.length > 0 ? definitions : DEFAULT_PLAYABLE_CONFIG.resources,
    };
  }

  private createUniqueResourceId(
    resource: BreakableResource,
    usedIds: Map<string, number>,
  ): string {
    const baseId = resource.resourceId.trim() || resource.node.name || 'Resource';
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);

    if (count === 0) {
      return baseId;
    }

    return `${baseId}_${count + 1}`;
  }

  private createResourceDefinition(resource: BreakableResource, id: string): ResourceDefinition {
    return {
      id,
      kind: resource.resourceKind === CocosResourceKind.Metal ? 'metal' : 'wood',
      requiredWeaponLevel: resource.requiredWeaponLevel >= 2 ? 2 : 1,
      rewardAmount: Math.max(1, Math.floor(resource.rewardAmount)),
      maxHits: Math.max(1, Math.floor(resource.maxHits)),
    };
  }

  private applyUpgradeStation(snapshot: PlayableSnapshot): void {
    const trigger = this.resolveUpgradeStationTrigger();

    if (trigger !== null) {
      trigger.isTrigger = true;
      trigger.enabled = snapshot.canUpgrade && !snapshot.completed;
    }

    this.syncUpgradeStationZone(snapshot);
  }

  private syncUpgradeStationZone(snapshot: PlayableSnapshot): void {
    if (this.feedbackView === null) {
      return;
    }

    const anchor = this.upgradeStationAnchor ?? this.resolveUpgradeStationTrigger()?.node ?? null;
    const visible = snapshot.canUpgrade && !snapshot.completed && anchor !== null;

    if (anchor !== null) {
      anchor.getWorldPosition(TMP_VEC3_A);
    }

    this.feedbackView.setUpgradeStationZone(TMP_VEC3_A, visible);
  }

  private bindUpgradeStationTrigger(): void {
    const trigger = this.resolveUpgradeStationTrigger();

    if (trigger === null || this.boundUpgradeStationTrigger === trigger) {
      return;
    }

    this.unbindUpgradeStationTrigger();
    trigger.isTrigger = true;
    trigger.on('onTriggerEnter', this.onUpgradeStationTrigger, this);
    trigger.on('onTriggerStay', this.onUpgradeStationTrigger, this);
    this.boundUpgradeStationTrigger = trigger;
  }

  private unbindUpgradeStationTrigger(): void {
    if (this.boundUpgradeStationTrigger === null) {
      return;
    }

    this.boundUpgradeStationTrigger.off('onTriggerEnter', this.onUpgradeStationTrigger, this);
    this.boundUpgradeStationTrigger.off('onTriggerStay', this.onUpgradeStationTrigger, this);
    this.boundUpgradeStationTrigger = null;
  }

  private bindStoreButton(): void {
    if (this.storeButton === null || !this.storeButton.isValid) {
      return;
    }

    if (this.boundStoreButton === this.storeButton) {
      return;
    }

    this.unbindStoreButton();
    this.storeButton.on(Node.EventType.TOUCH_END, this.openStore, this);
    this.boundStoreButton = this.storeButton;
  }

  private unbindStoreButton(): void {
    if (this.boundStoreButton === null || !this.boundStoreButton.isValid) {
      this.boundStoreButton = null;
      return;
    }

    this.boundStoreButton.off(Node.EventType.TOUCH_END, this.openStore, this);
    this.boundStoreButton = null;
  }

  private onUpgradeStationTrigger(event: ITriggerEvent): void {
    if (
      event.otherCollider === null ||
      this.findPlayerInParents(event.otherCollider.node) === null
    ) {
      return;
    }

    if (!this.getSnapshot().canUpgrade) {
      return;
    }

    this.tryUpgrade();
  }

  private findResourceState(resources: ResourceState[], id: string): ResourceState | null {
    for (const resource of resources) {
      if (resource.id === id) {
        return resource;
      }
    }

    return null;
  }

  private findResourcesInTree(root: Node): BreakableResource[] {
    const result: BreakableResource[] = [];
    const resource = root.getComponent(BreakableResource);

    if (resource !== null) {
      result.push(resource);
    }

    for (const child of root.children) {
      result.push(...this.findResourcesInTree(child));
    }

    return result;
  }

  private findPlayerInParents(node: Node): PlayerController | null {
    let current: Node | null = node;

    while (current !== null) {
      const player = current.getComponent(PlayerController);

      if (player !== null) {
        return player;
      }

      current = current.parent;
    }

    return null;
  }

  private findColliderByNodeName(root: Node, nodeName: string): Collider | null {
    if (root.name === nodeName) {
      return root.getComponent(Collider);
    }

    for (const child of root.children) {
      const found = this.findColliderByNodeName(child, nodeName);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  private findExitGateInTree(root: Node): ExitGate | null {
    const gate = root.getComponent(ExitGate);

    if (gate !== null) {
      return gate;
    }

    for (const child of root.children) {
      const found = this.findExitGateInTree(child);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  private findWeaponMountInTree(root: Node): WeaponMount | null {
    const mount = root.getComponent(WeaponMount);

    if (mount !== null) {
      return mount;
    }

    for (const child of root.children) {
      const found = this.findWeaponMountInTree(child);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  private findPlayerInTree(root: Node): PlayerController | null {
    const player = root.getComponent(PlayerController);

    if (player !== null) {
      return player;
    }

    for (const child of root.children) {
      const found = this.findPlayerInTree(child);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }
}
