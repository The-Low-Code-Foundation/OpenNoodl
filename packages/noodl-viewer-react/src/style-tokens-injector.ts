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

    // Load tokens from project metadata
    this.loadTokens();

    // Inject tokens into DOM
    this.injectTokens();

    // Listen for project changes
    this.bindListeners();
  }

  /**
   * Load tokens from project metadata
   */
  private loadTokens() {
    try {
      const metadata = this.graphModel.getMetaData();
      const styleTokens = metadata?.styleTokens;

      // Validate that styleTokens is a proper object
      if (styleTokens && typeof styleTokens === 'object' && !Array.isArray(styleTokens)) {
        this.tokens = styleTokens as Record<string, string>;
      } else {
        this.tokens = this.getDefaultTokens();
      }
    } catch (error) {
      console.warn('Failed to load style tokens, using defaults:', error);
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
    if (typeof document === 'undefined') return;

    // Remove existing style element if any
    this.removeStyleElement();

    // Create new style element
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'noodl-style-tokens';
    this.styleElement.textContent = this.generateCSS();

    // Inject into head
    document.head.appendChild(this.styleElement);
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
