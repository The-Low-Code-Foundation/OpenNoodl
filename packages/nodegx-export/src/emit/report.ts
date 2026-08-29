/**
 * `EXPORT-REPORT.md` — the report the exported app carries with it (EXP-004).
 *
 * ## Why this file exists
 *
 * Two generated `TODO(export)` markers have ended with *"See the export report"* since EXP-002,
 * and there was no report. Everything the export dropped or refused went to `EmittedApp.notes`,
 * which `scripts/emit-app.ts` printed to **stderr** — so an author who ran the export and opened
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
  if (data.usesBackend) {
    out.push(
      bullet(
        data.backendEndpoint !== null
          ? `**Data access** in \`src/api/\`, calling your NodeGX backend at \`${data.backendEndpoint}\`. ` +
              'Override the endpoint with `.env` — see `.env.example`, and `README.md` for the rest.'
          : '**Data access** in `src/api/`, emitted as **stubs**: reads answer empty and writes throw. ' +
              'The project declares no backend, so there was nothing to point them at. Each stub names ' +
              'the node it came from, so you can wire it to your own service.'
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
  const nothingToReport =
    attention.length === 0 && deferred.length === 0 && data.modules.length === 0 && data.project.length === 0;

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

    if (deferred.length > 0) {
      out.push('### Components with no generated file');
      out.push('');
      for (const c of deferred) out.push(bullet(`\`${c.path}\` — ${c.skipped?.reason}`));
      out.push('');
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
