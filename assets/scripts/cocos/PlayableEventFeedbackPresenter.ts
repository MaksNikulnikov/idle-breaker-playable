import { Color, Node, Vec3 } from 'cc';

import {
  getDamageText,
  getWeaponDisplayName,
  getWeaponPowerBonus,
  getWeaponUnlockText,
  type PlayablePresentationConfig,
} from '../application';
import type { GameEvent, PlayableSnapshot, ResourceKind, WeaponLevel } from '../domain';
import type { PlayableFeedbackView } from './PlayableFeedbackView';
import type { PlayableSceneRegistry } from './PlayableSceneRegistry';

type PlayableEventFeedbackPresenterOptions = {
  sceneRegistry: PlayableSceneRegistry;
  presentationConfig: PlayablePresentationConfig;
  getFeedbackView: () => PlayableFeedbackView | null;
  getUpgradeStationAnchor: () => Node | null;
};

const DAMAGE_COLOR = new Color(255, 245, 220, 255);
const LOCKED_COLOR = new Color(255, 120, 90, 255);
const UPGRADE_COLOR = new Color(112, 255, 162, 255);

export class PlayableEventFeedbackPresenter {
  private readonly options: PlayableEventFeedbackPresenterOptions;
  private readonly feedbackPosition = new Vec3();
  private readonly hitPosition = new Vec3();

  public constructor(options: PlayableEventFeedbackPresenterOptions) {
    this.options = options;
  }

  public play(events: GameEvent[], snapshot: PlayableSnapshot): boolean {
    let completed = false;

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
          completed = true;
          break;
        default:
          break;
      }
    }

    return completed;
  }

  private playResourceHitFeedback(
    resourceId: string,
    snapshot: PlayableSnapshot,
    kind: ResourceKind,
  ): void {
    const resource = this.options.sceneRegistry.findResource(resourceId);

    if (resource === null) {
      return;
    }

    resource.playHitFeedback();
    resource.getFeedbackWorldPosition(this.feedbackPosition);
    resource.getHitWorldPosition(this.hitPosition);
    this.options
      .getFeedbackView()
      ?.spawnFloatingLabel(
        getDamageText(snapshot, this.options.presentationConfig),
        this.feedbackPosition,
        DAMAGE_COLOR,
      );
    this.options.sceneRegistry.resolveWeaponMount()?.playAttackSlash();
    this.options.getFeedbackView()?.spawnPickupRewards(kind, this.hitPosition);
    this.options.getFeedbackView()?.spawnHitStars(this.hitPosition);
    this.options.getFeedbackView()?.spawnImpactBurst(this.hitPosition, 1.15);
  }

  private playResourceCollectedFeedback(resourceId: string): void {
    const resource = this.options.sceneRegistry.findResource(resourceId);

    if (resource === null) {
      return;
    }

    resource.getFeedbackWorldPosition(this.feedbackPosition);
    resource.getHitWorldPosition(this.hitPosition);
    resource.playCollectedFeedback();
    this.options.getFeedbackView()?.hideResourceHealthBar(resourceId, 0.25);
    this.options.getFeedbackView()?.spawnImpactBurst(this.hitPosition, 1.45);
  }

  private playResourceLockedFeedback(resourceId: string, requiredWeaponLevel: number): void {
    const resource = this.options.sceneRegistry.findResource(resourceId);

    if (resource === null) {
      return;
    }

    resource.getFeedbackWorldPosition(this.feedbackPosition);
    this.options
      .getFeedbackView()
      ?.spawnFloatingLabel(`LVL ${requiredWeaponLevel}`, this.feedbackPosition, LOCKED_COLOR);
  }

  private playGateHitFeedback(snapshot: PlayableSnapshot): void {
    const gate = this.options.sceneRegistry.resolveExitGate(null);

    if (gate === null) {
      return;
    }

    gate.playHitFeedback();
    gate.getFeedbackWorldPosition(this.feedbackPosition);
    gate.getHitWorldPosition(this.hitPosition);
    this.options
      .getFeedbackView()
      ?.spawnFloatingLabel(
        getDamageText(snapshot, this.options.presentationConfig),
        this.feedbackPosition,
        DAMAGE_COLOR,
      );
    this.options.sceneRegistry.resolveWeaponMount()?.playAttackSlash();
    this.options.getFeedbackView()?.spawnImpactBurst(this.hitPosition, 1.35);
  }

  private playGateLockedFeedback(requiredWeaponLevel: number): void {
    const gate = this.options.sceneRegistry.resolveExitGate(null);

    if (gate === null) {
      return;
    }

    gate.getFeedbackWorldPosition(this.feedbackPosition);
    this.options
      .getFeedbackView()
      ?.spawnFloatingLabel(`LVL ${requiredWeaponLevel}`, this.feedbackPosition, LOCKED_COLOR);
  }

  private playGateDestroyedFeedback(): void {
    const gate = this.options.sceneRegistry.resolveExitGate(null);

    if (gate === null) {
      return;
    }

    gate.getFeedbackWorldPosition(this.feedbackPosition);
    gate.getHitWorldPosition(this.hitPosition);
    gate.playDestroyedFeedback();
    this.options.getFeedbackView()?.hideGateHealthBar(0.35);
    this.options.getFeedbackView()?.spawnImpactBurst(this.hitPosition, 1.75);
  }

  private playWeaponUpgradedFeedback(level: WeaponLevel): void {
    this.options
      .getFeedbackView()
      ?.playWeaponUpgrade(
        level,
        getWeaponDisplayName(level, this.options.presentationConfig),
        getWeaponUnlockText(level, this.options.presentationConfig),
        getWeaponPowerBonus(level, this.options.presentationConfig),
      );
  }

  private playUpgradeAvailableFeedback(): void {
    const anchor = this.options.getUpgradeStationAnchor();

    if (anchor === null) {
      return;
    }

    anchor.getWorldPosition(this.feedbackPosition);
    this.feedbackPosition.y += 1.25;
    this.options
      .getFeedbackView()
      ?.spawnFloatingLabel('UPGRADE', this.feedbackPosition, UPGRADE_COLOR);
  }
}
