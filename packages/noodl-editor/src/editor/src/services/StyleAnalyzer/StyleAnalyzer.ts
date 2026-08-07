/**
 * STYLE-005: StyleAnalyzer
 *
 * Scans all visual nodes in the current project for style patterns that could
 * benefit from tokenisation or variant extraction.
 *
 * Designed to be stateless and synchronous — safe to call at any time.
 * Does NOT mutate any models; all mutation lives in SuggestionActionHandler.
 *
 * The detection logic lives in the pure `StyleAnalyzerCore` (AIX-006) so the AI
 * authoring loop can lint a candidate with the same detector without importing
 * ProjectModel. This class is the live-project entry point.
 */

import { ProjectModel } from '@noodl-models/projectmodel';

import {
  analyzeNodes as coreAnalyzeNodes,
  COLOR_PROPERTIES,
  isRawColorValue,
  isTokenisableSpacingValue,
  isTokenReference,
  SPACING_PROPERTIES,
  suggestVariantName
} from './StyleAnalyzerCore';
import {
  AnalyzableNode,
  StyleAnalysisResult,
  StyleAnalysisOptions,
  StyleSuggestion,
  SUGGESTION_THRESHOLDS
} from './types';

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

    const nodes: AnalyzableNode[] = [];
    for (const component of project.getComponents()) {
      component.forEachNode((node) => {
        if (!node || !node.typename) return;
        nodes.push({ id: node.id, typename: node.typename, parameters: node.parameters });
      });
    }

    return coreAnalyzeNodes(nodes, options);
  }

  /**
   * AIX-006: the same analysis, over an explicit node list rather than the live
   * project. This is what the authoring loop's post-generation lint runs on a
   * candidate component before it is staged — the candidate is not in any
   * ProjectModel yet, so `analyzeProject` cannot see it. One detector, two entry
   * points.
   */
  static analyzeNodes(nodes: AnalyzableNode[], options?: StyleAnalysisOptions): StyleAnalysisResult {
    return coreAnalyzeNodes(nodes, options);
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
        (SPACING_PROPERTIES.has(prop) && isTokenisableSpacingValue(value))
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
}
