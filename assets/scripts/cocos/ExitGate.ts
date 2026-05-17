import { _decorator, Collider, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ExitGate')
export class ExitGate extends Component {
  @property
  public gateId = 'ExitGate';

  @property
  public maxHits = 3;

  @property({ type: [Node] })
  public damageStateNodes: Node[] = [];

  private collider: Collider | null = null;

  public onLoad(): void {
    this.collider = this.getComponent(Collider);
  }

  public getRuntimeId(): string {
    return this.gateId.trim() || this.node.name;
  }

  public showDamageStage(stageIndex: number): void {
    if (this.damageStateNodes.length === 0) {
      return;
    }

    const visibleIndex = Math.max(0, Math.min(stageIndex, this.damageStateNodes.length - 1));

    for (let index = 0; index < this.damageStateNodes.length; index += 1) {
      this.damageStateNodes[index].active = index === visibleIndex;
    }
  }

  public setDestroyed(destroyed: boolean): void {
    this.node.active = !destroyed;

    if (this.collider !== null) {
      this.collider.enabled = !destroyed;
    }
  }
}
