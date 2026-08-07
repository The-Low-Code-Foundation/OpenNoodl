import { platform, PlatformOS } from '@noodl/platform';
// Electron 32 removed the nonstandard `File.path`; webUtils.getPathForFile is
// the supported replacement for turning a dropped File into a native path.
import { webUtils } from 'electron';
import React from 'react';
import { createRoot } from 'react-dom/client';

import FileSystem from '@noodl-utils/filesystem';
import { KeyCode } from '@noodl-utils/keyboard/KeyCode';
import KeyboardHandler from '@noodl-utils/keyboardhandler';
import { windowTitleBarHeight } from '@noodl-utils/utils';

import { ConfirmModal, ErrorModal } from './PopupLayer/ConfirmModal';
import { StringInputPopup } from './PopupLayer/StringInputPopup';
import { ToastLayer } from './ToastLayer/ToastLayer';

// Styles
require('../styles/popuplayer.css');

export type PopoutPosition = 'bottom' | 'top' | 'left' | 'right';

type ElementLike = HTMLElement;

export interface PopupContent {
  el: ElementLike;
  owner?: TSFixme;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PopupArgs {
  content: PopupContent;
  /** Anchor element. Ignored when `position` is 'screen-center'. */
  attachTo?: ElementLike;
  /** Document coordinates to anchor to, when there is no anchor element. */
  attachToPoint?: { x: number; y: number };
  position?: PopoutPosition | 'screen-center';
  isBackgroundDimmed?: boolean;
  hasDynamicHeight?: boolean;
  contentId?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface PopoutArgs {
  content: PopupContent;
  attachTo?: ElementLike;
  attachToPoint?: { x: number; y: number };
  position?: PopoutPosition;
  animate?: boolean;
  manualClose?: boolean;
  /** CSS color for the arrow. @default '313131' */
  arrowColor?: string;
  disableDynamicPositioning?: boolean;
  /**
   * @deprecated Never centred anything: its only effect was to skip clearing the
   * arrow's direction class, which now has to happen so a flipped popout's arrow
   * points the right way. No caller has ever set it.
   */
  disableCentering?: boolean;
  offsetX?: number;
  offsetY?: number;
  onClose?: () => void;
}

export interface Popout {
  el: HTMLElement;
  onClose?: () => void;
  /** The side that was asked for. */
  position: PopoutPosition;
  /** The side actually used — differs from `position` when it had to flip to fit. */
  effectivePosition?: PopoutPosition;
  /** Remembered so the arrow can be recoloured onto the right border after a flip. */
  arrowColor?: string;
  animate?: boolean;
  manualClose?: boolean;
  attachToRect: Rect;
  resizeObserver: ResizeObserver;
}

export interface ModalArgs {
  content: PopupContent;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface TooltipArgs {
  content: string;
  attachTo?: ElementLike;
  x?: number;
  y?: number;
  position?: PopoutPosition;
  offset?: { x?: number; y?: number };
}

// ---------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** Border box size, plus margins when `includeMargin` — jQuery's outerWidth(true). */
function outerSize(node: HTMLElement, includeMargin: boolean): { width: number; height: number } {
  const rect = node.getBoundingClientRect();
  if (!includeMargin) return { width: rect.width, height: rect.height };

  const style = getComputedStyle(node);
  return {
    width: rect.width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0),
    height: rect.height + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
  };
}

/**
 * Document-relative rect of a popup/popout/tooltip anchor.
 *
 * Popups and popouts measure the margin box (jQuery `outerWidth(true)`),
 * tooltips the border box — preserved from the legacy implementation.
 */
function attachToRect(attachTo: ElementLike, includeMargin = true): Rect {
  const node = attachTo;
  const rect = node.getBoundingClientRect();
  const size = outerSize(node, includeMargin);
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: size.width,
    height: size.height
  };
}

function setArrowDirection(arrow: HTMLElement, position: string) {
  arrow.classList.remove('left', 'right', 'bottom', 'top');
  if (position === 'bottom') arrow.classList.add('top');
  else if (position === 'top') arrow.classList.add('bottom');
  else if (position === 'left') arrow.classList.add('right');
  else if (position === 'right') arrow.classList.add('left');
}

const ARROW_COLOR_CSS_ATTR = {
  bottom: 'borderBottomColor',
  top: 'borderTopColor',
  left: 'borderLeftColor',
  right: 'borderRightColor'
};

/**
 * The side a popout flips to when the one it asked for does not fit.
 *
 * It doubles as the arrow-class map: a popout placed *below* its anchor wears
 * the `top` arrow, and so on — which is the same table read the other way.
 */
const OPPOSITE_POSITION: Record<PopoutPosition, PopoutPosition> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left'
};

// ---------------------------------------------------------------------
// PopupLayer
// ---------------------------------------------------------------------

export class PopupLayer {
  public static instance: PopupLayer;
  public static StringInputPopup = StringInputPopup;

  /** The `.popup-layer` root, appended to the body by the router. */
  public el: HTMLElement;
  public dragItem: TSFixme;

  public isShowingPopup = false;
  public ignoreContextMenuEvent = false;
  /** Locked means a body click event won't close the popup. */
  public isLocked = false;
  public contentId = '';
  public popouts: Popout[] = [];
  public modals: ModalArgs[] = [];

  public width = 0;
  public height = 0;

  private popup: PopupArgs | undefined;
  private _dimLayerCount = 0;
  private _hideTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private toastHideTimeout: ReturnType<typeof setTimeout> | undefined;
  private dragListeners: AbortController | undefined;

  private shouldCloseModal = false;
  private allowShouldCloseModal = false;

  /**
   * PNL-002: cancel an in-flight dismissal gesture. Set up by
   * `bindBodyListeners`; called by the `show*` methods so that the same gesture
   * that opened something cannot also close it on its own `pointerup`.
   */
  private disarmDismissal: () => void = () => undefined;

  // Shell elements
  private popupEl: HTMLElement;
  private popupArrow: HTMLElement;
  private popupContent: HTMLElement;
  private popoutsEl: HTMLElement;
  private modalEl: HTMLElement;
  private modalContent: HTMLElement;
  private toastEl: HTMLElement;
  private draggerEl: HTMLElement;
  private draggerLabel: HTMLElement;
  private dropTypeIndicator: HTMLElement;
  private dragMessage: HTMLElement;
  private dragMessageText: HTMLElement;
  private tooltipEl: HTMLElement;
  private tooltipArrow: HTMLElement;
  private tooltipContent: HTMLElement;
  private fileDropEl: HTMLElement;
  private activityEl: HTMLElement;
  private activityText: HTMLElement;
  private activityProgress: HTMLElement;
  private activityProgressBar: HTMLElement;
  private blockerEl: HTMLElement;

  constructor() {
    KeyboardHandler.instance.registerCommands([
      {
        handler: () => {
          if (this.popup && this.isShowingPopup) {
            this.hidePopup();
          } else if (this.modals.length) {
            this.hideModal();
          } else if (this.popouts.length) {
            this.hidePopouts();
          }
        },
        keybinding: KeyCode.Escape
      }
    ]);
  }

  public resize() {
    this.width = document.documentElement.clientWidth;
    this.height = document.documentElement.clientHeight;
  }

  public render(): HTMLElement {
    this.buildShell();

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.bindBodyListeners();

    return this.el;
  }

  private buildShell() {
    this.el = el('div', 'popup-layer');

    // small docs popup (populated by DocsPopup)
    this.el.appendChild(el('div', 'popup-small-docs'));

    this.popoutsEl = el('div', 'popup-layer-popouts');
    this.el.appendChild(this.popoutsEl);

    this.popupEl = el('div', 'popup-layer-popup');
    this.popupArrow = el('div', 'popup-layer-popup-arrow');
    this.popupContent = el('div', 'popup-layer-popup-content');
    this.popupEl.append(this.popupArrow, this.popupContent);
    this.el.appendChild(this.popupEl);

    this.modalEl = el('div', 'popup-layer-modal');
    this.modalContent = el('div', 'popup-layer-modal-content');
    this.modalEl.appendChild(this.modalContent);
    this.el.appendChild(this.modalEl);

    this.toastEl = el('div', 'popup-layer-toast');
    this.el.appendChild(this.toastEl);

    this.draggerEl = el('div', 'popup-layer-dragger');
    this.dropTypeIndicator = el('i', 'popup-layer-drop-type-indicator fa');
    this.draggerLabel = el('span', 'popup-layer-dragger-label');
    this.dragMessage = el('div', 'popup-layer-drag-message');
    this.dragMessage.style.display = 'none';
    this.dragMessageText = el('span', 'popup-layer-drag-message-text');
    const dragMessageSmall = el('small');
    dragMessageSmall.appendChild(this.dragMessageText);
    this.dragMessage.append(el('i', 'fa fa-exclamation-triangle'), dragMessageSmall);
    this.draggerEl.append(this.dropTypeIndicator, this.draggerLabel, this.dragMessage);
    this.el.appendChild(this.draggerEl);

    this.tooltipEl = el('div', 'popup-layer-tooltip');
    this.tooltipArrow = el('div', 'dark popup-layer-tooltip-arrow');
    this.tooltipContent = el('div', 'popup-layer-tooltip-content');
    this.tooltipEl.append(this.tooltipArrow, this.tooltipContent);
    this.el.appendChild(this.tooltipEl);

    this.fileDropEl = el('div', 'popup-file-drop');
    this.fileDropEl.style.display = 'none';
    const fileDropMsg = el('div', 'popup-file-drop-msg');
    fileDropMsg.textContent = 'Drop files here to copy to project folder.';
    this.fileDropEl.appendChild(fileDropMsg);
    this.el.appendChild(this.fileDropEl);

    this.activityEl = el('div', 'popup-layer-activity');
    this.activityText = el('div', 'popup-layer-activity-text');
    const spinner = el('div', 'spinner popup-layer-activity-spinner');
    spinner.append(el('div', 'bounce1'), el('div', 'bounce2'), el('div', 'bounce3'));
    this.activityProgress = el('div', 'popup-layer-activity-progress');
    this.activityProgressBar = el('div', 'popup-layer-activity-progress-bar');
    this.activityProgress.appendChild(this.activityProgressBar);
    this.activityEl.append(this.activityText, spinner, this.activityProgress);
    this.el.appendChild(this.activityEl);

    // block mouse events when a popup is visible
    this.blockerEl = el('div', 'popup-layer-blocker');
    this.blockerEl.setAttribute('data-test', 'popup-layer-blocker');
    Object.assign(this.blockerEl.style, {
      width: '100%',
      height: '100%',
      pointerEvents: 'all',
      display: 'none'
    });
    this.el.appendChild(this.blockerEl);
  }

  /**
   * Outside-click handling.
   *
   * PNL-002: dismissal is a **gesture**, not a click.
   *
   * A `click` event is dispatched to the nearest common ancestor of the
   * mousedown and mouseup targets. Press inside a side-panel text field, drag
   * right to select, release over the canvas, and the resulting `click` targets
   * an ancestor of both — which is outside every popup, popout and modal, so the
   * old "clicked outside → close" rules all fired on what was really a text
   * selection. Measured, not deduced: the drag produces
   * `mousedown → INPUT`, `mouseup → CANVAS`, `click → the FrameDivider root`.
   *
   * So the decision is made on `pointerdown` and acted on at `pointerup`, and
   * **both ends of the gesture have to be outside** for it to count as a
   * dismissal. Starting inside and ending outside is a selection; starting
   * outside and ending inside is a mis-drag onto the popup. Neither dismisses.
   *
   * Pointer events rather than mouse events so a stylus or touch behaves the
   * same. `pointercancel` and losing the window disarm, so a gesture that never
   * gets its `pointerup` cannot leave the layer armed to dismiss on the next one.
   */
  private bindBodyListeners() {
    const body = document.body;

    /** `.parents().is(el)` — true only for a strict descendant. */
    const isInside = (target: EventTarget | null, node: HTMLElement) =>
      target instanceof Node && target !== node && node.contains(target);

    /**
     * `MenuDialog` / `BaseDialog` render through a React **portal** into
     * `.dialog-layer-portal-target` on the body — so a popout's *visible* menu
     * is not a DOM descendant of `popoutsEl` at all (measured: the popout
     * element itself is a 0×0 box at the attach point, and the menu's parent
     * chain is `BaseDialog .Root → .dialog-layer-portal-target → body`).
     *
     * Without this, pressing a context-menu item counts as pressing outside the
     * popout: the popout is dismissed on `pointerup`, its React root unmounts,
     * and the `click` that would have run the item's action never fires because
     * the element is gone. Verified — the item received no click event at all.
     *
     * `contains` is DOM ancestry, not a hit test, so a click on the canvas
     * behind a dialog still targets the canvas and still dismisses.
     */
    const insideDialogPortal = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      const portal = document.querySelector('.dialog-layer-portal-target');
      return !!portal && portal.contains(target);
    };

    const outsidePopup = (target: EventTarget | null) =>
      !isInside(target, this.popupEl) && !insideDialogPortal(target);
    const outsidePopouts = (target: EventTarget | null) =>
      !(isInside(target, this.popupEl) || isInside(target, this.popoutsEl)) && !insideDialogPortal(target);

    // Armed by a pointerdown that landed outside; only a pointerup that also
    // lands outside acts on it.
    let popupArmed = false;
    let popoutArmed = false;

    this.disarmDismissal = () => {
      popupArmed = false;
      popoutArmed = false;
      this.shouldCloseModal = false;
    };

    body.addEventListener('pointerdown', (e) => {
      popupArmed = outsidePopup(e.target) && !this.isLocked;
      popoutArmed = outsidePopouts(e.target) && !this.isLocked;

      if (this.allowShouldCloseModal) {
        this.shouldCloseModal = !isInside(e.target, this.modalEl);
      }

      // On Windows contextmenu is sent after mousedown. This can cause popups that are opened
      // through mousedown to close immediately. So ignore the contextmenu event for 0.1 seconds.
      if (platform.os === PlatformOS.Windows) {
        this.ignoreContextMenuEvent = true;
        setTimeout(() => {
          this.ignoreContextMenuEvent = false;
        }, 100);
      }
    });

    body.addEventListener('pointerup', (e) => {
      // Order matters and is the same as the legacy listener order: popup,
      // popout, modal. `modals.length` gates the first two exactly as before.
      if (popupArmed && outsidePopup(e.target) && !this.modals.length) {
        this.hidePopup();
        this.hideTooltip();
      }

      if (popoutArmed && outsidePopouts(e.target) && !this.modals.length) {
        this.hidePopouts();
      }

      if (this.shouldCloseModal && !isInside(e.target, this.modalEl)) {
        this.hideModal();
        this.allowShouldCloseModal = false;
      }

      this.disarmDismissal();
    });

    // A gesture that never completes must not stay armed.
    body.addEventListener('pointercancel', () => this.disarmDismissal());
    window.addEventListener('blur', () => this.disarmDismissal());

    // Right-click dismisses popouts too. `contextmenu` arrives after the
    // pointerdown that armed us and there is no pointerup to wait for, so it is
    // handled on its own terms.
    body.addEventListener('contextmenu', (e) => {
      if (this.ignoreContextMenuEvent) return;
      if (popoutArmed && outsidePopouts(e.target) && !this.modals.length) {
        this.hidePopouts();
      }
    });

    this.bindFileDropListeners(body);
  }

  private bindFileDropListeners(body: HTMLElement) {
    const isValid = (dataTransfer: DataTransfer) =>
      dataTransfer !== undefined && dataTransfer.types && dataTransfer.types.indexOf('Files') >= 0;

    const { ProjectModel } = require('../models/projectmodel'); //include here to fix circular dependency

    body.addEventListener('dragover', (evt) => {
      // Indicate drop is OK
      if (ProjectModel.instance && isValid(evt.dataTransfer)) {
        this.showFileDrop();

        evt.dataTransfer.dropEffect = 'copy';
      }

      evt.stopPropagation();
      evt.preventDefault();
    });

    body.addEventListener('dragleave', (evt) => {
      this.hideFileDrop();

      evt.stopPropagation();
      evt.preventDefault();
    });

    body.addEventListener('drop', (evt) => {
      if (ProjectModel.instance && isValid(evt.dataTransfer)) {
        const files = evt.dataTransfer.files;

        const _files = [];
        function collectFiles(file: TSFixme, basedir?: string) {
          if (FileSystem.instance.isPathDirectory(file.fullPath)) {
            const subfiles = FileSystem.instance.readDirectorySync(file.fullPath);
            subfiles.forEach((f: TSFixme) => {
              collectFiles({ fullPath: f.fullPath, name: f.fullPath.substring(basedir.length + 1) });
            });
          } else _files.push(file);
        }

        const toastActivityId = 'toast-drop-files-progress-id';
        try {
          for (let i = 0; i < files.length; i++) {
            const fullPath = webUtils.getPathForFile(files[i]);
            collectFiles({ fullPath, name: files[i].name }, FileSystem.instance.getFileDirectoryName(fullPath));
          }

          _files.forEach((f, index) => {
            ProjectModel.instance.copyFileToProjectDirectory(f);

            const progress = index / _files.length;
            ToastLayer.showProgress('Copying files to project folder.', progress, toastActivityId);
          });

          if (_files.length === 1) {
            ToastLayer.showSuccess('Successfully copied file to the project folder.');
          } else {
            ToastLayer.showSuccess(`Successfully copied ${_files.length} files to the project folder.`);
          }
        } catch (e) {
          console.error(e);
          ToastLayer.showError(
            'Failed to drop file. This is most likely caused by a temporary file, place the file in a normal folder and try again.'
          );
        } finally {
          ToastLayer.hideActivity(toastActivityId);
        }
      }

      this.hideFileDrop();

      evt.stopPropagation();
      evt.preventDefault();
    });
  }

  public getContentId(): string {
    return this.contentId;
  }

  private _dimBakckground() {
    this._dimLayerCount++;
    this.el.classList.add('dim');
  }

  private _undimBackground() {
    this._dimLayerCount--;

    if (this._dimLayerCount <= 0) {
      this.el.classList.remove('dim');
      this._dimLayerCount = 0;
    }
  }

  // ------------------------------ Popup ------------------------------
  public hidePopup() {
    if (this.popup && this.isShowingPopup) {
      this._undimBackground();
      const popupContent = this.popup.content.el;
      popupContent && popupContent.remove();
      this.popupEl.style.visibility = 'hidden';
      this.popup.onClose && this.popup.onClose();
      this.popup.content.onClose && this.popup.content.onClose();
      this.isShowingPopup = false;
      this.contentId = '';
      this._disablePopupAutoheight();
    }
    this.blockerEl.style.display = 'none';
  }

  private _enablePopupAutoheight() {
    this.popupEl.style.height = 'auto';
    this.popupContent.style.position = 'relative';
    Array.from(this.popupContent.children).forEach((child) => {
      (child as HTMLElement).style.display = 'inline-block';
      (child as HTMLElement).style.verticalAlign = 'bottom';
    });
  }

  private _disablePopupAutoheight() {
    this.popupEl.style.height = '';
    this.popupContent.style.position = '';
    Array.from(this.popupContent.children).forEach((child) => {
      (child as HTMLElement).style.display = '';
      (child as HTMLElement).style.verticalAlign = '';
    });
  }

  public setContentSize(contentWidth: number, contentHeight: number) {
    this.popupEl.style.width = contentWidth + 'px';
    this.popupEl.style.height = contentHeight + 'px';
    this.popupEl.style.transition = 'none';
  }

  public showPopup(args: PopupArgs) {
    const arrowSize = 10;

    // The gesture that opened this must not also dismiss it (PNL-002).
    this.disarmDismissal();

    this.hidePopup();
    this.blockerEl.style.display = '';

    const content = args.content.el;
    args.content.owner = this;

    this.popupContent.append(content);

    // Force a reflow to ensure the element is measurable
    void this.popupContent.offsetHeight;

    // Query the actual appended element to measure dimensions
    const firstChild = this.popupContent.firstElementChild as HTMLElement;
    const contentSize = outerSize(firstChild, true);
    const contentWidth = contentSize.width;
    const contentHeight = contentSize.height;

    if (args.position === 'screen-center') {
      if (args.isBackgroundDimmed) {
        this._dimBakckground();

        this.popupEl.style.transition = '';
        this.popupEl.style.transform = 'translateY(20px)';
        this.popupEl.style.opacity = '0';

        setTimeout(() => {
          this.popupEl.style.transition = 'all 200ms ease';
          this.popupEl.style.transform = 'translateY(0)';
          this.popupEl.style.opacity = '1';
        }, 100);
      }

      const x = this.width / 2 - contentWidth / 2;
      const y = this.height / 2 - contentHeight / 2;

      Object.assign(this.popupEl.style, {
        position: 'absolute',
        left: x + 'px',
        top: y + 'px',
        width: contentWidth + 'px',
        height: contentHeight + 'px'
      });
      this.popupArrow.style.display = 'none';
      this.popupEl.style.visibility = 'visible';
    } else {
      const anchorRect = args.attachTo
        ? attachToRect(args.attachTo)
        : { left: args.attachToPoint.x, top: args.attachToPoint.y, width: 0, height: 0 };
      const attachToLeft = anchorRect.left;
      const attachToTop = anchorRect.top;
      const attachToWidth = anchorRect.width;
      const attachToHeight = anchorRect.height;

      // Figure out the position of the popup
      let x: number, y: number;
      setArrowDirection(this.popupArrow, args.position);

      if (args.position === 'bottom') {
        x = attachToLeft + attachToWidth / 2 - contentWidth / 2;
        y = attachToHeight + attachToTop + arrowSize;
      } else if (args.position === 'top') {
        x = attachToLeft + attachToWidth / 2 - contentWidth / 2;
        y = attachToTop - contentHeight - arrowSize;
      } else if (args.position === 'left') {
        x = attachToLeft - contentWidth - arrowSize;
        y = attachToTop + attachToHeight / 2 - contentHeight / 2;
      } else if (args.position === 'right') {
        x = attachToWidth + attachToLeft + arrowSize;
        y = attachToTop + attachToHeight / 2 - contentHeight / 2;
      }

      // Make sure the popup is not outside of the screen
      const margin = 2;
      if (x + contentWidth > this.width - margin) x = this.width - margin - contentWidth;
      if (y + contentHeight > this.height - margin) y = this.height - margin - contentHeight;
      if (x < margin) x = margin;
      if (y < margin) y = margin;

      // Cannot cover to bar as that is used for moving window
      const topBarHeight = windowTitleBarHeight();

      if (y < topBarHeight) y = topBarHeight;

      // Position the popup
      Object.assign(this.popupEl.style, {
        position: 'absolute',
        left: x + 'px',
        top: y + 'px',
        transition: 'none'
      });

      this.setContentSize(contentWidth, contentHeight);

      // Set the position of the arrow
      this.popupArrow.style.left =
        args.position === 'top' || args.position === 'bottom'
          ? Math.round(Math.abs(attachToLeft + attachToWidth / 2 - x)) + 'px'
          : '';
      this.popupArrow.style.top =
        args.position === 'left' || args.position === 'right'
          ? Math.round(Math.abs(attachToTop + attachToHeight / 2 - y)) + 'px'
          : '';

      this.popupArrow.style.display = 'initial';
      this.popupEl.style.visibility = 'visible';
    }

    if (args.hasDynamicHeight) {
      this._enablePopupAutoheight();
    }

    this.popup = args;
    this.popup.onOpen && this.popup.onOpen();
    this.popup.content.onOpen && this.popup.content.onOpen();
    this.isShowingPopup = true;
    this.contentId = args.contentId;
  }

  // ------------------------------ Popout ------------------------------
  private _resizePopout(popout: Popout) {
    const content = popout.el.querySelector('.popup-layer-popout-content') as HTMLElement;
    const size = outerSize(content, true);

    popout.el.style.width = size.width + 'px';
    popout.el.style.height = size.height + 'px';
    popout.el.style.transition = 'none';
  }

  private _positionPopout(popout: Popout, args: PopoutArgs) {
    const popoutEl = popout.el;
    const attachRect = popout.attachToRect;

    const content = popoutEl.querySelector('.popup-layer-popout-content') as HTMLElement;
    const arrow = popoutEl.querySelector('.popup-layer-popout-arrow') as HTMLElement;

    const arrowSize = 10;
    const margin = 10;

    const size = outerSize(content, true);
    const contentWidth = size.width;
    const contentHeight = size.height;

    // The box the popout has to live in. The window's title bar is off limits —
    // it is what the OS drags the window by.
    const minX = margin;
    const maxX = this.width - margin;
    const minY = Math.max(margin, windowTitleBarHeight());
    const maxY = this.height - margin;

    const offsetX = args.offsetX || 0;
    const offsetY = args.offsetY || 0;

    /** Where a popout of this size sits when placed on `side`, before any clamping. */
    const originFor = (side: PopoutPosition) => {
      switch (side) {
        case 'bottom':
          return {
            x: attachRect.left + attachRect.width / 2 - contentWidth / 2 + offsetX,
            y: attachRect.top + attachRect.height + arrowSize + offsetY
          };
        case 'top':
          return {
            x: attachRect.left + attachRect.width / 2 - contentWidth / 2 + offsetX,
            y: attachRect.top - contentHeight - arrowSize + offsetY
          };
        case 'left':
          return {
            x: attachRect.left - contentWidth - arrowSize + offsetX,
            y: attachRect.top + attachRect.height / 2 - contentHeight / 2 + offsetY
          };
        case 'right':
          return {
            x: attachRect.left + attachRect.width + arrowSize + offsetX,
            y: attachRect.top + attachRect.height / 2 - contentHeight / 2 + offsetY
          };
        default:
          return undefined;
      }
    };

    /**
     * How far off screen a side puts the popout, along the axis that side owns.
     * Only that axis can be improved by flipping — the other one is identical on
     * both sides and is the clamp's job.
     */
    const overflowFor = (side: PopoutPosition, origin: { x: number; y: number }) => {
      switch (side) {
        case 'bottom':
          return Math.max(0, origin.y + contentHeight - maxY);
        case 'top':
          return Math.max(0, minY - origin.y);
        case 'right':
          return Math.max(0, origin.x + contentWidth - maxX);
        case 'left':
          return Math.max(0, minX - origin.x);
        default:
          return 0;
      }
    };

    let position = popout.position;
    let origin = originFor(position);

    // Flip to the opposite side when this one hangs off the edge — but only if the
    // other side is genuinely better. A popout taller than the window overflows
    // whichever way it faces, and flipping it would only move which end is cut off.
    if (origin) {
      const overflow = overflowFor(position, origin);
      if (overflow > 0) {
        const flipped = OPPOSITE_POSITION[position];
        const flippedOrigin = originFor(flipped);
        if (flippedOrigin && overflowFor(flipped, flippedOrigin) < overflow) {
          position = flipped;
          origin = flippedOrigin;
        }
      }
    }

    // The arrow always points back at the anchor, so it follows the side we ended on.
    if (position) {
      setArrowDirection(arrow, position);
    }

    // Recolour only when the side changed: showPopout colours the arrow before the
    // first positioning pass, against the side that was asked for.
    if (popout.effectivePosition !== position) {
      popout.effectivePosition = position;
      if (popout.arrowColor) this.setPopoutArrowColor(popout, popout.arrowColor);
    }

    // Make sure the popout is not outside of the screen
    let x = origin?.x;
    let y = origin?.y;

    if (x !== undefined) {
      if (x + contentWidth > maxX) x = maxX - contentWidth;
      if (x < minX) x = minX;
    }

    if (y !== undefined) {
      if (y + contentHeight > maxY) y = maxY - contentHeight;
      if (y < minY) y = minY;
    }

    // Position the popup
    Object.assign(popoutEl.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      transition: 'none'
    });

    // Set the position of the arrow
    arrow.style.left =
      position === 'top' || position === 'bottom'
        ? Math.round(Math.abs(attachRect.left + attachRect.width / 2 - x)) + 'px'
        : '';
    arrow.style.top =
      position === 'left' || position === 'right'
        ? Math.round(Math.abs(attachRect.top + attachRect.height / 2 - y)) + 'px'
        : '';
  }

  public showPopout(args: PopoutArgs): Popout {
    this.disarmDismissal();

    this.blockerEl.style.display = '';

    const content = args.content.el;
    args.content.owner = this;

    const popoutEl = el('div', 'popup-layer-popout');
    popoutEl.append(el('div', 'popup-layer-popout-arrow'), el('div', 'popup-layer-popout-content'));
    this.popoutsEl.appendChild(popoutEl);

    popoutEl.querySelector('.popup-layer-popout-content').append(content);

    const resizeObserver = new ResizeObserver(() => {
      this._resizePopout(popout);
      if (!args.disableDynamicPositioning) {
        this._positionPopout(popout, args);
      }
    });

    //note: the dom element in attachTo can become invalid while the popout is open (when the property panel re-renders)
    //so we need to save the position now and hope the attach point doesn't move
    const popout: Popout = {
      el: popoutEl,
      onClose: args.onClose,
      position: args.position,
      animate: args.animate,
      manualClose: args.manualClose,
      attachToRect: args.attachTo
        ? attachToRect(args.attachTo)
        : { left: args.attachToPoint.x, top: args.attachToPoint.y, width: 0, height: 0 },
      resizeObserver
    };
    this.setPopoutArrowColor(popout, args.arrowColor || '313131');

    this._resizePopout(popout);
    this._positionPopout(popout, args);
    resizeObserver.observe(content);

    this.popouts.push(popout);

    // Enable pointer events for outside-click-to-close when popouts are active
    this.el.classList.add('has-popouts');

    if (args.animate) {
      popoutEl.style.transform = 'translateY(10px)';
      popoutEl.style.opacity = '0';

      setTimeout(() => {
        popoutEl.style.transition = 'all 200ms ease-out';
        popoutEl.style.transform = 'translateY(0px)';
        popoutEl.style.opacity = '1';
      }, 50);
    }

    return popout;
  }

  public setPopoutArrowColor(popout: Popout, color: string) {
    popout.arrowColor = color;

    const attr = ARROW_COLOR_CSS_ATTR[popout.effectivePosition || popout.position];
    if (!attr) return;

    const arrow = popout.el.querySelector('.popup-layer-popout-arrow') as HTMLElement;

    // Clear the other three, or a popout that flipped keeps the old side's colour
    // painted on a border the arrow no longer draws with.
    Object.values(ARROW_COLOR_CSS_ATTR).forEach((key) => ((arrow.style as TSFixme)[key] = ''));
    (arrow.style as TSFixme)[attr] = color;
  }

  public hidePopouts(manual?: boolean) {
    const popouts = [...this.popouts]; //shallow copy since we'll modify the array in the loop
    popouts.forEach((p) => {
      if (!p.manualClose || manual === true) {
        this.hidePopout(p);
      }
    });
  }

  public hidePopout(popout: Popout) {
    if (!popout) return;

    const i = this.popouts.indexOf(popout);
    if (i !== -1) {
      this.popouts.splice(i, 1);
    }

    popout.resizeObserver.disconnect();
    popout.onClose && popout.onClose();

    const close = () => {
      popout.el.remove();

      if (this.popouts.length === 0) {
        this.blockerEl.style.display = 'none';
        // Disable pointer events when no popouts are active
        this.el.classList.remove('has-popouts');
      }
    };

    if (popout.animate) {
      popout.el.style.transition = 'all 200ms ease-out';
      popout.el.style.transform = 'translateY(10px)';
      popout.el.style.opacity = '0';
      setTimeout(close, 250);
    } else {
      close();
    }
  }

  // ------------------------------ Modals ------------------------------
  public showModal(args: ModalArgs): ModalArgs {
    this.disarmDismissal();

    const content = args.content.el;
    args.content.owner = this;

    this.modalContent.replaceChildren(content);

    //If the previous popup is being hidden, cancel that timer
    this._hideTimeoutId && clearTimeout(this._hideTimeoutId);

    // Position the popup
    Object.assign(this.modalEl.style, {
      transform: 'translate(-50%, calc(-50% + -20px))',
      transition: 'none',
      opacity: '0',
      visibility: 'visible'
    });

    this._dimBakckground();

    setTimeout(() => {
      Object.assign(this.modalEl.style, {
        transition: 'all 200ms ease',
        transform: 'translate(-50%, -50%)',
        opacity: '1'
      });
    }, 100);

    const modal = args;

    modal.onOpen && modal.onOpen();
    modal.content.onOpen && modal.content.onOpen();
    this.modals.push(modal);

    return modal;
  }

  public hideModal(modal?: ModalArgs) {
    if (!modal) {
      modal = this.modals.pop();
    } else {
      const index = this.modals.indexOf(modal);
      if (index !== -1) {
        this.modals.splice(index, 1);
      }
    }

    if (modal) {
      this.modalEl.style.transform = 'translate(-50%, calc(-50% + -20px))';
      this.modalEl.style.opacity = '0';
      this._undimBackground();
      this._hideTimeoutId = setTimeout(() => {
        this.modalEl.style.visibility = 'hidden';
        this.modalContent.replaceChildren();
      }, 200);
      modal.onClose && modal.onClose();
    }
  }

  public hideAllModalsAndPopups() {
    const modals = this.modals.slice();
    modals.forEach((modal) => this.hideModal(modal));

    this.hidePopup();
    this.hidePopouts();
    this.hideTooltip();
  }

  public showConfirmModal({
    message,
    title,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel
  }: {
    message: string;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) {
    this.showReactModal(
      React.createElement(ConfirmModal, {
        message,
        title,
        confirmLabel,
        cancelLabel,
        onCancel: () => {
          this.hideModal();
          onCancel && onCancel();
        },
        onConfirm: () => {
          this.hideModal();
          onConfirm && onConfirm();
        }
      })
    );
  }

  public showErrorModal({ message, title, onOk }: { message: string; title?: string; onOk?: () => void }) {
    //print error so it is logged to the debug log
    console.log('Showing error modal: ');
    console.log(` Title: ${title} Message:  ${message}`);

    this.showReactModal(
      React.createElement(ErrorModal, {
        message,
        title,
        onOk: () => {
          this.hideModal();
          onOk && onOk();
        }
      })
    );
  }

  /** Show a React element as a modal, unmounting it once the modal closes. */
  private showReactModal(element: React.ReactElement) {
    const container = document.createElement('div');
    const root = createRoot(container);
    root.render(element);

    this.showModal({
      content: { el: container },
      // Deferred: onClose runs inside the React event that triggered the close.
      onClose: () => setTimeout(() => root.unmount(), 0)
    });
  }

  // ------------------ Drag and drop ---------------------
  public startDragging(item: TSFixme) {
    this.draggerLabel.textContent = item.label;

    this.dragItem = item;

    const placeDragItem = (x: number, y: number) => {
      this.draggerEl.style.opacity = '1';
      this.draggerEl.style.transition = 'none';
      this.draggerEl.style.transform = `translate3d(${x}px,${y}px,0px)`;
    };

    this.dragListeners && this.dragListeners.abort();
    this.dragListeners = new AbortController();
    const { signal } = this.dragListeners;

    document.body.addEventListener(
      'mousemove',
      (e) => {
        placeDragItem(e.pageX, e.pageY);
        e.preventDefault();
      },
      { signal }
    );
    document.body.addEventListener(
      'mouseup',
      (e) => {
        this.dragCompleted();

        this.dragListeners && this.dragListeners.abort();
        this.dragListeners = undefined;
        e.preventDefault();
      },
      { signal }
    );
  }

  public isDragging(): boolean {
    return !!this.dragItem;
  }

  public indicateDropType(type?: string) {
    const dropTypeClasses = {
      move: 'fa-share',
      add: 'fa-plus'
    };
    Object.values(dropTypeClasses).forEach((cls) => this.dropTypeIndicator.classList.remove(cls));

    if (type) this.dropTypeIndicator.classList.add(dropTypeClasses[type]);
  }

  public setDragMessage(message?: string) {
    if (message && message !== '') {
      this.dragMessageText.textContent = message;
      this.dragMessage.style.display = '';
    } else {
      this.dragMessage.style.display = 'none';
    }
  }

  public dragCompleted() {
    this.draggerEl.style.opacity = '0';
    this.dragItem = undefined;
  }

  // -------------------------------- Tooltip ----------------------------------
  private _setTooltipPosition(args: { offset?: { x?: number }; position: string; x: number; y: number }) {
    if (args.offset && args.offset.x) {
      this.tooltipArrow.style.transform = `translateX(-${args.offset.x}px)`;
    } else {
      this.tooltipArrow.style.transform = '';
    }

    this.tooltipEl.style.left = args.x + 'px';
    this.tooltipEl.style.top = args.y + 'px';
    this.tooltipEl.style.opacity = '1';

    // Set arrow position
    this.tooltipArrow.classList.remove('left', 'right', 'top', 'bottom');
    this.tooltipArrow.classList.add(args.position);
  }

  private _getTooltipPosition(args: TooltipArgs) {
    const size = outerSize(this.tooltipEl, false);
    const contentWidth = size.width;
    const contentHeight = size.height;

    // The tooltip anchor is measured on its border box (no margins)
    const anchor = args.attachTo ? attachToRect(args.attachTo, false) : null;
    let attachToLeft = anchor ? anchor.left : args.x;
    const attachToTop = anchor ? anchor.top : args.y;
    const attachToWidth = anchor ? anchor.width : 0;
    const attachToHeight = anchor ? anchor.height : 0;

    if (args.offset && args.offset.x) {
      attachToLeft += args.offset.x;
    }

    let x: number, y: number;
    const arrowSize = 5;
    if (args.position === undefined || args.position === 'bottom') {
      x = attachToLeft + attachToWidth / 2 - contentWidth / 2;
      y = attachToHeight + attachToTop + arrowSize;
    } else if (args.position === 'top') {
      x = attachToLeft + attachToWidth / 2 - contentWidth / 2;
      y = attachToTop - contentHeight - arrowSize;
    } else if (args.position === 'left') {
      x = attachToLeft - contentWidth - arrowSize;
      y = attachToTop + attachToHeight / 2 - contentHeight / 2;
    } else if (args.position === 'right') {
      x = attachToWidth + attachToLeft + arrowSize;
      y = attachToTop + attachToHeight / 2 - contentHeight / 2;
    }

    return { x, y, contentWidth, contentHeight };
  }

  public showTooltip(args: TooltipArgs) {
    if (this.isDragging()) return; // Don't show tooltip if a drag is in progress

    // Set text
    this.tooltipContent.innerHTML = args.content;

    args.position = args.position || 'bottom'; //default to bottom

    //calculate tooltip position
    let rect = this._getTooltipPosition(args);

    //if the tooltip is attached to the bottom of an element, and gets placed outside
    //the screen, change position to top
    if (args.position === 'bottom' && rect.y + rect.contentHeight > window.innerHeight) {
      args.position = 'top';
      rect = this._getTooltipPosition(args);
    }

    //make sure the tooltip isn't rendered outside the screen, and that there's
    //a small amount of margin to the edge
    rect.x = Math.max(16, rect.x);

    this._setTooltipPosition({
      offset: args.offset,
      position: args.position,
      x: rect.x,
      y: rect.y
    });

    return rect;
  }

  public hideTooltip() {
    this.tooltipEl.style.opacity = '0';
  }

  // ------------------ Toast (deprecated) ---------------------
  public showToast(text: string) {
    this.toastEl.textContent = text;
    const size = outerSize(this.toastEl, false);
    const x = (this.width - size.width) / 2;
    const y = (this.height - size.height) / 2;

    this.toastEl.style.opacity = '1';
    this.toastEl.style.transform = `translate3d(${x}px,${y}px,0px)`;

    clearTimeout(this.toastHideTimeout);
    this.toastHideTimeout = setTimeout(() => {
      this.toastEl.style.opacity = '0';
    }, 2000);

    console.error(
      'showToast is deprecated. Use ToastLayer.showSuccess(), ToastLayer.showError() or ToastLayer.showInteraction() instead.'
    );
  }

  // ------------------ Activity (deprecated) ---------------------
  public showActivity(text: string) {
    this.activityText.innerHTML = text;
    const size = outerSize(this.activityEl, false);
    const x = (this.width - size.width) / 2;
    const y = (this.height - size.height) / 2;

    this.activityEl.style.opacity = '1';
    this.activityEl.style.transform = `translate3d(${x}px,${y}px,0px)`;

    this.activityProgress.style.display = 'none';
    this.activityProgressBar.style.width = '0%';

    console.error('showActivity is deprecated. Use ToastLayer.showActivity() instead.');
  }

  public hideActivity() {
    this.activityEl.style.opacity = '0';
    this.activityEl.style.pointerEvents = 'none';

    console.error('hideActivity is deprecated. Use ToastLayer.hideActivity() instead.');
  }

  /**
   * @param progress 0 to 100
   */
  public showActivityProgress(progress: number | string) {
    this.activityProgress.style.display = '';
    this.activityProgressBar.style.width = progress + '%';

    console.error('showActivityProgress is deprecated. Use ToastLayer.showProgress() instead.');
  }

  // ------------------ Indicate drop on ---------------------
  public showFileDrop() {
    this.fileDropEl.style.display = '';
  }

  public hideFileDrop() {
    this.fileDropEl.style.display = 'none';
  }
}

export { StringInputPopup };

export default PopupLayer;
