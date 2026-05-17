import { _decorator, Color, Component, director, Node, Vec3 } from 'cc';

import { DEFAULT_PLAYABLE_CONFIG } from '../application';
import {
  createInitialPlayableState,
  createPlayableSnapshot,
  stepPlayableState,
  type GameCommand,
  type GameEvent,
  type PlayableSnapshot,
  type PlayableState,
  type ResourceState,
} from '../domain';
import { BreakableResource } from './BreakableResource';
import { ExitGate } from './ExitGate';
import { PlayableFeedbackView } from './PlayableFeedbackView';
import { PlayableHudView } from './PlayableHudView';
import { WeaponMount } from './WeaponMount';

const { ccclass, disallowMultiple, property } = _decorator;

export const PLAYABLE_STATE_CHANGED_EVENT = 'playable-state-changed';
export const PLAYABLE_EVENTS_EVENT = 'playable-events';

type RewardKind = 'wood' | 'metal';

const TMP_VEC3_A = new Vec3();

@ccclass('PlayableGameController')
@disallowMultiple
export class PlayableGameController extends Component {
  @property
  public startOnLoad = true;

  @property
  public autoUpgradeWhenAffordable = true;

  @property({ type: ExitGate })
  public exitGate: ExitGate | null = null;

  @property({ type: PlayableHudView })
  public hudView: PlayableHudView | null = null;

  @property({ type: PlayableFeedbackView })
  public feedbackView: PlayableFeedbackView | null = null;

  private state: PlayableState = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
  private appliedWeaponLevel = 0;
  private readonly resources: BreakableResource[] = [];
  private weaponMount: WeaponMount | null = null;

  public start(): void {
    this.validateSceneReferences();
    this.feedbackView?.refreshLayout();
    this.state = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
    const snapshot = this.getSnapshot();
    this.applySnapshot(snapshot);
    this.syncFeedbackState(snapshot);

    if (this.startOnLoad) {
      this.dispatch({ type: 'start' });
      return;
    }

    this.emitStateChanged([]);
  }

  public update(deltaTime: number): void {
    this.feedbackView?.refreshLayout();
    this.updateFeedback(deltaTime);
  }

  public getSnapshot(): PlayableSnapshot {
    return createPlayableSnapshot(this.state, DEFAULT_PLAYABLE_CONFIG);
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

  public resetGame(): void {
    this.appliedWeaponLevel = 0;
    this.feedbackView?.clearTransientFeedback();
    this.dispatch({ type: 'reset' });
  }

  private dispatch(command: GameCommand): void {
    const result = stepPlayableState(this.state, command, DEFAULT_PLAYABLE_CONFIG);
    this.state = result.state;

    const snapshot = this.getSnapshot();
    this.applySnapshot(snapshot);
    this.syncFeedbackState(snapshot);
    this.playEventFeedback(result.events, snapshot);
    this.emitStateChanged(result.events);
    this.handleAutomaticProgression(result.events);
  }

  private applySnapshot(snapshot: PlayableSnapshot): void {
    this.applyResources(snapshot.resources);
    this.applyGate(snapshot);
    this.applyWeapon(snapshot);
    this.hudView?.applySnapshot(snapshot);
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

  private resolveResources(): BreakableResource[] {
    if (this.resources.length > 0) {
      return this.resources.filter((resource) => resource !== null);
    }

    const scene = director.getScene();
    return scene === null ? [] : this.findResourcesInTree(scene);
  }

  private resolveExitGate(): ExitGate | null {
    if (this.exitGate !== null) {
      return this.exitGate;
    }

    const scene = director.getScene();
    return scene === null ? null : this.findExitGateInTree(scene);
  }

  private resolveWeaponMount(): WeaponMount | null {
    if (this.weaponMount !== null) {
      return this.weaponMount;
    }

    const scene = director.getScene();
    return scene === null ? null : this.findWeaponMountInTree(scene);
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
  }

  private updateFeedback(deltaTime: number): void {
    this.updateHealthBarPositions();
    this.feedbackView?.updateHealthBars(deltaTime);
  }

  private playEventFeedback(events: GameEvent[], snapshot: PlayableSnapshot): void {
    for (const event of events) {
      switch (event.type) {
        case 'resource_hit':
          this.playResourceHitFeedback(event.resourceId, snapshot);
          break;
        case 'resource_collected':
          this.playResourceCollectedFeedback(event.resourceId, event.kind, event.rewardAmount);
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
        default:
          break;
      }
    }
  }

  private playResourceHitFeedback(resourceId: string, snapshot: PlayableSnapshot): void {
    const resource = this.findResourceComponent(resourceId);

    if (resource === null) {
      return;
    }

    resource.playHitFeedback();
    resource.getFeedbackWorldPosition(TMP_VEC3_A);
    this.feedbackView?.spawnFloatingLabel(
      this.getDamageText(snapshot),
      TMP_VEC3_A,
      new Color(255, 245, 220, 255),
    );
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_A);
  }

  private playResourceCollectedFeedback(
    resourceId: string,
    kind: RewardKind,
    rewardAmount: number,
  ): void {
    const resource = this.findResourceComponent(resourceId);

    if (resource === null) {
      return;
    }

    resource.getFeedbackWorldPosition(TMP_VEC3_A);
    resource.playCollectedFeedback();
    this.feedbackView?.hideResourceHealthBar(resourceId, 0.25);
    this.feedbackView?.spawnPickupRewards(kind, rewardAmount, TMP_VEC3_A);
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_A, 1.35);
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
    this.feedbackView?.spawnFloatingLabel(
      this.getDamageText(snapshot),
      TMP_VEC3_A,
      new Color(255, 245, 220, 255),
    );
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_A, 1.2);
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
    gate.playDestroyedFeedback();
    this.feedbackView?.hideGateHealthBar(0.35);
    this.feedbackView?.spawnImpactBurst(TMP_VEC3_A, 1.6);
  }

  private playWeaponUpgradedFeedback(level: number): void {
    this.feedbackView?.playWeaponUpgrade(
      level,
      this.getWeaponDisplayName(level),
      this.getWeaponUnlockText(level),
    );
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

    return 'FENCES UNLOCKED';
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
    for (const resource of this.resolveResources()) {
      if (resource.getRuntimeId() === resourceId) {
        return resource;
      }
    }

    return null;
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
}
