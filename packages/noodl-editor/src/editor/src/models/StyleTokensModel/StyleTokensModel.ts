/**
 * STYLE-001: StyleTokensModel
 *
 * Main model for the Noodl design token system.
 * Stores Tailwind-inspired CSS custom properties and persists customisations
 * in project metadata under the key 'designTokens'.
 *
 * Architecture:
 * - Default tokens are loaded from DefaultTokens.ts (never stored in project.json)
 * - Only user *overrides* are stored as customTokens in project.json
 * - The effective token map merges defaults + overrides
 * - Listeners can subscribe to 'tokensChanged' to react to updates
 */

import Model from '../../../../shared/model';
import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ProjectModel } from '../projectmodel';
import { consumePendingPreset } from '../StylePresets';
import { UndoActionGroup, UndoQueue } from '../undo-queue-model';
import { buildDefaultTokenMap } from './DefaultTokens';
import {
  StyleTokenRecord,
  StyleTokensData,
  TokenCategory,
  TOKEN_CATEGORIES,
  TokenCategoryGroup,
  TOKEN_CATEGORY_GROUPS
} from './TokenCategories';
import { TokenResolver } from './TokenResolver';

const METADATA_KEY = 'designTokens';
const CURRENT_VERSION = 1;

export class StyleTokensModel extends Model {
  /** Full merged token map (defaults + overrides). */
  private _tokens: Map<string, StyleTokenRecord> = new Map();

  /** Resolver instance for CSS var() reference resolution. */
  readonly resolver: TokenResolver;

  constructor() {
    super();
    this._buildEffectiveTokens();
    this.resolver = new TokenResolver(this._tokens);
    this._bindListeners();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns all effective tokens (defaults merged with project overrides).
   * Ordered as: defaults first (in definition order), then any extra custom tokens.
   */
  getTokens(): StyleTokenRecord[] {
    return Array.from(this._tokens.values());
  }

  /**
   * Returns tokens filtered to a specific category.
   */
  getTokensByCategory(category: TokenCategory): StyleTokenRecord[] {
    return this.getTokens().filter((t) => t.category === category);
  }

  /**
   * Returns tokens for a group of categories (e.g. all 'Colors' tokens).
   */
  getTokensByGroup(group: TokenCategoryGroup): StyleTokenRecord[] {
    const categories = (Object.keys(TOKEN_CATEGORIES) as TokenCategory[]).filter(
      (cat) => TOKEN_CATEGORIES[cat].group === group
    );
    return this.getTokens().filter((t) => categories.includes(t.category));
  }

  /**
   * Returns tokens grouped by their display group for rendering the panel.
   */
  getTokensGrouped(): Record<TokenCategoryGroup, StyleTokenRecord[]> {
    const result = {} as Record<TokenCategoryGroup, StyleTokenRecord[]>;
    for (const group of TOKEN_CATEGORY_GROUPS) {
      result[group] = this.getTokensByGroup(group);
    }
    return result;
  }

  /**
   * Resolve a token name to its actual CSS value (follows var() references).
   */
  resolveToken(name: string): string | undefined {
    return this.resolver.resolve(name);
  }

  /**
   * Get a single token by CSS custom property name.
   */
  getToken(name: string): StyleTokenRecord | undefined {
    return this._tokens.get(name);
  }

  /**
   * Returns only the tokens that have been customised (differ from defaults).
   */
  getCustomTokens(): StyleTokenRecord[] {
    return this.getTokens().filter((t) => t.isCustom);
  }

  /**
   * Returns whether a token value is overriding its default.
   */
  isOverridden(name: string): boolean {
    const token = this._tokens.get(name);
    if (!token?.isCustom) return false;
    const defaultMap = buildDefaultTokenMap();
    const def = defaultMap.get(name);
    return !def || def.value !== token.value;
  }

  /**
   * Set/update a token value. If setting a default token to a new value,
   * it becomes a custom override. If resetting to the default value, the
   * isCustom flag is cleared.
   *
   * Fires 'tokensChanged' on success.
   */
  setToken(name: string, value: string, args?: { undo?: boolean; label?: string }): void {
    const existing = this._tokens.get(name);
    const defaultMap = buildDefaultTokenMap();
    const defaultToken = defaultMap.get(name);

    if (existing && existing.value === value) return; // No-op

    const prevToken = existing ? { ...existing } : undefined;
    const isRevertingToDefault = defaultToken && defaultToken.value === value;
    const category = existing?.category ?? defaultToken?.category ?? ('color-semantic' as TokenCategory);

    const newToken: StyleTokenRecord = {
      name,
      value,
      category,
      isCustom: !isRevertingToDefault,
      description: existing?.description ?? defaultToken?.description
    };

    this._tokens.set(name, newToken);
    this._store();
    this.resolver.invalidate(name);
    this.notifyListeners('tokensChanged', { name, token: newToken });

    if (args?.undo) {
      UndoQueue.instance.push(
        new UndoActionGroup({
          label: args.label ?? 'set design token',
          do: () => this.setToken(name, value),
          undo: () => {
            if (prevToken) {
              this.setToken(name, prevToken.value);
            } else {
              this.deleteCustomToken(name);
            }
          }
        })
      );
    }
  }

  /**
   * Add a brand-new custom token (not in defaults).
   */
  addCustomToken(token: Omit<StyleTokenRecord, 'isCustom'>, args?: { undo?: boolean; label?: string }): void {
    if (this._tokens.has(token.name)) {
      // Already exists — treat as an update
      this.setToken(token.name, token.value, args);
      return;
    }

    const newToken: StyleTokenRecord = { ...token, isCustom: true };
    this._tokens.set(token.name, newToken);
    this._store();
    this.notifyListeners('tokensChanged', { name: token.name, token: newToken });

    if (args?.undo) {
      UndoQueue.instance.push(
        new UndoActionGroup({
          label: args.label ?? 'add design token',
          do: () => this.addCustomToken(token),
          undo: () => this.deleteCustomToken(token.name)
        })
      );
    }
  }

  /**
   * Delete a custom token. For default tokens, this resets them to their
   * default value. For fully custom tokens, removes them entirely.
   */
  deleteCustomToken(name: string, args?: { undo?: boolean; label?: string }): void {
    const existing = this._tokens.get(name);
    if (!existing) return;

    const defaultMap = buildDefaultTokenMap();
    const defaultToken = defaultMap.get(name);

    if (defaultToken) {
      // Reset to default rather than delete
      this.setToken(name, defaultToken.value, args);
    } else {
      // Fully custom — remove it
      this._tokens.delete(name);
      this._store();
      this.resolver.invalidate(name);
      this.notifyListeners('tokensChanged', { name, token: null });

      if (args?.undo) {
        UndoQueue.instance.push(
          new UndoActionGroup({
            label: args.label ?? 'delete design token',
            do: () => this.deleteCustomToken(name),
            undo: () => this.addCustomToken(existing)
          })
        );
      }
    }
  }

  /**
   * Reset ALL customised tokens back to their defaults, and remove any
   * fully-custom tokens. Clears the customTokens stored in project metadata.
   */
  resetAllToDefaults(args?: { undo?: boolean }): void {
    const prevCustom = this.getCustomTokens().map((t) => ({ ...t }));
    this._buildEffectiveTokens();
    this._clearStore();
    this.resolver.invalidate();
    this.notifyListeners('tokensChanged', { name: null, token: null });

    if (args?.undo) {
      UndoQueue.instance.push(
        new UndoActionGroup({
          label: 'reset all design tokens',
          do: () => this.resetAllToDefaults(),
          undo: () => {
            for (const token of prevCustom) {
              this._tokens.set(token.name, token);
            }
            this._store();
            this.notifyListeners('tokensChanged', { name: null, token: null });
          }
        })
      );
    }
  }

  /**
   * Apply a preset's token overrides to this project.
   *
   * Bulk-sets all token values defined in the preset. For the Modern preset
   * (whose `tokens` map is empty) this is a no-op. For all others, only the
   * tokens listed in the preset are overridden — palette scale tokens and any
   * tokens not mentioned by the preset retain their defaults.
   *
   * Call this right after creating a new project (while ProjectModel.instance
   * is set) so the overrides are persisted in project metadata.
   */
  applyPreset(tokens: Record<string, string>): void {
    const entries = Object.entries(tokens);
    if (entries.length === 0) return; // Modern = defaults, nothing to write

    for (const [name, value] of entries) {
      this.setToken(name, value);
    }
  }

  /**
   * Generate a CSS :root { ... } block with all effective tokens.
   * Used for injection into the preview iframe and deployed projects.
   */
  generateCss(): string {
    return this.resolver.generateCss(this._tokens);
  }

  /**
   * Export all custom tokens as JSON (for import/export feature).
   */
  exportCustomTokensJson(): string {
    return JSON.stringify(
      {
        version: CURRENT_VERSION,
        customTokens: this.getCustomTokens()
      } satisfies StyleTokensData,
      null,
      2
    );
  }

  /**
   * Import tokens from a JSON string (previously exported).
   * Only applies custom overrides — safe to call on any project.
   */
  importCustomTokensJson(json: string): void {
    try {
      const data: StyleTokensData = JSON.parse(json);
      if (!data.customTokens || !Array.isArray(data.customTokens)) return;

      for (const token of data.customTokens) {
        this.setToken(token.name, token.value);
      }
    } catch (e) {
      console.error('[StyleTokensModel] Failed to import tokens JSON:', e);
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  dispose(): void {
    this._unbindListeners();
    this.removeAllListeners();
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  /**
   * Build the effective token map by merging defaults with project overrides.
   */
  private _buildEffectiveTokens(): void {
    // Start with all defaults
    this._tokens = buildDefaultTokenMap() as Map<string, StyleTokenRecord>;

    // Load stored custom overrides from project metadata
    const stored = this._loadStored();
    if (!stored) return;

    for (const customToken of stored.customTokens) {
      this._tokens.set(customToken.name, customToken);
    }
  }

  /**
   * Persist only the custom overrides to project metadata.
   * We never persist defaults — they're always loaded from DefaultTokens.ts.
   */
  private _store(): void {
    if (!ProjectModel.instance) return;

    const customTokens: StyleTokenRecord[] = [];
    for (const [, token] of this._tokens) {
      if (token.isCustom) {
        customTokens.push(token);
      }
    }

    const data: StyleTokensData = {
      version: CURRENT_VERSION,
      customTokens
    };

    ProjectModel.instance.setMetaData(METADATA_KEY, data);
  }

  private _clearStore(): void {
    if (!ProjectModel.instance) return;
    ProjectModel.instance.setMetaData(METADATA_KEY, null);
  }

  private _loadStored(): StyleTokensData | null {
    if (!ProjectModel.instance) return null;
    const data = ProjectModel.instance.getMetaData(METADATA_KEY);
    if (!data || typeof data !== 'object') return null;
    return data as StyleTokensData;
  }

  private _bindListeners(): void {
    const reload = () => {
      if (ProjectModel.instance) {
        this._buildEffectiveTokens();
        // Apply pending preset (set during new-project creation in the launcher).
        // This is a one-shot: consumePendingPreset() clears the pending value.
        this._applyAndClearPendingPreset();
        this.resolver.updateTokens(this._tokens);
        this.notifyListeners('tokensChanged', { name: null, token: null });
      }
    };

    EventDispatcher.instance.on(['ProjectModel.importComplete', 'ProjectModel.instanceHasChanged'], reload, this);

    EventDispatcher.instance.on(
      'ProjectModel.metadataChanged',
      ({ key }: { key: string }) => {
        if (key === METADATA_KEY) {
          this._buildEffectiveTokens();
          this.resolver.updateTokens(this._tokens);
          this.notifyListeners('tokensChanged', { name: null, token: null });
        }
      },
      this
    );
  }

  /**
   * Check for a pending preset (written by the launcher when a new project
   * is created) and apply it to the current project. One-shot — the pending
   * value is consumed/cleared after this call.
   */
  private _applyAndClearPendingPreset(): void {
    const preset = consumePendingPreset();
    if (!preset || Object.keys(preset.tokens).length === 0) return;
    this.applyPreset(preset.tokens);
  }

  private _unbindListeners(): void {
    EventDispatcher.instance.off(this);
  }
}
