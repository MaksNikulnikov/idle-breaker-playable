import { sys } from 'cc';

type BrowserInputSafetyOptions = {
  resetInput: () => void;
  resetPointerInput: () => void;
  resetMouseInput: () => void;
};

export class BrowserInputSafety {
  private readonly options: BrowserInputSafetyOptions;
  private pointerReleaseTimer = 0;
  private bound = false;

  public constructor(options: BrowserInputSafetyOptions) {
    this.options = options;
  }

  public bind(): void {
    if (this.bound || !sys.isBrowser) {
      return;
    }

    window.addEventListener('blur', this.options.resetInput);
    window.addEventListener('pagehide', this.options.resetInput);
    window.addEventListener('pointerup', this.deferPointerReleaseReset);
    window.addEventListener('pointercancel', this.deferPointerReleaseReset);
    window.addEventListener('mouseup', this.deferPointerReleaseReset);
    window.addEventListener('touchend', this.deferPointerReleaseReset);
    window.addEventListener('touchcancel', this.deferPointerReleaseReset);
    document.addEventListener('visibilitychange', this.options.resetInput);
    this.bound = true;
  }

  public unbind(): void {
    if (!this.bound || !sys.isBrowser) {
      return;
    }

    window.removeEventListener('blur', this.options.resetInput);
    window.removeEventListener('pagehide', this.options.resetInput);
    window.removeEventListener('pointerup', this.deferPointerReleaseReset);
    window.removeEventListener('pointercancel', this.deferPointerReleaseReset);
    window.removeEventListener('mouseup', this.deferPointerReleaseReset);
    window.removeEventListener('touchend', this.deferPointerReleaseReset);
    window.removeEventListener('touchcancel', this.deferPointerReleaseReset);
    document.removeEventListener('visibilitychange', this.options.resetInput);
    this.clearPointerReleaseTimer();
    this.bound = false;
  }

  private readonly deferPointerReleaseReset = (): void => {
    if (this.pointerReleaseTimer !== 0) {
      return;
    }

    this.pointerReleaseTimer = window.setTimeout(() => {
      this.pointerReleaseTimer = 0;
      this.options.resetPointerInput();
      this.options.resetMouseInput();
    }, 0);
  };

  private clearPointerReleaseTimer(): void {
    if (this.pointerReleaseTimer === 0) {
      return;
    }

    window.clearTimeout(this.pointerReleaseTimer);
    this.pointerReleaseTimer = 0;
  }
}
