/**
 * Style Tokens Injector
 *
 * Injects CSS custom properties (design tokens) into the DOM
 * for use in Noodl projects.
 *
 * This class is responsible for:
 * - Injecting default tokens into the page
 * - Updating tokens when project settings change
 * - Cleaning up on unmount
 */

interface GraphModel {
  getMetaData(): Record<string, unknown> | undefined;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string): void;
}

interface StyleTokensInjectorOptions {
  graphModel: GraphModel;
}

export class StyleTokensInjector {
  private styleElement: HTMLStyleElement | null = null;
  private graphModel: GraphModel;
  private tokens: Record<string, string> = {};

  constructor(options: StyleTokensInjectorOptions) {
    this.graphModel = options.graphModel;

    console.log('[StyleTokensInjector] Initializing...');

    // Load tokens from project metadata
    this.loadTokens();

    console.log('[StyleTokensInjector] Loaded tokens:', Object.keys(this.tokens).length, 'tokens');

    // Inject tokens into DOM
    this.injectTokens();

    console.log('[StyleTokensInjector] Tokens injected into DOM');

    // Listen for project changes
    this.bindListeners();
  }

  /**
   * Load tokens from project metadata
   */
  private loadTokens() {
    try {
      const metadata = this.graphModel.getMetaData();
      console.log('[StyleTokensInjector] Metadata:', metadata);

      const styleTokens = metadata?.styleTokens;
      console.log('[StyleTokensInjector] Style tokens from metadata:', styleTokens);

      // Always start with defaults
      const defaults = this.getDefaultTokens();

      // Validate that styleTokens is a proper object and merge with defaults
      if (styleTokens && typeof styleTokens === 'object' && !Array.isArray(styleTokens)) {
        console.log('[StyleTokensInjector] Merging custom tokens with defaults');
        this.tokens = { ...defaults, ...styleTokens };
      } else {
        console.log('[StyleTokensInjector] No custom tokens, using defaults only');
        this.tokens = defaults;
      }
    } catch (error) {
      console.warn('[StyleTokensInjector] Failed to load style tokens, using defaults:', error);
      this.tokens = this.getDefaultTokens();
    }
  }

  /**
   * Get default tokens (fallback if project doesn't have custom tokens)
   */
  private getDefaultTokens(): Record<string, string> {
    return {
      // Colors
      '--primary': '#3b82f6',
      '--background': '#ffffff',
      '--foreground': '#0f172a',
      '--border': '#e2e8f0',
      // Spacing
      '--space-sm': '8px',
      '--space-md': '16px',
      '--space-lg': '24px',
      // Borders
      '--radius-md': '8px',
      // Shadows
      '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
    };
  }

  /**
   * Inject tokens as CSS custom properties
   */
  private injectTokens() {
    // Support SSR
    if (typeof document === 'undefined') {
      console.log('[StyleTokensInjector] Skipping injection (SSR)');
      return;
    }

    // Remove existing style element if any
    this.removeStyleElement();

    // Create new style element
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'noodl-style-tokens';
    const css = this.generateCSS();
    this.styleElement.textContent = css;

    console.log('[StyleTokensInjector] Generated CSS:', css.substring(0, 100) + '...');

    // Inject into head
    document.head.appendChild(this.styleElement);

    console.log('[StyleTokensInjector] Style element added to <head>, id:', this.styleElement.id);
  }

  /**
   * Generate CSS string from tokens
   */
  private generateCSS(): string {
    const entries = Object.entries(this.tokens);

    if (entries.length === 0) {
      return '';
    }

    const declarations = entries.map(([name, value]) => `  ${name}: ${value};`).join('\n');

    return `:root {\n${declarations}\n}`;
  }

  /**
   * Update tokens and re-inject
   */
  updateTokens(newTokens: Record<string, string>) {
    this.tokens = { ...this.getDefaultTokens(), ...newTokens };
    this.injectTokens();
  }

  /**
   * Bind to graph model events
   */
  private bindListeners() {
    if (!this.graphModel) return;

    // Listen for metadata changes
    this.graphModel.on('metadataChanged', (metadata: unknown) => {
      if (metadata && typeof metadata === 'object' && 'styleTokens' in metadata) {
        const data = metadata as Record<string, unknown>;
        if (data.styleTokens && typeof data.styleTokens === 'object') {
          this.updateTokens(data.styleTokens as Record<string, string>);
        }
      }
    });
  }

  /**
   * Remove style element from DOM
   */
  private removeStyleElement() {
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
      this.styleElement = null;
    }
  }

  /**
   * Cleanup
   */
  dispose() {
    this.removeStyleElement();
    if (this.graphModel) {
      this.graphModel.off('metadataChanged');
    }
  }
}

export default StyleTokensInjector;
