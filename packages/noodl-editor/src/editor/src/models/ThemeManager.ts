import { ipcRenderer } from 'electron';

import { EditorSettings } from '@noodl-utils/editorsettings';
import { Model } from '@noodl-utils/model';

/**
 * ThemeManager — the editor's light/dark theme controller (UIX-008).
 *
 * Responsibilities:
 *  - Own the tri-state theme mode (`system | light | dark`), persisted in the
 *    shared editor settings store (`EditorSettings`, key `editor.theme`), so the
 *    choice survives restarts alongside every other editor-wide preference.
 *  - Resolve `system` against the OS via `prefers-color-scheme`, and follow live
 *    OS theme changes while in system mode (no restart).
 *  - Stamp `data-theme="light" | "dark"` on the document root so the UIX-001
 *    token overrides apply. Because launcher and editor share one window (and
 *    all popouts render into that window's DOM), stamping the root covers the
 *    whole editor chrome.
 *  - Notify imperative consumers on every change: it fires the
 *    `nodegx:themechanged` window event (the UIX-005 canvas repaint contract;
 *    the CodeMirror theme follows the CSS variables automatically) and its own
 *    typed `changed` model event for React surfaces.
 *  - Ask the Electron main process to align `nativeTheme.themeSource` so native
 *    scrollbars/menus match.
 *
 * "Theme" here means the editor CHROME only. The preview webview renders the
 * user's running app and is deliberately untouched.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** The persisted editor-settings key. */
export const THEME_SETTINGS_KEY = 'editor.theme';

/**
 * Default mode. `system` — the app respects the OS preference out of the box,
 * which is the least-surprising and most welcoming default for new users (the
 * stated goal of this task) and is safe because NodeGX is pre-release with no
 * installed base accustomed to a forced dark theme. Flipping this to `dark` is
 * a one-line change if the light theme needs more baking. See UIX-008-NOTES.
 */
const DEFAULT_MODE: ThemeMode = 'system';

/** The window event the canvas (UIX-005) and any imperative code listen for. */
export const THEME_CHANGED_EVENT = 'nodegx:themechanged';

/** IPC channel used to align Electron's native theme (scrollbars/menus). */
const NATIVE_THEME_IPC = 'set-native-theme';

export enum ThemeManagerEvent {
  Changed = 'changed'
}

export type ThemeManagerEvents = {
  [ThemeManagerEvent.Changed]: (state: { mode: ThemeMode; resolved: ResolvedTheme }) => void;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

class ThemeManagerModel extends Model<ThemeManagerEvent, ThemeManagerEvents> {
  private mode: ThemeMode = DEFAULT_MODE;
  private mediaQuery: MediaQueryList | undefined;
  private initialized = false;

  /** The user-facing mode (`system | light | dark`). */
  get currentMode(): ThemeMode {
    return this.mode;
  }

  /** The concrete theme currently applied (`light | dark`). */
  get resolvedTheme(): ResolvedTheme {
    return this.resolve(this.mode);
  }

  private systemPrefersDark(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private resolve(mode: ThemeMode): ResolvedTheme {
    if (mode === 'system') return this.systemPrefersDark() ? 'dark' : 'light';
    return mode;
  }

  /**
   * Apply a best-effort theme immediately at renderer bootstrap, BEFORE the
   * persisted settings have loaded, to avoid a flash of the wrong theme. Uses
   * the OS preference (correct for the default `system` mode and the common
   * case). `init()` reconciles to the saved choice a moment later.
   */
  applyProvisional() {
    this.applyAttribute(this.resolve('system'));
  }

  /**
   * Load the persisted mode and apply it. Awaits the settings store so the
   * saved choice wins over the provisional one with no visible flash on the
   * shared window's background (the main process pre-paints the same colour).
   */
  async init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      await EditorSettings.instance.ready;
    } catch {
      /* fall back to the default mode */
    }

    const saved = EditorSettings.instance.get(THEME_SETTINGS_KEY);
    this.mode = isThemeMode(saved) ? saved : DEFAULT_MODE;

    this.setupSystemListener();
    this.apply();

    // Pick up the choice if it is changed elsewhere (defensive — the settings
    // store is a single source and another surface could write the key).
    EditorSettings.instance.on(
      'updated',
      ({ key }: { key: string }) => {
        if (key !== THEME_SETTINGS_KEY) return;
        const next = EditorSettings.instance.get(THEME_SETTINGS_KEY);
        if (isThemeMode(next) && next !== this.mode) {
          this.mode = next;
          this.apply();
        }
      },
      this
    );
  }

  /** Set the mode, persist it, and re-apply. No-op if unchanged. */
  setMode(mode: ThemeMode) {
    if (!isThemeMode(mode) || mode === this.mode) return;
    this.mode = mode;
    // Persist through the shared editor settings store (fires `updated`; the
    // listener above guards against a re-apply loop because `this.mode` already
    // equals the new value).
    EditorSettings.instance.set(THEME_SETTINGS_KEY, mode);
    this.apply();
  }

  private setupSystemListener() {
    if (typeof matchMedia !== 'function') return;
    this.mediaQuery = matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (this.mode === 'system') this.apply();
    };
    if (this.mediaQuery.addEventListener) {
      this.mediaQuery.addEventListener('change', handler);
    } else if ((this.mediaQuery as TSFixme).addListener) {
      // Older Electron/Chromium fallback.
      (this.mediaQuery as TSFixme).addListener(handler);
    }
  }

  private apply() {
    const resolved = this.resolve(this.mode);
    this.applyAttribute(resolved);
    this.applyNativeTheme();

    // Imperative consumers: the node-graph canvas (UIX-005) repaints on this,
    // and the CodeMirror theme follows the CSS variables for free.
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT));
    }

    this.notifyListeners(ThemeManagerEvent.Changed, { mode: this.mode, resolved });
  }

  private applyAttribute(resolved: ResolvedTheme) {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }

  private applyNativeTheme() {
    try {
      // Electron's nativeTheme.themeSource accepts exactly these strings.
      ipcRenderer?.send(NATIVE_THEME_IPC, this.mode);
    } catch {
      /* main process not reachable (tests/headless) — nothing to align */
    }
  }
}

export const ThemeManager = new ThemeManagerModel();
