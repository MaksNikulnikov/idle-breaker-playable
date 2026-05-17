import { _decorator, Color, Component, ProgressBar, Vec3 } from 'cc';

const { ccclass, disallowMultiple, property, requireComponent } = _decorator;

@ccclass('HealthBarView')
@disallowMultiple
@requireComponent(ProgressBar)
export class HealthBarView extends Component {
  @property({ type: ProgressBar })
  public progressBar: ProgressBar | null = null;

  private targetProgress = 1;
  private displayedProgress = 1;
  private hideDelay = 0;

  public onLoad(): void {
    this.resolveReferences();
  }

  public resolveReferences(): boolean {
    this.progressBar ??= this.node.getComponent(ProgressBar);
    return this.progressBar !== null;
  }

  public handleCoordinateSync(position: Vec3): void {
    this.node.setPosition(position);
  }

  public setProgress(current: number, max: number): void {
    this.resolveReferences();
    this.hideDelay = 0;
    this.node.active = true;
    this.targetProgress = max <= 0 ? 0 : Math.max(0, Math.min(1, current / max));
    this.applyProgress(this.displayedProgress);
  }

  public hideAfter(delaySeconds: number): void {
    this.hideDelay = Math.max(0, delaySeconds);
  }

  public setVisible(visible: boolean): void {
    this.hideDelay = 0;
    this.node.active = visible;
  }

  public tick(deltaTime: number): void {
    if (!this.node.active) {
      return;
    }

    if (this.hideDelay > 0) {
      this.hideDelay = Math.max(0, this.hideDelay - deltaTime);

      if (this.hideDelay === 0) {
        this.node.active = false;
        return;
      }
    }

    const nextProgress =
      this.displayedProgress +
      (this.targetProgress - this.displayedProgress) * Math.min(1, deltaTime * 12);

    if (Math.abs(nextProgress - this.displayedProgress) < 0.002) {
      return;
    }

    this.displayedProgress = nextProgress;
    this.applyProgress(this.displayedProgress);
  }

  private applyProgress(progress: number): void {
    if (this.progressBar === null) {
      return;
    }

    this.progressBar.progress = progress;
    this.tintBar(progress);
  }

  private tintBar(progress: number): void {
    const barSprite = this.progressBar?.barSprite ?? null;

    if (barSprite === null) {
      return;
    }

    barSprite.color = progress > 0.3 ? new Color(65, 170, 255, 255) : new Color(255, 188, 72, 255);
  }
}
