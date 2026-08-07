/**
 * AIX-006: the Style Vocabulary — the style analogue of the node catalog.
 *
 * A serializable description of the on-system styling an agent may emit:
 *   - design tokens, by category (the semantic names, NOT the resolved values —
 *     the agent references a token by name, and names are stable across
 *     projects; only the values a project overrides change);
 *   - the legal variants/sizes per element type, plus the token-referenced
 *     styles each variant/size resolves to (so the agent can copy a coherent
 *     combo rather than invent one);
 *   - the built-in presets, so a project can start on a coherent scheme.
 *
 * VERIFIED STORAGE FORMAT (spec step 1): a token-valued parameter is stored as
 * the literal CSS string `var(--token-name)` — see SuggestionActionHandler
 * (`node.setParameter(prop, 'var(--primary)')`) and every ElementConfig variant
 * (`backgroundColor: 'var(--primary)'`). The runtime resolves it against the
 * `:root { --token: … }` block that ProjectTokenCss stamps into preview and
 * deployed builds. So the agent must emit `var(--token-name)` — not the token
 * name bare, and not the resolved hex. The `_variant`/`_size` markers store the
 * bare name, but variants are stamped into concrete params at author time (the
 * viewer does not expand them), so the reliable emission is the concrete
 * token-referenced params, which is what this vocabulary hands over.
 *
 * PURE by construction — no ProjectModel, no editor Model, no Electron. It reads
 * project overrides through the same `MetaDataSource` seam ProjectTokenCss uses,
 * so it works in the renderer (ProjectModel.instance), in the headless
 * measurement harness (the serialized project's metadata), and inside the
 * esbuild-bundled MCP server. When no source is given it describes the shipped
 * defaults, which is correct for the token *names* the agent emits.
 *
 * @module models/StyleTokensModel/StyleVocabulary
 */

import { ElementConfigRegistry } from '../ElementConfigs/ElementConfigRegistry';
import { buildEffectiveTokens, MetaDataSource, readStoredTokens } from './ProjectTokenCss';
import {
  StyleTokenRecord,
  TokenCategory,
  TOKEN_CATEGORIES,
  TokenCategoryGroup,
  TOKEN_CATEGORY_GROUPS
} from './TokenCategories';

/** One token as the agent needs to see it — a name to reference, plus a hint. */
export interface VocabToken {
  /** CSS custom property name, e.g. "--primary". Emit as `var(--primary)`. */
  name: string;
  category: TokenCategory;
  /** Present only for tokens a project has overridden away from the default. */
  isCustom?: boolean;
  description?: string;
}

/** Tokens of one category. */
export interface VocabTokenCategory {
  category: TokenCategory;
  label: string;
  group: TokenCategoryGroup;
  tokens: VocabToken[];
}

/** The variants/sizes a single element type supports, with the styles they imply. */
export interface VocabElement {
  nodeType: string;
  variants: string[];
  sizes: string[];
  /** variantName → the token-referenced style params that variant stamps. */
  variantStyles: Record<string, Record<string, string>>;
  /** sizeName → the token-referenced style params that size stamps. */
  sizeStyles: Record<string, Record<string, string>>;
}

export interface VocabPreset {
  id: string;
  name: string;
  description: string;
}

export interface StyleVocabulary {
  /** Design tokens, grouped by category, in category-declaration order. */
  categories: VocabTokenCategory[];
  /** Element types with a variant/size registry (Button, Text, …). */
  elements: VocabElement[];
  /** Built-in presets a new project can adopt. */
  presets: VocabPreset[];
}

/** Categories whose members are raw scales the agent should rarely reach for. */
const RAW_SCALE_CATEGORIES = new Set<TokenCategory>(['color-palette']);

/**
 * Rewrite an element config's CSS into the parameters a node actually has.
 *
 * The element configs are authored as CSS — they also drive the editor's own
 * variant rendering, so they carry `transform`, `cursor` and shorthand
 * properties. The vocabulary, though, is read by an agent as "copy these
 * parameters onto the node", and a parameter with no matching port is dropped
 * at apply with only a warning, which never blocks. So `boxShadow` and the
 * `padding` shorthand were being taught as settable when the runtime declares
 * neither: it has `boxShadowEnabled` plus five components, and one port per
 * padding side.
 *
 * Only the two shorthands the configs actually use are expanded. Anything else
 * is passed through untouched rather than filtered against a hardcoded port
 * list, which would go stale the moment a port is added.
 */
function toPortParameters(styles: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(styles)) {
    if (key === 'padding' || key === 'margin') {
      // `2px 4px` → top/bottom, left/right. CSS's 1–4 value box shorthand.
      const parts = value.trim().split(/\s+/);
      const [top, right, bottom, left] =
        parts.length === 1
          ? [parts[0], parts[0], parts[0], parts[0]]
          : parts.length === 2
            ? [parts[0], parts[1], parts[0], parts[1]]
            : parts.length === 3
              ? [parts[0], parts[1], parts[2], parts[1]]
              : [parts[0], parts[1], parts[2], parts[3]];
      out[`${key}Top`] = top;
      out[`${key}Right`] = right;
      out[`${key}Bottom`] = bottom;
      out[`${key}Left`] = left;
      continue;
    }

    if (key === 'boxShadow') {
      // There is no shorthand port. Turning the shadow on gets the runtime's
      // own subtle default; the components stay available for a node that wants
      // to be specific. Emitting the token here would set a *colour* port to a
      // full shadow value, which is what the authored pages ended up doing.
      out.boxShadowEnabled = 'true';
      continue;
    }

    out[key] = value;
  }

  return out;
}

/**
 * Build the full style vocabulary. Pass a metadata source (ProjectModel, a
 * serialized project's `{ getMetaData }`, or the MCP project file) to reflect a
 * project's custom token overrides; omit it for the shipped defaults.
 */
export function buildStyleVocabulary(source?: MetaDataSource | null): StyleVocabulary {
  const tokenMap = buildEffectiveTokens(readStoredTokens(source));

  const byCategory = new Map<TokenCategory, VocabToken[]>();
  for (const record of tokenMap.values()) {
    const list = byCategory.get(record.category) ?? [];
    list.push({
      name: record.name,
      category: record.category,
      ...(record.isCustom ? { isCustom: true } : {}),
      ...(record.description ? { description: record.description } : {})
    });
    byCategory.set(record.category, list);
  }

  const categories: VocabTokenCategory[] = (Object.keys(TOKEN_CATEGORIES) as TokenCategory[])
    .map((category) => ({
      category,
      label: TOKEN_CATEGORIES[category].label,
      group: TOKEN_CATEGORIES[category].group,
      tokens: byCategory.get(category) ?? []
    }))
    .filter((c) => c.tokens.length > 0);

  const elements: VocabElement[] = ElementConfigRegistry.getAll().map((config) => {
    const nodeType = config.nodeType;
    const variants = ElementConfigRegistry.getVariantNames(nodeType);
    const sizes = ElementConfigRegistry.getSizeNames(nodeType);
    const variantStyles: Record<string, Record<string, string>> = {};
    for (const variant of variants) {
      const resolved = ElementConfigRegistry.resolveVariant(nodeType, variant);
      if (resolved) variantStyles[variant] = toPortParameters(resolved.baseStyles);
    }
    const sizeStyles: Record<string, Record<string, string>> = {};
    for (const size of sizes) {
      const applied: Record<string, string> = {};
      // resolveVariant does not cover sizes; read them off the config directly.
      const sizePreset = (config.sizes ?? {})[size];
      if (sizePreset) {
        for (const [k, v] of Object.entries(sizePreset)) {
          if (typeof v === 'string') applied[k] = v;
        }
      }
      sizeStyles[size] = toPortParameters(applied);
    }
    return { nodeType, variants, sizes, variantStyles, sizeStyles };
  });

  const presets = listVocabularyPresets();

  return { categories, elements, presets };
}

/**
 * Preset descriptions, without importing the StylePresets model's default-token
 * apparatus into pure code paths. Kept in lockstep with StylePresetsModel's
 * built-ins (id/name/description) — the only fields the vocabulary exposes.
 */
export function listVocabularyPresets(): VocabPreset[] {
  return [
    { id: 'modern', name: 'Modern', description: 'The balanced default — clean, neutral, Tailwind-scale.' },
    { id: 'minimal', name: 'Minimal', description: 'Restrained: subtle borders, muted palette, tight radius.' },
    { id: 'playful', name: 'Playful', description: 'Vivid colors, rounded corners, generous spacing.' },
    { id: 'enterprise', name: 'Enterprise', description: 'Dense, conservative, high-contrast for data-heavy UIs.' },
    { id: 'soft', name: 'Soft', description: 'Gentle pastels, large radius, airy spacing.' }
  ];
}

// ── Prompt rendering ────────────────────────────────────────────────────────

export interface RenderVocabularyOptions {
  /**
   * When given, only these element types get their variants/sizes spelled out
   * (the rest are named). Keeps the block inside AIX-002's structural budget —
   * the agent asks the catalog for element ports anyway.
   */
  elementTypes?: string[];
  /** Cap on tokens listed per category before eliding — keeps colour scales from bloating. */
  maxTokensPerCategory?: number;
}

const DEFAULT_MAX_TOKENS_PER_CATEGORY = 40;

/**
 * Render the vocabulary as a compact prompt block: category summaries (token
 * NAMES only — the agent references names, never values), and the legal
 * variants/sizes per element with the token-referenced styles each implies.
 * Deliberately terse — this rides inside AIX-002's existing context budget.
 */
export function renderStyleVocabulary(vocab: StyleVocabulary, options: RenderVocabularyOptions = {}): string {
  const cap = options.maxTokensPerCategory ?? DEFAULT_MAX_TOKENS_PER_CATEGORY;
  const lines: string[] = [];

  lines.push('DESIGN TOKENS — reference these by name as `var(--name)`; never emit a raw hex or px when a token fits.');
  for (const group of TOKEN_CATEGORY_GROUPS) {
    const inGroup = vocab.categories.filter((c) => c.group === group);
    if (inGroup.length === 0) continue;
    for (const cat of inGroup) {
      const names = cat.tokens.map((t) => t.name);
      const isRaw = RAW_SCALE_CATEGORIES.has(cat.category);
      const shown = names.slice(0, isRaw ? 8 : cap);
      const suffix = names.length > shown.length ? `, … (+${names.length - shown.length})` : '';
      const note = isRaw ? ' [raw scale — prefer the semantic colours above]' : '';
      lines.push(`- ${cat.label}: ${shown.join(', ')}${suffix}${note}`);
    }
  }

  if (vocab.elements.length > 0) {
    lines.push('');
    // The old wording offered two routes — "set the element type via the marker
    // param, or copy the styles it implies" — and the marker route does not
    // work: `variant` is `allowConnectionsOnly`, so a statically authored value
    // is discarded. An agent that took the shorter-looking option wrote
    // `variant: "heading-1"` on every Text, set no font size or colour, and
    // shipped a page that rendered entirely at browser defaults. There is only
    // one route now, and the validator errors on the other.
    lines.push(
      'ELEMENT VARIANTS & SIZES — a catalogue of coherent styles, NOT settable parameters. ' +
        '"variant" and "size" are connection-only ports: setting either as a parameter is discarded and is a ' +
        'validation error. To use one, copy the parameters it lists onto the node:'
    );
    const spellOut = options.elementTypes ? new Set(options.elementTypes) : null;
    for (const el of vocab.elements) {
      const head = `- ${el.nodeType}: variants [${el.variants.join(', ') || 'none'}], sizes [${
        el.sizes.join(', ') || 'none'
      }]`;
      lines.push(head);
      if (spellOut && !spellOut.has(el.nodeType)) continue;
      for (const variant of el.variants) {
        const styles = el.variantStyles[variant];
        if (styles && Object.keys(styles).length > 0) {
          lines.push(`    · ${variant}: ${formatStyleMap(styles)}`);
        }
      }
    }
  }

  return lines.join('\n');
}

function formatStyleMap(styles: Record<string, string>): string {
  return Object.entries(styles)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}

/** Every token name the vocabulary knows — for cheap "is this a real token?" checks. */
export function vocabularyTokenNames(vocab: StyleVocabulary): Set<string> {
  const names = new Set<string>();
  for (const cat of vocab.categories) for (const t of cat.tokens) names.add(t.name);
  return names;
}

/** The full record list (defaults + overrides) as a flat array — for lint token-matching. */
export function vocabularyTokenRecords(source?: MetaDataSource | null): StyleTokenRecord[] {
  return Array.from(buildEffectiveTokens(readStoredTokens(source)).values());
}
