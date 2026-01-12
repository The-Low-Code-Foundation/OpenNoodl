/**
 * Style Tokens Model
 *
 * Manages CSS custom properties (design tokens) for a Noodl project.
 * Tokens are stored in project metadata and can be customized per project.
 *
 * @module StyleTokens
 */

import Model from '../../../../shared/model';
import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ProjectModel } from '../projectmodel';
import { getDefaultTokenValues, DEFAULT_TOKENS, StyleToken, TokenCategory } from './DefaultTokens';

export class StyleTokensModel extends Model {
  /** Custom token values (overrides defaults) */
  private customTokens: Record<string, string>;

  constructor() {
    super();
    this.customTokens = {};
    this.loadFromProject();
    this.bindListeners();
  }

  /**
   * Bind to project events to stay in sync
   */
  private bindListeners() {
    const onProjectChanged = () => {
      this.loadFromProject();
      this.notifyListeners('tokensChanged');
    };

    EventDispatcher.instance.on(
      ['ProjectModel.importComplete', 'ProjectModel.instanceHasChanged'],
      () => {
        if (ProjectModel.instance) {
          onProjectChanged();
        }
      },
      this
    );

    EventDispatcher.instance.on(
      'ProjectModel.metadataChanged',
      ({ key }) => {
        if (key === 'styleTokens') {
          onProjectChanged();
        }
      },
      this
    );
  }

  /**
   * Unbind listeners
   */
  private unbindListeners() {
    EventDispatcher.instance.off(this);
  }

  /**
   * Load tokens from current project
   */
  private loadFromProject() {
    if (ProjectModel.instance) {
      this.customTokens = ProjectModel.instance.getMetaData('styleTokens') || {};
    } else {
      this.customTokens = {};
    }
  }

  /**
   * Save tokens to current project
   */
  private saveToProject() {
    if (ProjectModel.instance) {
      this.unbindListeners();
      ProjectModel.instance.setMetaData('styleTokens', this.customTokens);
      this.bindListeners();
    }
  }

  /**
   * Get all tokens (defaults + custom overrides)
   */
  getAllTokens(): Record<string, string> {
    const defaults = getDefaultTokenValues();
    return {
      ...defaults,
      ...this.customTokens
    };
  }

  /**
   * Get a specific token value
   * @param name Token name (e.g., '--primary')
   * @returns Token value or undefined if not found
   */
  getToken(name: string): string | undefined {
    // Check custom tokens first
    if (this.customTokens[name] !== undefined) {
      return this.customTokens[name];
    }

    // Fall back to default
    const defaultToken = DEFAULT_TOKENS[name];
    return defaultToken?.value;
  }

  /**
   * Set a custom token value
   * @param name Token name (e.g., '--primary')
   * @param value Token value (e.g., '#ff0000')
   */
  setToken(name: string, value: string) {
    // Validate token name starts with --
    if (!name.startsWith('--')) {
      console.warn(`Token name must start with -- : ${name}`);
      return;
    }

    this.customTokens[name] = value;
    this.saveToProject();
    this.notifyListeners('tokensChanged');
    this.notifyListeners('tokenChanged', { name, value });
  }

  /**
   * Reset a token to its default value
   * @param name Token name (e.g., '--primary')
   */
  resetToken(name: string) {
    if (this.customTokens[name] !== undefined) {
      delete this.customTokens[name];
      this.saveToProject();
      this.notifyListeners('tokensChanged');
      this.notifyListeners('tokenReset', { name });
    }
  }

  /**
   * Reset all tokens to defaults
   */
  resetAllTokens() {
    this.customTokens = {};
    this.saveToProject();
    this.notifyListeners('tokensChanged');
    this.notifyListeners('allTokensReset');
  }

  /**
   * Check if a token has been customized
   */
  isTokenCustomized(name: string): boolean {
    return this.customTokens[name] !== undefined;
  }

  /**
   * Get token metadata
   */
  getTokenInfo(name: string): StyleToken | undefined {
    return DEFAULT_TOKENS[name];
  }

  /**
   * Get all tokens by category
   */
  getTokensByCategory(category: TokenCategory): Record<string, string> {
    const tokens: Record<string, string> = {};

    for (const [name, tokenInfo] of Object.entries(DEFAULT_TOKENS)) {
      if (tokenInfo.category === category) {
        tokens[name] = this.getToken(name) || tokenInfo.value;
      }
    }

    return tokens;
  }

  /**
   * Generate CSS string for injection
   * @returns CSS custom properties as a string
   */
  generateCSS(): string {
    const allTokens = this.getAllTokens();
    const entries = Object.entries(allTokens);

    if (entries.length === 0) {
      return '';
    }

    const declarations = entries.map(([name, value]) => `  ${name}: ${value};`).join('\n');

    return `:root {\n${declarations}\n}`;
  }

  /**
   * Cleanup
   */
  dispose() {
    this.unbindListeners();
    this.removeAllListeners();
  }
}

/**
 * Singleton instance
 */
export const StyleTokens = new StyleTokensModel();
