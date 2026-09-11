/**
 * UNI-007 — the tutor lesson-context overlay.
 *
 * CURRICULUM-DESIGN §9.1 and TUTOR-BOUNDARY §4: when a lesson is active, the
 * explain system prompt gains an overlay naming the current step, forbidding the
 * tutor from completing it, and pinning the concept vocabulary. Listed as
 * *"required before L2 testing"* since 2026-07-25 and owed by phase 67 ever
 * since; this module is its implementable half.
 *
 * ## Why this file imports (almost) nothing
 *
 * The boundary is the pedagogy — TUTOR-BOUNDARY's own first line — so the thing
 * worth grading is the *copy*, not the plumbing. Keeping the overlay import-free
 * puts it in `tsconfig.tests-main.json`'s include list beside `portCopy.ts`,
 * which means the sentences are asserted in a plain-Node runner rather than only
 * by starting Electron and reading them. That is the same argument
 * `NodePicker.chooser.ts` and `portCopy.ts` already make, and the same one that
 * keeps `lessonevalconditions.ts` free of the renderer.
 *
 * ⚠️ **The one import is deliberate and load-bearing** — see {@link GLOSSARY}.
 *
 * ## What this module does NOT do
 *
 * It does not decide *whether* a lesson is active. That is the panel's job,
 * because it is the only caller holding `ProjectModel.instance.lesson`, and a
 * module that reached for that singleton would take the renderer with it.
 *
 * @module AiAssistant/explain/tutor
 */

import { SIGNAL_SENTENCE } from '../../../views/ConnectionPopup/portCopy';

/**
 * What the panel knows about the step the learner is on.
 *
 * Both fields are optional because both can genuinely be absent: a legacy
 * hand-authored lesson (`<!-- # -->` HTML) carries no structured title or body
 * at all, and a manifest step may omit either. An overlay with neither still has
 * work to do — the boundary and the glossary do not depend on knowing the step —
 * so absence degrades the overlay rather than disabling it.
 */
export interface TutorContext {
  stepTitle?: string;
  stepBody?: string;
}

/**
 * CURRICULUM-DESIGN §6's glossary, in the format that document fixes:
 * *Noodl word — general word — one sentence a 13-year-old can repeat.*
 *
 * 🔴 **The Signal line is derived, not copied.** §6 records D7 — phase 60 owns
 * the beginner wording for "signal" — and states the obligation as prose: *"if
 * `portCopy.ts` changes, this line changes with it"*. Prose cannot enforce that.
 * Reading the lead clause out of {@link SIGNAL_SENTENCE} can, and `tutor.test.ts`
 * asserts the two agree, so a phase-60 rewording that forgot this file fails a
 * spec instead of quietly teaching two vocabularies.
 *
 * ⚠️ **Only the lead clause is taken.** `SIGNAL_SENTENCE.body` carries `<em>`
 * markup for the connection popup, and the rest of it ("value connections carry
 * their data on their own…") is advice about *wiring choices* — which is the one
 * subject this overlay exists to keep the tutor away from during a step.
 */
export const GLOSSARY: readonly string[] = Object.freeze([
  'Property — attribute — a setting on an element that controls how it looks or behaves.',
  `${SIGNAL_SENTENCE.lead} It runs something on the node it points at. (Signal — event.)`,
  'Value — data — a piece of information that flows along a wire and updates whatever reads it.',
  "Variable / Counter — state — a value the app remembers between events; the app's memory.",
  'Wire / connection — data flow — the path a value or signal travels; downstream updates automatically.',
  'Condition — if/else — a decision point: one outcome when true, another when false.',
  'Repeater item — array element — one entry in a list, rendered by a shared template.',
  'Collection — array — an ordered list of records the app can add to and remove from.',
  'Route / Page — URL / screen — an addressable screen; parameters say which one and with what.',
  'Component — function / module — a named, reusable part with declared inputs and outputs.'
]);

/**
 * Markdown-stripped step body, per TUTOR-BOUNDARY §4's `{step.body, markdown
 * stripped}`.
 *
 * Deliberately a *reducer*, not a renderer: every branch either removes markup
 * or leaves the text alone, so no input can make this emit more than it was
 * given. The step body is authored content and this string goes into a system
 * prompt, so the property that matters is that it cannot smuggle structure —
 * a heading or a fenced block in a step body must not read to the model as
 * instructions about its own role.
 *
 * ⚠️ Not a security boundary and not claimed as one. A lesson author who wants
 * to write "ignore your instructions" in a step body can; TUTOR-BOUNDARY §6
 * already records that the boundary is prompt-enforced above the structural
 * read-only floor. This keeps *accidental* structure out, which is the case that
 * actually happens.
 */
export function stripMarkdown(md: string | undefined): string {
  if (!md) return '';
  return (
    md
      // Fenced code: keep the code, drop the fence, so "type this expression"
      // steps still say what the expression is.
      //
      // 🔴 A block fence and an inline triple-backtick have to be handled
      // separately, and a spec caught this rather than review. Stripping
      // ```` ```[a-z]* ```` everywhere reads the first word of an *inline*
      // span as a language tag: ```` ```a > b``` ```` came out as `> b`,
      // silently deleting the left-hand side of the expression a step was
      // telling the learner to type. A block fence is the whole line; anything
      // else is inline and has no language tag to drop.
      .replace(/^[ \t]*```[a-zA-Z0-9]*[ \t]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm, '$1')
      .replace(/```([\s\S]*?)```/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      // Images before links: an image is a link with a bang, and doing links
      // first would leave a stray `!`.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}[-*+]\s+/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim()
  );
}

/** The longest step body the overlay will carry, in characters. */
const STEP_BODY_LIMIT = 600;

/**
 * TUTOR-BOUNDARY §4's overlay, appended after the existing explain rules.
 *
 * The rules it states are §4's verbatim intent rather than a summary of it: the
 * refusal shape ("say why in one clause, then help one rung down, never refuse
 * flatly") is the difference between this boundary and a gag, and §3's opening
 * line is that a flat refusal *"teaches learners to stop asking questions — the
 * opposite of the goal"*.
 */
export function tutorOverlay(context: TutorContext): string {
  const title = (context.stepTitle ?? '').trim();
  const body = stripMarkdown(context.stepBody);
  const truncated = body.length > STEP_BODY_LIMIT ? `${body.slice(0, STEP_BODY_LIMIT).trimEnd()}…` : body;

  // Absence is stated, not blanked. A prompt reading `Current step task: ""`
  // invites the model to decide what the step probably is, which is the one
  // guess whose confident version defeats the whole overlay.
  const task =
    title || truncated
      ? `Current step task:\n  "${[title, truncated].filter(Boolean).join(': ')}"`
      : 'The current step\'s text was not available. Hold the boundary anyway: do not state connections, ' +
        'parameter values or node placements the learner appears to be working on.';

  return [
    'TUTOR MODE — A LESSON IS ACTIVE',
    'The reader is a beginner working through a lesson.',
    task,
    '',
    '- Your job is understanding, not completion. NEVER state the specific connection, parameter value, or',
    '  node placement that completes the current step, even if asked directly and repeatedly.',
    '- If asked to do the step or reveal its solution: briefly say why not (one clause), then help one rung',
    '  down — name the concept, cite the relevant nodes, or ask the one question that unlocks it. Never',
    '  refuse flatly. A bare refusal is a failure even though the boundary held.',
    '- A node type\'s own documentation is always fair game. "What does the Counter node do?" gets a real',
    '  answer during the counter lesson. Only this step\'s specific assembly is protected; over-refusal is',
    '  a failure mode too.',
    '- Explaining wiring that ALREADY EXISTS in the learner\'s graph is explanation, not completion. What is',
    '  protected is the wiring the step is asking them to add.',
    '- Use these concept names exactly, pairing the Noodl term with the general term:',
    ...GLOSSARY.map((line) => `    ${line}`),
    '- Tone: plain, warm, brief. Never condescending, no exclamation-mark enthusiasm, no "great question".',
    '- If the learner seems frustrated (repeated asking, "just tell me"), acknowledge it in a clause and',
    '  shrink the problem to its smallest piece.'
  ].join('\n');
}

/**
 * 🔴 `deep` is not available in tutor mode, and this is a pedagogy rule rather
 * than a UI preference.
 *
 * TUTOR-BOUNDARY §4: *"`deep` disabled in tutor mode (depth invites
 * solution-shaped walkthroughs of the exact step)"*. `deep`'s own instruction
 * tells the model to *"walk the data flow step by step"* — which, asked about
 * the graph the learner is halfway through building, is the solution read aloud.
 * That makes it §5's oracle-extraction attack available from the toolbar with no
 * prompt injection at all.
 *
 * Expressed as a clamp rather than as a hidden menu item because the panel is
 * not the only caller: the measurement harness and any future headless tutor run
 * get the same rule without having to remember it.
 */
export function clampTutorDetail<T extends string>(detail: T | undefined, tutorActive: boolean): T | 'standard' {
  if (tutorActive && detail === 'deep') return 'standard';
  return detail ?? 'standard';
}
