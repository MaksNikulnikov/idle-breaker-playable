import { Component, Node } from 'cc';

import { openStoreUrl } from '../application';

type PlayableCompletionControllerOptions = {
  owner: Component;
  getStoreUrl: () => string;
  isAutomaticOpenEnabled: () => boolean;
  getAutomaticOpenDelay: () => number;
  getStoreButton: () => Node | null;
};

export class PlayableCompletionController {
  private readonly options: PlayableCompletionControllerOptions;
  private boundStoreButton: Node | null = null;
  private storeOpenTriggered = false;
  private storeOpenScheduled = false;

  public constructor(options: PlayableCompletionControllerOptions) {
    this.options = options;
  }

  public readonly openStore = (): void => {
    if (this.storeOpenTriggered) {
      return;
    }

    this.clearScheduledStoreOpen();

    if (openStoreUrl(this.options.getStoreUrl())) {
      this.storeOpenTriggered = true;
    }
  };

  public reset(): void {
    this.storeOpenTriggered = false;
    this.clearScheduledStoreOpen();
  }

  public bindStoreButton(): void {
    const storeButton = this.options.getStoreButton();

    if (storeButton === null || !storeButton.isValid || this.boundStoreButton === storeButton) {
      return;
    }

    this.unbindStoreButton();
    storeButton.on(Node.EventType.TOUCH_END, this.openStore, this);
    this.boundStoreButton = storeButton;
  }

  public unbindStoreButton(): void {
    if (this.boundStoreButton === null || !this.boundStoreButton.isValid) {
      this.boundStoreButton = null;
      return;
    }

    this.boundStoreButton.off(Node.EventType.TOUCH_END, this.openStore, this);
    this.boundStoreButton = null;
  }

  public handleCompleted(): void {
    if (!this.options.isAutomaticOpenEnabled() || this.storeOpenTriggered) {
      return;
    }

    this.scheduleStoreOpen();
  }

  public clearScheduledStoreOpen(): void {
    if (!this.storeOpenScheduled) {
      return;
    }

    this.options.owner.unschedule(this.handleScheduledStoreOpen);
    this.storeOpenScheduled = false;
  }

  private scheduleStoreOpen(): void {
    if (this.storeOpenScheduled || this.storeOpenTriggered) {
      return;
    }

    const delaySeconds = Math.max(0, this.options.getAutomaticOpenDelay());

    if (delaySeconds === 0) {
      this.openStore();
      return;
    }

    this.storeOpenScheduled = true;
    this.options.owner.scheduleOnce(this.handleScheduledStoreOpen, delaySeconds);
  }

  private readonly handleScheduledStoreOpen = (): void => {
    this.storeOpenScheduled = false;
    this.openStore();
  };
}
