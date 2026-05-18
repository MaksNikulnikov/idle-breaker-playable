import { _decorator, Collider, Component, director, ITriggerEvent, Node } from 'cc';

import { BreakableResource } from './BreakableResource';
import { ExitGate } from './ExitGate';
import {
  PlayerController,
  PLAYER_ATTACK_ENDED_EVENT,
  PLAYER_ATTACK_STARTED_EVENT,
} from './PlayerController';
import { PlayableGameController } from './PlayableGameController';

const { ccclass, disallowMultiple, property, requireComponent } = _decorator;

@ccclass('WeaponHitbox')
@disallowMultiple
@requireComponent(Collider)
export class WeaponHitbox extends Component {
  @property({ type: Collider })
  public hitboxCollider: Collider | null = null;

  @property({ type: PlayableGameController })
  public gameplay: PlayableGameController | null = null;

  @property({ type: PlayerController })
  public playerController: PlayerController | null = null;

  @property
  public activationDelay = 0.5;

  @property
  public activeSeconds = 0.32;

  private collider: Collider | null = null;
  private activeTimeRemaining = 0;
  private activationDelayRemaining = 0;
  private readonly hitTargets = new Set<string>();

  public onLoad(): void {
    this.collider = this.hitboxCollider ?? this.getComponent(Collider);

    if (this.collider !== null) {
      this.collider.isTrigger = true;
      this.collider.enabled = false;
    }
  }

  public onEnable(): void {
    const player = this.resolvePlayerController();

    if (player !== null) {
      player.node.on(PLAYER_ATTACK_STARTED_EVENT, this.onAttackStarted, this);
      player.node.on(PLAYER_ATTACK_ENDED_EVENT, this.onAttackEnded, this);
    }

    if (this.collider !== null) {
      this.collider.on('onTriggerEnter', this.onTrigger, this);
      this.collider.on('onTriggerStay', this.onTrigger, this);
    }
  }

  public onDisable(): void {
    const player = this.resolvePlayerController();

    if (player !== null) {
      player.node.off(PLAYER_ATTACK_STARTED_EVENT, this.onAttackStarted, this);
      player.node.off(PLAYER_ATTACK_ENDED_EVENT, this.onAttackEnded, this);
    }

    if (this.collider !== null) {
      this.collider.off('onTriggerEnter', this.onTrigger, this);
      this.collider.off('onTriggerStay', this.onTrigger, this);
      this.collider.enabled = false;
    }

    this.hitTargets.clear();
    this.activeTimeRemaining = 0;
    this.activationDelayRemaining = 0;
  }

  public update(deltaTime: number): void {
    if (this.activationDelayRemaining > 0) {
      this.activationDelayRemaining = Math.max(0, this.activationDelayRemaining - deltaTime);

      if (this.activationDelayRemaining === 0) {
        this.enableHitbox();
      }

      return;
    }

    if (this.activeTimeRemaining <= 0) {
      return;
    }

    this.activeTimeRemaining = Math.max(0, this.activeTimeRemaining - deltaTime);

    if (this.activeTimeRemaining === 0) {
      this.disableHitbox();
    }
  }

  private onAttackStarted(attackDuration: number): void {
    this.hitTargets.clear();
    this.activeTimeRemaining = Math.min(
      Math.max(0, attackDuration),
      Math.max(0, this.activeSeconds),
    );
    this.activationDelayRemaining = Math.max(0, this.activationDelay);

    if (this.activationDelayRemaining === 0) {
      this.enableHitbox();
    }
  }

  private onAttackEnded(): void {
    this.disableHitbox();
    this.activeTimeRemaining = 0;
    this.activationDelayRemaining = 0;
  }

  private onTrigger(event: ITriggerEvent): void {
    if (this.activeTimeRemaining <= 0 || event.otherCollider === null) {
      return;
    }

    const resource = this.findResourceInParents(event.otherCollider.node);

    if (resource !== null) {
      this.hitResource(resource);
      return;
    }

    const gate = this.findGateInParents(event.otherCollider.node);

    if (gate !== null) {
      this.hitGate(gate);
    }
  }

  private hitResource(resource: BreakableResource): void {
    const id = resource.getRuntimeId();
    const key = `resource:${id}`;

    if (this.hitTargets.has(key)) {
      return;
    }

    this.hitTargets.add(key);
    this.resolveGameplay()?.hitResource(id);
  }

  private hitGate(gate: ExitGate): void {
    const key = `gate:${gate.getRuntimeId()}`;

    if (this.hitTargets.has(key)) {
      return;
    }

    this.hitTargets.add(key);
    this.resolveGameplay()?.hitGate();
  }

  private enableHitbox(): void {
    if (this.collider !== null) {
      this.collider.enabled = true;
    }
  }

  private disableHitbox(): void {
    if (this.collider !== null) {
      this.collider.enabled = false;
    }
  }

  private resolveGameplay(): PlayableGameController | null {
    if (this.gameplay !== null) {
      return this.gameplay;
    }

    const scene = director.getScene();
    return scene === null ? null : this.findGameplayInTree(scene);
  }

  private resolvePlayerController(): PlayerController | null {
    if (this.playerController !== null) {
      return this.playerController;
    }

    let current: Node | null = this.node;

    while (current !== null) {
      const player = current.getComponent(PlayerController);

      if (player !== null) {
        return player;
      }

      current = current.parent;
    }

    return null;
  }

  private findResourceInParents(node: Node): BreakableResource | null {
    let current: Node | null = node;

    while (current !== null) {
      const resource = current.getComponent(BreakableResource);

      if (resource !== null) {
        return resource;
      }

      current = current.parent;
    }

    return null;
  }

  private findGateInParents(node: Node): ExitGate | null {
    let current: Node | null = node;

    while (current !== null) {
      const gate = current.getComponent(ExitGate);

      if (gate !== null) {
        return gate;
      }

      current = current.parent;
    }

    return null;
  }

  private findGameplayInTree(root: Node): PlayableGameController | null {
    const gameplay = root.getComponent(PlayableGameController);

    if (gameplay !== null) {
      return gameplay;
    }

    for (const child of root.children) {
      const childGameplay = this.findGameplayInTree(child);

      if (childGameplay !== null) {
        return childGameplay;
      }
    }

    return null;
  }
}
