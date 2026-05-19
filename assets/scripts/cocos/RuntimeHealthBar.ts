import {
  Camera,
  director,
  EventHandler,
  instantiate,
  Node,
  Prefab,
  UICoordinateTracker,
  Vec3,
} from 'cc';

import { HealthBarView } from './HealthBarView';
import { applyLayerRecursive } from './NodeLayerUtils';

export class RuntimeHealthBar {
  private readonly node: Node;
  private readonly anchorNode: Node;
  private readonly view: HealthBarView;
  private readonly tracker: UICoordinateTracker;

  public constructor(parent: Node, name: string, prefab: Prefab, camera: Camera) {
    this.node = instantiate(prefab);
    this.node.name = name;
    applyLayerRecursive(this.node, parent.layer);
    parent.addChild(this.node);

    const healthBarView = this.node.getComponent(HealthBarView);

    if (healthBarView === null) {
      this.node.destroy();
      throw new Error('HealthBar prefab must have HealthBarView attached to its root node.');
    }

    this.view = healthBarView;

    if (!this.view.resolveReferences()) {
      this.node.destroy();
      throw new Error('HealthBarView must reference a cc.ProgressBar component.');
    }

    this.anchorNode = new Node(`${name}_WorldAnchor`);
    director.getScene()?.addChild(this.anchorNode);

    this.tracker = this.anchorNode.addComponent(UICoordinateTracker);
    this.tracker.camera = camera;
    this.tracker.target = parent;
    this.tracker.useScale = false;
    this.tracker.syncEvents = [this.createTrackerSyncEvent()];
  }

  public setWorldPosition(position: Vec3): void {
    this.anchorNode.setWorldPosition(position);
    this.tracker.update();
  }

  public setProgress(current: number, max: number): void {
    this.anchorNode.active = true;
    this.view.setProgress(current, max);
  }

  public hideAfter(delaySeconds: number): void {
    this.view.hideAfter(delaySeconds);
  }

  public setVisible(visible: boolean): void {
    this.anchorNode.active = visible;
    this.view.setVisible(visible);
  }

  public update(deltaTime: number): void {
    this.view.tick(deltaTime);
  }

  private createTrackerSyncEvent(): EventHandler {
    const event = new EventHandler();
    event.target = this.node;
    event.component = 'HealthBarView';
    event.handler = 'handleCoordinateSync';
    return event;
  }
}
