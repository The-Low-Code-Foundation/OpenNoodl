/**
 * The Logic Builder's Blockly theme, built from UIX-001 design tokens.
 *
 * Blockly wants literal colours, not `var()`, so this goes through
 * {@link resolveThemeTokens} — the same resolver the canvas uses (UIX-005), with the same
 * dark-theme fallbacks for contexts that have no stylesheet. Rebuilding on
 * `nodegx:themechanged` is what makes the block editor follow the editor's light/dark
 * setting instead of being permanently dark, which is what `@blockly/theme-dark` made it.
 *
 * Block *body* colours stay on Blockly's own hue scale (set per block in NoodlBlocks.ts and
 * the toolbox). Those are semantic — the learner reads "green means loops" — and mapping
 * them onto editor chrome tokens would flatten exactly the distinction they exist to make.
 * What the tokens drive is the chrome around the blocks: workspace, toolbox, flyout,
 * scrollbars, selection and insertion markers.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';

import { ColorSpec, resolveThemeTokens } from '../nodegrapheditor/canvas/CanvasTheme';

const THEME_TOKENS: Record<string, ColorSpec> = {
  /** Workspace ground — the same surface the node canvas uses, so the tab does not jump. */
  workspace: { css: '--theme-color-bg-0', fallback: '#0b0e12' },
  /** Toolbox tree and flyout sit one step up, like every other panel. */
  panel: { css: '--theme-color-bg-1', fallback: '#11151b' },
  panelText: { css: '--theme-color-fg-default', fallback: '#c9d2dd' },
  /** Grid dots and scrollbars: present, not loud. */
  subtle: { css: '--theme-color-border-default', fallback: '#232a33' },
  /** Selection and insertion markers use the azure action accent. */
  accent: { css: '--theme-color-primary', fallback: '#4da3ff' }
};

/** Bumped per rebuild so Blockly sees a distinct theme name and re-applies cleanly. */
let generation = 0;

export interface BlocklyChromeColors {
  workspace: string;
  panel: string;
  panelText: string;
  subtle: string;
  accent: string;
}

/** Resolve the chrome colours for the theme currently applied to the document. */
export function resolveBlocklyChrome(): BlocklyChromeColors {
  return resolveThemeTokens(THEME_TOKENS) as unknown as BlocklyChromeColors;
}

/**
 * Build a Blockly theme from the current tokens.
 *
 * Call again after a theme change and hand the result to `workspace.setTheme(...)`.
 */
export function buildBlocklyTheme(): Blockly.Theme {
  const chrome = resolveBlocklyChrome();

  return Blockly.Theme.defineTheme(`nodegx-${(generation += 1)}`, {
    name: 'nodegx',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: chrome.workspace,
      toolboxBackgroundColour: chrome.panel,
      toolboxForegroundColour: chrome.panelText,
      flyoutBackgroundColour: chrome.panel,
      flyoutForegroundColour: chrome.panelText,
      flyoutOpacity: 1,
      scrollbarColour: chrome.subtle,
      scrollbarOpacity: 0.6,
      insertionMarkerColour: chrome.accent,
      insertionMarkerOpacity: 0.5,
      markerColour: chrome.accent,
      cursorColour: chrome.accent,
      selectedGlowColour: chrome.accent,
      selectedGlowOpacity: 0.7,
      replacementGlowColour: chrome.accent
    }
  });
}
