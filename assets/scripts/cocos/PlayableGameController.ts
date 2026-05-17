import { _decorator, Component, director, Node } from 'cc';

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
import { WeaponMount } from './WeaponMount';

const { ccclass, property } = _decorator;

export const PLAYABLE_STATE_CHANGED_EVENT = 'playable-state-changed';
export const PLAYABLE_EVENTS_EVENT = 'playable-events';

@ccclass('PlayableGameController')
export class PlayableGameController extends Component {
  @property
  public startOnLoad = true;

  @property
  public autoUpgradeWhenAffordable = true;

  @property({ type: [BreakableResource] })
  public resources: BreakableResource[] = [];

  @property({ type: ExitGate })
  public exitGate: ExitGate | null = null;

  @property({ type: WeaponMount })
  public weaponMount: WeaponMount | null = null;

  private state: PlayableState = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
  private appliedWeaponLevel = 0;

  public start(): void {
    this.state = createInitialPlayableState(DEFAULT_PLAYABLE_CONFIG);
    this.applySnapshot(this.getSnapshot());

    if (this.startOnLoad) {
      this.dispatch({ type: 'start' });
      return;
    }

    this.emitStateChanged([]);
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
    this.dispatch({ type: 'reset' });
  }

  private dispatch(command: GameCommand): void {
    const result = stepPlayableState(this.state, command, DEFAULT_PLAYABLE_CONFIG);
    this.state = result.state;

    const snapshot = this.getSnapshot();
    this.applySnapshot(snapshot);
    this.emitStateChanged(result.events);
    this.handleAutomaticProgression(result.events);
  }

  private applySnapshot(snapshot: PlayableSnapshot): void {
    this.applyResources(snapshot.resources);
    this.applyGate(snapshot);
    this.applyWeapon(snapshot);
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
      const childGate = this.findExitGateInTree(child);

      if (childGate !== null) {
        return childGate;
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
      const childMount = this.findWeaponMountInTree(child);

      if (childMount !== null) {
        return childMount;
      }
    }

    return null;
  }
}
