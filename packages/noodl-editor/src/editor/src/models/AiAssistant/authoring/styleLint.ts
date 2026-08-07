/**
 * AIX-006 — The Authoring Loop: post-generation style lint.
 *
 * The style analogue of the semantic validator. After a candidate passes the
 * structural + semantic gate, this runs the StyleAnalyzer's detector (the pure
 * core — no ProjectModel, so it bundles into the headless harness) over the
 * candidate's OWN nodes and reports raw on-page values the agent should have
 * expressed as tokens. Scoped to the generated component: a raw colour used 3×
 * inside this one component is a finding; the rest of the project is not the
 * analyzer's concern here (the property-panel banner covers project-wide drift).
 *
 * These findings feed the SAME refine loop as validator errors — but as a
 * second, clearly-labelled tier: the validator's errors reject a submission,
 * style findings only ask for one improvement pass. The linter suggests; the
 * loop decides (spec risk row).
 *
 * @module AiAssistant/authoring/styleLint
 */

// Import the PURE submodules directly, never the barrel — the barrel re-exports
// StyleTokensModel.ts (ProjectModel/EventDispatcher/Electron), which would taint
// the headless measurement-harness bundle of the authoring loop.
import { buildEffectiveTokens, MetaDataSource, readStoredTokens } from '../../StyleTokensModel/ProjectTokenCss';
import type { StyleTokenRecord } from '../../StyleTokensModel/TokenCategories';
import { TokenResolver } from '../../StyleTokensModel/TokenResolver';
import {
  analyzeNodes,
  COLOR_PROPERTIES,
  isRawColorValue,
  isRawSpacingValue,
  isTokenReference,
  SPACING_PROPERTIES
} from '../../../services/StyleAnalyzer/StyleAnalyzerCore';
import type { AnalyzableNode, StyleAnalysisResult, TokenModelLike } from '../../../services/StyleAnalyzer/types';
import type { ComponentFiles } from './types';

export interface StyleLintOptions {
  /**
   * Project metadata source, so raw values can be matched against the project's
   * ACTUAL resolved tokens (defaults + overrides). Omit to match against the
   * shipped defaults — still correct for the vast majority of token names.
   */
  metaSource?: MetaDataSource | null;
  /** Pre-built token records (defaults + overrides), if the caller already has them. */
  tokenRecords?: StyleTokenRecord[];
}

export interface StyleLint {
  /** Structured analyzer result over the candidate's nodes. */
  result: StyleAnalysisResult;
  /** Agent-oriented finding lines (empty when the candidate is on-system). */
  findings: string[];
}

/** v2 candidate nodes → the analyzer's `{ id, typename, parameters }` shape. */
function candidateNodes(files: ComponentFiles): AnalyzableNode[] {
  return files.nodes.nodes.map((n) => ({
    id: n.id,
    typename: n.type,
    parameters: (n.parameters ?? null) as Record<string, unknown> | null
  }));
}

/** A minimal token model for the analyzer's nearest-token matching, from records. */
function tokenModelFrom(records: StyleTokenRecord[]): TokenModelLike {
  const map = new Map(records.map((r) => [r.name, r]));
  const resolver = new TokenResolver(map);
  return {
    getTokens: () => records.map((r) => ({ name: r.name })),
    resolveToken: (name: string) => resolver.resolve(name)
  };
}

/**
 * Lint a candidate component's styling. Returns the raw analyzer result and a
 * ready-to-feed list of agent-oriented finding lines.
 */
export function styleLintCandidate(files: ComponentFiles, options: StyleLintOptions = {}): StyleLint {
  const records =
    options.tokenRecords ?? Array.from(buildEffectiveTokens(readStoredTokens(options.metaSource)).values());
  const tokenModel = tokenModelFrom(records);

  const result = analyzeNodes(candidateNodes(files), { tokenModel });
  return { result, findings: formatStyleFindings(result) };
}

/**
 * Turn an analysis result into finding lines phrased for the agent to act on —
 * emission-oriented ("reference var(--x)"), not the human banner's phrasing.
 */
export function formatStyleFindings(result: StyleAnalysisResult): string[] {
  const lines: string[] = [];

  for (const rv of [...result.repeatedColors].sort((a, b) => b.count - a.count)) {
    const fix = rv.matchingToken
      ? `it resolves to the existing token ${rv.matchingToken} — reference var(${rv.matchingToken}) instead`
      : `define a colour token for it (get/set via the style vocabulary) and reference var(--…) instead`;
    lines.push(`raw colour ${rv.value} used on ${rv.count} elements: ${fix}.`);
  }

  for (const rv of [...result.repeatedSpacing].sort((a, b) => b.count - a.count)) {
    const fix = rv.matchingToken
      ? `it matches the spacing token ${rv.matchingToken} — reference var(${rv.matchingToken}) instead`
      : `reference the nearest spacing token (e.g. var(--space-*), var(--text-*), var(--radius-*)) instead of a literal`;
    lines.push(`raw spacing ${rv.value} used on ${rv.count} elements: ${fix}.`);
  }

  for (const vc of [...result.variantCandidates].sort((a, b) => b.overrideCount - a.overrideCount)) {
    const short = vc.nodeType.split('.').pop();
    lines.push(
      `${short} "${vc.nodeLabel}" carries ${vc.overrideCount} raw style overrides — prefer an element variant ` +
        `(see ELEMENT VARIANTS in the style vocabulary) or token references for these.`
    );
  }

  return lines;
}

/**
 * Count raw vs token-referenced style values across a candidate — the A/B
 * measurement primitive (raw-value rate vs on-system rate). Counts only the
 * colour + spacing style properties the analyzer cares about.
 */
export function countStyleValues(files: ComponentFiles): {
  rawValues: number;
  tokenReferences: number;
  total: number;
} {
  let rawValues = 0;
  let tokenReferences = 0;
  for (const node of files.nodes.nodes) {
    const params = node.parameters ?? {};
    for (const [prop, rawVal] of Object.entries(params)) {
      const value = typeof rawVal === 'string' ? rawVal : String(rawVal ?? '');
      if (!value) continue;
      const isStyleProp = COLOR_PROPERTIES.has(prop) || SPACING_PROPERTIES.has(prop);
      if (!isStyleProp) continue;
      if (isTokenReference(value)) {
        tokenReferences++;
      } else if (isRawColorValue(value) || isRawSpacingValue(value)) {
        rawValues++;
      }
    }
  }
  return { rawValues, tokenReferences, total: rawValues + tokenReferences };
}
