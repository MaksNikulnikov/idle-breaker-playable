import { Collider, Node, Vec3 } from 'cc';

import type { PlayableSnapshot, ResourceState } from '../domain';
import type { PlayableFeedbackView } from './PlayableFeedbackView';
import type { PlayableHudView } from './PlayableHudView';
import type { PlayableSceneRegistry } from './PlayableSceneRegistry';

type PlayableSnapshotApplierOptions = {
  sceneRegistry: PlayableSceneRegistry;
  getHudView: () => PlayableHudView | null;
  getFeedbackView: () => PlayableFeedbackView | null;
  getUpgradeStationTrigger: () => Collider | null;
  getUpgradeStationAnchor: () => Node | null;
  isPlayerCompletionLockEnabled: () => boolean;
};

export class PlayableSnapshotApplier {
  private readonly options: PlayableSnapshotApplierOptions;
  private readonly feedbackPosition = new Vec3();
  private appliedWeaponLevel = 0;

  public constructor(options: PlayableSnapshotApplierOptions) {
    this.options = options;
  }

  public reset(): void {
    this.appliedWeaponLevel = 0;
  }

  public apply(snapshot: PlayableSnapshot): void {
    this.applyResources(snapshot.resources);
    this.applyGate(snapshot);
    this.applyWeapon(snapshot);
    this.options.getHudView()?.applySnapshot(snapshot);
    this.applyUpgradeStation(snapshot);
    this.applyPlayerCompletionLock(snapshot);
  }

  public applyPlayerCompletionLock(snapshot: PlayableSnapshot): void {
    if (!this.options.isPlayerCompletionLockEnabled()) {
      return;
    }

    this.options.sceneRegistry.resolvePlayerController()?.setControlsEnabled(!snapshot.completed);
  }

  public syncFeedbackState(snapshot: PlayableSnapshot): void {
    const feedbackView = this.options.getFeedbackView();

    if (feedbackView === null) {
      return;
    }

    for (const resource of snapshot.resources) {
      const component = this.options.sceneRegistry.findResource(resource.id);

      if (component === null) {
        continue;
      }

      component.getFeedbackWorldPosition(this.feedbackPosition);
      feedbackView.setResourceHealthBar(
        resource.id,
        this.feedbackPosition,
        resource.hitsRemaining,
        resource.maxHits,
        !resource.collected ? 'visible' : component.node.active ? 'hide-soon' : 'hidden',
      );
    }

    const gate = this.options.sceneRegistry.resolveExitGate(null);

    if (gate !== null) {
      gate.getFeedbackWorldPosition(this.feedbackPosition);
      feedbackView.setGateHealthBar(
        this.feedbackPosition,
        snapshot.gate.hitsRemaining,
        snapshot.gate.maxHits,
        !snapshot.gate.destroyed ? 'visible' : gate.node.active ? 'hide-soon' : 'hidden',
      );
    }

    this.syncUpgradeStationZone(snapshot);
  }

  public updateFeedbackPositions(snapshot: PlayableSnapshot): void {
    const feedbackView = this.options.getFeedbackView();

    if (feedbackView === null) {
      return;
    }

    for (const resource of snapshot.resources) {
      const component = this.options.sceneRegistry.findResource(resource.id);

      if (component === null || !component.node.active) {
        continue;
      }

      component.getFeedbackWorldPosition(this.feedbackPosition);
      feedbackView.updateResourceHealthBarPosition(resource.id, this.feedbackPosition);
    }

    const gate = this.options.sceneRegistry.resolveExitGate(null);

    if (gate !== null && gate.node.active) {
      gate.getFeedbackWorldPosition(this.feedbackPosition);
      feedbackView.updateGateHealthBarPosition(this.feedbackPosition);
    }

    this.syncUpgradeStationZone(snapshot);
  }

  private applyResources(resources: ResourceState[]): void {
    const components = this.options.sceneRegistry.resolveResources();

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
    const gate = this.options.sceneRegistry.resolveExitGate(null);

    if (gate === null || gate.getRuntimeId() !== snapshot.gate.id) {
      return;
    }

    gate.setDestroyed(snapshot.gate.destroyed);

    if (!snapshot.gate.destroyed) {
      gate.showDamageStage(snapshot.gate.maxHits - snapshot.gate.hitsRemaining);
    }
  }

  private applyWeapon(snapshot: PlayableSnapshot): void {
    const mount = this.options.sceneRegistry.resolveWeaponMount();

    if (mount === null || this.appliedWeaponLevel === snapshot.weaponLevel) {
      return;
    }

    mount.equipWeaponLevel(snapshot.weaponLevel);
    this.appliedWeaponLevel = snapshot.weaponLevel;
  }

  private applyUpgradeStation(snapshot: PlayableSnapshot): void {
    const trigger = this.options.getUpgradeStationTrigger();

    if (trigger !== null) {
      trigger.isTrigger = true;
      trigger.enabled = snapshot.canUpgrade && !snapshot.completed;
    }

    this.syncUpgradeStationZone(snapshot);
  }

  private syncUpgradeStationZone(snapshot: PlayableSnapshot): void {
    const feedbackView = this.options.getFeedbackView();

    if (feedbackView === null) {
      return;
    }

    const anchor =
      this.options.getUpgradeStationAnchor() ??
      this.options.getUpgradeStationTrigger()?.node ??
      null;
    const visible = snapshot.canUpgrade && !snapshot.completed && anchor !== null;

    if (anchor !== null) {
      anchor.getWorldPosition(this.feedbackPosition);
    }

    feedbackView.setUpgradeStationZone(this.feedbackPosition, visible);
  }

  private findResourceState(resources: ResourceState[], id: string): ResourceState | null {
    for (const resource of resources) {
      if (resource.id === id) {
        return resource;
      }
    }

    return null;
  }
}
