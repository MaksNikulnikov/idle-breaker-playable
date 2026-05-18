import {
  _decorator,
  Component,
  Label,
  Node,
  ProgressBar,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  Vec3,
} from 'cc';

import type { PlayableSnapshot } from '../domain';

const { ccclass, disallowMultiple, property } = _decorator;

type ObjectiveKind = 'wood' | 'metal' | 'gate' | 'complete';

const OBJECTIVE_LABEL_POSITION = new Vec3(0, -20, 0);
const OBJECTIVE_RESOURCE_SLOT_POSITION = new Vec3(-66, -60, 0);
const OBJECTIVE_WEAPON_SLOT_WITH_RESOURCE_POSITION = new Vec3(78, -60, 0);
const OBJECTIVE_WEAPON_SLOT_ONLY_POSITION = new Vec3(0, -60, 0);
const OBJECTIVE_SWAP_OFFSET = 112;

@ccclass('PlayableHudView')
@disallowMultiple
export class PlayableHudView extends Component {
  @property({ type: Label })
  public objectiveLabel: Label | null = null;

  @property({ type: Label })
  public woodLabel: Label | null = null;

  @property({ type: Label })
  public metalLabel: Label | null = null;

  @property({ type: ProgressBar })
  public woodProgressBar: ProgressBar | null = null;

  @property({ type: ProgressBar })
  public metalProgressBar: ProgressBar | null = null;

  @property({ type: Label })
  public weaponLabel: Label | null = null;

  @property({ type: Node })
  public completionOverlay: Node | null = null;

  @property
  public objectiveSwapDelaySeconds = 1.1;

  private currentObjectiveKind: ObjectiveKind | null = null;
  private pendingSnapshot: PlayableSnapshot | null = null;
  private isObjectiveSwapPlaying = false;

  public applySnapshot(snapshot: PlayableSnapshot): void {
    const nextObjectiveKind = this.getObjectiveKind(snapshot);

    if (this.currentObjectiveKind === null || snapshot.completed) {
      this.applySnapshotImmediately(snapshot, nextObjectiveKind);
      this.currentObjectiveKind = nextObjectiveKind;
      return;
    }

    if (nextObjectiveKind !== this.currentObjectiveKind) {
      this.pendingSnapshot = snapshot;
      this.playObjectiveSwap(nextObjectiveKind);
      return;
    }

    this.applySnapshotImmediately(snapshot, nextObjectiveKind);
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

  public getResourceIconFrame(kind: 'wood' | 'metal'): SpriteFrame | null {
    const counter = this.getResourceCounterNode(kind);
    const iconName = kind === 'wood' ? 'WoodIcon' : 'MetalIcon';
    return counter?.getChildByName(iconName)?.getComponent(Sprite)?.spriteFrame ?? null;
  }

  public getCompletionOverlay(): Node | null {
    return this.completionOverlay;
  }

  private applySnapshotImmediately(snapshot: PlayableSnapshot, objectiveKind: ObjectiveKind): void {
    if (this.objectiveLabel !== null) {
      this.objectiveLabel.string = this.getObjectiveText(snapshot);
    }

    if (this.woodLabel !== null) {
      this.woodLabel.string =
        this.getCollectedAmount(snapshot, 'wood') + '/' + snapshot.totalRewards.wood;
    }

    if (this.metalLabel !== null) {
      this.metalLabel.string =
        this.getCollectedAmount(snapshot, 'metal') + '/' + snapshot.totalRewards.metal;
    }

    if (this.woodProgressBar !== null) {
      this.woodProgressBar.progress = this.getCollectedProgress(snapshot, 'wood');
    }

    if (this.metalProgressBar !== null) {
      this.metalProgressBar.progress = this.getCollectedProgress(snapshot, 'metal');
    }

    if (this.weaponLabel !== null) {
      this.weaponLabel.string = 'LVL ' + String(snapshot.weaponLevel);
    }

    if (this.completionOverlay !== null) {
      this.completionOverlay.active = snapshot.completed;
    }

    this.applyObjectiveSlotLayout(objectiveKind);
    this.currentObjectiveKind = objectiveKind;
  }

  private playObjectiveSwap(nextObjectiveKind: ObjectiveKind): void {
    if (this.isObjectiveSwapPlaying) {
      return;
    }

    const visibleNodes = this.getVisibleObjectiveSlotNodes();

    if (visibleNodes.length === 0) {
      const snapshot = this.pendingSnapshot;
      this.pendingSnapshot = null;

      if (snapshot !== null) {
        this.applySnapshotImmediately(snapshot, nextObjectiveKind);
      }

      return;
    }

    this.isObjectiveSwapPlaying = true;
    Tween.stopAllByTarget(this.node);

    for (const node of visibleNodes) {
      Tween.stopAllByTarget(node);
    }

    tween(this.node)
      .delay(Math.max(0, this.objectiveSwapDelaySeconds))
      .call(() => {
        for (const node of visibleNodes) {
          const currentPosition = node.position.clone();
          tween(node)
            .to(
              0.16,
              {
                position: new Vec3(
                  currentPosition.x,
                  currentPosition.y + OBJECTIVE_SWAP_OFFSET,
                  currentPosition.z,
                ),
              },
              { easing: 'quadIn' },
            )
            .start();
        }
      })
      .delay(0.16)
      .call(() => {
        const snapshot = this.pendingSnapshot;
        this.pendingSnapshot = null;

        const finalObjectiveKind =
          snapshot !== null ? this.getObjectiveKind(snapshot) : nextObjectiveKind;

        if (snapshot !== null) {
          this.applySnapshotImmediately(snapshot, finalObjectiveKind);
        }

        for (const node of this.getVisibleObjectiveSlotNodes()) {
          const targetPosition = node.position.clone();
          node.setPosition(
            targetPosition.x,
            targetPosition.y - OBJECTIVE_SWAP_OFFSET,
            targetPosition.z,
          );
          tween(node).to(0.22, { position: targetPosition }, { easing: 'backOut' }).start();
        }

        this.isObjectiveSwapPlaying = false;
      })
      .start();
  }

  private getObjectiveText(snapshot: PlayableSnapshot): string {
    if (snapshot.completed) {
      return 'COMPLETE!';
    }

    if (snapshot.weaponLevel === 1) {
      return 'BREAK FENCES';
    }

    if (snapshot.weaponLevel === 2) {
      return 'BREAK BOXES';
    }

    return 'BREAK GATE';
  }

  private getObjectiveKind(snapshot: PlayableSnapshot): ObjectiveKind {
    if (snapshot.completed) {
      return 'complete';
    }

    if (snapshot.weaponLevel === 1) {
      return 'wood';
    }

    if (snapshot.weaponLevel === 2) {
      return 'metal';
    }

    return 'gate';
  }

  private applyObjectiveSlotLayout(objectiveKind: ObjectiveKind): void {
    const woodCounter = this.getResourceCounterNode('wood');
    const metalCounter = this.getResourceCounterNode('metal');
    const weaponCounter = this.getWeaponCounterNode();

    this.objectiveLabel?.node.setPosition(OBJECTIVE_LABEL_POSITION);

    if (woodCounter !== null) {
      woodCounter.active = objectiveKind === 'wood';
      woodCounter.setPosition(OBJECTIVE_RESOURCE_SLOT_POSITION);
    }

    if (metalCounter !== null) {
      metalCounter.active = objectiveKind === 'metal';
      metalCounter.setPosition(OBJECTIVE_RESOURCE_SLOT_POSITION);
    }

    if (weaponCounter !== null) {
      weaponCounter.setPosition(
        objectiveKind === 'wood' || objectiveKind === 'metal'
          ? OBJECTIVE_WEAPON_SLOT_WITH_RESOURCE_POSITION
          : OBJECTIVE_WEAPON_SLOT_ONLY_POSITION,
      );
    }
  }

  private getVisibleObjectiveSlotNodes(): Node[] {
    const nodes: Node[] = [];

    if (this.objectiveLabel?.node.activeInHierarchy) {
      nodes.push(this.objectiveLabel.node);
    }

    const woodCounter = this.getResourceCounterNode('wood');

    if (woodCounter?.activeInHierarchy) {
      nodes.push(woodCounter);
    }

    const metalCounter = this.getResourceCounterNode('metal');

    if (metalCounter?.activeInHierarchy) {
      nodes.push(metalCounter);
    }

    const weaponCounter = this.getWeaponCounterNode();

    if (weaponCounter?.activeInHierarchy) {
      nodes.push(weaponCounter);
    }

    return nodes;
  }

  private getCollectedAmount(snapshot: PlayableSnapshot, kind: 'wood' | 'metal'): number {
    return Math.min(snapshot.totalRewards[kind], snapshot.collectedTotals[kind]);
  }

  private getCollectedProgress(snapshot: PlayableSnapshot, kind: 'wood' | 'metal'): number {
    const total = snapshot.totalRewards[kind];

    if (total <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(1, snapshot.collectedTotals[kind] / total));
  }
}
