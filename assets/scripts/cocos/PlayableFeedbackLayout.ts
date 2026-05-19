import { Node, UITransform, view, Widget } from 'cc';

import { PlayableHudView } from './PlayableHudView';

const HUD_TOP_MARGIN = 0;
const HUD_SIDE_MARGIN = 16;
const POPUP_SIDE_MARGIN = 32;
const POPUP_VERTICAL_MARGIN = 112;
const POPUP_TARGET_SCREEN_WIDTH = 370;
const POPUP_TARGET_SCREEN_HEIGHT = 280;
const UPGRADE_CARD_WIDTH = 440;
const UPGRADE_CARD_HEIGHT = 328;
const VICTORY_CONTENT_WIDTH = 360;
const VICTORY_CONTENT_HEIGHT = 230;
const VICTORY_TARGET_SCREEN_WIDTH = 340;
const VICTORY_TARGET_SCREEN_HEIGHT = 210;

export class PlayableFeedbackLayout {
  private lastLayoutWidth = -1;
  private lastLayoutHeight = -1;
  private lastLayoutScaleX = -1;
  private lastLayoutScaleY = -1;
  private completionContentRoot: Node | null = null;

  public fitHudCanvasToScreen(hudCanvas: Node | null): void {
    if (hudCanvas === null) {
      return;
    }

    const widget = hudCanvas.getComponent(Widget);

    if (widget === null) {
      return;
    }

    widget.target = null;
    widget.isAlignTop = true;
    widget.top = 0;
    widget.isAlignBottom = true;
    widget.bottom = 0;
    widget.isAlignLeft = true;
    widget.left = 0;
    widget.isAlignRight = true;
    widget.right = 0;
    widget.isAlignHorizontalCenter = false;
    widget.isAlignVerticalCenter = false;
    widget.alignMode = Widget.AlignMode.ALWAYS;
    widget.updateAlignment();
  }

  public pinTopHudPanel(
    hudView: PlayableHudView | null,
    hudCanvas: Node | null,
    targetScreenWidth: number,
  ): void {
    const panel = hudView?.getTopPanelNode() ?? null;

    if (panel === null) {
      return;
    }

    const widget = panel.getComponent(Widget);

    if (widget === null) {
      return;
    }

    widget.target = hudCanvas;
    widget.isAlignTop = true;
    widget.top = HUD_TOP_MARGIN;
    widget.isAlignBottom = false;
    widget.isAlignLeft = false;
    widget.isAlignRight = false;
    widget.isAlignHorizontalCenter = true;
    widget.horizontalCenter = 0;
    widget.isAlignVerticalCenter = false;
    widget.alignMode = Widget.AlignMode.ALWAYS;
    widget.updateAlignment();

    const transform = panel.getComponent(UITransform);
    const canvasWidth = this.getHudWidth(hudCanvas);
    const panelWidth = transform?.contentSize.width ?? 360;
    const fitCanvasScale = (canvasWidth - HUD_SIDE_MARGIN * 2) / panelWidth;
    const fitScreenScale = this.getScreenWidthScale(panelWidth, targetScreenWidth);
    const scale = Math.min(1, Math.max(0.58, Math.min(fitCanvasScale, fitScreenScale)));
    panel.setScale(scale, scale, 1);
  }

  public refreshCompletionOverlayLayout(
    hudView: PlayableHudView | null,
    hudCanvas: Node | null,
  ): void {
    const overlay = hudView?.getCompletionOverlay() ?? null;

    if (overlay === null || !overlay.isValid) {
      this.completionContentRoot = null;
      return;
    }

    this.refreshFullscreenLayer(overlay, hudCanvas);

    const dimmer = overlay.getChildByName('VictoryDimmer');

    if (dimmer !== null) {
      this.refreshFullscreenLayer(dimmer, overlay);
      dimmer.setSiblingIndex(0);
    }

    const contentRoot = this.getCompletionContentRoot(overlay);

    if (contentRoot === null) {
      return;
    }

    const scale = this.getCompletionOverlayScale(hudCanvas);
    contentRoot.setPosition(0, 0, 0);
    contentRoot.setScale(scale, scale, 1);
    contentRoot.setSiblingIndex(overlay.children.length - 1);
  }

  public refreshUpgradePopupLayout(
    popupRoot: Node | null,
    popupDim: Node | null,
    popupCard: Node | null,
    target: Node | null,
    hudCanvas: Node | null,
  ): void {
    if (popupRoot === null || !popupRoot.isValid) {
      return;
    }

    if (target === null) {
      return;
    }

    this.refreshFullscreenLayer(popupRoot, target);

    const dim = popupDim !== null && popupDim.isValid ? popupDim : popupRoot.getChildByName('Dim');

    if (dim !== null) {
      this.refreshFullscreenLayer(dim, popupRoot);
      dim.setSiblingIndex(0);
    }

    if (popupCard !== null && popupCard.isValid) {
      const scale = this.getUpgradePopupScale(hudCanvas);
      popupCard.setScale(scale, scale, 1);
      popupCard.setPosition(0, 0, 0);
    }
  }

  public getUpgradePopupScale(hudCanvas: Node | null): number {
    const availableWidth = Math.max(1, this.getHudWidth(hudCanvas) - POPUP_SIDE_MARGIN * 2);
    const availableHeight = Math.max(1, this.getHudHeight(hudCanvas) - POPUP_VERTICAL_MARGIN * 2);
    const fitCanvasScale = Math.min(
      availableWidth / UPGRADE_CARD_WIDTH,
      availableHeight / UPGRADE_CARD_HEIGHT,
    );
    const fitScreenScale = Math.min(
      this.getScreenWidthScale(UPGRADE_CARD_WIDTH, POPUP_TARGET_SCREEN_WIDTH),
      this.getScreenHeightScale(UPGRADE_CARD_HEIGHT, POPUP_TARGET_SCREEN_HEIGHT),
    );

    return Math.min(0.92, Math.max(0.56, Math.min(fitCanvasScale, fitScreenScale)));
  }

  public refreshFullscreenLayer(node: Node | null, target: Node | null): void {
    if (node === null || target === null || !node.isValid || !target.isValid) {
      return;
    }

    const targetTransform = target.getComponent(UITransform);
    const layerTransform = node.getComponent(UITransform);

    if (layerTransform === null) {
      return;
    }

    if (targetTransform !== null) {
      layerTransform.setContentSize(targetTransform.contentSize);
    }

    node.setPosition(0, 0, 0);

    const widget = node.getComponent(Widget);

    if (widget === null) {
      return;
    }

    widget.target = target;
    widget.isAlignTop = true;
    widget.top = 0;
    widget.isAlignBottom = true;
    widget.bottom = 0;
    widget.isAlignLeft = true;
    widget.left = 0;
    widget.isAlignRight = true;
    widget.right = 0;
    widget.isAlignHorizontalCenter = false;
    widget.isAlignVerticalCenter = false;
    widget.alignMode = Widget.AlignMode.ALWAYS;
    widget.updateAlignment();
  }

  public shouldRefreshLayout(): boolean {
    const visibleSize = view.getVisibleSize();
    const scaleX = view.getScaleX();
    const scaleY = view.getScaleY();

    return (
      Math.abs(visibleSize.width - this.lastLayoutWidth) > 0.5 ||
      Math.abs(visibleSize.height - this.lastLayoutHeight) > 0.5 ||
      Math.abs(scaleX - this.lastLayoutScaleX) > 0.0001 ||
      Math.abs(scaleY - this.lastLayoutScaleY) > 0.0001
    );
  }

  public markClean(): void {
    const visibleSize = view.getVisibleSize();
    this.lastLayoutWidth = visibleSize.width;
    this.lastLayoutHeight = visibleSize.height;
    this.lastLayoutScaleX = view.getScaleX();
    this.lastLayoutScaleY = view.getScaleY();
  }

  private getCompletionContentRoot(overlay: Node): Node | null {
    if (this.completionContentRoot !== null && this.completionContentRoot.isValid) {
      return this.completionContentRoot;
    }

    const contentRoot = overlay.getChildByName('VictoryContentRoot');

    this.completionContentRoot = contentRoot;
    return contentRoot;
  }

  private getCompletionOverlayScale(hudCanvas: Node | null): number {
    const availableWidth = Math.max(1, this.getHudWidth(hudCanvas) - POPUP_SIDE_MARGIN * 2);
    const availableHeight = Math.max(1, this.getHudHeight(hudCanvas) - POPUP_VERTICAL_MARGIN * 2);
    const fitCanvasScale = Math.min(
      availableWidth / VICTORY_CONTENT_WIDTH,
      availableHeight / VICTORY_CONTENT_HEIGHT,
    );
    const fitScreenScale = Math.min(
      this.getScreenWidthScale(VICTORY_CONTENT_WIDTH, VICTORY_TARGET_SCREEN_WIDTH),
      this.getScreenHeightScale(VICTORY_CONTENT_HEIGHT, VICTORY_TARGET_SCREEN_HEIGHT),
    );

    return Math.min(1, Math.max(0.58, Math.min(fitCanvasScale, fitScreenScale)));
  }

  private getScreenWidthScale(contentWidth: number, targetScreenWidth: number): number {
    return targetScreenWidth / Math.max(1, contentWidth * Math.max(0.0001, view.getScaleX()));
  }

  private getScreenHeightScale(contentHeight: number, targetScreenHeight: number): number {
    return targetScreenHeight / Math.max(1, contentHeight * Math.max(0.0001, view.getScaleY()));
  }

  private getHudWidth(hudCanvas: Node | null): number {
    return hudCanvas?.getComponent(UITransform)?.contentSize.width ?? 720;
  }

  private getHudHeight(hudCanvas: Node | null): number {
    return hudCanvas?.getComponent(UITransform)?.contentSize.height ?? 1280;
  }
}
