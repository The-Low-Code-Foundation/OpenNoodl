import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { platform } from '@noodl/platform';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import View from '../../../../shared/ListenableView';
import { PreviewTokenInjector } from '../../services/PreviewTokenInjector';
import { VisualCanvas } from './VisualCanvas';

export class CanvasView extends View {
  webview: Electron.WebviewTag;
  webviewDomReady: boolean;

  zoomFactor: number;

  viewportWidth: number;
  viewportHeight: number;

  inspectMode: boolean;
  selectedNodeId: string | null;

  private root: Root | null = null;

  props: {
    deviceName?: string;
    zoom?: number;
    onWebView: (webview: Electron.WebviewTag) => void;
    designMode?: boolean;
    onExitDesignMode?: () => void;
    designSelection?: { label: string; seq: number };
  };

  /** Bumped per selection so the toast re-fires when the same node is clicked twice. */
  private designSelectionSeq = 0;

  _onEditorApiResponse: (event: any, args: any) => void;

  onNavigationStateChanged: ({
    route,
    canGoBack,
    canGoForward
  }: {
    route: string;
    canGoBack: boolean;
    canGoForward: boolean;
  }) => void;

  constructor({ onNavigationStateChanged }) {
    super();

    this.zoomFactor = 1;
    this.inspectMode = false;
    this.viewportWidth = null;

    this.onNavigationStateChanged = (state) => {
      onNavigationStateChanged(state);
      window.noodlEditorPreviewRoute = state.route.substring(0, state.route.indexOf('?'));
      EventDispatcher.instance.emit('viewer-navigated', state.route);
    };

    this.viewportHeight = null;

    this.props = {
      onWebView: (webview: Electron.WebviewTag) => {
        if (webview) {
          this._setupWebview(webview);
        } else {
          this.webviewDomReady = false;
          this.webview = null;
        }
      },
      designMode: false,
      /**
       * DES-001 — the preview's own way out of design mode.
       *
       * Both signals are sent because this view renders in two windows and does
       * not know which one it is in: the docked preview is in the editor
       * renderer, where the bus reaches `EditorDocument` directly, and the
       * detached preview is a separate renderer, where only main can carry it.
       * The docked case therefore delivers it twice; `setPreviewMode(true)` is
       * idempotent, and one path that always works beats a window check that
       * can be wrong.
       */
      onExitDesignMode: () => {
        EventDispatcher.instance.emit('request-preview-mode');
        ipcRenderer.send('viewer-request-preview-mode');
      }
    };
  }
  _setupWebview(webview: Electron.WebviewTag) {
    this.webview = webview;

    webview.preload = platform.getAppPath() + 'src/assets/webview-preload-viewer.js';

    webview.addEventListener('dom-ready', async () => {
      this.webviewDomReady = true;

      const isValidSession = await this.webview.executeJavaScript(`typeof NoodlEditorInspectorAPI !== 'undefined'`);
      if (!isValidSession) {
        // TODO: When loading a page with "Path" navigation and you have a "."
        // (dot) in the URL our web server will return 404, this is technically
        // a crash, right? This can also be a file, and we have no file preview yet.

        // TODO: there are use cases for invalid sessions, such as a google auth login flow that uses redirect.
        // Let's allow it for now
        // this.webview.dispatchEvent(new Event('crashed'));
        return;
      }

      const code = `
        document.addEventListener('keydown', (e) => {
          const hasFocusedElement = document.querySelector(':focus') ? true : false;
          if (!hasFocusedElement && (e.metaKey || e.ctrlKey || e.shiftKey)) {
            NoodlEditor.keyDown({
              metaKey: e.metaKey,
              ctrlKey: e.ctrlKey,
              shiftKey: e.shiftKey,
              keyCode: e.keyCode,
              key: e.key
            });
          }
        });
      `;

      webview.executeJavaScript(code);

      this.webview.executeJavaScript(`NoodlEditorInspectorAPI.setEnabled(${this.inspectMode})`);

      if (this.selectedNodeId) {
        this.webview.executeJavaScript(`NoodlEditorHighlightAPI.selectNode('${this.selectedNodeId}')`);
      }

      // Inject project design tokens into the preview so var(--token-name) resolves correctly.
      PreviewTokenInjector.instance.notifyDomReady(this.webview);

      this.updateViewportSize();
    });

    webview.addEventListener('load-commit', (event) => {
      if (event.isMainFrame === false) {
        return;
      }

      const protocol = process.env.ssl ? 'https://' : 'http://';
      const port = process.env.NOODLPORT || 8574;
      const urlPrefix = protocol + 'localhost:' + port;

      const route = event.url.startsWith(urlPrefix) ? event.url.substring(urlPrefix.length) : event.url;

      this.onNavigationStateChanged &&
        this.onNavigationStateChanged({ route, canGoBack: webview.canGoBack(), canGoForward: webview.canGoForward() });
    });

    this.setCurrentRoute('/');
  }
  resize() {
    this.updateViewportSize();
  }
  render() {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.overflow = 'hidden';

    this.el = div;

    // If there is an api response from the main thread, pass it along to the webview
    this._onEditorApiResponse = (event, args) => {
      this.tryWebviewCall(() => {
        this.webview.send('editor-api-response', args);
      });
    };

    ipcRenderer.on('editor-api-response', this._onEditorApiResponse);

    this.renderReact();

    return this.el;
  }
  renderReact() {
    // Props can be set before `render()` has made an element (the editor's
    // mode effects run on mount, ahead of the panel that hosts this view).
    // They are kept on `this.props` and picked up by the first real render.
    if (!this.el) {
      return;
    }

    if (!this.root) {
      this.root = createRoot(this.el as HTMLElement);
    }
    this.root.render(React.createElement(VisualCanvas, this.props as any));
  }
  setCurrentRoute(route: string) {
    const protocol = process.env.ssl ? 'https://' : 'http://';
    const port = process.env.NOODLPORT || 8574;

    this.webview.src = protocol + 'localhost:' + port + route;
    window.noodlEditorPreviewRoute = route;
    EventDispatcher.instance.emit('viewer-navigated', route);
  }
  dispose() {
    if (this.webview) {
      this.tryWebviewCall(() => {
        if (this.webview.isDevToolsOpened()) {
          this.webview.closeDevTools();
        }
      });
    }

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    PreviewTokenInjector.instance.clearWebview(this.webview);
    ipcRenderer.off('editor-api-response', this._onEditorApiResponse);
  }
  refresh() {
    //set back to root to reset any navigation that's been done
    // const protocol = process.env.ssl ? 'https://' : 'http://';
    // const port = process.env.NOODLPORT || 8574;
    // this.webview.src = protocol + 'localhost:' + port;

    this.tryWebviewCall(() => {
      this.webview.reloadIgnoringCache();
    });

    EventDispatcher.instance.emit('viewer-refreshed');
  }
  openDevTools() {
    if (this.webview.isDevToolsOpened()) {
      this.webview.closeDevTools();
    }

    this.webview.openDevTools();
  }

  setZoomFactor(zoomFactor: number) {
    this.zoomFactor = zoomFactor;
    this.updateViewportSize();
  }

  navigateBack() {
    this.tryWebviewCall(() => {
      this.webview.goBack();
    });
  }

  navigateForward() {
    this.tryWebviewCall(() => {
      this.webview.goForward();
    });
  }

  setViewportSize({ width, height, deviceName }: { width: number; height: number; deviceName?: string }) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.props.deviceName = deviceName;
    this.renderReact();
    this.updateViewportSize();
  }

  private updateViewportSize() {
    if (!this.webview) {
      return;
    }

    const width = this.viewportWidth;
    const height = this.viewportHeight;

    if (width !== null) {
      let zoom = this.zoomFactor;

      if (!zoom) {
        const rect = this.webview.parentElement.getBoundingClientRect();

        const aspectX = rect.width / width;
        const aspectY = rect.height / height;

        const zoomFit = Math.min(aspectX, aspectY); //zoom level that maximizes the viewport
        zoom = Math.min(1, zoomFit); //cap the zoom so it can't zoom in > 1 since it'll become blurry
      }

      this.webview.style.width = Math.floor(zoom * width) + 'px';
      this.webview.style.height = Math.floor(zoom * height) + 'px';

      this.props.zoom = zoom;
      this.renderReact();

      this.tryWebviewCall(() => this.webview.executeJavaScript(`document.body.style.zoom = '${zoom}'`));
    } else {
      const zoom = this.zoomFactor || 1;
      this.tryWebviewCall(() => this.webview.executeJavaScript(`document.body.style.zoom = '${zoom}'`));

      this.webview.style.width = '100%';
      this.webview.style.height = '100%';
      this.props.zoom = zoom;
      this.renderReact();
    }
  }

  setInspectMode(enabled: boolean) {
    this.inspectMode = enabled;

    // DES-001: inspect mode *is* design mode, so the chrome that says so is
    // driven from the same call rather than from a second piece of state that
    // could disagree with it.
    this.props.designMode = enabled;
    if (!enabled) {
      this.props.designSelection = undefined;
    }
    this.renderReact();

    this.tryWebviewCall(() => {
      this.webview.executeJavaScript(`NoodlEditorInspectorAPI.setEnabled(${enabled})`);
      this.webview.executeJavaScript(`NoodlEditorHighlightAPI.selectNode(null)`);
    });
  }

  /**
   * DES-001 — answer a design-mode click *in the preview*, where the click was.
   *
   * The properties panel already updates, but it is across the window from the
   * pointer, so a click on a button in design mode looks from here like nothing
   * happened at all — which is exactly the "the button doesn't work" report
   * this came from. The label is resolved by the editor, which owns the project
   * model; this view only shows it.
   */
  showDesignSelection(label: string) {
    if (!this.inspectMode) {
      return;
    }

    this.designSelectionSeq += 1;
    this.props.designSelection = { label, seq: this.designSelectionSeq };
    this.renderReact();
  }

  /**
   * FB-016 scope 4 — tell the running app that the author is editing a transform origin.
   *
   * This is the only part of the overlay the viewer cannot infer for itself: everything else it
   * says is read off the DOM it is already drawing over, but focus lives here, in the properties
   * panel, in another process.
   */
  setTransformOriginFocus(enabled: boolean) {
    this.tryWebviewCall(() => {
      this.webview.executeJavaScript(`NoodlEditorHighlightAPI.setTransformOriginFocus(${enabled})`);
    });
  }

  setNodeSelected(nodeId: string) {
    this.selectedNodeId = nodeId;
    this.tryWebviewCall(() => {
      this.webview.executeJavaScript(`NoodlEditorHighlightAPI.selectNode('${nodeId}')`);
    });
  }

  async captureThumbnail() {
    if (!this.webviewDomReady || !this.webview?.isConnected) {
      return null;
    }

    const nativeImage = await this.webview.capturePage();

    const size = nativeImage.getSize();
    const canvasWidth = size.width;
    const canvasHeight = size.height;
    let thumbHeight, thumbWidth;

    if (canvasWidth > canvasHeight) {
      thumbWidth = Math.round(400 * (canvasWidth / canvasHeight));
      thumbHeight = 400;
    } else {
      thumbWidth = 400;
      thumbHeight = Math.round(400 * (canvasHeight / canvasWidth));
    }

    const resizedImage = nativeImage.resize({
      width: thumbWidth,
      height: thumbHeight
    });

    return resizedImage;
  }

  private tryWebviewCall(func) {
    if (this.webviewDomReady && this.webview.isConnected) {
      try {
        func();
      } catch (e) {
        if (!e.toString().includes('The WebView must be attached to the DOM')) {
          throw e;
        }
      }
    }
  }
}
