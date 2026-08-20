/**
 * UNI-010 — the bundle harness: failure classes F1–F4, scored mechanically.
 *
 * WHAT THIS IS, AND THE BARGAIN IT PAYS FOR
 * -----------------------------------------
 * The prior arc (LEARN-007…010, phase 17) ruled that a model **never authors
 * predicates**: conditions shipped pre-written on a pattern and the model filled
 * slots, so a generated condition could not be wrong because no condition was
 * ever generated. UNI-010 overturned that — the user's own Claude authors the
 * whole bundle, `completeWhen` included — and the ruling recorded the price
 * exactly:
 *
 * > free authoring stands, **and in exchange the verifier must absorb the full
 * > F1–F6 taxonomy, not F2 alone.**
 *
 * A structural guarantee was traded for a gate. This module is the gate, and
 * every class it misses reaches a learner — which is the reason the classes are
 * scored *separately* rather than rolled into one verdict. "The bundle failed"
 * tells an authoring model nothing; "step 3's condition still passes against a
 * decoy of the type it addresses" tells it what to change.
 *
 * | | Class | Answered by |
 * |---|---|---|
 * | **F1** | Unreachable — a condition names a type or path that cannot match | {@link verifyLessonManifest}, already shipped |
 * | **F2** | Dead on solution — conditions never fire against the lesson's own answer | replay against the solution context |
 * | **F2′** | Ghostwritten — conditions *already* hold against the starter | replay against the starter context |
 * | **F3** | Ambiguous address — resolves to the wrong node when a second candidate exists | decoy injection |
 * | **F4** | Empty preview — the solution validates, and draws nothing or draws it broken | engine 2, injected |
 *
 * F5 (variant-blind) and F6 (text–graph divergence) are human classes by
 * definition and are deliberately absent. A harness that quietly scored them
 * would be the more dangerous artifact.
 *
 * 🔴 F2′ IS NOT A TIDINESS CHECK
 * ------------------------------
 * §3.5 of the prior arc drew the one line the tutor boundary rests on: a lesson
 * ships a starter graph, and *"anything the `completeWhen` checks for must be
 * absent from the starter, or the step completes on arrival and the lesson has
 * ghostwritten the step."* A generated lesson that hands the learner the answer
 * and then congratulates them for it is not a lesson, and it is the single
 * easiest mistake for a model to make — it has the solution in front of it while
 * it writes the starter.
 *
 * 🔴 F3 IS TWO FINDINGS, BECAUSE THE FIRST DRAFT FAILED EVERY SOUND LESSON
 * ------------------------------------------------------------------------
 * The decoy test asks "would this condition survive a second node of the type it
 * addresses?", and the honest answer for almost any `%Type` segment carrying a
 * specific assertion is no. Reported as an error, that fails essentially every
 * real lesson — a path like `App:%Page:#Greeting` names the page by type because
 * that is how a page component is shaped, and a hypothetical second Page is not
 * a defect in the lesson. A gate that rejects the correct answer is worse than
 * no gate, and it fails in the direction this module is most obliged to avoid.
 *
 * §3.2's binding is narrower than the decoy test, and it is the right line:
 * type-only addressing is permitted *"only where the graph guarantees exactly
 * one node of that type and the step cannot add another"*. So:
 *
 *   - **error** — the decoy displaces the address **and** a second candidate
 *     already exists, in the starter or in the solution. The lottery is running
 *     now, and which node the lesson means is decided by graph order.
 *   - **warning** — the decoy displaces the address and exactly one candidate
 *     exists. The lesson works; the address is brittle, and the fix is a label.
 *
 * ⚠️ The solution is what makes the error case reachable, and it is worth saying
 * why: the solution is the graph *after every step*, so a lesson that itself
 * instructs the learner to add a second Text has two Texts in its own solution.
 * That is the case F3 was predicted to appear in, and it is caught by comparing
 * the address against the lesson's own end state rather than by guessing.
 *
 * 🔴 F4 READS THE RENDER'S FINDINGS, NOT ONLY ITS TWO NUMBERS
 * -----------------------------------------------------------
 * Added after UNI-010's criterion-3 run, whose §8.1 is the case that demanded
 * it. A lesson's solution declared its row component's interface as
 * `dynamicports` where the editor reads `ports`, so the component had no
 * interface, and the Repeater stamped three rows of the literal word `"Text"`.
 * The page also carried one real heading. F4 therefore saw `valid: true`,
 * `rendered: true`, `drawnElementCount: 4` — and passed.
 *
 * The render harness had said the opposite in the same payload:
 * `dead-placeholder-text — 3 elements render a node-type default instead of
 * content`. It arrived as a **string** in `WholeSolutionResult.findings`, and
 * `findings` did not participate in the verdict. The control pair is the sharp
 * end of it: the broken bundle and the fixed one differ by **one JSON key in
 * one node**, one shows a learner three blank rows and the other does not, and
 * their scorecards were **character-for-character identical**.
 *
 * ⚠️ This is one level above the "clean can mean EMPTY" trap. F4 already
 * refuses to accept "no errors" as evidence and insists on a drawn count — and
 * then a **project-level** count lets an unrelated heading vouch for a broken
 * mechanism. The fix is not a bigger number; it is that the evidence was in the
 * payload and the rule could not reach it. `renderDefects` is the field it
 * reaches it through.
 *
 * 🔴 A CHECK THAT COULD NOT RUN IS NEVER A FAILURE
 * ------------------------------------------------
 * Stated once and honoured throughout. `viewerPathEq` and `activeComponentNameEq`
 * observe a running editor, so a file-backed context cannot answer them; a
 * bundle with no solution cannot be replayed at all; a machine with no Chrome
 * cannot render. Each of those is reported as **not checked**, with the class
 * result saying so, and none of them is allowed to read as a defect in the
 * lesson. The alternative — evaluating an unanswerable condition to `false` —
 * makes the gate accuse the author of the harness's own blind spot, and it is
 * the failure mode the whole "clean can mean EMPTY" discipline exists against,
 * pointed the other way.
 *
 * @module noodl-editor/models/lessonbundleverify
 */

import { compileConditions, LessonFormatError } from './lessonformat';
import type { LessonManifest, LessonStepDef } from './lessonformat';
import { normaliseWholeSolutionResult } from './lessongrading';
import type { WholeSolutionGrader, WholeSolutionResult } from './lessongrading';
import { collectionNamesInComponents } from './lessondatabase';
import { ambiguousTypeSegments, injectDecoys, unevaluableReason } from './lessonprojectcontext';
import type { UnevaluableOptions } from './lessonprojectcontext';
import { nodePathsInCondition, verifyLessonManifest } from './lessonverify';
import type {
  LessonFinding,
  LessonFindingCode,
  LessonVerificationReport,
  VerifyLessonOptions
} from './lessonverify';
import { evalConditionsWithContext } from '../views/lessons/lessonevalconditions';
import type { LessonCondition, LessonEvalContext } from '../views/lessons/lessonevalconditions';

// ─── Findings ───────────────────────────────────────────────────────────────

export type LessonBundleFindingCode =
  /** F2 — a graded step's conditions do not hold against the lesson's own solution. */
  | 'dead-on-solution'
  /** F2′ — a graded step's conditions already hold against the starter (§3.5). */
  | 'already-satisfied-in-starter'
  /** F3 — a `%Type` segment that already has more than one candidate. Fatal and invisible. */
  | 'ambiguous-type-address'
  /** F3, weaker — the address survives today only because nothing else of that type exists yet. */
  | 'fragile-type-address'
  /** F4 — the solution validates but draws nothing. */
  | 'solution-renders-nothing'
  /** F4 — the solution draws, and the render says what it drew is broken. */
  | 'solution-renders-broken'
  /** F4 — the solution does not validate. */
  | 'solution-invalid'
  /** A condition threw while being evaluated — malformed past what the compiler catches. */
  | 'condition-error'
  /** Not a defect: something could not be checked, and the scorecard says which. */
  | 'not-checked'
  /**
   * F1, passed through from the static check with its own code intact —
   * `display-name-used`, `shadowed-by-deprecated`, `unsafe-url` and the rest.
   *
   * 🔴 Kept rather than flattened. The first draft mapped every static error onto
   * `condition-error`, which reads fine to a human (the message survives) and
   * destroys the scorecard for anything counting: LEARN-009's deliverable is a
   * *regenerable per-lesson score*, and a run that cannot say which F1 defect it
   * hit cannot answer the arc's own pre-registered prediction about which class
   * dominates.
   */
  | LessonFindingCode;

export interface LessonBundleFinding {
  code: LessonBundleFindingCode;
  severity: 'error' | 'warning' | 'info';
  /** Which failure class this belongs to, for the scorecard. */
  failureClass: 'F1' | 'F2' | 'F3' | 'F4';
  where: string;
  /** Zero-based step index, when the finding belongs to a step. */
  step?: number;
  message: string;
}

/**
 * Per class, not per bundle.
 *
 * `not-checked` is a first-class result rather than an optimistic `pass`,
 * because "we did not look" and "we looked and it was fine" are the two answers
 * a decision rule must never conflate — UNI-010's ≥3-of-5 keep criterion is
 * counted off these.
 */
export type FailureClassResult = 'pass' | 'fail' | 'not-checked';

export interface LessonBundleScorecard {
  /** True when no class failed. A `not-checked` class does not make a bundle ok on its own — see {@link installable}. */
  ok: boolean;
  /**
   * True when every class was actually *checked* and passed. This is the gate an
   * install should use: a bundle whose solution was never replayed has not
   * earned the free-authoring bargain, it has skipped it.
   */
  installable: boolean;
  classes: Record<'F1' | 'F2' | 'F3' | 'F4', FailureClassResult>;
  findings: LessonBundleFinding[];
  /** Steps carrying at least one condition. Ungraded prose steps are not scored. */
  gradedSteps: number;
  /** The static report, verbatim, so a caller need not run it twice. */
  verification: LessonVerificationReport;
  /** Engine 2's result over the solution, when a grader was supplied. */
  wholeSolution?: WholeSolutionResult;
}

export interface VerifyLessonBundleOptions {
  /**
   * The lesson's own answer. Absent means F2, F2′ and F3 are `not-checked` —
   * which is honest for a curated bundle and disqualifying for a generated one.
   */
  solution?: LessonEvalContext;
  /** The project the learner opens. Required for F2′; absent skips only that half. */
  starter?: LessonEvalContext;
  /** Engine 2 over the *solution*. Absent means F4 is `not-checked`. */
  wholeSolution?: WholeSolutionGrader;
  /** Passed through to the static check. */
  verify?: VerifyLessonOptions;
}

// ─── Condition partitioning ─────────────────────────────────────────────────

export interface StepConditions {
  index: number;
  step: LessonStepDef;
  where: string;
  /** Compiled conditions a file-backed context can answer. */
  checkable: LessonCondition[];
  /** Compiled conditions it cannot, with the reason. */
  skipped: Array<{ condition: LessonCondition; reason: string }>;
  /** Set when the step would not compile — F1's territory, recorded so F2 does not double-report it. */
  compileError?: string;
}

/**
 * Which steps are graded, and what each one's conditions compile to.
 *
 * 🔴 Exported for {@link module:noodl-editor/models/lessonstarter}, and the export
 * is the point rather than a convenience. `derive_starter` subtracts from a
 * solution *per graded step*, and this gate then asks whether any graded step is
 * still satisfied by what came out. If the two disagreed about which steps count
 * — an ungraded prose step, a step whose conditions do not compile — the deriver
 * would retract something the gate never asked about, or skip something it did.
 * One notion of "graded step", in the module that already had to decide.
 */
export function stepConditions(manifest: LessonManifest, options: UnevaluableOptions = {}): StepConditions[] {
  const steps: LessonStepDef[] = Array.isArray(manifest?.steps) ? manifest.steps : [];

  return steps
    .map((step, index): StepConditions | undefined => {
      const where = `Step ${index + 1}${step?.title ? ` ("${step.title}")` : ''}`;
      if (!step?.completeWhen || step.completeWhen.length === 0) return undefined;

      let compiled: LessonCondition[];
      try {
        compiled = compileConditions(step.completeWhen, where);
      } catch (e) {
        return {
          index,
          step,
          where,
          checkable: [],
          skipped: [],
          compileError: e instanceof LessonFormatError ? e.message : String(e)
        };
      }

      const checkable: LessonCondition[] = [];
      const skipped: Array<{ condition: LessonCondition; reason: string }> = [];
      for (const condition of compiled) {
        const reason = unevaluableReason(condition, options);
        if (reason) skipped.push({ condition, reason });
        else checkable.push(condition);
      }

      return { index, step, where, checkable, skipped };
    })
    .filter((s): s is StepConditions => s !== undefined);
}

/**
 * Every collection name the bundle's own projects mention, across both of them.
 *
 * 🔴 **Both, and the union rather than the solution alone.** A lesson may legitimately name a
 * collection that only the starter refers to — "delete the Query that reads `Puppies`" is a step
 * — and a population drawn from the solution alone would call that name unreachable and refuse a
 * correct lesson. F1's job is to catch a name nothing in the bundle has ever heard of.
 */
function bundleCollections(options: VerifyLessonBundleOptions): string[] {
  const names = [
    ...collectionNamesInComponents(options.solution?.components),
    ...collectionNamesInComponents(options.starter?.components)
  ];
  const seen = new Set<string>();
  // Reported verbatim, matched case-insensitively — see `verifyLessonManifest`.
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Evaluate a step's checkable conditions.
 *
 * Returns `undefined` when evaluation threw — distinct from `false`, so a
 * malformed condition is reported as one rather than silently counted as "the
 * solution does not satisfy this step".
 */
function evaluate(conditions: LessonCondition[], ctx: LessonEvalContext): boolean | undefined {
  try {
    return evalConditionsWithContext(conditions, ctx);
  } catch {
    return undefined;
  }
}

// ─── The harness ────────────────────────────────────────────────────────────

/**
 * Score a lesson bundle against the machine-detectable failure classes.
 *
 * Never throws. Both producers of this format hand it machine-written JSON, and
 * a gate whose caller has to guard it is a gate that will be called without a
 * guard.
 */
export async function verifyLessonBundle(
  manifest: LessonManifest,
  options: VerifyLessonBundleOptions = {}
): Promise<LessonBundleScorecard> {
  const findings: LessonBundleFinding[] = [];
  const verification = verifyLessonManifest(manifest, {
    ...options.verify,
    // TUT-002 AC5 — F1's collection-reachability check, given its population at last. This is
    // the caller `VerifyLessonOptions.knownCollections` was written for: the harness is the only
    // thing that holds *both* projects, and a collection condition naming a table neither of
    // them ever mentions can never hold.
    //
    // 🔴 Supplied only when there is a solution to derive it from. `undefined` skips the check;
    // an empty array is *evidence* that the bundle names no collections at all, and asserting
    // that from a bundle we were never given would reject every correct data lesson verified
    // without one. `asked − answered = absent`; `everything − answered` is a lie.
    ...(options.verify?.knownCollections
      ? {}
      : options.solution
        ? { knownCollections: bundleCollections(options) }
        : {})
  });
  // TUT-002: the same flag the replay below runs under. A collection condition is replayable
  // only against a context that actually carries a snapshot; otherwise it is reported as
  // not-checked, never as a step the solution fails.
  const steps = stepConditions(manifest, { hasDatabase: !!options.solution?.database });

  // ── F1 ──────────────────────────────────────────────────────────────────
  for (const f of verification.findings) {
    findings.push(staticFindingToBundleFinding(f));
  }
  const f1: FailureClassResult = verification.ok ? 'pass' : 'fail';

  // ── F2 and F2′ ──────────────────────────────────────────────────────────
  let f2: FailureClassResult = 'not-checked';
  if (!options.solution) {
    findings.push({
      code: 'not-checked',
      severity: 'info',
      failureClass: 'F2',
      where: 'Bundle',
      message:
        'The bundle carries no solution, so its conditions were never replayed. A lesson whose own answer ' +
        'does not satisfy its steps is the failure this class exists to catch, and it cannot be ruled out ' +
        'without one.'
    });
  } else if (steps.length === 0) {
    findings.push({
      code: 'not-checked',
      severity: 'info',
      failureClass: 'F2',
      where: 'Bundle',
      message: 'No step carries a completion condition, so there is nothing to replay.'
    });
  } else {
    f2 = 'pass';
    for (const s of steps) {
      if (s.compileError) continue; // F1 already reported it; replaying is meaningless.

      if (s.checkable.length === 0) {
        findings.push({
          code: 'not-checked',
          severity: 'warning',
          failureClass: 'F2',
          where: s.where,
          step: s.index,
          message:
            `Every condition on this step observes a running editor, so none could be replayed ` +
            `(${s.skipped[0]?.reason ?? 'no checkable condition'}). This step is ungraded by the harness.`
        });
        continue;
      }

      const passes = evaluate(s.checkable, options.solution);
      if (passes === undefined) {
        f2 = 'fail';
        findings.push({
          code: 'condition-error',
          severity: 'error',
          failureClass: 'F2',
          where: s.where,
          step: s.index,
          message: 'A condition on this step could not be evaluated against the solution at all.'
        });
      } else if (!passes) {
        f2 = 'fail';
        findings.push({
          code: 'dead-on-solution',
          severity: 'error',
          failureClass: 'F2',
          where: s.where,
          step: s.index,
          message:
            "This step's conditions do not hold against the lesson's own solution, so a learner who builds " +
            'exactly what the lesson asks for will still be told they have not finished. Fix the condition, ' +
            'or fix the solution so it satisfies it.'
        });
      }

      for (const skipped of s.skipped) {
        findings.push({
          code: 'not-checked',
          severity: 'info',
          failureClass: 'F2',
          where: s.where,
          step: s.index,
          message: `One condition was not replayed: ${skipped.reason}.`
        });
      }

      // F2′ — the same conditions, against the starter.
      if (options.starter) {
        const alreadyDone = evaluate(s.checkable, options.starter);
        if (alreadyDone === true) {
          f2 = 'fail';
          findings.push({
            code: 'already-satisfied-in-starter',
            severity: 'error',
            failureClass: 'F2',
            where: s.where,
            step: s.index,
            message:
              'This step is already complete in the project the learner opens, so it will tick itself the ' +
              'moment they arrive. Whatever the condition checks for has to be absent from the starter — ' +
              'otherwise the lesson has done the step for them. If the step is meant to be orientation ' +
              '("find the Text node") rather than work, drop its completeWhen: a step with no conditions ' +
              'is a Next card the learner clicks through, and it is neither passed nor failed when graded.'
          });
        }
      }
    }
  }

  // ── F3 ──────────────────────────────────────────────────────────────────
  let f3: FailureClassResult = 'not-checked';
  if (options.solution && steps.length > 0) {
    f3 = 'pass';
    for (const s of steps) {
      if (s.compileError || s.checkable.length === 0) continue;

      const baseline = evaluate(s.checkable, options.solution);
      // A step that does not pass its own solution is F2's problem. Injecting a
      // decoy into a graph the step already fails against measures nothing.
      if (baseline !== true) continue;

      for (const { path } of pathsOfStep(s)) {
        // Which `%Type` segments already have more than one candidate, in either
        // graph the learner will actually meet.
        const alreadyAmbiguous = new Set([
          ...ambiguousTypeSegments(options.solution.components, path),
          ...(options.starter ? ambiguousTypeSegments(options.starter.components, path) : [])
        ]);

        for (const injection of injectDecoys(options.solution.components, path)) {
          const withDecoy: LessonEvalContext = { ...options.solution, components: injection.components };
          // Robust to a decoy: the condition would still be talking about the
          // right node. Nothing to say, whatever else is in the graph.
          if (evaluate(s.checkable, withDecoy) === true) continue;

          if (alreadyAmbiguous.has(injection.segment)) {
            f3 = 'fail';
            findings.push({
              code: 'ambiguous-type-address',
              severity: 'error',
              failureClass: 'F3',
              where: `${s.where} ("${path}")`,
              step: s.index,
              message:
                `"${injection.segment}" already matches more than one node here, and a node path takes the ` +
                `first match — so which "${injection.typeName}" this condition is talking about is decided ` +
                `by graph order rather than by the lesson. Give the node a label and address it as ` +
                `"#TheLabel" instead of "${injection.segment}".`
            });
          } else {
            findings.push({
              code: 'fragile-type-address',
              severity: 'warning',
              failureClass: 'F3',
              where: `${s.where} ("${path}")`,
              step: s.index,
              message:
                `This step stops passing as soon as a second "${injection.typeName}" exists beside the one ` +
                `it means. Exactly one exists today, so the lesson works — but a learner who adds another ` +
                `is told they failed a step they completed. Address it by label ("#TheLabel") rather than ` +
                `"${injection.segment}" if the learner could reasonably add one.`
            });
          }
        }
      }
    }
  }

  // ── F4 ──────────────────────────────────────────────────────────────────
  let f4: FailureClassResult = 'not-checked';
  let wholeSolution: WholeSolutionResult | undefined;
  if (options.wholeSolution) {
    wholeSolution = normaliseWholeSolutionResult(await options.wholeSolution.check());
    if (wholeSolution.unavailable) {
      findings.push({
        code: 'not-checked',
        severity: 'info',
        failureClass: 'F4',
        where: 'Solution',
        message: `The solution could not be rendered here, so "does it draw?" is unanswered: ${wholeSolution.unavailable}`
      });
    } else {
      f4 = 'pass';
      if (!wholeSolution.valid) {
        f4 = 'fail';
        findings.push({
          code: 'solution-invalid',
          severity: 'error',
          failureClass: 'F4',
          where: 'Solution',
          message:
            `The lesson's own solution does not validate, so the lesson asks the learner to build something ` +
            `broken. ${wholeSolution.findings[0] ?? ''}`.trim()
        });
      }
      if (!wholeSolution.rendered) {
        f4 = 'fail';
        findings.push({
          code: 'solution-renders-nothing',
          severity: 'error',
          failureClass: 'F4',
          where: 'Solution',
          message:
            'The solution draws nothing. A learner who follows every step correctly ends up looking at an ' +
            'empty page — usually because the sample data keys do not match what the nodes are bound to.'
        });
      } else if (wholeSolution.renderDefects?.length) {
        // 🔴 UNI-010 criterion 3, §8.1. `rendered` is a project-level "did
        // anything appear", so one working heading vouches for three dead
        // placeholders beside it — and the render had already said so, in a
        // sentence sitting unread in `findings`. The verdict now reads it.
        //
        // Not folded into the branch above: "it drew nothing" and "what it drew
        // is broken" are different repairs, and telling an author their page is
        // empty when three rows of the word "Text" are on it aims them at the
        // wrong subsystem.
        f4 = 'fail';
        findings.push({
          code: 'solution-renders-broken',
          severity: 'error',
          failureClass: 'F4',
          where: 'Solution',
          message:
            `The solution draws${
              wholeSolution.drawnElementCount !== undefined ? ` ${wholeSolution.drawnElementCount} elements` : ''
            }, and the render reports what it drew is broken: ` +
            `${wholeSolution.renderDefects.join(', ')}. A page is not passing because something appeared on ` +
            'it — a learner who follows every step correctly ends up looking at this. The render’s own lines ' +
            'below say which elements and why; fix the solution until they are gone, or the lesson teaches a ' +
            'graph that does not work.'
        });
      }
    }
  }

  const classes = { F1: f1, F2: f2, F3: f3, F4: f4 };
  const values = Object.values(classes);

  return {
    ok: !values.includes('fail'),
    installable: values.every((v) => v === 'pass'),
    classes,
    findings,
    gradedSteps: steps.length,
    verification,
    ...(wholeSolution ? { wholeSolution } : {})
  };
}

/** Every node path a step's conditions address, deduplicated. */
function pathsOfStep(s: StepConditions): Array<{ path: string }> {
  const seen = new Set<string>();
  const out: Array<{ path: string }> = [];
  for (const def of s.step.completeWhen ?? []) {
    for (const { path } of nodePathsInCondition(def)) {
      if (seen.has(path)) continue;
      seen.add(path);
      out.push({ path });
    }
  }
  return out;
}

function staticFindingToBundleFinding(f: LessonFinding): LessonBundleFinding {
  return {
    code: f.code,
    severity: f.severity,
    failureClass: 'F1',
    where: f.where,
    ...(f.step !== undefined ? { step: f.step } : {}),
    message: f.suggestion ? `${f.message} Use "${f.suggestion}".` : f.message
  };
}

// ─── Reporting ──────────────────────────────────────────────────────────────

/**
 * The per-lesson scorecard as text.
 *
 * 🔴 **Written for the author, who is a language model.** Phase 64's rule — grade
 * a refusal by what it wrote — applies with full force here: the model that
 * receives this is the one that has to fix the bundle, and "verification failed"
 * gives it nothing to act on. Every line therefore names the step, the class and
 * what to change.
 */
export function formatBundleScorecard(scorecard: LessonBundleScorecard): string {
  const lines: string[] = [];
  const label: Record<FailureClassResult, string> = {
    pass: 'pass',
    fail: 'FAIL',
    'not-checked': 'not checked'
  };

  lines.push(
    `F1 unreachable conditions: ${label[scorecard.classes.F1]}`,
    `F2 dead on solution:       ${label[scorecard.classes.F2]}`,
    `F3 ambiguous address:      ${label[scorecard.classes.F3]}`,
    `F4 empty preview:          ${label[scorecard.classes.F4]}`
  );

  if (scorecard.findings.length) {
    lines.push('');
    for (const f of scorecard.findings) {
      const marker = f.severity === 'error' ? 'ERROR' : f.severity === 'warning' ? 'WARN ' : 'note ';
      lines.push(`${marker} [${f.failureClass}] ${f.where}: ${f.message}`);
    }
  }

  if (!scorecard.installable && scorecard.ok) {
    lines.push(
      '',
      'Nothing failed, but not every class was checked. A generated lesson has to be checked on all four ' +
        'before it reaches a learner — the free-authoring bargain is that the gate carries the risk.'
    );
  }

  return lines.join('\n');
}
