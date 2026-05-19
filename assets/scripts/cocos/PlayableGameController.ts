import { _decorator, Collider, Component, ITriggerEvent, Node } from 'cc';

import {
  DEFAULT_PLAYABLE_CONFIG,
  DEFAULT_PLAYABLE_PRESENTATION_CONFIG,
  type PlayablePresentationConfig,
} from '../application';
import {
  createInitialPlayableState,
  createPlayableSnapshot,
  stepPlayableState,
  type GameCommand,
  type GameEvent,
  type PlayableConfig,
  type PlayableSnapshot,
  type PlayableState,
} from '../domain';
import { BreakableResource } from './BreakableResource';
import { ExitGate } from './ExitGate';
import { PlayableCompletionController } from './PlayableCompletionController';
import { PlayableEventFeedbackPresenter } from './PlayableEventFeedbackPresenter';
import { PlayableFeedbackView } from './PlayableFeedbackView';
import { PlayableHudView } from './PlayableHudView';
import { PlayableSceneRegistry } from './PlayableSceneRegistry';
import { PlayableSnapshotApplier } from './PlayableSnapshotApplier';
import { PlayableTargetHintController } from './PlayableTargetHintController';
import type { PlayerController } from './PlayerController';

const { ccclass, disallowMultiple, property } = _decorator;

export const PLAYABLE_STATE_CHANGED_EVENT = 'playable-state-changed';
export const PLAYABLE_EVENTS_EVENT = 'playable-events';

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
  public openStoreAutomaticallyOnCompletion = true;

  @property
  public completionStoreOpenDelay = 3;

  @property
  public lockPlayerOnCompletion = true;

  @property({ type: Node })
  public storeButton: Node | null = null;

  private config: PlayableConfig = DEFAULT_PLAYABLE_CONFIG;
  private readonly presentationConfig: PlayablePresentationConfig =
    DEFAULT_PLAYABLE_PRESENTATION_CONFIG;
  private state: PlayableState = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
  private snapshot: PlayableSnapshot = createPlayableSnapshot(this.state, this.config);
  private readonly sceneRegistry = new PlayableSceneRegistry();
  private readonly eventFeedback = new PlayableEventFeedbackPresenter({
    sceneRegistry: this.sceneRegistry,
    presentationConfig: this.presentationConfig,
    getFeedbackView: () => this.feedbackView,
    getUpgradeStationAnchor: () => this.upgradeStationAnchor,
  });
  private readonly snapshotApplier = new PlayableSnapshotApplier({
    sceneRegistry: this.sceneRegistry,
    getHudView: () => this.hudView,
    getFeedbackView: () => this.feedbackView,
    getUpgradeStationTrigger: () => this.resolveUpgradeStationTrigger(),
    getUpgradeStationAnchor: () => this.upgradeStationAnchor,
    isPlayerCompletionLockEnabled: () => this.lockPlayerOnCompletion,
  });
  private readonly completionFlow = new PlayableCompletionController({
    owner: this,
    getStoreUrl: () => this.storeUrl,
    isAutomaticOpenEnabled: () => this.openStoreAutomaticallyOnCompletion,
    getAutomaticOpenDelay: () => this.completionStoreOpenDelay,
    getStoreButton: () => this.storeButton,
  });
  private boundUpgradeStationTrigger: Collider | null = null;
  private readonly targetHints = new PlayableTargetHintController({
    getFeedbackView: () => this.feedbackView,
    getResources: () => this.resolveResources(),
    getExitGate: () => this.resolveExitGate(),
    getPlayer: () => this.resolvePlayerController(),
    getIdleDelay: () => this.targetHintIdleDelay,
    getInitialIdleDelay: () => this.initialTargetHintIdleDelay,
  });

  public onEnable(): void {
    this.bindUpgradeStationTrigger();
    this.completionFlow.bindStoreButton();
  }

  public onDisable(): void {
    this.completionFlow.clearScheduledStoreOpen();
    this.unbindUpgradeStationTrigger();
    this.completionFlow.unbindStoreButton();
  }

  public start(): void {
    this.validateSceneReferences();
    this.refreshSceneConfig();
    this.bindUpgradeStationTrigger();
    this.completionFlow.bindStoreButton();
    this.feedbackView?.refreshLayout();
    this.feedbackView?.prewarmTransientEffects();
    this.feedbackView?.warmupTransientRenderers();
    this.targetHints.prewarm();
    this.state = createInitialPlayableState(this.config);
    this.targetHints.armInitialDelay();
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
    this.targetHints.update(deltaTime, this.getSnapshot());
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
    this.completionFlow.openStore();
  }

  public resetGame(): void {
    this.snapshotApplier.reset();
    this.completionFlow.reset();
    this.targetHints.reset();
    this.targetHints.armInitialDelay();
    this.feedbackView?.clearTransientFeedback();
    this.refreshSceneConfig();
    this.targetHints.prewarm();
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
    this.targetHints.handleEvents(result.events, snapshot);
  }

  private applySnapshot(snapshot: PlayableSnapshot): void {
    this.snapshotApplier.apply(snapshot);
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
    const resources = this.sceneRegistry.resolveResources();

    if (resources.length === 0) {
      this.refreshSceneConfig();
    }

    return this.sceneRegistry.resolveResources();
  }

  private resolveExitGate(): ExitGate | null {
    return this.sceneRegistry.resolveExitGate(this.exitGate);
  }

  private resolvePlayerController(): PlayerController | null {
    return this.sceneRegistry.resolvePlayerController();
  }

  private resolveUpgradeStationTrigger(): Collider | null {
    return this.sceneRegistry.resolveUpgradeStationTrigger(this.upgradeStationTrigger);
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
    this.snapshotApplier.syncFeedbackState(snapshot);
  }

  private updateFeedback(deltaTime: number): void {
    this.snapshotApplier.updateFeedbackPositions(this.getSnapshot());
    this.feedbackView?.updateHealthBars(deltaTime);
  }

  private playEventFeedback(events: GameEvent[], snapshot: PlayableSnapshot): void {
    if (this.eventFeedback.play(events, snapshot)) {
      this.handlePlayableCompleted();
    }
  }

  private handlePlayableCompleted(): void {
    this.snapshotApplier.applyPlayerCompletionLock(this.getSnapshot());
    this.completionFlow.handleCompleted();
  }

  private refreshSceneConfig(): void {
    this.config = this.sceneRegistry.refreshConfig(DEFAULT_PLAYABLE_CONFIG, {
      exitGate: this.exitGate,
      upgradeStationTrigger: this.upgradeStationTrigger,
    });
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

  private onUpgradeStationTrigger(event: ITriggerEvent): void {
    if (
      event.otherCollider === null ||
      this.sceneRegistry.findPlayerInParents(event.otherCollider.node) === null
    ) {
      return;
    }

    if (!this.getSnapshot().canUpgrade) {
      return;
    }

    this.tryUpgrade();
  }
}
