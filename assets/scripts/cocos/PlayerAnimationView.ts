import { SkeletalAnimation } from 'cc';

export class PlayerAnimationView {
  private animation: SkeletalAnimation | null = null;
  private activeClip = '';

  public bind(animation: SkeletalAnimation | null): void {
    this.animation = animation;
    this.activeClip = '';
  }

  public prewarm(clipNames: string[]): void {
    if (this.animation === null) {
      return;
    }

    for (const clipName of clipNames) {
      this.animation.getState(clipName);
    }
  }

  public play(
    clipName: string,
    fadeDuration: number,
    force = false,
    speed = 1,
    rewind = false,
  ): void {
    if (this.animation === null || (!force && this.activeClip === clipName)) {
      return;
    }

    const state = this.animation.getState(clipName);

    if (!state) {
      return;
    }

    state.speed = speed;

    if (rewind) {
      state.time = 0;
    }

    this.animation.crossFade(clipName, fadeDuration);
    this.activeClip = clipName;
  }
}
