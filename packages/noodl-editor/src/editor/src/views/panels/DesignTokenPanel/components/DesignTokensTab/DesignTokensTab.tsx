/**
 * STYLE-001: Design Tokens Tab
 *
 * Main tab showing all design tokens grouped by category (Colors, Spacing, etc.).
 * Each group is collapsible. Token rows show a visual preview and the current value.
 */

import { useProjectDesignTokenContext } from '@noodl-contexts/ProjectDesignTokenContext';
import React from 'react';

import { StyleTokenRecord, TOKEN_CATEGORY_GROUPS, TokenCategoryGroup } from '@noodl-models/StyleTokensModel';

import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { SectionVariant } from '@noodl-core-ui/components/sidebar/Section';

import { TokenCategorySection } from '../TokenCategorySection';

export function DesignTokensTab() {
  const { designTokens, styleTokensModel } = useProjectDesignTokenContext();

  // Group tokens by their display group
  const grouped = React.useMemo(() => {
    const map: Partial<Record<TokenCategoryGroup, StyleTokenRecord[]>> = {};
    for (const group of TOKEN_CATEGORY_GROUPS) {
      map[group] = [];
    }
    for (const token of designTokens) {
      // Find the group from TOKEN_CATEGORIES
      // We rely on the model already having them grouped correctly
      const groupForToken = getGroupForToken(token);
      if (groupForToken && map[groupForToken]) {
        map[groupForToken].push(token);
      }
    }
    return map;
  }, [designTokens]);

  const customCount = designTokens.filter((t) => t.isCustom).length;

  return (
    <div>
      {customCount > 0 && (
        <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--theme-color-fg-default-shy)' }}>
          {customCount} token{customCount !== 1 ? 's' : ''} overriding defaults
          <button
            onClick={() => styleTokensModel?.resetAllToDefaults({ undo: true })}
            style={{
              marginLeft: '8px',
              background: 'none',
              border: 'none',
              color: 'var(--theme-color-primary)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: 0
            }}
          >
            Reset all
          </button>
        </div>
      )}

      {TOKEN_CATEGORY_GROUPS.map((group) => {
        const tokens = grouped[group] ?? [];
        if (tokens.length === 0) return null;

        return (
          <CollapsableSection
            key={group}
            title={group}
            variant={SectionVariant.Panel}
            UNSAFE_style={{ marginTop: group === TOKEN_CATEGORY_GROUPS[0] ? '16px' : '8px' }}
          >
            <TokenCategorySection
              tokens={tokens}
              onTokenChange={(name, value) => styleTokensModel?.setToken(name, value, { undo: true })}
              onTokenReset={(name) => styleTokensModel?.deleteCustomToken(name, { undo: true })}
            />
          </CollapsableSection>
        );
      })}
    </div>
  );
}

/**
 * Determine the display group from a token's category.
 *
 * 🔴 **This is a second copy of the mapping `TOKEN_CATEGORIES` already holds**,
 * and it fails closed in the worst possible way: an unmapped category returns
 * `null`, the token is dropped from `grouped`, and the panel renders as though it
 * does not exist — while `get_style_vocabulary` lists it to the authoring model
 * perfectly happily. VIB-002 hit exactly that adding the `gradient` category:
 * the tokens were live in the rendered page and invisible in the editor.
 *
 * It is kept as a copy only because the comment below it is true — importing the
 * table here would close a circular import — so the tripwire is the rule instead:
 * **a new `TokenCategory` must be added in BOTH places**, and the `default`
 * branch names the file to change.
 */
function getGroupForToken(token: StyleTokenRecord): TokenCategoryGroup | null {
  const cat = token.category;
  if (cat === 'color-semantic' || cat === 'color-palette') return 'Colors';
  if (cat === 'spacing') return 'Spacing';
  if (cat.startsWith('typography')) return 'Typography';
  if (cat === 'border-radius' || cat === 'border-width') return 'Borders';
  if (cat === 'shadow' || cat === 'gradient') return 'Effects';
  if (cat.startsWith('animation')) return 'Animation';
  return null;
}
