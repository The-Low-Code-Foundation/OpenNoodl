/**
 * Rule: a legacy import left a construct it could not convert (LIB-006).
 *
 * **Always `error`, never `warning`, and not promotable away by any option.**
 * That is the whole point of the rule. LIB-006's third risk is that placeholders
 * become a silent tolerance and projects ship carrying them; a warning is
 * exactly how that happens.
 *
 * ## Why this is not folded into `unknown-node-type`
 *
 * `unknown-node-type` is a `warning` by default, and correctly so: the catalog
 * enumerates the core vocabulary, so a module-provided node legitimately fails
 * to resolve and erroring on it cries wolf. But those two situations are
 * genuinely different claims:
 *
 * - *unknown type* — "this type is not in the catalog **right now**". A module
 *   may yet provide it. Warning.
 * - *legacy placeholder* — "**the importer looked at this and could not convert
 *   it**", recorded at import time with a report entry that says why. Error.
 *
 * The second is a stronger, dated statement made by something that had more
 * context than the validator has. It earns a stronger severity, and keeping the
 * rules separate is what lets each keep the severity it deserves.
 *
 * ## Why the placeholder is the node itself
 *
 * There is no `LegacyPlaceholder` node type, deliberately. The unconverted node
 * is left **exactly as authored** — original type name, original parameters,
 * original wiring — and only gains a `metadata.legacyImport` marker. Rewriting
 * it into a placeholder type would destroy the one piece of information a repair
 * needs most (what it was), would break the case where a module later provides
 * the type, and would add a runtime node type that phase 21 excludes. The editor
 * already renders a node with an unresolvable type visibly and flags it — this
 * rule adds the part that was missing, which is the error severity and the
 * pointer back to the report entry.
 *
 * @module noodl-editor/validation/rules/legacyImportPlaceholder
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { Rule, RuleContext } from './types';

/**
 * The metadata key a legacy import writes. Duplicated from
 * `utils/import-engine/legacy/types.ts` rather than imported: the validator is
 * consumed by the MCP server and the CLI, and must not acquire a dependency on
 * the import engine to check one string. The constant is asserted equal in
 * `tests-unit/lib-006/placeholderRule.test.ts` so the duplication cannot drift.
 */
export const LEGACY_IMPORT_METADATA_KEY = 'legacyImport';

interface LegacyImportMarkerLike {
  findingId?: unknown;
  originalType?: unknown;
  reason?: unknown;
}

function markerOf(metadata: Record<string, unknown> | undefined): LegacyImportMarkerLike | undefined {
  const marker = metadata?.[LEGACY_IMPORT_METADATA_KEY];
  if (marker === null || typeof marker !== 'object') {
    return undefined;
  }
  return marker as LegacyImportMarkerLike;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export const legacyImportPlaceholder: Rule = {
  code: DiagnosticCode.LegacyImportPlaceholder,
  description: 'No node is left over from a legacy import that the importer could not convert.',
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    for (const { component } of ctx.components) {
      for (const node of component.nodes) {
        const marker = markerOf(node.metadata);
        if (!marker) {
          continue;
        }

        const originalType = asString(marker.originalType) ?? node.type;
        const findingId = asString(marker.findingId);
        const reason = asString(marker.reason);

        let message = `"${originalType}" could not be converted when this project was imported, and is left here unconverted. It will not run.`;
        if (reason) {
          message += ` (${reason})`;
        }
        message += findingId
          ? ` See \`${findingId}\` in the project's import report.`
          : " See the project's import report.";

        out.push({
          // Always error. Not `ctx.options.strict ? ... : ...` — a placeholder
          // is not a matter of how strictly you want to be judged.
          code: DiagnosticCode.LegacyImportPlaceholder,
          severity: 'error',
          message,
          location: {
            component: component.name,
            nodeId: node.id,
            nodeType: node.type,
            nodeLabel: node.label
          },
          suggestion: ctx.catalog.suggestType(originalType)
        });
      }
    }
    return out;
  }
};
