/**
 * STYLE-005 / AIX-006: the pure core of the style analyzer.
 *
 * The detection logic — property buckets, raw-value detectors, repeated-value
 * aggregation, variant-candidate detection — with NO dependency on ProjectModel
 * or any editor model. `StyleAnalyzer` (the live-project entry point) imports
 * these, and so does the AI authoring loop's post-generation lint, which runs
 * on an in-memory candidate that is not in any project yet AND must stay
 * bundleable into the headless measurement harness (importing ProjectModel would
 * pull Electron into that bundle). One detector, two callers — the spec forbids
 * a second style validator.
 *
 * @module services/StyleAnalyzer/StyleAnalyzerCore
 */

import {
  AnalyzableNode,
  ElementReference,
  RepeatedValue,
  StyleAnalysisOptions,
  StyleAnalysisResult,
  SUGGESTION_THRESHOLDS,
  VariantCandidate
} from './types';

// ─── Property Buckets ─────────────────────────────────────────────────────────

/** Visual properties that hold colour values. */
export const COLOR_PROPERTIES = new Set([
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
export const SPACING_PROPERTIES = new Set([
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
export const ALL_STYLE_PROPERTIES = new Set([...COLOR_PROPERTIES, ...SPACING_PROPERTIES]);

/** Node typenames that are visual elements (not logic nodes). */
export const VISUAL_NODE_TYPES = new Set([
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

/** Returns true if the value is a raw (non-token) colour literal. */
export function isRawColorValue(value: string): boolean {
  if (!value || value.startsWith('var(')) return false;
  return HEX_COLOR_RE.test(value.trim()) || RGB_COLOR_RE.test(value.trim()) || HSL_COLOR_RE.test(value.trim());
}

/**
 * Returns true if the value is a raw (non-token) spacing literal
 * (e.g. '16px', '1.5rem', '24').
 */
export function isRawSpacingValue(value: string): boolean {
  if (!value || value.startsWith('var(')) return false;
  const trimmed = value.trim();
  // px, rem, em, %, vh, vw — or a plain number (unitless)
  return /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|ch|ex)?$/.test(trimmed);
}

/** Returns true if the value is a CSS var() reference to a token. */
export function isTokenReference(value: string): boolean {
  return typeof value === 'string' && value.startsWith('var(');
}

// ─── Name Generation ──────────────────────────────────────────────────────────

let _tokenNameCounter = 0;

/**
 * Generate a suggested CSS custom property name from a raw value.
 * e.g. '#3b82f6' → '--color-3b82f6', '16px' → '--spacing-16px'
 */
export function suggestTokenName(value: string, property: string): string {
  const isColor = COLOR_PROPERTIES.has(property) || isRawColorValue(value);
  const prefix = isColor ? '--color' : '--spacing';
  // Strip special chars so it's a valid CSS identifier
  const safe = value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || `custom-${++_tokenNameCounter}`;
  return `${prefix}-${safe}`;
}

/** Suggest a variant name from a node label and its primary override. */
export function suggestVariantName(nodeLabel: string, overrides: Record<string, string>): string {
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

// ─── Detection ────────────────────────────────────────────────────────────────

/** Scan one node's params into the accumulating maps. The single detector. */
export function scanNode(
  node: AnalyzableNode,
  colorMap: Map<string, ElementReference[]>,
  spacingMap: Map<string, ElementReference[]>,
  variantCandidates: VariantCandidate[]
): void {
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

    const ref: ElementReference = { nodeId: node.id, nodeLabel, property: prop, value };

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
}

export function buildRepeatedList(
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

/**
 * The full analysis over an explicit node list — the pure core `analyzeProject`
 * and the authoring lint both funnel through. Returns repeated colours/spacing
 * (3+ occurrences) and variant candidates (3+ raw overrides), deduplicated.
 */
export function analyzeNodes(nodes: AnalyzableNode[], options?: StyleAnalysisOptions): StyleAnalysisResult {
  const colorMap = new Map<string, ElementReference[]>();
  const spacingMap = new Map<string, ElementReference[]>();
  const variantCandidates: VariantCandidate[] = [];

  for (const node of nodes) {
    scanNode(node, colorMap, spacingMap, variantCandidates);
  }

  const repeatedColors = buildRepeatedList(colorMap, 'backgroundColor', options?.tokenModel);
  const repeatedSpacing = buildRepeatedList(spacingMap, 'paddingTop', options?.tokenModel);

  const seenNodes = new Set<string>();
  const uniqueVariants = variantCandidates.filter((vc) => {
    if (seenNodes.has(vc.nodeId)) return false;
    seenNodes.add(vc.nodeId);
    return true;
  });

  return { repeatedColors, repeatedSpacing, variantCandidates: uniqueVariants };
}
