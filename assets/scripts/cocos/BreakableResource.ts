import { _decorator, Component, Enum, Node } from 'cc';

const { ccclass, property } = _decorator;

export enum ResourceKind {
  Wood = 0,
  Metal = 1,
}

Enum(ResourceKind);

@ccclass('BreakableResource')
export class BreakableResource extends Component {
  @property
  public resourceId = '';

  @property({ type: Enum(ResourceKind) })
  public resourceKind = ResourceKind.Wood;

  @property
  public requiredWeaponLevel = 1;

  @property
  public rewardAmount = 1;

  @property
  public maxHits = 3;

  @property({ type: [Node] })
  public damageStateNodes: Node[] = [];

  public getRuntimeId(): string {
    return this.resourceId.trim() || this.node.name;
  }

  public showDamageStage(stageIndex: number): void {
    const visibleIndex = Math.max(0, Math.min(stageIndex, this.damageStateNodes.length - 1));

    for (let index = 0; index < this.damageStateNodes.length; index += 1) {
      this.damageStateNodes[index].active = index === visibleIndex;
    }
  }

  public setCollected(collected: boolean): void {
    this.node.active = !collected;
  }
}
