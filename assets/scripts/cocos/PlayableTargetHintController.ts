import { Prefab, Vec3 } from 'cc';

import type { GameEvent, PlayableSnapshot } from '../domain';
import { BreakableResource } from './BreakableResource';
import { ExitGate } from './ExitGate';
import { PlayableFeedbackView } from './PlayableFeedbackView';
import { PlayerController } from './PlayerController';

type TargetHintCandidate = {
  key: string;
  objectiveKey: string;
  useWorldBounds: boolean;
  prefab: Prefab | null;
};

type PlayableTargetHintControllerOptions = {
  getFeedbackView: () => PlayableFeedbackView | null;
  getResources: () => BreakableResource[];
  getExitGate: () => ExitGate | null;
  getPlayer: () => PlayerController | null;
  getIdleDelay: () => number;
  getInitialIdleDelay: () => number;
};

const TARGET_POSITION = new Vec3();
const TARGET_SIZE = new Vec3();
const PLAYER_POSITION = new Vec3();
const RESOURCE_POSITION = new Vec3();

export class PlayableTargetHintController {
  private readonly options: PlayableTargetHintControllerOptions;
  private cooldownRemaining = 0;
  private objectiveKey = '';
  private targetKey = '';
  private shownOnce = false;

  public constructor(options: PlayableTargetHintControllerOptions) {
    this.options = options;
  }

  public update(deltaTime: number, snapshot: PlayableSnapshot): void {
    const feedbackView = this.options.getFeedbackView();

    if (feedbackView === null) {
      return;
    }

    const target = this.resolveTargetHint(snapshot);

    if (target === null) {
      this.resetTracking();
      feedbackView.hideTargetHint();
      return;
    }

    const objectiveChanged = target.objectiveKey !== this.objectiveKey;
    const targetChanged = target.key !== this.targetKey;
    this.objectiveKey = target.objectiveKey;
    this.targetKey = target.key;
    feedbackView.syncTargetHint(TARGET_POSITION, target.useWorldBounds ? TARGET_SIZE : null);

    if (objectiveChanged) {
      if (!this.shownOnce) {
        this.cooldownRemaining = this.getCurrentDelay();
        return;
      }

      this.playTargetHint(feedbackView, target);
      return;
    }

    if (targetChanged) {
      this.cooldownRemaining = this.getCurrentDelay();
    }

    if (this.isPlayerActive()) {
      this.cooldownRemaining = this.getCurrentDelay();
      return;
    }

    this.cooldownRemaining -= deltaTime;

    if (this.cooldownRemaining <= 0) {
      this.playTargetHint(feedbackView, target);
    }
  }

  public handleEvents(events: GameEvent[], snapshot: PlayableSnapshot): void {
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
      this.cooldownRemaining = Math.max(0, this.options.getIdleDelay());
      this.options.getFeedbackView()?.hideTargetHint();
    }

    this.update(0, snapshot);
  }

  public reset(): void {
    this.cooldownRemaining = 0;
    this.objectiveKey = '';
    this.targetKey = '';
  }

  public armInitialDelay(): void {
    this.shownOnce = false;
    this.cooldownRemaining = Math.max(0, this.options.getInitialIdleDelay());
  }

  public prewarm(): void {
    const feedbackView = this.options.getFeedbackView();

    if (feedbackView === null) {
      return;
    }

    for (const resource of this.options.getResources()) {
      feedbackView.prepareTargetHint(resource.getTargetHintPrefab());
    }

    feedbackView.prepareTargetHint(this.options.getExitGate()?.getTargetHintPrefab() ?? null);
  }

  private playTargetHint(feedbackView: PlayableFeedbackView, target: TargetHintCandidate): void {
    this.shownOnce = true;
    this.cooldownRemaining = Math.max(0, this.options.getIdleDelay());
    feedbackView.playTargetHint(
      TARGET_POSITION,
      target.useWorldBounds ? TARGET_SIZE : null,
      target.prefab,
    );
  }

  private getCurrentDelay(): number {
    return Math.max(
      0,
      this.shownOnce ? this.options.getIdleDelay() : this.options.getInitialIdleDelay(),
    );
  }

  private resolveTargetHint(snapshot: PlayableSnapshot): TargetHintCandidate | null {
    if (snapshot.completed || snapshot.canUpgrade) {
      return null;
    }

    if (snapshot.weaponLevel < 3) {
      return this.resolveResourceTargetHint(snapshot);
    }

    const gate = this.options.getExitGate();

    if (gate === null || snapshot.gate.destroyed) {
      return null;
    }

    gate.getTargetHintWorldBounds(TARGET_POSITION, TARGET_SIZE);
    return {
      key: gate.getRuntimeId(),
      objectiveKey: 'gate',
      useWorldBounds: true,
      prefab: gate.getTargetHintPrefab(),
    };
  }

  private resolveResourceTargetHint(snapshot: PlayableSnapshot): TargetHintCandidate | null {
    const player = this.options.getPlayer();
    const targetLevel = snapshot.weaponLevel;
    let bestResource: BreakableResource | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    if (player !== null) {
      player.node.getWorldPosition(PLAYER_POSITION);
    }

    for (const resourceState of snapshot.resources) {
      if (resourceState.collected || resourceState.requiredWeaponLevel !== targetLevel) {
        continue;
      }

      const resource = this.findResource(resourceState.id);

      if (resource === null || !resource.node.activeInHierarchy) {
        continue;
      }

      resource.getHitWorldPosition(RESOURCE_POSITION);

      const distance =
        player === null
          ? 0
          : (RESOURCE_POSITION.x - PLAYER_POSITION.x) ** 2 +
            (RESOURCE_POSITION.z - PLAYER_POSITION.z) ** 2;

      if (distance < bestDistance) {
        bestDistance = distance;
        bestResource = resource;
      }
    }

    if (bestResource === null) {
      return null;
    }

    bestResource.getTargetHintWorldBounds(TARGET_POSITION, TARGET_SIZE);

    return {
      key: bestResource.getRuntimeId(),
      objectiveKey: targetLevel === 1 ? 'wood' : 'metal',
      useWorldBounds: true,
      prefab: bestResource.getTargetHintPrefab(),
    };
  }

  private findResource(resourceId: string): BreakableResource | null {
    for (const resource of this.options.getResources()) {
      if (resource.getRuntimeId() === resourceId) {
        return resource;
      }
    }

    return null;
  }

  private isPlayerActive(): boolean {
    return this.options.getPlayer()?.hasActiveGameplayInput() ?? false;
  }

  private resetTracking(): void {
    this.cooldownRemaining = 0;
    this.objectiveKey = '';
    this.targetKey = '';
  }
}
