export type PlayerAttackStartConfig = {
  animationDuration: number;
  attackSpeed: number;
  lockDuration: number;
};

export type PlayerAttackStartResult =
  | {
      started: true;
      playbackSpeed: number;
      lockTime: number;
    }
  | {
      started: false;
      playbackSpeed: number;
      lockTime: number;
    };

export class PlayerAttackState {
  private remainingTime = 0;

  public get isAttacking(): boolean {
    return this.remainingTime > 0;
  }

  public get timeRemaining(): number {
    return this.remainingTime;
  }

  public start(config: PlayerAttackStartConfig): PlayerAttackStartResult {
    const playbackSpeed = Math.max(0.01, config.attackSpeed);

    if (this.isAttacking) {
      return {
        started: false,
        playbackSpeed,
        lockTime: this.remainingTime,
      };
    }

    const animationRuntime = Math.max(0, config.animationDuration) / playbackSpeed;
    this.remainingTime = Math.max(animationRuntime, Math.max(0, config.lockDuration));

    return {
      started: true,
      playbackSpeed,
      lockTime: this.remainingTime,
    };
  }

  public tick(deltaTime: number): boolean {
    if (!this.isAttacking) {
      return false;
    }

    this.remainingTime = Math.max(0, this.remainingTime - Math.max(0, deltaTime));
    return this.remainingTime === 0;
  }

  public cancel(): boolean {
    const wasAttacking = this.isAttacking;
    this.remainingTime = 0;
    return wasAttacking;
  }
}
