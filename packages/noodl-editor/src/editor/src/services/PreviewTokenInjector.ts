/**
 * STYLE-001 Phase 4: PreviewTokenInjector
 *
 * Injects design token CSS custom properties into the preview webview so that
 * var(--token-name) references in user projects resolve to the correct values.
 *
 * Architecture:
 * - Singleton service, initialised once at app startup
 * - CanvasView calls `notifyDomReady(webview)` after each dom-ready event
 * - Subscribes to StyleTokensModel 'tokensChanged' and re-injects on every change
 * - Uses `executeJavaScript` to insert/update a <style id="noodl-design-tokens"> in the
 *   preview's <head>. The style element is created on first injection and updated in place
 *   on subsequent calls, avoiding repeated DOM mutations.
 *
 * CSS escaping:
 * - The CSS block is passed as a JSON-encoded string inside the script so that backticks,
 *   backslashes, and dollar signs in token values cannot break template literal parsing.
 */

import { StyleTokensModel } from '../models/StyleTokensModel';

const STYLE_ELEMENT_ID = 'noodl-design-tokens';

export class PreviewTokenInjector {
  private static _instance: PreviewTokenInjector | null = null;

  /**
   * Every preview surface that needs tokens. AIX-008 added a second one (the
   * authoring sandbox), and a single reference silently meant "whichever
   * announced itself last" — the other would keep whatever CSS it started with
   * and drift on the next token change.
   */
  private readonly _webviews = new Set<Electron.WebviewTag>();
  private _tokensModel: StyleTokensModel | null = null;

  private constructor() {}

  static get instance(): PreviewTokenInjector {
    if (!PreviewTokenInjector._instance) {
      PreviewTokenInjector._instance = new PreviewTokenInjector();
    }
    return PreviewTokenInjector._instance;
  }

  /**
   * Attach a StyleTokensModel instance. Called once when the project loads.
   * The injector subscribes to 'tokensChanged' and re-injects whenever tokens change.
   */
  attachModel(model: StyleTokensModel): void {
    // Detach previous model if any — off(context) removes all listeners bound to `this`
    this._tokensModel?.off(this);

    this._tokensModel = model;

    model.on('tokensChanged', () => this._inject(), this);
  }

  /**
   * Called by CanvasView after each dom-ready event (once the session is valid).
   * Stores the webview reference and immediately injects the current tokens.
   */
  notifyDomReady(webview: Electron.WebviewTag): void {
    this._webviews.add(webview);
    this._injectInto(webview);
  }

  /**
   * Stop tracking a preview surface. Without an argument this clears them all,
   * which is what the canvas being destroyed used to mean.
   */
  clearWebview(webview?: Electron.WebviewTag): void {
    if (webview) this._webviews.delete(webview);
    else this._webviews.clear();
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private _inject(): void {
    for (const webview of this._webviews) this._injectInto(webview);
  }

  private _injectInto(webview: Electron.WebviewTag): void {
    if (!this._tokensModel) return;

    const css = this._tokensModel.generateCss();
    if (!css) return;

    // JSON-encode the CSS to safely pass it through executeJavaScript without
    // worrying about backticks, backslashes, or $ signs in token values.
    const encodedCss = JSON.stringify(css);

    const script = `
      (function() {
        var id = '${STYLE_ELEMENT_ID}';
        var el = document.getElementById(id);
        if (!el) {
          el = document.createElement('style');
          el.id = id;
          (document.head || document.documentElement).appendChild(el);
        }
        el.textContent = ${encodedCss};
      })();
    `;

    // executeJavaScript returns a Promise — we intentionally don't await it here
    // because injection is best-effort and we don't want to block the caller.
    // Errors are swallowed because the webview may navigate away at any time.
    webview.executeJavaScript(script).catch(() => {
      // Webview navigated or was destroyed — no action needed.
    });
  }
}

/**
 * One-time initialisation: wire the injector to the global EventDispatcher so it
 * can pick up the StyleTokensModel when a project loads.
 *
 * Call this from the editor bootstrap (e.g. EditorTopBar or App startup).
 */
export function initPreviewTokenInjector(tokensModel: StyleTokensModel): void {
  PreviewTokenInjector.instance.attachModel(tokensModel);
}
