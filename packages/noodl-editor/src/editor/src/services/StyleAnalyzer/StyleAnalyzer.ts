/**
 * STYLE-005: StyleAnalyzer
 *
 * Scans all visual nodes in the current project for style patterns that could
 * benefit from tokenisation or variant extraction.
 *
 * Designed to be stateless and synchronous — safe to call at any time.
 * Does NOT mutate any models; all mutation lives in SuggestionActionHandler.
 */

import { ProjectModel } from '@noodl-models/projectmodel';

import {
  ElementReference,
  RepeatedValue,
  StyleAnalysisResult,
  StyleAnalysisOptions,
  StyleSuggestion,
  SUGGESTION_THRESHOLDS,
  VariantCandidate
} from './types';

// ─── Property Buckets ─────────────────────────────────────────────────────────

/** Visual properties that hold colour values. */
const COLOR_PROPERTIES = new Set([
  'backgroundColor',
  'color',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'shadowColor',
  'caretColor'
]);

/** Visual properties that hold spacing/size values (px / rem / em). */
const SPACING_PROPERTIES = new Set([
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
  'rowGap',
  'columnGap',
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight'
]);

/** All style property names we care about (union of colour + spacing). */
const ALL_STYLE_PROPERTIES = new Set([...COLOR_PROPERTIES, ...SPACING_PROPERTIES]);

/** Node typenames that are visual elements (not logic nodes). */
const VISUAL_NODE_TYPES = new Set([
  'Group',
  'net.noodl.controls.button',
  'net.noodl.controls.textinput',
  'net.noodl.text',
  'net.noodl.controls.checkbox',
  'net.noodl.visual.image',
  'net.noodl.controls.range',
  'net.noodl.controls.radiobutton',
  'net.noodl.visual.video',
  'net.noodl.controls.select'
]);

// ─── Value Detection Helpers ──────────────────────────────────────────────────

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_RE = /^rgba?\s*\(/i;
const HSL_COLOR_RE = /^hsla?\s*\(/i;

/**
 * Returns true if the value is a raw (non-token) colour literal.
 */
function isRawColorValue(value: string): boolean {
  if (!value || value.startsWith('var(')) return false;
  return HEX_COLOR_RE.test(value.trim()) || RGB_COLOR_RE.test(value.trim()) || HSL_COLOR_RE.test(value.trim());
}

/**
 * Returns true if the value is a raw (non-token) spacing literal
 * (e.g. '16px', '1.5rem', '24').
 */
function isRawSpacingValue(value: string): boolean {
  if (!value || value.startsWith('var(')) return false;
  const trimmed = value.trim();
  // px, rem, em, %, vh, vw — or a plain number (unitless)
  return /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|ch|ex)?$/.test(trimmed);
}

/**
 * Returns true if the value is a CSS var() reference to a token.
 */
function isTokenReference(value: string): boolean {
  return typeof value === 'string' && value.startsWith('var(');
}

// ─── Token Name Generation ────────────────────────────────────────────────────

let _tokenNameCounter = 0;

/**
 * Generate a suggested CSS custom property name from a raw value.
 * e.g. '#3b82f6' → '--color-3b82f6', '16px' → '--spacing-16px'
 */
function suggestTokenName(value: string, property: string): string {
  const isColor = COLOR_PROPERTIES.has(property) || isRawColorValue(value);
  const prefix = isColor ? '--color' : '--spacing';
  // Strip special chars so it's a valid CSS identifier
  const safe = value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || `custom-${++_tokenNameCounter}`;
  return `${prefix}-${safe}`;
}

/**
 * Suggest a variant name from a node label and its primary override.
 */
function suggestVariantName(nodeLabel: string, overrides: Record<string, string>): string {
  // If backgroundColor is overridden, use the hex value as a hint
  const bg = overrides['backgroundColor'];
  if (bg && isRawColorValue(bg)) {
    return 'custom';
  }
  // Fallback: slug of the node label
  return (
    nodeLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20) || 'custom'
  );
}

// ─── StyleAnalyzer ────────────────────────────────────────────────────────────

/**
 * Analyses the current project for repeated raw style values and nodes
 * with many custom overrides.
 *
 * Usage:
 * ```ts
 * const result = StyleAnalyzer.analyzeProject();
 * const suggestions = StyleAnalyzer.toSuggestions(result);
 * ```
 */
export class StyleAnalyzer {
  /**
   * Scan the whole project for repeated colours, repeated spacing values,
   * and variant candidates.
   *
   * Returns an empty result if there is no active project.
   */
  static analyzeProject(options?: StyleAnalysisOptions): StyleAnalysisResult {
    const project = ProjectModel.instance;
    if (!project) {
      return { repeatedColors: [], repeatedSpacing: [], variantCandidates: [] };
    }

    // Accumulate raw value → list of occurrences
    const colorMap = new Map<string, ElementReference[]>();
    const spacingMap = new Map<string, ElementReference[]>();
    const variantCandidates: VariantCandidate[] = [];

    for (const component of project.getComponents()) {
      component.forEachNode((node) => {
        if (!node || !node.typename) return;

        // Only scan visual nodes
        const isVisual =
          VISUAL_NODE_TYPES.has(node.typename) ||
          // Also catch any node with visual style params
          Object.keys(node.parameters || {}).some((k) => ALL_STYLE_PROPERTIES.has(k));

        if (!isVisual) return;

        const params: Record<string, unknown> = node.parameters || {};
        const nodeLabel = (params['label'] as string) || node.typename;
        const customOverrides: Record<string, string> = {};

        for (const [prop, rawVal] of Object.entries(params)) {
          const value = typeof rawVal === 'string' ? rawVal : String(rawVal ?? '');
          if (!value || isTokenReference(value)) continue;

          const ref: ElementReference = {
            nodeId: node.id,
            nodeLabel,
            property: prop,
            value
          };

          if (COLOR_PROPERTIES.has(prop) && isRawColorValue(value)) {
            const list = colorMap.get(value) ?? [];
            list.push(ref);
            colorMap.set(value, list);
            customOverrides[prop] = value;
          } else if (SPACING_PROPERTIES.has(prop) && isRawSpacingValue(value)) {
            const list = spacingMap.get(value) ?? [];
            list.push(ref);
            spacingMap.set(value, list);
            customOverrides[prop] = value;
          }
        }

        // Variant candidate: 3+ custom (non-token) style overrides
        const overrideCount = Object.keys(customOverrides).length;
        if (overrideCount >= SUGGESTION_THRESHOLDS.variantCandidateMinOverrides) {
          variantCandidates.push({
            nodeId: node.id,
            nodeLabel,
            nodeType: node.typename,
            overrideCount,
            overrides: customOverrides,
            suggestedVariantName: suggestVariantName(nodeLabel, customOverrides)
          });
        }
      });
    }

    // Build repeated colours list (3+ occurrences)
    const repeatedColors = this._buildRepeatedList(colorMap, 'backgroundColor', options?.tokenModel);

    // Build repeated spacing list (3+ occurrences)
    const repeatedSpacing = this._buildRepeatedList(spacingMap, 'paddingTop', options?.tokenModel);

    // Deduplicate variant candidates by nodeId (a node may be in multiple components)
    const seenNodes = new Set<string>();
    const uniqueVariants = variantCandidates.filter((vc) => {
      if (seenNodes.has(vc.nodeId)) return false;
      seenNodes.add(vc.nodeId);
      return true;
    });

    return {
      repeatedColors,
      repeatedSpacing,
      variantCandidates: uniqueVariants
    };
  }

  /**
   * Analyse a single node's parameters (for per-node suggestions when the
   * user selects something in the property panel).
   */
  static analyzeNode(nodeId: string): Pick<StyleAnalysisResult, 'variantCandidates'> {
    const project = ProjectModel.instance;
    if (!project) return { variantCandidates: [] };

    const node = project.findNodeWithId(nodeId);
    if (!node) return { variantCandidates: [] };

    const params: Record<string, unknown> = node.parameters || {};
    const nodeLabel = (params['label'] as string) || node.typename;
    const customOverrides: Record<string, string> = {};

    for (const [prop, rawVal] of Object.entries(params)) {
      const value = typeof rawVal === 'string' ? rawVal : String(rawVal ?? '');
      if (!value || isTokenReference(value)) continue;

      if (
        (COLOR_PROPERTIES.has(prop) && isRawColorValue(value)) ||
        (SPACING_PROPERTIES.has(prop) && isRawSpacingValue(value))
      ) {
        customOverrides[prop] = value;
      }
    }

    const overrideCount = Object.keys(customOverrides).length;

    if (overrideCount < SUGGESTION_THRESHOLDS.variantCandidateMinOverrides) {
      return { variantCandidates: [] };
    }

    return {
      variantCandidates: [
        {
          nodeId: node.id,
          nodeLabel,
          nodeType: node.typename,
          overrideCount,
          overrides: customOverrides,
          suggestedVariantName: suggestVariantName(nodeLabel, customOverrides)
        }
      ]
    };
  }

  /**
   * Convert an analysis result into an ordered list of user-facing suggestions.
   * Most actionable suggestions (highest count) come first.
   */
  static toSuggestions(result: StyleAnalysisResult): StyleSuggestion[] {
    const suggestions: StyleSuggestion[] = [];

    // Repeated colours — sort by count desc
    for (const rv of [...result.repeatedColors].sort((a, b) => b.count - a.count)) {
      suggestions.push({
        id: `repeated-color:${rv.value}`,
        type: 'repeated-color',
        message: `${rv.value} is used in ${rv.count} elements. Save as a token to update all at once?`,
        acceptLabel: 'Create Token',
        repeatedValue: rv
      });
    }

    // Repeated spacing — sort by count desc
    for (const rv of [...result.repeatedSpacing].sort((a, b) => b.count - a.count)) {
      const tokenHint = rv.matchingToken ? ` (matches ${rv.matchingToken})` : '';
      suggestions.push({
        id: `repeated-spacing:${rv.value}`,
        type: 'repeated-spacing',
        message: `${rv.value} is used as spacing in ${rv.count} elements${tokenHint}. Save as a token?`,
        acceptLabel: rv.matchingToken ? 'Switch to Token' : 'Create Token',
        repeatedValue: rv
      });
    }

    // Variant candidates — sort by override count desc
    for (const vc of [...result.variantCandidates].sort((a, b) => b.overrideCount - a.overrideCount)) {
      suggestions.push({
        id: `variant-candidate:${vc.nodeId}`,
        type: 'variant-candidate',
        message: `This ${vc.nodeType.split('.').pop()} has ${
          vc.overrideCount
        } custom values. Save as a reusable variant?`,
        acceptLabel: 'Save as Variant',
        variantCandidate: vc
      });
    }

    return suggestions;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private static _buildRepeatedList(
    valueMap: Map<string, ElementReference[]>,
    representativeProperty: string,
    tokenModel?: { getTokens(): Array<{ name: string }>; resolveToken(name: string): string | undefined }
  ): RepeatedValue[] {
    const result: RepeatedValue[] = [];

    for (const [value, elements] of valueMap) {
      if (elements.length < SUGGESTION_THRESHOLDS.repeatedValueMinCount) continue;

      // Check if this value matches any existing token
      let matchingToken: string | undefined;
      if (tokenModel) {
        for (const token of tokenModel.getTokens()) {
          const resolved = tokenModel.resolveToken(token.name);
          if (resolved && resolved.trim().toLowerCase() === value.trim().toLowerCase()) {
            matchingToken = token.name;
            break;
          }
        }
      }

      result.push({
        value,
        count: elements.length,
        elements,
        matchingToken,
        suggestedTokenName: suggestTokenName(value, representativeProperty)
      });
    }

    return result;
  }
}
