import { _decorator, Component, Label, Node } from 'cc';

import type { PlayableSnapshot } from '../domain';

const { ccclass, disallowMultiple, property } = _decorator;

@ccclass('PlayableHudView')
@disallowMultiple
export class PlayableHudView extends Component {
  @property({ type: Label })
  public objectiveLabel: Label | null = null;

  @property({ type: Label })
  public woodLabel: Label | null = null;

  @property({ type: Label })
  public metalLabel: Label | null = null;

  @property({ type: Label })
  public weaponLabel: Label | null = null;

  @property({ type: Node })
  public completionOverlay: Node | null = null;

  public applySnapshot(snapshot: PlayableSnapshot): void {
    if (this.objectiveLabel !== null) {
      this.objectiveLabel.string = this.getObjectiveText(snapshot);
    }

    if (this.woodLabel !== null) {
      this.woodLabel.string = this.getCollectedAmount(snapshot, 'wood') + '/2';
    }

    if (this.metalLabel !== null) {
      this.metalLabel.string = this.getCollectedAmount(snapshot, 'metal') + '/2';
    }

    if (this.weaponLabel !== null) {
      this.weaponLabel.string = 'LVL ' + String(snapshot.weaponLevel);
    }

    if (this.completionOverlay !== null) {
      this.completionOverlay.active = snapshot.completed;
    }
  }

  public hasRequiredReferences(): boolean {
    return (
      this.objectiveLabel !== null &&
      this.woodLabel !== null &&
      this.metalLabel !== null &&
      this.weaponLabel !== null &&
      this.completionOverlay !== null
    );
  }

  public getTopPanelNode(): Node | null {
    return this.objectiveLabel?.node.parent ?? null;
  }

  public getObjectiveFeedbackNode(): Node | null {
    return this.objectiveLabel?.node.parent ?? this.objectiveLabel?.node ?? null;
  }

  public getWeaponCounterNode(): Node | null {
    return this.weaponLabel?.node.parent ?? this.weaponLabel?.node ?? null;
  }

  public getResourceCounterNode(kind: 'wood' | 'metal'): Node | null {
    const label = kind === 'wood' ? this.woodLabel : this.metalLabel;
    return label?.node.parent ?? label?.node ?? null;
  }

  public getCompletionOverlay(): Node | null {
    return this.completionOverlay;
  }

  private getObjectiveText(snapshot: PlayableSnapshot): string {
    if (snapshot.completed) {
      return 'COMPLETE!';
    }

    if (snapshot.weaponLevel === 1) {
      return 'BREAK BOXES';
    }

    if (snapshot.weaponLevel === 2) {
      return 'BREAK FENCES';
    }

    return 'BREAK GATE';
  }

  private getCollectedAmount(snapshot: PlayableSnapshot, kind: 'wood' | 'metal'): number {
    let collected = 0;

    for (const resource of snapshot.resources) {
      if (resource.kind === kind && resource.collected) {
        collected += resource.rewardAmount;
      }
    }

    return Math.min(2, collected);
  }
}
