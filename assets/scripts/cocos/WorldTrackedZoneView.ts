import { Camera, Graphics, instantiate, Node, Prefab, UIOpacity, UITransform, Vec3 } from 'cc';

import { drawDashedZone } from './DashedZoneRenderer';
import { applyLayerRecursive } from './NodeLayerUtils';

export type WorldTrackedZoneConfig = {
  width: number;
  height: number;
  radius: number;
  dashLength: number;
  gapLength: number;
};

type WorldTrackedZoneViewOptions = {
  name: string;
  getLayer: () => Node | null;
  getWorldCamera: () => Camera | null;
};

const UI_POSITION = new Vec3();

export class WorldTrackedZoneView {
  private readonly options: WorldTrackedZoneViewOptions;
  private readonly worldPosition = new Vec3();
  private node: Node | null = null;
  private graphics: Graphics | null = null;
  private opacity: UIOpacity | null = null;
  private prefab: Prefab | null = null;
  private visible = false;
  private pulseTime = 0;

  public constructor(options: WorldTrackedZoneViewOptions) {
    this.options = options;
  }

  public setVisible(
    worldPosition: Vec3,
    visible: boolean,
    prefab: Prefab | null,
    config: WorldTrackedZoneConfig,
  ): void {
    this.visible = visible;

    if (!visible && (this.node === null || !this.node.isValid)) {
      return;
    }

    if (!this.ensure(prefab, config)) {
      return;
    }

    if (this.node === null) {
      return;
    }

    this.node.active = visible;

    if (!visible) {
      this.node.setScale(1, 1, 1);

      if (this.opacity !== null) {
        this.opacity.opacity = 0;
      }

      return;
    }

    this.worldPosition.set(worldPosition);
    this.syncPosition();
  }

  public update(deltaTime: number): void {
    if (!this.visible || this.node === null || !this.node.isValid) {
      return;
    }

    this.pulseTime += deltaTime;
    const pulseWave = Math.sin(this.pulseTime * 5.5);
    const pulse = 1 + pulseWave * 0.045;
    const opacity = 185 + pulseWave * 38;

    this.node.setScale(pulse, pulse, 1);

    if (this.opacity !== null) {
      this.opacity.opacity = Math.max(120, Math.min(230, opacity));
    }

    this.syncPosition();
  }

  public refreshLayout(config: WorldTrackedZoneConfig): void {
    if (this.node === null || this.graphics === null || !this.node.isValid) {
      return;
    }

    this.node.getComponent(UITransform)?.setContentSize(config.width, config.height);
    drawDashedZone(
      this.graphics,
      config.width,
      config.height,
      config.radius,
      config.dashLength,
      config.gapLength,
    );
  }

  public destroy(): void {
    if (this.node !== null && this.node.isValid) {
      this.node.destroy();
    }

    this.node = null;
    this.graphics = null;
    this.opacity = null;
    this.prefab = null;
    this.visible = false;
    this.pulseTime = 0;
  }

  private ensure(prefab: Prefab | null, config: WorldTrackedZoneConfig): boolean {
    if (
      prefab !== null &&
      this.node !== null &&
      this.node.isValid &&
      this.graphics !== null &&
      this.opacity !== null &&
      this.prefab === prefab
    ) {
      return true;
    }

    this.destroy();

    const layer = this.options.getLayer();
    const camera = this.options.getWorldCamera();

    if (prefab === null || layer === null || camera === null) {
      return false;
    }

    this.node = instantiate(prefab);
    this.node.name = this.options.name;
    this.prefab = prefab;
    applyLayerRecursive(this.node, layer.layer);
    layer.addChild(this.node);
    this.node.active = false;
    this.graphics = this.node.getComponent(Graphics);
    this.opacity = this.node.getComponent(UIOpacity);

    if (this.graphics === null || this.opacity === null) {
      this.destroy();
      return false;
    }

    this.opacity.opacity = 0;
    this.refreshLayout(config);
    return true;
  }

  private syncPosition(): void {
    const layer = this.options.getLayer();
    const camera = this.options.getWorldCamera();

    if (this.node === null || layer === null || camera === null) {
      return;
    }

    camera.convertToUINode(this.worldPosition, layer, UI_POSITION);
    this.node.setPosition(UI_POSITION);
  }
}
