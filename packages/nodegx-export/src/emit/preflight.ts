/**
 * The pre-flight summary — EXP-004's *before you export* surface.
 *
 * ## What this is for
 *
 * `EXPORT-REPORT.md` (see {@link module:emit/report}) is the account an author reads *after* the
 * export, inside the app they now own. EXP-004 asks for one more moment: **before** they pick a
 * directory and write sixty files, tell them what they are about to get, so the decision to
 * proceed is made with accurate expectations rather than with the word "export".
 *
 * Same facts, earlier moment, and much shorter — this is a thing someone reads in a dialog and
 * then clicks a button, not a document they study.
 *
 * ## 🔴 It is exact, and it is deliberately not an estimate
 *
 * EXP-004's own wording is *"pre-flight **estimate**"*, and its testing plan asks that the
 * estimate "match the actual outcome within a reasonable margin". **That premise does not survive
 * contact with this pipeline, and the honest thing is to say so rather than to build a
 * deliberately worse predictor so that a margin exists to measure.**
 *
 * `emitApp` is pure: it reads nothing, writes nothing, and returns the files as strings. Writing
 * them to disk is the caller's separate act (`scripts/emit-app.ts`). So the cost of knowing the
 * real answer is the cost of running the generator — about a tenth of a second on every project in
 * the corpus — and there is no reason whatever to approximate a number you can simply compute.
 * A margin here would be a defect, not a tolerance.
 *
 * ⚠️ **The cheap alternative was measured before this was written, because it is the one a future
 * session will reach for.** The obvious "estimate" is to stop after `planProject` and skip
 * emission — that is where most refusals are decided (§20.1), and it looks like the same answer
 * for less work. Over the seven fixtures it is **not** the same answer: the plan layer files 28
 * refusals where the export files 32. The missing four are all decided during emission — three
 * `parameter … has no style/content mapping` on `puppy-test-3` and one retired kit parameter on
 * `kits` — and they are invisible to any analysis that stops before the generator runs.
 *
 * 🔴 **That divergence happens to be invisible at component level today, and that is a fact about
 * the corpus rather than a property of the layers.** No fixture currently has a component whose
 * *only* refusals are emit-layer ones, so a plan-layer pre-flight would still sort every component
 * onto the correct side of "clean". Nothing makes that hold: a component with one unmapped
 * `padding` and no dropped wires would be called clean and export dirty. The control pair in
 * `tests/preflight.test.ts` asserts the two layers **disagree** on the totals, which is what keeps
 * this paragraph honest — a cheap-layer rewrite reddens a row instead of quietly under-reporting.
 *
 * ## The framing rules are `report.ts`'s, and they are the actual work
 *
 * - **Lead with what worked.** Counts and whole components first; a project with nothing to report
 *   never renders a list of problems, because there are none to render.
 * - **Be specific, not statistical.** No percentages and no confidence score. Components are named
 *   and their refusals counted.
 * - **Never let unverified code look verified.** Nothing has been run here either — less so, in
 *   fact, since at this point nothing has even been written.
 *
 * @module emit/preflight
 */

import { Catalog } from '../catalog';
import { ExportIR } from '../ir/types';
import { emitApp, EmittedApp } from './emitApp';
import { BackendMode, backendMode, REPORT_PATH } from './report';

/** A component that will emit a file, but with refusals recorded against it. */
export interface PreflightAttention {
  path: string;
  file: string;
  /** How many nodes, wires or parameters the export will leave out of this component. */
  refusals: number;
  unreachable: boolean;
}

/** A component that will emit no file at all. */
export interface PreflightNoFile {
  path: string;
  reason: string;
  /**
   * `scaffolded` is done — the app shell covers it. `deferred` is not. They are opposite news and
   * the discriminator is carried from the two sites in `plan.ts` that know, never read back out of
   * the sentence.
   */
  kind: 'scaffolded' | 'deferred';
}

export interface PreflightSummary {
  projectName: string;
  /**
   * Files the export will generate, `EXPORT-REPORT.md` included — the number the author will see
   * in the folder afterwards.
   */
  generatedFiles: number;
  /**
   * Assets that travel byte-for-byte beside them: a kit's script, an icon set's `.woff2`,
   * Inter's four `.ttf` (EXP-010 AC5).
   *
   * 🔴 **Counted separately and never folded into {@link generatedFiles}, because they are a
   * separate channel that has already been dropped once.** `emitApp` returns `files` and `copies`
   * as two lists, and §19.6 records the one shipped runner writing only the first — an author's
   * fonts silently absent from their repo, every gate green. A pre-flight that promised
   * "33 files" and delivered 45 would be describing the same defect from the other end.
   */
  copiedAssets: number;
  /** Pages and components that will emit a file. */
  pages: number;
  components: number;
  /** Paths of the components that will translate with nothing left over, in emission order. */
  whole: string[];
  /** The rest, worst first. */
  attention: PreflightAttention[];
  noFile: PreflightNoFile[];
  /**
   * Every item the export will list as not translated: each component-level refusal, each
   * component that emits **no file at all**, each kit that contributes no nodes, and each line
   * about the project as a whole. This is the length of the list `EXPORT-REPORT.md` will print.
   *
   * 🔴 **A component that emits no file is in this number, and the first draft left it out.** It
   * counted only the refusals recorded *inside* generated components, so `puppy-test-3` announced
   * "18" and then printed nineteen bullets — the extra being `Components/BenchLogicProbe`, which
   * is not a node dropped from a file but a whole component with no file. That is the largest
   * thing an export can leave out, and it was the one thing the headline number could not see.
   */
  refusals: number;
  /** Components with no generated file that are *not* handled by the app shell — counted above. */
  noFileDeferred: number;
  backend: BackendMode;
  backendEndpoint: string | null;
  /** `src/api/http.ts` — real generated calls to the addresses the author typed, never stubs. */
  httpModule: boolean;
  /** Kits that will ship their files but contribute none of their nodes. */
  moduleFailures: number;
  /** Refusals about the project rather than any one component (cloud functions, chiefly). */
  projectRefusals: number;
}

/**
 * The summary, from an export that has already been generated in memory.
 *
 * 🔴 **Everything here is read off `EmittedApp`, and nothing is recomputed.** The pre-flight and
 * the report are two renderings of one set of facts; the moment this function starts deciding for
 * itself whether a component counts as whole, the surface an author reads *before* exporting and
 * the one they read *after* can disagree about the same project — which is the failure EXP-004's
 * risk table calls "the report drifting out of sync with what the generators actually do",
 * arriving through a door the risk table did not think to name.
 */
export function summarizePreflight(app: EmittedApp): PreflightSummary {
  const data = app.report;
  const generated = data.components.filter((c) => c.file !== null);

  const attention = generated
    .filter((c) => c.notes.length > 0)
    .map((c) => ({
      path: c.path,
      // Narrowed by the `file !== null` filter above; the cast keeps that fact local rather than
      // widening `file` to `string | null` across the whole summary.
      file: c.file as string,
      refusals: c.notes.length,
      unreachable: c.unreachable
    }))
    /*
     * Worst first, then by path.
     *
     * ⚠️ **The tie-break is for the reader, not for determinism** — an earlier comment here
     * claimed the latter and was wrong. `Array.prototype.sort` is stable by specification, so
     * equal counts would come out in emission order, which is just as reproducible. What it would
     * not be is *predictable*: `puppy-test-3` has two components on four refusals each, and
     * without this their order is a fact about which component the planner reached first, which
     * moves when an unrelated component is added. Alphabetical among equals is the order a person
     * scanning the list expects, and it holds still.
     *
     * 🔴 **Unobservable on today's corpus, and recorded as unobservable rather than claimed.**
     * Removing the tie-break is an *equivalent* mutant: the tied pair's emission order already
     * happens to be alphabetical, so every fixture renders byte-identical output either way. The
     * row asserting the ordering is not vacuous — dropping the sort, or reversing it, both redden
     * it — but nothing in the corpus distinguishes this clause from its absence. It stays for the
     * shape the corpus does not yet hold: a tie whose emission order is not alphabetical.
     */
    .sort((a, b) => b.refusals - a.refusals || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const componentRefusals = generated.reduce((total, c) => total + c.notes.length, 0);
  const noFile = data.components
    .filter((c) => c.file === null && c.skipped !== undefined)
    .map((c) => ({
      path: c.path,
      reason: (c.skipped as { reason: string }).reason,
      kind: (c.skipped as { kind: 'scaffolded' | 'deferred' }).kind
    }));
  const noFileDeferred = noFile.filter((c) => c.kind === 'deferred').length;

  return {
    projectName: data.projectName,
    generatedFiles: data.files.length,
    copiedAssets: app.copies.length,
    pages: generated.filter((c) => c.role === 'page').length,
    components: generated.filter((c) => c.role === 'component').length,
    whole: generated.filter((c) => c.notes.length === 0).map((c) => c.path),
    attention,
    noFile,
    refusals: componentRefusals + noFileDeferred + data.modules.length + data.project.length,
    noFileDeferred,
    backend: backendMode(data),
    backendEndpoint: data.backendEndpoint,
    httpModule: data.httpModule,
    moduleFailures: data.modules.length,
    projectRefusals: data.project.length
  };
}

/**
 * Generate the app in memory and summarise it, writing nothing.
 *
 * This is the whole of the "pre" in pre-flight: the export runs, and its output is discarded
 * rather than committed to a directory the author has not yet chosen.
 */
export function preflight(ir: ExportIR, catalog: Catalog): PreflightSummary {
  return summarizePreflight(emitApp(ir, catalog));
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * The pre-flight as text an author reads and then decides on.
 *
 * Pure, and deliberately much shorter than `renderReport` — this is read standing up. It names
 * what will be built, names every component that will come out incomplete, and says plainly that
 * the full reasons travel with the app rather than repeating them here.
 */
export function renderPreflight(s: PreflightSummary): string {
  const out: string[] = [];
  out.push(`# Before you export — ${s.projectName}`);
  out.push('');
  out.push('This is what the export will produce. **Nothing has been written yet.**');
  out.push('');

  // ── Lead with what worked ──────────────────────────────────────────────────
  out.push('## What you will get');
  out.push('');
  const built = [
    s.pages > 0 ? plural(s.pages, 'page') : null,
    s.components > 0 ? plural(s.components, 'component') : null
  ].filter((part): part is string => part !== null);
  out.push(
    `- **${plural(s.generatedFiles, 'file')}**${built.length > 0 ? ` — ${built.join(' and ')},` : ' —'} ` +
      'plus the app shell, styles and build config'
  );
  if (s.copiedAssets > 0) {
    out.push(
      `- **${plural(s.copiedAssets, 'file')} copied across unchanged** from your kits — scripts, ` +
        'fonts and icon sets, byte for byte'
    );
  }
  if (s.backend === 'connected') {
    out.push(`- **Data access** in \`src/api/\`, calling your NodeGX backend at \`${s.backendEndpoint}\``);
  } else if (s.backend === 'stubbed') {
    out.push(
      '- **Data access** in `src/api/`, as **stubs** — reads answer empty and writes throw. This ' +
        'project declares no backend, so there is nothing to point them at'
    );
  }
  if (s.httpModule) {
    out.push('- **Your `HTTP Request` calls** in `src/api/http.ts` — real code, calling the addresses you typed');
  }
  const translated = s.whole.length;
  const totalGenerated = translated + s.attention.length;
  if (translated > 0) {
    // ⚠️ No noun here on purpose. The bullet above already said "4 pages and 6 components", and
    // calling the same ten "components" a line later reads as a second, smaller set.
    out.push(
      translated === totalGenerated
        ? `- **All ${totalGenerated}** come out with nothing left over`
        : `- **${translated} of the ${totalGenerated}** come out with nothing left over`
    );
  }
  const scaffolded = s.noFile.filter((c) => c.kind === 'scaffolded');
  for (const c of scaffolded) out.push(`- \`${c.path}\` — ${c.reason}`);
  out.push('');

  // ── Then, and only then, what is missing ───────────────────────────────────
  const deferred = s.noFile.filter((c) => c.kind === 'deferred');
  if (s.refusals === 0) {
    out.push('## What will not translate');
    out.push('');
    out.push(
      '**Nothing.** Every node and every wire in this project has a translation, and the export ' +
        'refuses none of them.'
    );
    out.push('');
  } else {
    out.push(`## What will not translate (${s.refusals})`);
    out.push('');
    out.push(
      // ⚠️ "or a whole component" is load-bearing. The list can contain an entry that is not a
      // node, wire or parameter at all, and a sentence that promised only those three would be
      // describing a different list from the one printed directly beneath it.
      'Each one is a node, wire, parameter — or a whole component — that the export has no rule ' +
        'for. It will be **left out**, not translated wrongly, and the running app will be missing ' +
        'that behaviour until you write it.'
    );
    out.push('');
    if (deferred.length > 0) {
      for (const c of deferred) out.push(`- \`${c.path}\` — **no file at all**: ${c.reason}`);
    }
    for (const c of s.attention) {
      out.push(
        `- \`${c.path}\` — ${plural(c.refusals, 'refusal')}` +
          (c.unreachable ? ', and no route reaches this component' : '')
      );
    }
    if (s.moduleFailures > 0) {
      out.push(
        `- **${plural(s.moduleFailures, 'kit')}** will ship ${s.moduleFailures === 1 ? 'its files' : 'their files'} ` +
          `but contribute ${s.moduleFailures === 1 ? 'no node' : 'no nodes'}`
      );
    }
    if (s.projectRefusals > 0) {
      out.push(`- **${plural(s.projectRefusals, 'thing')}** about the project as a whole`);
    }
    out.push('');
    out.push(
      `The reason for every one of them, in the exporter's own words, is written into the app as ` +
        `\`${REPORT_PATH}\` when you proceed.`
    );
    out.push('');
  }

  // ── The honesty section, which is shorter here and says less on purpose ────
  out.push('## What this export will claim, and what it will not');
  out.push('');
  out.push(
    'Every line will be generated by rule, and **nothing will be run**. Where the exporter has a ' +
      'rule for a node it emits code from it; where it does not, it refuses and says so. It never ' +
      'guesses — and it never executes your graph, records its behaviour, or compares the ' +
      'generated code against it.'
  );
  out.push('');
  out.push(
    'The export is also **one-way**: the code will not sync back, and re-exporting overwrites ' +
      'whatever you changed in it.'
  );
  out.push('');

  return out.join('\n');
}
