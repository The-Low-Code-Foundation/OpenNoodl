/**
 * UNI-010 slice 2 — `create_lesson`, `check_lesson` and the brief they hand out.
 *
 * ## What this surface is for
 *
 * The 2026-08-14 ruling let a model author lesson completion conditions directly
 * — overturning the prior arc's "the model fills slots, it never authors
 * predicates" — and priced it exactly: *free authoring stands, and in exchange
 * the verifier must absorb the full F1–F6 taxonomy.* Slice 1 built that gate.
 * This is the door a model reaches it through.
 *
 * 🔴 **Four tools, and the order matters.** `get_lesson_brief` first, because the
 * condition vocabulary is not guessable and a model that starts writing will
 * write `paramsEq` and `hasConnection`, neither of which exists. Then build the
 * **solution** with the ordinary authoring tools and `derive_starter` the other
 * project out of it. Then `create_lesson`, which scores the pair and writes a
 * bundle only if every machine-checkable class passed.
 *
 * ✅ **`derive_starter` is why the order is now four steps rather than three, and
 * it is not an ergonomic tidy-up.** The criterion-3 run authored five lessons and
 * built every starter by subtraction from the solution — and the ghostwriting
 * refusal (*"this step is already complete in the project the learner opens"*)
 * fired **zero times in five lessons**. Its own §11 reads that number as an upper
 * bound rather than a result: subtraction makes the mistake structurally hard to
 * commit, and a model building the two projects *independently* is far more
 * exposed to it, because the natural way to author a lesson is to build the
 * finished thing and describe it. This makes the safe route the cheap one.
 *
 * ⚠️ **`create_lesson` writes a folder and nothing else.** It does not install
 * anything: D5 gives the Learning section's register to the editor process, and a
 * sidecar writing launcher state would be wrong on the bridge direction as well
 * as on the ruling. The learner installs the folder through the launcher, where
 * the editor's own gate runs again — and the manifest's `authoredBy: "ai"` stamp
 * makes it run in its stricter form.
 *
 * @module noodl-mcp/tools/lessonTools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { EXAMPLE_MANIFEST, lessonAuthoringBrief } from '../lessons/authoringBrief';
import { nodeBundleFs, scoreLesson, writeLessonBundle } from '../lessons/bundleWriter';
import { lessonDatabaseFromBackend } from '../lessons/lessonDatabase';
import { writeDerivedStarter } from '../lessons/starterWriter';
import { createWholeSolutionGrader } from '../lessons/wholeSolutionGrader';
import { formatBundleScorecard, readLessonBundle, SOLUTION_DIR, verifyLessonBundle } from '../editor-deps';
import type { LessonManifest } from '../editor-deps';
import { buildLessonEvalContext } from '../editor-deps';
import { bundleVocabularyFor } from '../lessons/bundleVocabulary';
import { ToolError } from '../errors';
import { guarded, jsonResult, type ToolResult } from './util';

/**
 * The manifest arrives as an opaque object on purpose.
 *
 * Re-declaring the lesson format in zod here would be a second statement of it,
 * and the two would drift — which is the exact failure the shared `editor-deps`
 * barrel exists to prevent. The real check is `verifyLessonBundle`, which is the
 * same one the editor runs, and its refusals are written for a model to act on.
 * All this schema does is insist on the shape of the outer envelope so a caller
 * passing a string gets a sentence rather than a stack trace.
 */
const manifestSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    format: z.string().optional(),
    steps: z.array(z.record(z.string(), z.unknown()))
  })
  .passthrough();

function asManifest(value: unknown): LessonManifest {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { steps?: unknown }).steps)) {
    throw new ToolError(
      'invalid-argument',
      'The manifest must be an object with a `steps` array. Call get_lesson_brief for the format.'
    );
  }
  return value as LessonManifest;
}

export function registerLessonTools(server: McpServer): void {
  // ─── The brief ────────────────────────────────────────────────────────────
  server.registerTool(
    'get_lesson_brief',
    {
      title: 'How to write a lesson',
      description:
        'READ THIS BEFORE AUTHORING A LESSON. The bundle layout, the manifest format, the node-path grammar, ' +
        'the complete condition vocabulary with a worked example of every verb, and the four traps that make a ' +
        'plausible-looking lesson silently unfinishable. The vocabulary is not guessable — it is `hasParams` ' +
        '(an array), `paramsEqual`, and a bare `connection` key — so writing a manifest without this call ' +
        'costs a round trip.',
      inputSchema: {}
    },
    guarded(
      async (): Promise<ToolResult> => ({ content: [{ type: 'text', text: lessonAuthoringBrief() }] })
    )
  );

  // ─── Create ───────────────────────────────────────────────────────────────
  server.registerTool(
    'create_lesson',
    {
      title: 'Create a lesson bundle',
      description:
        'Score a lesson against its own starter and solution projects, and write the bundle ONLY if every ' +
        'machine-checkable failure class passes. Refusals name the step, the class and what to change. ' +
        'Call get_lesson_brief first. The result is a folder on disk — install it from the editor launcher\'s ' +
        'Learning section; this server deliberately does not write the editor\'s state.',
      inputSchema: {
        bundle_dir: z.string().describe('Where to write the bundle. Created if it does not exist.'),
        starter_dir: z.string().describe('The project directory the learner opens — the lesson NOT yet done'),
        solution_dir: z
          .string()
          .describe("The project directory holding the lesson's own answer — the graph after EVERY step"),
        manifest: manifestSchema.describe('The lesson.json content: title, description and steps'),
        allow_unrendered: z
          .boolean()
          .optional()
          .describe(
            'Write even if the solution could not be rendered (no Chrome / no viewer build), leaving F4 — ' +
              '"the solution draws nothing" — deliberately unchecked. Off by default.'
          )
      }
    },
    guarded(
      async (args: {
        bundle_dir: string;
        starter_dir: string;
        solution_dir: string;
        manifest: unknown;
        allow_unrendered?: boolean;
      }): Promise<ToolResult> => {
        const result = await writeLessonBundle(asManifest(args.manifest), {
          bundleDir: args.bundle_dir,
          starterDir: args.starter_dir,
          solutionDir: args.solution_dir,
          ...(args.allow_unrendered ? { allowUnrendered: true } : {})
        });

        return jsonResult({
          written: result.written,
          bundle_dir: result.bundleDir,
          classes: result.scorecard.classes,
          graded_steps: result.scorecard.gradedSteps,
          scorecard: result.report,
          ...(result.refusal ? { refused_because: result.refusal } : {}),
          next_step: result.written
            ? `The bundle is at ${result.bundleDir}. In the NodeGX editor's launcher, open the Learning ` +
              'section and choose "Install from a folder", then point it at that directory. It will be ' +
              'labelled as AI-authored.'
            : 'Nothing was written. Fix what the scorecard names and call create_lesson again.'
        });
      }
    )
  );

  // ─── Derive the starter ───────────────────────────────────────────────────
  // 🔴 Registered HERE, inside `registerLessonTools`, and that placement is the
  // whole of whether it costs anything. `server.ts` calls
  // `disclosure.applyPolicy` once, after every registration; a tool registered
  // after that call is resident no matter which group the manifest puts it in,
  // and nothing asserts otherwise for this group.
  server.registerTool(
    'derive_starter',
    {
      title: 'Derive a lesson starter from its solution',
      description:
        "Build the lesson's STARTER project by subtracting its own steps from the finished solution — the " +
        'route that makes ghostwriting structurally hard, rather than merely checked for. The condition verb ' +
        'decides what comes out: hasType/exists/hasLabel remove the node, hasParams/paramsEqual unset those ' +
        'parameters and keep it, connection removes the wire, routerLists un-lists the page. It then REPLAYS ' +
        'every graded step against what it produced and writes nothing if any step is still complete.',
      inputSchema: {
        solution_dir: z
          .string()
          .describe("The finished project — the graph after EVERY step. Not modified."),
        starter_dir: z
          .string()
          .describe('Where to write the starter. Must be new or empty, and outside solution_dir.'),
        manifest: manifestSchema.describe('The same lesson.json you will pass to create_lesson')
      }
    },
    guarded(
      async (args: { solution_dir: string; starter_dir: string; manifest: unknown }): Promise<ToolResult> => {
        const result = writeDerivedStarter(asManifest(args.manifest), {
          solutionDir: args.solution_dir,
          starterDir: args.starter_dir
        });

        return jsonResult({
          written: result.written,
          starter_dir: result.starterDir,
          // Per step and per condition, because "a starter was derived" is not
          // something an authoring model can check its own prose against and
          // "step 2: removed the Text, kept the Page" is.
          retractions: result.retractions,
          ...(result.stillSatisfied.length ? { still_complete_in_starter: result.stillSatisfied } : {}),
          ...(result.droppedFromCopy.length ? { dropped_from_copy: result.droppedFromCopy } : {}),
          // A component the learner CREATES is not in the starter at all — its
          // directory and registry entry are gone, not emptied (P79 L1).
          ...(result.removedComponents.length ? { removed_components: result.removedComponents } : {}),
          ...(result.refusal ? { refused_because: result.refusal } : {}),
          next_step: result.written
            ? `The starter is at ${result.starterDir}. Read the retractions against your step prose — the ` +
              'subtraction is only as good as the conditions, and a condition that checks less than the prose ' +
              'asks for produces a starter that gives part of the answer away. Then call create_lesson with ' +
              'this starter_dir and the same solution_dir.'
            : 'Nothing was written. Fix what the refusal names and call derive_starter again.'
        });
      }
    )
  );

  // ─── Check ────────────────────────────────────────────────────────────────
  server.registerTool(
    'check_lesson',
    {
      title: 'Check an existing lesson bundle',
      description:
        'Score a lesson bundle that already exists on disk — its manifest, its starter and the solution/ ' +
        'folder inside it — without writing anything. Use it to re-check a bundle you have edited by hand, ' +
        'or to find out why one is being refused at install.',
      inputSchema: {
        bundle_dir: z.string().describe('A lesson bundle: project files, lesson.json, and a solution/ folder'),
        render: z
          .boolean()
          .optional()
          .describe('Render the solution to answer F4 ("does it draw?"). Takes ~8s. On by default.'),
        backend_id: z
          .string()
          .optional()
          .describe(
            'A built-in backend to replay collectionExists / hasColumns / rowCountAtLeast against, started ' +
              'if it is not running. WITHOUT it those conditions are reported as not-checkable — a bundle on ' +
              'disk holds no data — and only their collection NAMES are checked. Name one to find out whether ' +
              'the tables and columns the lesson grades actually exist.'
          )
      }
    },
    guarded(
      async (args: { bundle_dir: string; render?: boolean; backend_id?: string }): Promise<ToolResult> => {
        const bundle = readLessonBundle(args.bundle_dir, nodeBundleFs);
        if (!bundle.manifest) {
          throw new ToolError('invalid-argument', bundle.problems.join(' '));
        }

        // ⚠️ A bundle read off disk gets the scorecard, problems and all —
        // including "there is no solution/". `scoreLesson` insists on both
        // projects because its caller is *producing* one; this path is
        // diagnosing, and refusing to report on a bundle because it is
        // incomplete would withhold the one answer the caller wants.
        // 🔴 CN-003 slice 4 — read the bundle's *own* kits, from the directory
        // being diagnosed. Nothing here may fall back to the bound project's:
        // this tool is pointed at an arbitrary bundle_dir, and answering about
        // the wrong kit is the failure CN-003 records as its standing trap.
        const kits = bundleVocabularyFor(args.bundle_dir);

        // TUT-002 AC3 — the sidecar's context filler, and it is opt-in for a reason worth
        // keeping in view: absent, the collection verbs are reported as not-checkable and F1
        // checks their names; present, they are replayed for real. Reported below either way, so
        // "checked against a database" and "not checked at all" cannot read the same.
        const database = args.backend_id ? await lessonDatabaseFromBackend(args.backend_id) : undefined;

        const scorecard = await verifyLessonBundle(bundle.manifest, {
          ...(bundle.starter
            ? { starter: buildLessonEvalContext({ ...bundle.starter, ...(database ? { database } : {}) }, { catalog: kits.catalog }) }
            : {}),
          ...(bundle.solution
            ? { solution: buildLessonEvalContext({ ...bundle.solution, ...(database ? { database } : {}) }, { catalog: kits.catalog }) }
            : {}),
          ...(bundle.solution && args.render !== false
            ? { wholeSolution: createWholeSolutionGrader(nodeBundleFs.join(args.bundle_dir, SOLUTION_DIR)) }
            : {}),
          verify: { vocabulary: kits.vocabulary }
        });

        // Reported, never folded into the scorecard: "this bundle declares five
        // node types of its own" and "its kit would not load" are facts about the
        // *bundle*, and a caller that cannot see the difference between them will
        // read an empty answer as a clean one.
        const kitNote = kits.overlay.unavailable
          ? { kits_unavailable: kits.overlay.unavailable.reason }
          : kits.overlay.kits.length > 0
            ? {
                kits: kits.overlay.kits.map((k) => k.kitModule),
                kit_node_types: kits.overlay.nodes.map((n) => n.typeName),
                ...(kits.overlay.failures.length
                  ? { kit_failures: kits.overlay.failures.map((f) => `${f.kitModule}: ${f.message}`) }
                  : {})
              }
            : {};

        return jsonResult({
          classes: scorecard.classes,
          graded_steps: scorecard.gradedSteps,
          scorecard: formatBundleScorecard(scorecard),
          ...kitNote,
          // TUT-002 — said out loud, because "the data conditions passed" and "the data
          // conditions were never asked" are the same silence otherwise.
          ...(database
            ? {
                database:
                  database.status === 'ok'
                    ? { status: 'ok', collections: database.collections.map((c) => c.name) }
                    : database
              }
            : {}),
          ...(bundle.problems.length ? { bundle_problems: bundle.problems } : {})
        });
      }
    )
  );
}

/** Exported for the specs — the brief's worked example, as the tools describe it. */
export const LESSON_BRIEF_EXAMPLE = EXAMPLE_MANIFEST;

/** Exported for the specs, so a scorecard can be asserted without a tool call. */
export { scoreLesson };
