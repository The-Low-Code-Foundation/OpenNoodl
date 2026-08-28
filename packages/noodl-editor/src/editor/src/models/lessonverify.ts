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
 * A SECOND ROUTE TO THE SAME SILENT FAILURE
 * -----------------------------------------
 * Added 2026-08-15, found while building the install gate that calls this: a
 * node path can be *shaped* so that it never resolves, with no vocabulary
 * question involved at all — `%Group` with the component name left off, or a
 * bare `Group` segment that is read as a child index. Both end in exactly the
 * outcome the two-vocabulary rule exists to prevent, so both are checked here.
 * See {@link nodePathProblems}.
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
import {
  catalogGeneration,
  catalogWithOverlay,
  defaultCatalog,
  loadDefaultCatalog,
  projectCatalog,
  shippedCatalogIndex
} from '../validation/catalog';
import type { OverlayCatalogNode } from '@nodegx/kit-catalog';
import { compileLessonManifest, LessonFormatError, safeLessonUrl } from './lessonformat';
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
  /** A node path whose shape means `findNodeWithPath` can never match it. */
  | 'unmatchable-node-path'
  /** A URL naming a scheme a lesson may not use — `javascript:` and friends. */
  | 'unsafe-url'
  /**
   * TUT-002 / F1 — a collection condition names a collection that neither the starter nor the
   * `solution/` ever creates, so it can never hold.
   *
   * 🔴 Only ever raised when the caller supplies the population to check against
   * ({@link VerifyLessonOptions.knownCollections}). Absence derived from a list nobody provided is
   * not absence, and a verifier that guesses here rejects correct lessons.
   */
  | 'unreachable-collection'
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
/**
 * CN-003 slice 4 — what this vocabulary knows it *cannot* answer.
 *
 * 🔴 The point is CN-002's, one layer up: a check that was skipped must not read
 * as a check that passed, and — the half that bites here — a check that could
 * not run must not read as a check that *failed with a known reason*. Without
 * this, a bundle carrying a kit that declares `demo.kit.Badge` is refused with
 * the sentence *"demo.kit.Badge is not a node type or a display name in the
 * catalog"*, which is simply false about that bundle. The verdict does not
 * change (✅ D4: no quiet downgrades); the **claim** does.
 */
export interface UnresolvedKits {
  /** Whose kits, as a sentence subject: `'This bundle'`, `'The project'`. */
  where: string;
  /** Why they could not be read, when there is something more specific to say. */
  reason?: string;
}

export class LessonVocabulary {
  private readonly byDisplayName = new Map<string, CatalogNode[]>();

  constructor(
    catalog: NodeCatalog,
    /** Reuse the memoised index when there is one; it supplies `hasType`/`suggestType`. */
    private readonly index: CatalogIndex = new CatalogIndex(catalog),
    /**
     * Set when this vocabulary is known to be *incomplete* — kits are present
     * whose node types could not be resolved. Absent means complete, and a
     * caller that cannot tell must say so rather than leave it absent.
     */
    private readonly unresolvedKits?: UnresolvedKits
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

  /** True when this vocabulary is known to be missing some project's kit types. */
  get isIncomplete(): boolean {
    return this.unresolvedKits !== undefined;
  }

  /**
   * The sentence appended to an "I have never heard of this" verdict when we
   * know we have not heard of everything. Empty — not a hedge — when the
   * vocabulary is complete, so a lesson naming a genuine typo still gets the
   * flat answer it deserves.
   */
  private unresolvedKitsCaveat(): string {
    if (!this.unresolvedKits) return '';
    const { where, reason } = this.unresolvedKits;
    return (
      ` ⚠️ ${where} carries at least one node kit whose node types could not be read here` +
      (reason ? ` (${reason})` : '') +
      ', so a type that kit declares is indistinguishable from a typo at this point. ' +
      'Check the spelling against the kit before assuming it is wrong.'
    );
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
          (suggestion ? ` Did you mean "${suggestion}"?` : '') +
          this.unresolvedKitsCaveat()
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

/**
 * The vocabulary over the bundled node catalog (memoised).
 *
 * 🔴 CN-003: **both halves are the shipped catalog**, deliberately. The index
 * used to be `loadDefaultCatalog()`, which now carries the open project's kit
 * types — so this vocabulary would have resolved a kit type through its index
 * while its display-name map, built from `defaultCatalog()`, had never heard of
 * it. Memoised, so which halves it got would have depended on whether a project
 * was open the first time a lesson was verified.
 *
 * ✅ **Slice 4 landed the other two vocabularies rather than changing this one.**
 * {@link projectLessonVocabulary} is for a caller whose subject really is the
 * open project; {@link bundleLessonVocabulary} is for one holding a directory
 * that is not it. This remains the answer for a caller with no project at all.
 */
export function defaultLessonVocabulary(): LessonVocabulary {
  if (!cachedVocabulary) cachedVocabulary = new LessonVocabulary(defaultCatalog(), shippedCatalogIndex());
  return cachedVocabulary;
}

let cachedProjectVocabulary: { generation: number; vocabulary: LessonVocabulary } | undefined;

/**
 * The vocabulary over **the open project**: shipped catalog plus its own kits.
 *
 * For callers whose subject is the project on screen — grading the learner's
 * work, or verifying a lesson being authored against the project it is about.
 * 🔴 **Never for a bundle.** A bundle is a different project, and answering
 * about it with this vocabulary is the wrong-kit failure CN-003 records as its
 * standing trap.
 *
 * Memoised against {@link catalogGeneration}, not forever: both halves move when
 * a project opens, closes or reloads its library, and a vocabulary cached across
 * that boundary is a validator that has never heard of the project it is
 * validating — the exact failure the generation counter exists to prevent one
 * layer down.
 */
export function projectLessonVocabulary(): LessonVocabulary {
  const generation = catalogGeneration();
  if (!cachedProjectVocabulary || cachedProjectVocabulary.generation !== generation) {
    cachedProjectVocabulary = {
      generation,
      vocabulary: new LessonVocabulary(projectCatalog(), loadDefaultCatalog())
    };
  }
  return cachedProjectVocabulary.vocabulary;
}

/**
 * The vocabulary for **a bundle**, built from that bundle's own kit entries.
 *
 * `overlayNodes` is what the caller managed to read from the bundle's directory
 * — `[]` when it has no kits *and* `[]` when it could not tell, which is why
 * `unresolved` is a separate argument rather than something inferred from an
 * empty list. ✅ **D3 decides who can fill it**: the MCP server extracts (it has
 * the headless extractor and the bundle is a project directory like any other),
 * the editor cannot, so the editor's install path passes `[]` with `unresolved`
 * set whenever the bundle carries a `noodl_modules/` it could not read.
 */
export function bundleLessonVocabulary(
  overlayNodes: readonly OverlayCatalogNode[],
  unresolved?: UnresolvedKits
): LessonVocabulary {
  const { catalog, index } = catalogWithOverlay(overlayNodes);
  return new LessonVocabulary(catalog, index, unresolved);
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

/**
 * Problems with the *shape* of a node path, independent of any vocabulary
 * question. Empty when the path can at least in principle match.
 *
 * 🔴 **WHY THIS IS HERE AND NOT ONLY IN THE VOCABULARY CHECK.** Found 2026-08-15
 * while building the install gate that calls this verifier. The two-vocabulary
 * check reads `%`-prefixed segments — and `typeNamesInPath` correctly drops the
 * first segment, because `findNodeWithPath` reads it as a **component name**.
 * The consequence nobody had followed through: a path written as `%Group`, with
 * the component name left off, contains no checked segment at all, so the
 * verifier passes it in silence. At runtime `findNodeWithPath` looks for a
 * *component* called `"%Group"`, finds none, and returns undefined — for ever.
 *
 * That is the same failure the two-vocabulary rule exists to prevent, arrived at
 * by a different route: the step never completes and the learner is told they
 * have not done a thing they have in fact done (LESSON-FORMAT §3's silent
 * failure, class F1). A gate that catches one spelling of never-matches and not
 * the other is not a gate.
 *
 * Only the two unarguable shapes are reported. Component names are *not*
 * checked — this verifier has no project, and a lesson is verified before the
 * project it grades exists.
 */
export function nodePathProblems(path: string): string[] {
  const problems: string[] = [];
  const tokens = path.split(':');

  // The first segment is a component name. A `%` there is the type sigil in the
  // wrong place, which is the mistake an author makes when they think of a path
  // as "the node" rather than as "where the node lives".
  if (tokens[0]?.startsWith('%')) {
    problems.push(
      `"${path}" starts with a node type. A node path starts with the component the node is in, ` +
        `e.g. "App:${tokens[0]}" — as written, this looks for a component literally called "${tokens[0]}" ` +
        `and will never match.`
    );
  }

  // After the first, a segment is `#label`, `%Type`, or a child index. Anything
  // else reaches `nodes[parseFloat(ref)]` and indexes with NaN.
  tokens.slice(1).forEach((segment, i) => {
    if (segment.startsWith('%') || segment.startsWith('#')) return;
    if (!Number.isNaN(parseFloat(segment))) return;
    problems.push(
      `"${path}" segment ${i + 2} ("${segment}") is neither a type ("%${segment}"), a label ` +
        `("#${segment}") nor a child index, so it will never match.`
    );
  });

  return problems;
}

/** Every node path in one authored condition, with the field it was written in. */
export function nodePathsInCondition(def: LessonConditionDef): Array<{ field: string; path: string }> {
  const d = def as Record<string, unknown>;
  const paths: Array<{ field: string; path: string }> = [];

  if (typeof d.node === 'string') paths.push({ field: 'node', path: d.node });

  if ('connection' in d && d.connection && typeof d.connection === 'object') {
    const c = d.connection as Record<string, unknown>;
    if (typeof c.from === 'string') paths.push({ field: 'connection.from', path: c.from });
    if (typeof c.to === 'string') paths.push({ field: 'connection.to', path: c.to });
  }

  return paths;
}

/**
 * Problems with the `routerLists` value, which is a **component legacy name**
 * and not a node path — the one place in the vocabulary where those two live
 * side by side in the same object.
 *
 * 🔴 That adjacency is the whole reason this check exists. `{ node: "…",
 * routerLists: "…" }` puts a node path and a component name one line apart, and
 * the mistake it invites is writing the second in the grammar of the first. A
 * value with a `:` in it is a node path; unscoped it would then be compared
 * against `routes` entries and never match, which is the silent never-completes
 * class F1 exists for.
 *
 * ⚠️ Only the unarguable shape is reported. Whether `/About` names a real
 * component is not checkable here — this verifier has no project, by design.
 */
export function routerListsProblems(value: string): string[] {
  if (!value.includes(':')) return [];
  return [
    `"${value}" looks like a node path. "routerLists" takes a component's legacy name — the same string ` +
      `the router stores in its routes and a RouterNavigate aims at, e.g. "/#__page__/About" — not a ` +
      `"Component:%Type:#Label" address. As written it will never match.`
  ];
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

// ─── URLs a lesson may name ─────────────────────────────────────────────────

/** Markdown links in a prose field. Same pattern the compiler lowers. */
const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Every URL one step declares, with the field it came from.
 *
 * 🔴 **Why the verifier cares about a URL at all.** Compiled step HTML reaches
 * `innerHTML` and `dangerouslySetInnerHTML` inside the editor's own renderer,
 * which has node integration — so a `javascript:` href in a lesson body is
 * arbitrary code with filesystem access, one click away. The compiler now
 * neutralises those at the sink; this reports them so the *author* is told
 * rather than left with a link that silently stopped working.
 *
 * ⚠️ Until the Learning folder existed, lesson content came from one first-party
 * hosted index. It now installs from any folder on disk and UNI-010 makes a
 * language model a producer, which is what promoted this from latent to live.
 */
export function urlsInStep(step: LessonStepDef | undefined): Array<{ field: string; url: string; kind: 'link' | 'media' }> {
  const found: Array<{ field: string; url: string; kind: 'link' | 'media' }> = [];
  if (!step || typeof step !== 'object') return found;

  if (step.media && typeof step.media === 'object' && typeof step.media.src === 'string') {
    found.push({ field: 'media.src', url: step.media.src, kind: 'media' });
  }

  // SYL-001 added `detail`. 🔴 It belongs here, not only at the sink: `renderMarkdown` would drop a
  // `javascript:` href in a step's hand-holding silently, and the author would be left with a link
  // that stopped working and no finding saying why. The neutraliser and the report are a pair, and
  // a field added to one half only has half the protection.
  for (const field of ['title', 'body', 'detail'] as const) {
    const text = step[field];
    if (typeof text !== 'string') continue;
    for (const match of text.matchAll(MARKDOWN_LINK)) {
      found.push({ field, url: match[2], kind: 'link' });
    }
  }

  return found;
}

// ─── The verifier ───────────────────────────────────────────────────────────

export interface VerifyLessonOptions {
  vocabulary?: LessonVocabulary;
  /** Skip the compile check when the caller has already compiled the manifest. */
  skipCompile?: boolean;
  /**
   * TUT-002 / F1 — every collection the bundle's starter or `solution/` is known to create.
   *
   * 🔴 **Omit it and the collection-reachability check does not run at all.** That is the correct
   * default, not a gap: this verifier is handed a manifest alone by two of its three callers, and
   * "absent from a list I was never given" is not evidence of anything. A check that fired anyway
   * would reject every correct data lesson the moment it was verified without a bundle around it.
   * The bundle harness, which *does* know both projects, is the caller that supplies it.
   *
   * Compared case-insensitively, because SQLite identifiers are.
   *
   * 🔴 **NO PRODUCTION CALLER SUPPLIES THIS YET (TUT-002, session 2).** `lessonbundleverify` is the
   * intended one and cannot until it can read a bundle's collections — TUT-002 AC3. Until then the
   * collection-reachability check is specced and dormant, and a data lesson can ship with a
   * condition naming a collection nothing creates. Do not read the green suite as coverage.
   */
  knownCollections?: string[];
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
  // TUT-002: `undefined` (not supplied) and an empty array (supplied, and empty) are different
  // answers, and only the second is evidence. See `VerifyLessonOptions.knownCollections`.
  const knownNames = options.knownCollections?.map((c) => c.trim()).filter((c) => c !== '');
  // Matched case-insensitively, but REPORTED verbatim: an author told to "correct the name to one
  // of: owners, puppies" types exactly that, and `Owners` is what the solution actually creates.
  const known = knownNames ? new Set(knownNames.map((c) => c.toLowerCase())) : undefined;

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
    for (const { field, url, kind } of urlsInStep(step)) {
      if (safeLessonUrl(url, kind)) continue;
      findings.push({
        code: 'unsafe-url',
        severity: 'error',
        where: `${describeStep(step, stepIndex)} ("${field}")`,
        step: stepIndex,
        value: url,
        message:
          `"${url}" names a scheme a lesson may not use. Lesson content is rendered inside the editor, ` +
          `so only http, https, mailto${kind === 'media' ? ', data:image/' : ''} and relative paths are allowed.`
      });
    }

    const conditions = step && Array.isArray(step.completeWhen) ? step.completeWhen : [];
    conditions.forEach((def, conditionIndex) => {
      if (!def || typeof def !== 'object') return;
      const where = `${describeStep(step, stepIndex)} condition ${conditionIndex + 1}`;

      // Shape before vocabulary: a path that can never resolve is not improved
      // by being told its type name is spelt correctly.
      for (const { field, path } of nodePathsInCondition(def)) {
        for (const message of nodePathProblems(path)) {
          findings.push({
            code: 'unmatchable-node-path',
            severity: 'error',
            where: `${where} ("${field}")`,
            step: stepIndex,
            value: path,
            message
          });
        }
      }

      // TUT-002 / F1 — a collection condition that can never hold.
      const collection = (def as Record<string, unknown>).collection;
      const isCollectionDef =
        'collectionExists' in (def as Record<string, unknown>) ||
        'hasColumns' in (def as Record<string, unknown>) ||
        'rowCountAtLeast' in (def as Record<string, unknown>);

      if (isCollectionDef && known !== undefined) {
        // 🔴 `collectionExists: false` is the one collection condition that is *supposed* to name a
        // collection nothing creates — "you have not made it yet" is a legitimate step. Flagging it
        // would be a gate rejecting the correct answer.
        const assertsPresence = (def as Record<string, unknown>).collectionExists !== false;
        const name = typeof collection === 'string' ? collection.trim() : '';

        if (assertsPresence && name !== '' && !known.has(name.toLowerCase())) {
          findings.push({
            code: 'unreachable-collection',
            severity: 'error',
            where: `${where} ("collection")`,
            step: stepIndex,
            value: name,
            message:
              `No collection named "${name}" is created by the starter project or by the lesson's ` +
              `own solution, so this condition can never hold. Either create "${name}" in the ` +
              `solution, or correct the name to one of: ${[...(knownNames ?? [])].sort().join(', ') || '(none)'}.`
          });
        }
      }

      const routerLists = (def as Record<string, unknown>).routerLists;
      if (typeof routerLists === 'string') {
        for (const message of routerListsProblems(routerLists)) {
          findings.push({
            code: 'unmatchable-node-path',
            severity: 'error',
            where: `${where} ("routerLists")`,
            step: stepIndex,
            value: routerLists,
            message
          });
        }
      }

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
