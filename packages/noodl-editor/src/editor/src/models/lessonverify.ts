/**
 * UNI-007 — the static half of the lesson grading runner: the two-vocabulary check.
 *
 * WHY THIS EXISTS
 * ---------------
 * A lesson carries **two vocabularies** and they are frequently different
 * strings (LESSON-FORMAT.md §3). Prose (`title`, `body`) names a node the way
 * the learner sees it in the node picker — its **display name**. Conditions
 * (`hasType`, and the `%Type` segments of a node path) are matched against
 * `node.type.name` by `findNodeWithPath` — the **type name**.
 *
 * The failure is silent. A condition naming a display name matches nothing, the
 * step never completes, and the learner is told they have not done a thing they
 * have in fact done. Phase 67 ruled the lesson format an **open contract with
 * two producers** — the platform's generator and, per UNI-010, the user's own
 * Claude through a local MCP — which doubles the exposure and makes the check
 * mandatory rather than nice-to-have. This module is that check, and it is
 * deliberately the *same* one both producers must pass ("the same verifier, not
 * a fork", README surface 2).
 *
 * WHAT THE ARCHIVE RECORDED, AND WHAT THE CATALOG ACTUALLY SAYS
 * -------------------------------------------------------------
 * LESSON-FORMAT.md §3 tabulates **nine** divergences and names `Variable`,
 * `Button` and `Text Input` among the nodes that "use the same string for
 * both". Re-derived from `node-catalog.json` (175 entries) on 2026-08-14, the
 * real shape is bigger and has a class nobody had written down:
 *
 * | Class | Count | What it is | Verdict |
 * |---|---|---|---|
 * | plain divergence | **103** | display name is not any type name, and maps to exactly one | reject, **suggest** the type name |
 * | ambiguous | **4** | display name maps to two type names (`Array`, `Object`, `Component Object`, `Parent Component Object`) | reject, **no substitution** |
 * | **shadowed** | **6** | the string IS a real type name — of a **deprecated** node — while the node the learner actually places carries it as a *display* name (`Button`, `Checkbox`, `Cloud Function`, `Radio Button`, `Text Input`, `Variable`) | reject, suggest the live type |
 *
 * The shadowed class is the dangerous one and it is why "does this type exist
 * in the catalog?" is not a sufficient check: `%Variable` names a real catalog
 * entry, so a naive existence test passes, but the node the learner drags out
 * of the picker is `Variable2`. `Variable` is in the curriculum spine
 * (CURRICULUM-DESIGN D3 — "Counter first, Variable revealed in L6") and
 * `Button` / `Text Input` are in any beginner lesson, so this is not a
 * theoretical corner.
 *
 * Ambiguity is rejected rather than repaired because an ambiguous name can
 * resolve to the **wrong one of two** rather than to none — failure class F3 in
 * the phase-17 taxonomy, the one the prior arc predicted "nobody expects to see
 * and is worst when it appears" (PRIOR-ART-RECONCILIATION F3). Substituting a
 * type name for the author would be choosing which of two nodes they meant.
 *
 * PURITY
 * ------
 * No editor singletons, no DOM, no MCP, no model call — a pure function of
 * (manifest, catalog). That is deliberate: UNI-010 runs this verifier inside an
 * MCP sidecar with no renderer around it, so anything needing Electron to start
 * would be testable only in the one environment it does not have to work in
 * (the OBS-002 rule this repo's `tests-unit/` exists for).
 *
 * @module noodl-editor/models/lessonverify
 */

import type { NodeCatalog, CatalogNode } from '../validation/CatalogIndex';
import { CatalogIndex } from '../validation/CatalogIndex';
import { defaultCatalog, loadDefaultCatalog } from '../validation/catalog';
import { compileLessonManifest, LessonFormatError } from './lessonformat';
import type { LessonConditionDef, LessonManifest, LessonStepDef } from './lessonformat';

// ─── Findings ───────────────────────────────────────────────────────────────

export type LessonFindingCode =
  /** The string is neither a type name nor a display name. */
  | 'unknown-node-type'
  /** A display name that maps to exactly one type name — fixable by substitution. */
  | 'display-name-used'
  /** A display name that maps to more than one type name — F3, not repairable. */
  | 'ambiguous-display-name'
  /** A real type name, but the deprecated one; a live node carries it as a display name. */
  | 'shadowed-by-deprecated'
  /** A real, unshadowed type name belonging to a deprecated node. */
  | 'deprecated-node-type'
  /** The manifest does not compile — malformed before any vocabulary question arises. */
  | 'malformed-lesson';

export type LessonFindingSeverity = 'error' | 'warning';

export interface LessonFinding {
  code: LessonFindingCode;
  severity: LessonFindingSeverity;
  /** Human location, e.g. `Step 3 ("Add a Group") condition 1`. */
  where: string;
  /** Zero-based step index, when the finding belongs to a step. */
  step?: number;
  /** The offending string, verbatim. */
  value?: string;
  message: string;
  /**
   * The type name the author almost certainly meant. **Absent for
   * `ambiguous-display-name` by design** — see the module note.
   */
  suggestion?: string;
}

export interface LessonVerificationReport {
  /** True when there is no `error`-severity finding. */
  ok: boolean;
  findings: LessonFinding[];
}

// ─── The vocabulary index ───────────────────────────────────────────────────

/** How a string written in a condition relates to the catalog's two vocabularies. */
export interface TypeNameVerdict {
  code: Exclude<LessonFindingCode, 'malformed-lesson'> | 'ok';
  severity?: LessonFindingSeverity;
  message?: string;
  suggestion?: string;
  /** For an ambiguous name, every type name it could mean — reported, never chosen between. */
  candidates?: string[];
}

/**
 * The display-name half of the catalog, which `CatalogIndex` deliberately does
 * not carry (it is a *validator* index and validation never sees display
 * names). Built over the same `NodeCatalog` data so the two cannot drift.
 */
export class LessonVocabulary {
  private readonly byDisplayName = new Map<string, CatalogNode[]>();

  constructor(
    catalog: NodeCatalog,
    /** Reuse the memoised index when there is one; it supplies `hasType`/`suggestType`. */
    private readonly index: CatalogIndex = new CatalogIndex(catalog)
  ) {
    for (const node of catalog.nodes) {
      if (!node.displayName) continue;
      const bucket = this.byDisplayName.get(node.displayName);
      if (bucket) bucket.push(node);
      else this.byDisplayName.set(node.displayName, [node]);
    }
  }

  /** Every catalog entry whose *display* name is `name`. */
  nodesWithDisplayName(name: string): CatalogNode[] {
    return this.byDisplayName.get(name) ?? [];
  }

  /**
   * Classify a string written where a **type name** belongs.
   *
   * The order of the tests matters: the string is checked as a type name first,
   * because the shadowed class is precisely the case where that test succeeds
   * and is still wrong.
   */
  classifyTypeName(name: string): TypeNameVerdict {
    const asType = this.index.getNode(name);
    // Live nodes that would be *displayed* under this string but are not it.
    const liveShadowers = this.nodesWithDisplayName(name).filter((n) => n.typeName !== name && !n.isDeprecated);

    if (asType) {
      // The shadowed class: the string names a real type, so an existence check
      // passes, but that type is retired and the node the learner can actually
      // place under this name is a different one.
      if (asType.isDeprecated && liveShadowers.length === 1) {
        const live = liveShadowers[0].typeName;
        return {
          code: 'shadowed-by-deprecated',
          severity: 'error',
          suggestion: live,
          message:
            `"${name}" is a real node type, but the deprecated one. The node a learner drags out of the ` +
            `picker under the name "${name}" is "${live}", so a condition naming "${name}" will not match it.`
        };
      }
      // A live type name that is *also* another live node's display name has no
      // safe reading at all. No catalog entry does this today; the guard is here
      // so a future catalog change surfaces as a rejection rather than as a
      // lesson that grades the wrong node.
      if (liveShadowers.length > 0) {
        const candidates = [asType.typeName, ...liveShadowers.map((n) => n.typeName)];
        return {
          code: 'ambiguous-display-name',
          severity: 'error',
          candidates,
          message:
            `"${name}" is a node type and also the display name of ${liveShadowers.length} other node type(s) ` +
            `(${liveShadowers.map((n) => `"${n.typeName}"`).join(', ')}). Too ambiguous to use in a condition.`
        };
      }
      if (asType.isDeprecated) {
        return {
          code: 'deprecated-node-type',
          severity: 'warning',
          message: `"${name}" is deprecated and is not offered in the node picker, so a learner cannot place it.`
        };
      }
      return { code: 'ok' };
    }

    const byDisplay = this.nodesWithDisplayName(name);

    if (byDisplay.length === 0) {
      const suggestion = this.index.suggestType(name);
      return {
        code: 'unknown-node-type',
        severity: 'error',
        suggestion,
        message:
          `"${name}" is not a node type or a display name in the catalog.` +
          (suggestion ? ` Did you mean "${suggestion}"?` : '')
      };
    }

    if (byDisplay.length === 1) {
      const typeName = byDisplay[0].typeName;
      return {
        code: 'display-name-used',
        severity: 'error',
        suggestion: typeName,
        message:
          `"${name}" is the display name shown in the node picker; a condition needs the type name "${typeName}". ` +
          `Prose says "${name}", conditions say "${typeName}".`
      };
    }

    // 🔴 No suggestion, on purpose. Substituting would be choosing which of two
    // nodes the author meant, and choosing wrong is failure class F3 — a
    // condition that resolves to the wrong node, silently.
    const candidates = byDisplay.map((n) => n.typeName);
    return {
      code: 'ambiguous-display-name',
      severity: 'error',
      candidates,
      message:
        `"${name}" is a display name shared by ${byDisplay.length} node types ` +
        `(${candidates.map((c) => `"${c}"`).join(', ')}), so it cannot be resolved to one. ` +
        `Write the type name you mean.`
    };
  }
}

let cachedVocabulary: LessonVocabulary | undefined;

/** The vocabulary over the bundled node catalog (memoised, like `loadDefaultCatalog`). */
export function defaultLessonVocabulary(): LessonVocabulary {
  if (!cachedVocabulary) cachedVocabulary = new LessonVocabulary(defaultCatalog(), loadDefaultCatalog());
  return cachedVocabulary;
}

// ─── Where type names appear in a manifest ──────────────────────────────────

/**
 * Pull the type names out of one node path.
 *
 * Path grammar (`findNodeWithPath`): `Component:#label:%Type:idx`. Only
 * `%`-prefixed segments are type names — the first segment is a component name,
 * `#` is a label, and a bare number is a child index. `suggestedNodes` is
 * deliberately not read here: nothing consumes it today
 * (`LessonModel.getCurrentSuggestedNodes` has no callers), so which vocabulary
 * it wants is not established, and inventing one would be worse than the gap.
 */
export function typeNamesInPath(path: string): string[] {
  return path
    .split(':')
    .slice(1)
    .filter((segment) => segment.startsWith('%'))
    .map((segment) => segment.substring(1))
    .filter((name) => name.length > 0);
}

/** Every string in one authored condition that is matched against `node.type.name`. */
export function typeNamesInCondition(def: LessonConditionDef): string[] {
  const d = def as Record<string, unknown>;
  const names: string[] = [];

  if (typeof d.node === 'string') names.push(...typeNamesInPath(d.node));
  if ('hasType' in d && typeof d.hasType === 'string') names.push(d.hasType);

  if ('connection' in d && d.connection && typeof d.connection === 'object') {
    const c = d.connection as Record<string, unknown>;
    if (typeof c.from === 'string') names.push(...typeNamesInPath(c.from));
    if (typeof c.to === 'string') names.push(...typeNamesInPath(c.to));
  }

  return names;
}

function describeStep(step: LessonStepDef | undefined, index: number): string {
  return `Step ${index + 1}${step && step.title ? ` ("${step.title}")` : ''}`;
}

// ─── The verifier ───────────────────────────────────────────────────────────

export interface VerifyLessonOptions {
  vocabulary?: LessonVocabulary;
  /** Skip the compile check when the caller has already compiled the manifest. */
  skipCompile?: boolean;
}

/**
 * Statically verify a lesson manifest against the node catalog.
 *
 * Never throws: a manifest that does not compile comes back as a
 * `malformed-lesson` finding. A verifier that throws on bad input is a verifier
 * whose caller has to guess, and both producers of this format hand it
 * machine-written JSON.
 */
export function verifyLessonManifest(
  manifest: LessonManifest,
  options: VerifyLessonOptions = {}
): LessonVerificationReport {
  const vocabulary = options.vocabulary ?? defaultLessonVocabulary();
  const findings: LessonFinding[] = [];

  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.steps)) {
    return {
      ok: false,
      findings: [
        {
          code: 'malformed-lesson',
          severity: 'error',
          where: 'Lesson',
          message: 'Lesson manifest must be a JSON object with a "steps" array.'
        }
      ]
    };
  }

  // Structural first: an author reading "unknown node type" when the real
  // problem is a missing "node" field is being sent to the wrong place.
  if (!options.skipCompile) {
    try {
      compileLessonManifest(manifest);
    } catch (e) {
      findings.push({
        code: 'malformed-lesson',
        severity: 'error',
        where: 'Lesson',
        message: e instanceof LessonFormatError ? e.message : `Lesson manifest failed to compile: ${String(e)}`
      });
    }
  }

  manifest.steps.forEach((step, stepIndex) => {
    const conditions = step && Array.isArray(step.completeWhen) ? step.completeWhen : [];
    conditions.forEach((def, conditionIndex) => {
      if (!def || typeof def !== 'object') return;
      const where = `${describeStep(step, stepIndex)} condition ${conditionIndex + 1}`;

      for (const name of typeNamesInCondition(def)) {
        const verdict = vocabulary.classifyTypeName(name);
        if (verdict.code === 'ok') continue;
        findings.push({
          code: verdict.code,
          severity: verdict.severity ?? 'error',
          where,
          step: stepIndex,
          value: name,
          message: verdict.message ?? `"${name}" cannot be used as a node type.`,
          ...(verdict.suggestion ? { suggestion: verdict.suggestion } : {})
        });
      }
    });
  });

  return { ok: !findings.some((f) => f.severity === 'error'), findings };
}

/** Parse a `lesson.json` source string and verify it. Never throws. */
export function verifyLessonSource(source: string, options: VerifyLessonOptions = {}): LessonVerificationReport {
  let manifest: LessonManifest;
  try {
    manifest = JSON.parse(source);
  } catch (e) {
    return {
      ok: false,
      findings: [
        {
          code: 'malformed-lesson',
          severity: 'error',
          where: 'Lesson',
          message: `Lesson file is not valid JSON: ${(e as Error).message}`
        }
      ]
    };
  }
  return verifyLessonManifest(manifest, options);
}

/** One-line-per-finding rendering, for a CLI or an MCP tool result. */
export function formatLessonFindings(report: LessonVerificationReport): string {
  if (!report.findings.length) return 'No problems found.';
  return report.findings
    .map((f) => `${f.severity === 'error' ? 'ERROR' : 'WARN '} ${f.where}: ${f.message}`)
    .join('\n');
}
