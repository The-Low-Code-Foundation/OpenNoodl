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

/** A jQuery object, a raw element, or an array of elements. */
type ElementLike = TSFixme;

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
  /** Anchor element (jQuery or raw). Ignored when `position` is 'screen-center'. */
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
  disableCentering?: boolean;
  offsetX?: number;
  offsetY?: number;
  onClose?: () => void;
}

export interface Popout {
  el: HTMLElement;
  onClose?: () => void;
  position: PopoutPosition;
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

/** `content.el` is a jQuery object, a raw element, or an array of elements. */
function toElement(content: ElementLike): HTMLElement {
  return content && (content[0] || content);
}

function isJQuery(value: ElementLike): boolean {
  return !!value && !!value.jquery;
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
 * Document-relative rect of a popup/popout/tooltip anchor. `attachTo` is either
 * a jQuery object (the few remaining legacy views) or a raw element.
 *
 * Popups and popouts measure the margin box (jQuery `outerWidth(true)`),
 * tooltips the border box — preserved from the legacy implementation.
 */
function attachToRect(attachTo: ElementLike, includeMargin = true): Rect {
  if (isJQuery(attachTo)) {
    const offset = attachTo.offset();
    const size = includeMargin
      ? { width: attachTo.outerWidth(true), height: attachTo.outerHeight(true) }
      : outerSize(attachTo[0], false);
    return { left: offset.left, top: offset.top, width: size.width, height: size.height };
  }

  const node = toElement(attachTo);
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
   * Outside-click handling. The listeners are registered in the same order as
   * the legacy jQuery ones (popup, popout, modal, file drop) because the
   * handlers depend on each other's state within a single event.
   */
  private bindBodyListeners() {
    const body = document.body;

    /** `.parents().is(el)` — true only for a strict descendant. */
    const isInside = (target: EventTarget | null, node: HTMLElement) =>
      target instanceof Node && target !== node && node.contains(target);

    // Detect if you click outside of a popup, then it should be closed
    let shouldClosePopup = false;
    body.addEventListener('click', (e) => {
      if (!isInside(e.target, this.popupEl) && shouldClosePopup && !this.modals.length) {
        this.hidePopup();
        this.hideTooltip();
      }
    });
    body.addEventListener('mousedown', (e) => {
      shouldClosePopup = !isInside(e.target, this.popupEl) && !this.isLocked;
    });

    // Detect if you click outside of a popout and popup, then all popouts should be closed
    let shouldClosePopout = false;

    const onClick = (e: Event) => {
      if (
        !(isInside(e.target, this.popupEl) || isInside(e.target, this.popoutsEl)) &&
        shouldClosePopout &&
        !this.modals.length
      ) {
        this.hidePopouts();
      }
    };

    body.addEventListener('click', onClick);
    body.addEventListener('contextmenu', (e) => {
      if (!this.ignoreContextMenuEvent) {
        onClick(e);
      }
    });
    body.addEventListener('mousedown', (e) => {
      shouldClosePopout = !(isInside(e.target, this.popupEl) || isInside(e.target, this.popoutsEl)) && !this.isLocked;

      // On Windows contextmenu is sent after mousedown. This can cause popups that are opened
      // through mousedown to close immediately. So ignore the contextmenu event for 0.1 seconds.
      if (platform.os === PlatformOS.Windows) {
        this.ignoreContextMenuEvent = true;
        setTimeout(() => {
          this.ignoreContextMenuEvent = false;
        }, 100);
      }
    });

    // Check if should close modal
    body.addEventListener('click', () => {
      if (this.shouldCloseModal) {
        this.hideModal();
        this.shouldCloseModal = false;
        this.allowShouldCloseModal = false;
      }
    });
    body.addEventListener('mousedown', (e) => {
      if (this.allowShouldCloseModal) {
        this.shouldCloseModal = !isInside(e.target, this.modalEl);
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
      // content.el is a jQuery object or a raw element
      const popupContent = this.popup.content.el;
      popupContent && (popupContent.detach ? popupContent.detach() : popupContent.remove());
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

    this.hidePopup();
    this.blockerEl.style.display = '';

    const content = args.content.el;
    args.content.owner = this;

    this.popupContent.append(toElement(content));

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
    const position = popout.position;
    const attachRect = popout.attachToRect;

    const content = popoutEl.querySelector('.popup-layer-popout-content') as HTMLElement;
    const arrow = popoutEl.querySelector('.popup-layer-popout-arrow') as HTMLElement;

    const arrowSize = 10;

    const size = outerSize(content, true);
    const contentWidth = size.width;
    const contentHeight = size.height;

    // Figure out the position of the popup
    let x: number, y: number;

    if (!args.disableCentering) {
      arrow.classList.remove('left', 'right', 'bottom', 'top');
    }

    if (position === 'bottom') {
      x = attachRect.left + attachRect.width / 2 - contentWidth / 2;
      y = attachRect.height + attachRect.top + arrowSize;
      arrow.classList.add('top');
    } else if (position === 'top') {
      x = attachRect.left + attachRect.width / 2 - contentWidth / 2;
      y = attachRect.top - contentHeight - arrowSize;
      arrow.classList.add('bottom');
    } else if (position === 'left') {
      x = attachRect.left - contentWidth - arrowSize;
      y = attachRect.top + attachRect.height / 2 - contentHeight / 2;
      arrow.classList.add('right');
    } else if (position === 'right') {
      x = attachRect.width + attachRect.left + arrowSize;
      y = attachRect.top + attachRect.height / 2 - contentHeight / 2;
      arrow.classList.add('left');
    }

    // Make sure the popup is not outside of the screen
    const margin = 10;
    if (args.offsetX) x += args.offsetX;
    if (args.offsetY) y += args.offsetY;

    if (x + contentWidth > this.width - margin) x = this.width - margin - contentWidth;
    if (y + contentHeight > this.height - margin) y = this.height - margin - contentHeight;
    if (x < margin) x = margin;
    if (y < margin) y = margin;

    // Cannot cover to bar as that is used for moving window
    const topBarHeight = windowTitleBarHeight();

    if (y < topBarHeight) y = topBarHeight;

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
    this.blockerEl.style.display = '';

    const content = args.content.el;
    args.content.owner = this;

    const popoutEl = el('div', 'popup-layer-popout');
    popoutEl.append(el('div', 'popup-layer-popout-arrow'), el('div', 'popup-layer-popout-content'));
    this.popoutsEl.appendChild(popoutEl);

    popoutEl.querySelector('.popup-layer-popout-content').append(toElement(content));

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
    resizeObserver.observe(toElement(content));

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
    const attr = ARROW_COLOR_CSS_ATTR[popout.position];
    if (!attr) return;

    const arrow = popout.el.querySelector('.popup-layer-popout-arrow') as HTMLElement;
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
    const content = args.content.el;
    args.content.owner = this;

    this.modalContent.replaceChildren(toElement(content));

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
