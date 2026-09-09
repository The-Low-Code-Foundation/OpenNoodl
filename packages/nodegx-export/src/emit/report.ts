/**
 * `EXPORT-REPORT.md` — the report the exported app carries with it (EXP-004).
 *
 * ## Why this file exists
 *
 * Two generated `TODO(export)` markers have ended with *"See the export report"* since EXP-002,
 * and there was no report. Everything the export dropped or refused went to `EmittedApp.notes`,
 * which the runner printed to **stderr** — so an author who ran the export and opened
 * the repo saw markers pointing at a document that did not exist, and a scrollback they no longer
 * had. This is that document, written into the app beside the code it is about.
 *
 * ## The framing rules, which are the actual work
 *
 * EXP-004's own words, and each one is visible in the output below:
 *
 * - **Lead with what worked.** A report opening on a list of problems reads as failure even when
 *   the export went well. The counts and the whole-component list come first, and a project with
 *   nothing to report never renders an "attention" section at all.
 * - **Be specific, not statistical.** No percentages and no confidence score. Every refusal is a
 *   named component, a named node or wire, and the exporter's own sentence for why.
 * - **Never let unverified code look verified.** ⚠️ This is the one that constrains wording
 *   hardest, and the honest statement today is *narrower* than EXP-004 anticipated: EXP-003's AI
 *   translation and trace verification do not exist yet, so nothing in a generated app has been
 *   run, replayed or compared against anything. The report says that in those words. When
 *   EXP-003 lands, this section gains a verdict per translation — it must not gain the word
 *   "verified" before then.
 *
 * ## 🔴 No timestamp, and that is not an oversight
 *
 * The generators are deterministic (EXP-002-DETERMINISTIC-GENERATORS): the same project emits the
 * same bytes, which is what makes the goldens a regression net and what lets a user diff two
 * exports. A date line would change every byte-comparison in the suite and turn "nothing changed"
 * into noise. The report carries no clock, no random id and no absolute path.
 *
 * ## Where the structure comes from
 *
 * 🔴 **Grouping is by what the caller already knew, never by reading the prose back.** `emitApp`
 * pushes a component's notes inside the loop that owns `plan`, so scope is a fact at the push
 * site; `skipKind` discriminates the router shell from a logic-only component because the two
 * sentences would otherwise have to be told apart by matching their words. A report that grouped
 * by parsing `notes` would mis-file the first time anyone reworded a refusal — and rewording
 * refusals is the ordinary business of this package.
 *
 * @module emit/report
 */

import { RefusedNode } from '../ir/types';

export const REPORT_PATH = 'EXPORT-REPORT.md';

/** One component, as the report talks about it. */
export interface ReportComponent {
  /** "Pages/Home", "Components/PuppyCard". */
  path: string;
  role: 'page' | 'component';
  /** The file it emitted, or `null` when it emitted none. */
  file: string | null;
  /**
   * Everything dropped or deferred inside it, in emission order, with the exporter's own
   * reason. Already stripped of the `"<path>: "` prefix the emitter writes onto each one.
   */
  notes: string[];
  /**
   * No route reaches this component. Reported, never acted on — it changes how the notes above
   * read (a refusal in unreachable code is not a gap in the export's reach), so it is stated
   * beside them rather than filtering them out.
   */
  unreachable: boolean;
  /** Set when nothing was emitted for this component at all. */
  skipped?: { kind: 'scaffolded' | 'deferred'; reason: string };
  /**
   * Authored scripts this export did not translate, on a component that emitted no file
   * (EXP-011 §27.6).
   *
   * 🔴 **Only ever populated when {@link file} is `null`.** A component with a module carries the
   * identical record as a code comment beside the node, and printing it here as well would make
   * the report a second copy of something the repo already holds — the shape that is a duplicate
   * before it is a check. `emitApp` fills this in its skip branch and nowhere else, so which of
   * the two carriers holds a script is decided by whether a file exists, not by a filter.
   */
  preservedScripts?: Array<{ nodeId: string; typeName: string; label?: string; source: string }>;
  /**
   * EXP-013. The nodes the plan refused in this component, each with the refused node that starves
   * it when the refusal is a cascade. Optional so a report built by hand before EXP-013 still
   * types; `emitApp` always sets it.
   */
  refusals?: RefusedNode[];
}

export interface ExportReportData {
  projectName: string;
  /** Every emitted file, so the report can count without being handed the contents. */
  files: string[];
  components: ReportComponent[];
  /** `noodl_modules` folders that could not contribute their nodes; their files still ship. */
  modules: string[];
  /** Lines that are about the project rather than any one component. */
  project: string[];
  /** The backend endpoint the api modules talk to, or `null` when the project declares none. */
  backendEndpoint: string | null;
  /**
   * Whether the project asks anything of a backend — a collection query, a mutation, or a session
   * call.
   *
   * 🔴 **Not "were any api files emitted".** `src/api/http.ts` is emitted for an `HTTP Request`,
   * which talks to whatever address the author typed and is real code in a project with no backend
   * at all. Keying the stub sentence on "any api file" told a project with a working fetch and no
   * backend that its reads answer empty — see {@link httpModule}.
   */
  usesBackend: boolean;
  /** Whether `src/api/http.ts` was emitted — generated `HTTP Request` calls, never stubs. */
  httpModule: boolean;
  /** EXP-011 §41. Whether `src/api/functions.ts` was emitted — one function per `Cloud Function` node. Optional so a report built by hand before §41 still types. */
  functionsModule?: boolean;
  /**
   * HLS-003 — stored parameters this export read the editor's way rather than the file's.
   *
   * Absent when the project has no node that exercises the seam, which is the common case and is
   * why this is optional rather than a zeroed record. 🔴 **Absent means "nothing here exercises
   * it", never "the seam is closed"** — a project with no wired control signal on one of the
   * fifteen NDA-017 families reads absent however open the seam is.
   */
  settled?: {
    parameters: number;
    nodes: number;
    /** Component paths, sorted — where an author would go to look. */
    components: string[];
  };
}

/**
 * Which of the three states the generated `src/api/` is in.
 *
 * 🔴 **One decision, two readers.** The report prints a sentence from it and the pre-flight
 * summary (EXP-004's before-you-export surface) prints a different one, and the discriminator
 * itself — *does the project ask anything of a backend, and did it name one* — must not exist
 * twice. A second copy would be right until the day `usesBackend` grew a third case, and the two
 * surfaces would then disagree about the same project in the same export.
 */
export type BackendMode = 'connected' | 'stubbed' | 'absent';

export function backendMode(data: Pick<ExportReportData, 'usesBackend' | 'backendEndpoint'>): BackendMode {
  if (!data.usesBackend) return 'absent';
  return data.backendEndpoint !== null ? 'connected' : 'stubbed';
}

/** `"Pages/Home: wire x dropped"` → `"wire x dropped"`, when the prefix is this component's. */
export function stripScope(path: string, note: string): string {
  // An exact known-prefix test, not a pattern: `emitComponent` writes `${plan.path}: ` onto its
  // notes at every site, and the few it does not are kept whole rather than trimmed by guesswork.
  const prefix = `${path}: `;
  return note.startsWith(prefix) ? note.slice(prefix.length) : note;
}

const bullet = (line: string): string => `- ${line}`;

/**
 * The longest run of backticks in a text, so a fenced block can be opened with one more.
 *
 * 🔴 A preserved script is author content and the fence is markup — the same hazard
 * `commentSafe` answers on the code side, one output format over. A body containing ``` would
 * otherwise close the fence early and spill its remainder into the report as prose.
 */
const longestBacktickRun = (text: string): number => {
  let longest = 0;
  let run = 0;
  for (const ch of text) {
    run = ch === '`' ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  return longest;
};

/**
 * The ordered steps as Markdown, shared by the report and the README so the two cannot format the
 * same facts differently. Three-space continuation indent is what keeps the detail and locations
 * inside their numbered item rather than starting a new block after it.
 */
/** A refused node the way a person names it: their label first, the picker's type name beside it. */
export function describeNode(node: Pick<RefusedNode, 'displayName' | 'label' | 'nodeId'>): string {
  return node.label !== undefined && node.label !== '' ? `"${node.label}" (${node.displayName})` : `${node.displayName} \`${node.nodeId}\``;
}

/**
 * The reason as a person reads it. The planner's catch-all is `logic node (<typeName>)` — the
 * exporter talking to itself, and the sentence `sweepUnreportedDeferrals` already refuses to
 * stutter back at the author. Every other reason is a gate's own sentence and is kept verbatim.
 */
export function plainReason(node: Pick<RefusedNode, 'type' | 'reason'>): string {
  return node.reason === `logic node (${node.type})` ? 'the export has no rule for this node yet' : node.reason;
}

/** One root refusal and everything it silences, across the whole export. */
export interface CascadeRoot {
  /** The component the root sits in. */
  path: string;
  node: RefusedNode;
  /** Every node whose `causedBy` resolves to this root, in report order. */
  silences: Array<{ path: string; node: RefusedNode }>;
}

/**
 * EXP-013 AC3/AC4 — the refusals of an export, split into the ones the export has no rule for
 * and the ones that are only refused because of them.
 */
export interface ExportCascade {
  /** Refused nodes with no `causedBy`, that at least one other node names as its cause. Worst first. */
  roots: CascadeRoot[];
  /** Refused nodes with no `causedBy` — the roots above plus every independent refusal. */
  unsilenced: number;
  /** Refused nodes with a `causedBy` — the sum of every root's `silences`. */
  silenced: number;
  /**
   * Nodes whose loss is a pathway rather than a feature (see `isPathwayType`) and that are lost to
   * a cascade — as a silenced node, or as a root that is itself a pathway (an `On App Error` the
   * export has no rule for takes the error pathway with it whether or not anything hangs off it).
   */
  pathway: Array<{ path: string; node: RefusedNode }>;
}

/**
 * The cascade, from the report data and nothing else.
 *
 * 🔴 **`silenced` + `unsilenced` is the number of refused nodes, and `silenced` is the sum of the
 * roots' lists — asserted rather than assumed** (`tests/cascade.test.ts`), because the headline the
 * modal prints is *"N the export has no rule for, M more silenced by them"*, and the cheap mistake
 * is to count a silenced node on both sides. A node with two roots is listed under both and counted
 * once.
 */
export function cascadeOf(data: Pick<ExportReportData, 'components'>): ExportCascade {
  const rows = data.components.flatMap((c) => (c.refusals ?? []).map((node) => ({ path: c.path, node })));
  const byId = new Map(rows.map((row) => [`${row.path}:${row.node.nodeId}`, row]));
  const rootRows = new Map<string, CascadeRoot>();
  let silenced = 0;
  for (const row of rows) {
    if (row.node.causedBy === undefined) continue;
    silenced += 1;
    for (const rootId of row.node.causedBy) {
      const key = `${row.path}:${rootId}`;
      const rootRow = byId.get(key);
      // A cause the plan named that is not itself a refused row would be a defect in the plan; the
      // node is still counted as silenced, and the root is simply not listed.
      if (rootRow === undefined) continue;
      const existing = rootRows.get(key) ?? { path: rootRow.path, node: rootRow.node, silences: [] };
      existing.silences.push(row);
      rootRows.set(key, existing);
    }
  }
  // An `On App Error` the export has no rule for is a root whether or not anything hangs off it:
  // its refusal removes the app's whole error pathway, which is EXP-011 §50.2's second reading
  // and the one Richard's ruling quotes. It is listed as a root with an empty cascade.
  for (const row of rows) {
    if (row.node.causedBy !== undefined || row.node.type !== 'On App Error') continue;
    const key = `${row.path}:${row.node.nodeId}`;
    if (!rootRows.has(key)) rootRows.set(key, { path: row.path, node: row.node, silences: [] });
  }
  const roots = [...rootRows.values()].sort(
    (a, b) => b.silences.length - a.silences.length || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  );
  const pathway = [
    ...roots.filter((root) => root.node.pathway).map((root) => ({ path: root.path, node: root.node })),
    ...rows.filter((row) => row.node.causedBy !== undefined && row.node.pathway)
  ];
  return {
    roots,
    unsilenced: rows.filter((row) => row.node.causedBy === undefined).length,
    silenced,
    pathway
  };
}

/**
 * EXP-013 AC4 — the sentence that leads when a cascade costs a pathway, or `null`.
 *
 * Plain, and the same words on the modal and in the report: *this export would be missing a
 * pathway, not a node*. It names the roots, because the roots are what a person can act on.
 */
export function pathwayVerdict(cascade: ExportCascade): string | null {
  if (cascade.pathway.length === 0) return null;
  // The roots worth naming: a root that is itself a pathway, or one that silences a pathway node.
  const rootsNamed = cascade.roots
    .filter((root) => root.node.pathway || root.silences.some((s) => s.node.pathway))
    .map((root) => `${describeNode(root.node)} in \`${root.path}\``);
  const lost = cascade.pathway.filter((p) => p.node.causedBy !== undefined).map((p) => describeNode(p.node));
  const one = rootsNamed.length === 1;
  const consequence =
    lost.length > 0
      ? `Without ${one ? 'it' : 'them'}, ${lost.join(', ')} ${lost.length === 1 ? 'never runs' : 'never run'}.`
      : `Without ${one ? 'it' : 'them'}, the app has no error pathway.`;
  return (
    `This export would be missing a pathway, not a node: ${rootsNamed.join('; ')}. ${consequence} ` +
    `Replace ${one ? 'it' : 'them'} or wait for a release that translates ${one ? 'it' : 'them'}.`
  );
}

/** The lines under a component that name the nodes the plan refused, roots and their cascades first. */
export function refusedNodeLines(refusals: RefusedNode[] | undefined, indent = ''): string[] {
  if (refusals === undefined || refusals.length === 0) return [];
  const byId = new Map(refusals.map((r) => [r.nodeId, r]));
  const out: string[] = [];
  for (const node of refusals) {
    if (node.causedBy !== undefined) continue;
    out.push(`${indent}- ${describeNode(node)} — ${plainReason(node)}`);
    const silenced = refusals.filter((r) => r.causedBy?.includes(node.nodeId));
    if (silenced.length > 0) {
      out.push(
        `${indent}  …and ${silenced.length === 1 ? 'one node is' : `${silenced.length} nodes are`} left out only because this one fires ` +
          `${silenced.length === 1 ? 'it' : 'them'}: ${silenced.map((r) => describeNode(r)).join(', ')}`
      );
    }
  }
  // A silenced node whose root sits in another component, or whose root row the plan did not
  // produce, still gets a line — nothing is dropped for being awkward to group.
  for (const node of refusals) {
    if (node.causedBy === undefined || node.causedBy.some((id) => byId.has(id))) continue;
    out.push(`${indent}- ${describeNode(node)} — ${plainReason(node)} (fired only by ${node.causedBy.map((id) => `\`${id}\``).join(', ')})`);
  }
  return out;
}

export function renderSteps(steps: NextStep[]): string[] {
  const out: string[] = [];
  steps.forEach((step, i) => {
    out.push(`${i + 1}. **${step.title}**`);
    out.push(`   ${step.detail}`);
    if (step.where.length > 0) out.push(`   In ${step.where.map((w) => `\`${w}\``).join(', ')}.`);
    out.push('');
  });
  // The blank line after the final item is the section separator the caller would otherwise add
  // twice; every other `out.push('')` in this file is the caller's.
  out.pop();
  return out;
}

/**
 * The report, as Markdown.
 *
 * Pure — it is handed everything it says and reads nothing, so the suite can drive it on data
 * that no fixture on disk produces (a project with no gaps at all, which is the section order's
 * hardest case and the one a corpus is least likely to contain).
 */
export function renderReport(data: ExportReportData): string {
  const generated = data.components.filter((c) => c.file !== null);
  const whole = generated.filter((c) => c.notes.length === 0);
  const attention = generated.filter((c) => c.notes.length > 0);
  const deferred = data.components.filter((c) => c.skipped?.kind === 'deferred');
  const scaffolded = data.components.filter((c) => c.skipped?.kind === 'scaffolded');

  const out: string[] = [];
  out.push(`# Export report — ${data.projectName}`);
  out.push('');
  out.push(
    'This React app was generated from your NodeGX project. This file is the record of what the ' +
      'export could translate and what it could not; it is generated with the app, so it is ' +
      'always about the code sitting next to it.'
  );
  out.push('');

  // ── Lead with what worked ──────────────────────────────────────────────────
  out.push('## What was generated');
  out.push('');
  const pages = generated.filter((c) => c.role === 'page').length;
  const components = generated.filter((c) => c.role === 'component').length;
  // A zero half is dropped rather than printed. "1 page and 0 components" reads as an absence
  // the author is meant to do something about, and there is nothing to do about it.
  const built = [
    pages > 0 ? `${pages} ${pages === 1 ? 'page' : 'pages'}` : null,
    components > 0 ? `${components} ${components === 1 ? 'component' : 'components'}` : null
  ].filter((part): part is string => part !== null);
  out.push(
    bullet(
      `**${data.files.length} files**${built.length > 0 ? ` — ${built.join(' and ')},` : ' —'} ` +
        'plus the app shell, styles and build config'
    )
  );
  const backend = backendMode(data);
  if (backend !== 'absent') {
    out.push(
      bullet(
        backend === 'connected'
          ? `**Data access** in \`src/api/\`, calling your NodeGX backend at \`${data.backendEndpoint}\`. ` +
              'Override the endpoint with `.env` — see `.env.example`, and `README.md` for the rest.'
          : '**Data access** in `src/api/`, emitted as **stubs**: reads answer empty and writes throw. ' +
              'The project declares no backend, so there was nothing to point them at. Each stub names ' +
              'the node it came from, so you can wire it to your own service.'
      )
    );
  }
  if (data.functionsModule) {
    // EXP-011 §41. Connected, the sentence is the client's; unconnected, the stub throws the
    // interpreter's own failure, and that is the fact an author needs.
    out.push(
      bullet(
        backendMode(data) === 'connected'
          ? '**Your `Cloud Function` calls** in `src/api/functions.ts`, one function each — through ' +
              '`src/api/client.ts` to the same backend functions the app calls today.'
          : '**Your `Cloud Function` calls** in `src/api/functions.ts`, one function each — the project ' +
              'declares no backend, so each one fails with the sentence the app itself answers: ' +
              '"No cloud services defined in this project."'
      )
    );
  }
  if (data.httpModule) {
    // Deliberately its own bullet and deliberately not hedged. This module is a transcription of
    // the HTTP Request node's own builders — it calls the address the author typed, and whether
    // the project declares a NodeGX backend has nothing to do with it.
    out.push(
      bullet(
        '**Your `HTTP Request` calls** in `src/api/http.ts`, one function each — real code, calling ' +
          'the addresses you typed.'
      )
    );
  }
  out.push(bullet('Run it with `npm install && npm run build`, then `npm run preview`.'));
  out.push('');

  if (whole.length > 0) {
    out.push(`### Translated with nothing left over (${whole.length})`);
    out.push('');
    for (const c of whole) out.push(bullet(`\`${c.path}\` → \`${c.file}\``));
    out.push('');
  }

  if (scaffolded.length > 0) {
    out.push('### Handled by the app shell');
    out.push('');
    for (const c of scaffolded) out.push(bullet(`\`${c.path}\` — ${c.skipped?.reason}`));
    out.push('');
  }

  // ── Then, and only then, what is missing ───────────────────────────────────
  /**
   * Components carrying a script that only this report can hold (EXP-011 §27.6), in report order.
   *
   * 🔴 Not filtered to `deferred`. A script-bearing node beside the **router shell** is
   * `scaffolded`, which lands in the "what worked" half above and in none of the three terms
   * below — so without this the report could say "Nothing" needs attention while an authored
   * script had vanished from the export entirely, which is the exact sentence §27.6 exists to
   * stop the export saying.
   */
  const withPreserved = data.components.filter((c) => (c.preservedScripts?.length ?? 0) > 0);
  const nothingToReport =
    attention.length === 0 &&
    deferred.length === 0 &&
    withPreserved.length === 0 &&
    data.modules.length === 0 &&
    data.project.length === 0;

  if (nothingToReport) {
    out.push('## What needs your attention');
    out.push('');
    out.push(
      '**Nothing.** Every node and every wire in this project had a translation, and the export ' +
        'refused none of them. Read the section below anyway — it says what that does and does not claim.'
    );
    out.push('');
  } else {
    out.push('## What needs your attention');
    out.push('');
    out.push(
      'Each line is one node, wire or parameter the export did not translate, with the reason it ' +
        'gave. Nothing here was translated wrongly — it was **left out**, and the running app will ' +
        'be missing that behaviour until you write it.'
    );
    out.push('');

    /*
     * EXP-013 AC3/AC4/AC5 — the same two numbers and the same verdict the pre-flight modal shows,
     * from the same rows. The modal is read before the export and this file after it; a person who
     * proceeded on "1 node the export has no rule for, 5 more silenced by it" has to find that
     * sentence here, not a different accounting of the same graph.
     */
    const cascade = cascadeOf(data);
    if (cascade.roots.length > 0) {
      const verdict = pathwayVerdict(cascade);
      if (verdict !== null) {
        out.push(`🔴 **${verdict}**`);
        out.push('');
      }
      out.push(
        `**${cascade.unsilenced === 1 ? '1 node' : `${cascade.unsilenced} nodes`} the export has no rule for, and ` +
          `${cascade.silenced === 1 ? '1 more' : `${cascade.silenced} more`} left out only because ` +
          `${cascade.unsilenced === 1 ? 'it fires' : 'they fire'} them.** Fixing a root fixes its cascade, so the ` +
          'roots come first:'
      );
      out.push('');
      for (const root of cascade.roots) {
        out.push(bullet(`${describeNode(root.node)} in \`${root.path}\` — ${plainReason(root.node)}`));
        if (root.silences.length > 0) {
          out.push(
            `  …and ${root.silences.length === 1 ? 'one node is' : `${root.silences.length} nodes are`} left out only because this one fires ` +
              `${root.silences.length === 1 ? 'it' : 'them'}: ${root.silences.map((s) => describeNode(s.node)).join(', ')}`
          );
        }
      }
      out.push('');
    }

    if (deferred.length > 0) {
      out.push('### Components with no generated file');
      out.push('');
      for (const c of deferred) {
        out.push(bullet(`\`${c.path}\` — ${c.skipped?.reason}`));
        out.push(...refusedNodeLines(c.refusals, '  '));
      }
      out.push('');
    }

    for (const c of withPreserved) {
      out.push(`### Code from \`${c.path}\` that is only in this file`);
      out.push('');
      out.push(
        'This component generated no file, so there is no module for a comment to sit in. The ' +
          'scripts below were written in the project and this export did not translate them — ' +
          'they are **not anywhere else in the exported repo**, and this is their only record.'
      );
      out.push('');
      for (const script of c.preservedScripts ?? []) {
        const named = script.label !== undefined ? `"${script.label}" (node \`${script.nodeId}\`)` : `node \`${script.nodeId}\``;
        out.push(bullet(`${script.typeName} ${named}:`));
        out.push('');
        // Verbatim, per the IR's contract for `sourceText`: never trimmed, never reformatted.
        // A fence needs no comment-terminator escaping, but it does need to survive a body that
        // contains one — so the fence is long enough that the script cannot close it.
        const fence = '`'.repeat(Math.max(3, longestBacktickRun(script.source) + 1));
        out.push(`${fence}javascript`);
        out.push(script.source);
        out.push(fence);
        out.push('');
      }
    }

    for (const c of attention) {
      out.push(`### \`${c.path}\`${c.unreachable ? ' — no route reaches this component' : ''}`);
      out.push('');
      if (c.unreachable) {
        out.push(
          'Nothing in the running app renders this component, so the lines below describe code the ' +
            'app never runs. Left in the export rather than dropped: a component may be mid-build, ' +
            'and that is not the export’s call to make.'
        );
        out.push('');
      }
      out.push(`Generated as \`${c.file}\`.`);
      out.push('');
      // EXP-013 AC2 — the nodes, by label and type, before the notes. A note is about a wire or a
      // parameter as often as a node, and a refused node can go unnamed by every note (the
      // measurement in `plan.ts`'s `collectRefusals`); this list is built from the rows instead.
      const nodeLines = refusedNodeLines(c.refusals);
      if (nodeLines.length > 0) {
        out.push('Nodes left out:');
        out.push('');
        out.push(...nodeLines);
        out.push('');
        out.push('Every line the exporter wrote about this component:');
        out.push('');
      }
      for (const note of c.notes) out.push(bullet(note));
      out.push('');
    }

    if (data.modules.length > 0) {
      out.push('### Kits that could not contribute their nodes');
      out.push('');
      out.push(
        'Their files still ship with the app — a kit that contributes fonts or icons still ' +
          'contributes them. What is missing is the nodes they would have registered, either ' +
          'because the kit failed to load or because another kit had already claimed the type name.'
      );
      out.push('');
      for (const note of data.modules) out.push(bullet(note));
      out.push('');
    }

    if (data.project.length > 0) {
      out.push('### About the project as a whole');
      out.push('');
      for (const note of data.project) out.push(bullet(note));
      out.push('');
    }
  }

  /*
   * EXP-004's "clear next steps, with file locations", and the one section that tells the author
   * what to *do* rather than what happened.
   *
   * 🔴 **It sits here, between the itemised list and the honesty section, because the last step is
   * always "test it".** Put the steps after the honesty section and that step reads as an
   * afterthought to a caveat; put them before the itemised list and the report leads on work
   * outstanding, which is the exact failure EXP-004's risk table calls "a good export looking bad".
   * The full list is also in `README.md` — same function, two readers — because the two files are
   * reached by different routes: a developer opens the README, and the `TODO(export)` markers in
   * the code send them here.
   */
  const steps = nextSteps(data);
  out.push('## What to do next, in order');
  out.push('');
  out.push(
    steps.length === 1
      ? 'One thing, and it is the one every export ends on.'
      : 'Most-missing first — how much of the running app is not there without it. The last step ' +
          'is on every export, however well it went.'
  );
  out.push('');
  out.push(...renderSteps(steps));
  out.push('');

  // ── The honesty section ────────────────────────────────────────────────────
  out.push('## What this export claims, and what it does not');
  out.push('');
  out.push(
    '**Every line of this app was generated by rule, and nothing here has been run.** Where the ' +
      'exporter had a rule for a node, it emitted code from it; where it did not, it refused and ' +
      'said so above. It never guesses.'
  );
  out.push('');
  out.push(
    'Those rules were written against the runtime source of each node and are covered by the ' +
      'exporter’s own tests. That is a claim about **the rules**, not about **your project**: ' +
      'your graph was not executed, its behaviour was not recorded, and the generated code was ' +
      'not compared against it. Nothing in this app has been verified against the app you built.'
  );
  out.push('');
  out.push(
    'So the useful reading of the list above is *"this is what is missing"*, and the useful ' +
      'reading of everything not on it is *"this is what the exporter believed it could translate"* ' +
      '— which is worth testing, exactly as you would test code you wrote yourself.'
  );
  out.push('');
  /*
   * HLS-003 — the one place this report says the export did not read the files literally.
   *
   * 🔴 It sits in the claims section rather than the attention list on purpose. The settle is not
   * a gap and not a refusal; it is the export declining to read a graph the author never saw. But
   * it is still a difference between the files on disk and what was generated, and an author who
   * diffs the two has to be able to find out why. Silence here is the ordinary case and says only
   * that nothing in the project exercised the seam.
   */
  if (data.settled) {
    const { parameters, nodes, components } = data.settled;
    out.push('### Where this export did not read your files literally');
    out.push('');
    out.push(
      `${parameters === 1 ? 'One stored parameter' : `${parameters} stored parameters`} on ` +
        `${nodes === 1 ? 'one node' : `${nodes} nodes`} ` +
        `${parameters === 1 ? 'was' : 'were'} read the way the editor reads ` +
        `${parameters === 1 ? 'it' : 'them'}, rather than the way your project files spell ` +
        `${parameters === 1 ? 'it' : 'them'} out.`
    );
    out.push('');
    out.push(
      'Each one is a *Run on value change* box on a node whose control signal is wired. Opening the ' +
        'project in the editor unticks those boxes (NDA-017) — so the graph on your canvas and the ' +
        'graph in the files disagree until the project is saved again. **This export followed the ' +
        'canvas**, which is the graph you built and looked at.'
    );
    out.push('');
    out.push(
      `In ${components.map((c) => '`' + c + '`').join(', ')}. Nothing was written back to your ` +
        'project — the difference was applied to this read only, and opening and saving the project ' +
        'in the editor is what settles the files themselves.'
    );
    out.push('');
  }

  out.push('### Finding the marked places in the code');
  out.push('');
  out.push('Most of what is listed above also leaves a marker in the code, where it would have been:');
  out.push('');
  out.push('```');
  out.push('grep -rn "TODO(export)" src');
  out.push('```');
  out.push('');
  /*
   * 🔴 **This paragraph is the report not overstating itself, and it has been wrong once already.**
   *
   * An earlier draft said "every marker names the node it stands in for, so a line here and a
   * marker there are the two ends of the same fact" — which reads as *every line has a marker*.
   * It did not: markers went only where an element could not be emitted at all, so a wire dropped
   * from an element that still rendered left the element there, correct-looking and inert, with
   * nothing in the file to find. `puppy-test-3` emitted **no** `TODO(export)` at all while this
   * report listed nine refusals, and a reader who greps, finds nothing and concludes the app is
   * complete has been misled by the one file whose entire job is not misleading them.
   *
   * EXP-004's marker pass closed that: a dropped wire now marks the element at whichever end of it
   * renders. 🔴 **The claim still has to be the narrow one**, because a population remains that
   * cannot be marked — a refusal between two logic nodes has no element to sit on, and neither has
   * a component that emitted no file. The report stays the authority and the markers stay the
   * convenience; what changed is that the convenience now covers most of the list instead of none
   * of it. Saying "every" here would be the same error one iteration later.
   */
  out.push(
    '⚠️ **Not quite everything above can leave one.** A marker needs an element to sit on: it goes ' +
      'where one could not be generated at all, and on the element that still renders when a wire ' +
      'into or out of it was dropped. A refusal between two logic nodes has no element to mark, and ' +
      'neither has a component that emitted no file. **This report is the complete list** — the ' +
      'markers are the part of it you can find from inside the code.'
  );
  out.push('');
  out.push('### This export is one-way');
  out.push('');
  out.push(
    'This code does not sync back. Editing it does not change your NodeGX project, and re-exporting ' +
      'overwrites what you changed. Once you start editing here, this is the source of truth — so ' +
      'commit it before you do.'
  );
  out.push('');

  return out.join('\n');
}

/**
 * One thing the author has to do, and where.
 *
 * `where` is *locations*, not always files: a component the export refused entirely has no file to
 * name, so the component's own path is what a reader can act on. The renderers do not know the
 * difference and do not need to — both print it as a code span.
 */
export interface NextStep {
  /** Imperative, one sentence, ending in a full stop. */
  title: string;
  /** What is broken until it is done. This is the sentence that justifies the position. */
  detail: string;
  /** Files or component paths, in emission order. May be empty. */
  where: string[];
}

/**
 * EXP-004's *"actionable next steps ordered by priority"*, computed once and rendered twice.
 *
 * ## 🔴 The ordering criterion, written down so it can be argued with
 *
 * **How much of the running app is missing without it, most first.** Not difficulty, not the
 * number of refusals, and deliberately not the order the report prints its sections in — the
 * report is organised for *looking something up*, and this list is organised for *doing the work*.
 *
 * 1. **Components with no file at all.** The most absent thing the export produces: a route can
 *    lead to a component that was never written.
 * 2. **A stubbed `src/api/`.** Every read answers empty and every write throws, across the whole
 *    app rather than one screen.
 * 3. **Refusals in components a route reaches.** Screens that render, missing behaviour.
 * 4. **Refusals in components no route reaches.** The same work, but nothing runs it today — which
 *    is the whole of why it sits below 3 rather than beside it.
 * 5. **Kits that shipped files but contributed no nodes.**
 * 6. **Anything the export said about the project as a whole.**
 * 7. **Test what was generated.** Always present, always last, and the only step that is not about
 *    something missing.
 *
 * ⚠️ **1 above 2 is a judgement and not a measurement.** A missing component takes out one screen;
 * a stubbed backend takes out every data path in the app. They are ranked the way they are because
 * "nothing was emitted" is strictly more absent than "a stub exists, and it names the node it came
 * from" — but an author whose app is one page and six queries would reasonably reverse them. Both
 * lines say what they cost, so the reading does not depend on the rank alone.
 *
 * ## What is *not* in the order
 *
 * Within a group, components stay in **emission order** — the order they appear in the report's
 * own sections, so a reader can scan straight down from a step to its detail. Sorting them by
 * refusal count was considered and rejected: it would break that correspondence to express a
 * ranking that the counts printed beside them already express.
 *
 * Pure, and driven directly by the suite for the four shapes the corpus does not contain
 * (a stubbed backend, project-wide notes, a clean export, and every group at once).
 */
export function nextSteps(data: ExportReportData): NextStep[] {
  const steps: NextStep[] = [];
  const generated = data.components.filter((c) => c.file !== null);
  const attention = generated.filter((c) => c.notes.length > 0);
  const reached = attention.filter((c) => !c.unreachable);
  const unreached = attention.filter((c) => c.unreachable);
  const deferred = data.components.filter((c) => c.skipped?.kind === 'deferred');
  const count = (cs: ReportComponent[]): number => cs.reduce((n, c) => n + c.notes.length, 0);
  // ⚠️ One is spelled and everything else is a digit. "Write the 1 component the export could not
  // generate" is what the obvious version produces, and it is the sentence a reader trips on.
  const many = (n: number, one: string, rest = `${one}s`): string =>
    n === 1 ? `one ${one}` : `${n} ${rest}`;

  /*
   * EXP-013 AC5 — the root refusals first, because fixing a root fixes its cascade.
   *
   * ⚠️ Above "components with no file" on purpose, and this is the one place the ordering
   * criterion above ("how much of the running app is missing") is read *per fix* rather than
   * *per gap*: one root can be the reason for a component's whole behaviour and for a pathway,
   * and it is one node to replace. The step names the roots and where they are; the cascade
   * itself is itemised in the report's attention section.
   */
  const cascade = cascadeOf(data);
  if (cascade.roots.length > 0) {
    const verdict = pathwayVerdict(cascade);
    steps.push({
      title: `Replace the ${many(cascade.roots.length, 'node')} the export has no rule for that ${
        cascade.roots.length === 1 ? 'silences' : 'silence'
      } ${many(cascade.silenced, 'more', 'more')}.`,
      detail:
        (verdict !== null ? `${verdict} ` : '') +
        `${cascade.roots.map((root) => `${describeNode(root.node)} in \`${root.path}\``).join('; ')}. ` +
        'Every node behind each of these is left out only because this one fires it — replace the root ' +
        'with nodes the export translates, and its cascade translates with it.',
      where: [...new Set(cascade.roots.map((root) => root.path))]
    });
  }

  if (deferred.length > 0) {
    steps.push({
      title: `Write the ${many(deferred.length, 'component')} the export could not generate.`,
      detail:
        'No file was emitted at all — not an empty one, not a stub. Anything that places one ' +
        'renders nothing, and the report gives the reason each was refused.',
      where: deferred.map((c) => c.path)
    });
  }

  if (backendMode(data) === 'stubbed') {
    steps.push({
      title: 'Point `src/api/` at a data source.',
      detail:
        'Until you do, every read answers empty and every write throws. Your project declares no ' +
        'backend, so the export had nothing to connect them to; each stub carries the node it was ' +
        'generated from, so you can see what it is meant to fetch or save.',
      // `client.ts` is not emitted in this mode at all, and `http.ts` is real code calling an
      // address the author typed — neither is a stub, and neither is this step's work.
      where: data.files.filter((f) => f.startsWith('src/api/') && f !== 'src/api/http.ts')
    });
  }

  if (reached.length > 0) {
    steps.push({
      title: `Fill in ${many(count(reached), 'refusal')} in ${many(reached.length, 'component')} a route reaches.`,
      detail:
        'Each refusal is a node, wire or parameter the export had no rule for: the screen renders, ' +
        'people get to it, and some of what it used to do is missing.',
      where: reached.map((c) => c.file as string)
    });
  }

  if (unreached.length > 0) {
    steps.push({
      title: `Fill in ${many(count(unreached), 'refusal')} in ${many(unreached.length, 'component')} no route reaches.`,
      detail:
        'The same kind of work as above, and lower only because nothing in the app renders this ' +
        'today. A screen you were part way through building moves to the top of this list the ' +
        'moment you route to it.',
      where: unreached.map((c) => c.file as string)
    });
  }

  if (data.modules.length > 0) {
    steps.push({
      title: `Replace the nodes ${many(data.modules.length, 'kit')} could not contribute.`,
      detail:
        'Their files shipped — fonts, icons and scripts are all still here — but the node types ' +
        'they would have registered are not, so anything built from those nodes is missing. The ' +
        'report names each kit and why it could not contribute.',
      where: []
    });
  }

  if (data.project.length > 0) {
    steps.push({
      title: `Settle the ${many(data.project.length, 'note')} the export left about the project itself.`,
      detail: 'These belong to no single component. The report states each one in full.',
      where: []
    });
  }

  steps.push({
    title: 'Test it, including the parts nothing above mentions.',
    detail:
      'Everything not listed above is code the exporter believed it could translate. That is a ' +
      'claim about its rules, not about your project, and the section below says exactly what it ' +
      'does and does not cover.',
    where: []
  });

  return steps;
}
