/**
 * FIX-022 — grading a plan, including the REUSE axis.
 *
 * ## Why this is its own module
 *
 * Same reason as `plan-doctrine-arm.ts`, and it is not tidiness: `plan-harness.ts`
 * calls `main()` at import time, so nothing in it can be held by a spec. The
 * grader is the half of the instrument that decides what the numbers mean, and
 * session 43's re-grade was done by a human reading intents in a terminal —
 * a reading nobody could re-run. This module makes it mechanical, and
 * `tests-unit/phase-66/planGrade.test.ts` holds it in `test:main`.
 *
 * ## The reuse axis, and why it exists
 *
 * Session 42's ruling retired the obvious grade. Richard:
 *
 * > "I sometimes create components with just one node inside, like a function
 * > node, because I want to reuse that function in multiple places, or a 'pill'
 * > card with just a group and a text for example."
 *
 * So `creates` is not a defect count. A one-node component is right when it is
 * placed more than once and wrong when it is placed once, and **only the
 * placement count tells those apart**. Every metric here that matters is
 * therefore about placement, not size.
 *
 * ## 🔴 How a placement is detected, and how much of it is prose
 *
 * A plan is pre-authoring: no graph exists yet, so "how many instances" cannot
 * be counted from anything built. Two signals exist, and they disagree:
 *
 * 1. **Structural** — LAS-006 gave `PlanOperation.instantiates` ("component
 *    targets this one will place"). When the model fills it, placement is a
 *    field and not a reading.
 * 2. **Prose** — the operation's `intent` names the created component.
 *
 * ⚠️ **The structured field is filled far less often than it is true.** Across
 * session 41's 20 saved `small-logic` plans, 11 created a component and every
 * one of those was placed by exactly one update — but `instantiates` was
 * present on only **5** of those 11 placing updates. A structural-only metric
 * would have scored the other 6 as never placed at all.
 *
 * So a site counts on **either** signal, and the grade reports the split
 * (`structuralSites` / `proseOnlySites`) rather than hiding it. A reader who
 * distrusts prose can read the structural number alone and see exactly how much
 * of the claim rests on words.
 */

import type { PlanOperation } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import type { PlanPrompt } from './plan-prompts';

/**
 * Component paths arrive in three spellings in real records — "Visual
 * Components/Article/Reading Time", "/Visual Components/Article/Reading Time"
 * and occasionally a legacy name. All three appear in session 41's files, in
 * the same cell, sometimes within one plan.
 */
function normalisePath(target: string): string {
  return target.replace(/^\/+/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** "Visual Components/Article/Reading Time" → "reading time". */
function leafOf(target: string): string {
  const parts = normalisePath(target).split('/');
  return parts[parts.length - 1] ?? '';
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does this operation's prose name the created component?
 *
 * Matched on the leaf name at word boundaries, because intents refer to the
 * same component by full path, by leading-slash path and by bare name — all
 * three occur in the saved records. The leaf is what they share.
 *
 * ⚠️ A leaf short enough to occur incidentally ("Article", "Pill") would
 * over-match. That is why {@link gradePlan} reports the prose share separately
 * instead of folding it silently into one number.
 */
function proseNames(operation: PlanOperation, leaf: string): boolean {
  if (!leaf) return false;
  return new RegExp(`\\b${escapeForRegExp(leaf)}\\b`, 'i').test(operation.intent ?? '');
}

/** Does this operation's `instantiates` field name the created component? */
function structurallyPlaces(operation: PlanOperation, target: string): boolean {
  const wanted = normalisePath(target);
  const wantedLeaf = leafOf(target);
  return (operation.instantiates ?? []).some((entry) => {
    const seen = normalisePath(entry);
    return seen === wanted || leafOf(entry) === wantedLeaf;
  });
}

/** Where one created component gets placed, and on what evidence. */
export interface CreatePlacement {
  /** The created component, verbatim as the plan spelled it. */
  target: string;
  /** Distinct operations that place it — the reuse number. */
  sites: number;
  /** Of those, how many say so in `instantiates` rather than in prose. */
  structuralSites: number;
  /** Of those, how many rest on the intent naming it and nothing else. */
  proseOnlySites: number;
  /** The placing operations' targets, so the number can be argued with. */
  siteTargets: string[];
}

/**
 * What a plan did, reduced to numbers a disagreeing reader can re-derive.
 *
 * `creates` is kept because it is what the doctrine moves and what every
 * earlier record carries. It is no longer the defect count — see the header.
 */
export interface PlanGrade {
  creates: number;
  updates: number;
  docs: number;
  createTargets: string[];
  updateTargets: string[];
  /** Creates whose target sits under a Logic folder — the reported defect's shape. */
  logicCreates: string[];
  /** Whether `/App` (the Page Router holder) is updated — page registration. */
  registersPages: boolean;

  // ── The reuse axis (session 42's ruling) ───────────────────────────────────

  /** Per created component, where it gets placed. */
  placements: CreatePlacement[];
  /** Created and placed at exactly one site — creation the ruling calls wrong. */
  singleUseCreates: string[];
  /** Created and placed at two or more sites — creation the ruling calls right. */
  reusedCreates: string[];
  /**
   * Created and placed nowhere the plan mentions.
   *
   * ⚠️ Deliberately NOT merged into `singleUseCreates`. Zero detected sites is
   * far more likely to be the instrument failing to see a placement than a plan
   * that genuinely orphans a component, and merging the two would let an
   * instrument failure read as a defect finding.
   */
  unplacedCreates: string[];

  /** Against the prompt's stated oracle — creates in range, and reuse if asked for. */
  withinExpectation: boolean;
}

/**
 * Grade one plan.
 *
 * ✅ Pure and dependency-free by design: it takes operations and an oracle, so
 * a spec can hand it a plan whose right answer is known.
 */
export function gradePlan(operations: PlanOperation[], expect: PlanPrompt['expect']): PlanGrade {
  const creates = operations.filter((o) => o.kind === 'create');
  const updates = operations.filter((o) => o.kind === 'update');
  const createTargets = creates.map((o) => o.target);

  const placements: CreatePlacement[] = creates.map((created) => {
    const leaf = leafOf(created.target);
    // Every operation EXCEPT the one that creates it. A create can place another
    // create's component (a new page placing a new card), so creates are not
    // excluded as a class — only this component's own create is.
    const others = operations.filter((o) => o !== created);

    let structuralSites = 0;
    let proseOnlySites = 0;
    const siteTargets: string[] = [];

    for (const operation of others) {
      const structural = structurallyPlaces(operation, created.target);
      const prose = !structural && proseNames(operation, leaf);
      if (!structural && !prose) continue;
      if (structural) structuralSites += 1;
      else proseOnlySites += 1;
      siteTargets.push(operation.target);
    }

    return {
      target: created.target,
      sites: structuralSites + proseOnlySites,
      structuralSites,
      proseOnlySites,
      siteTargets
    };
  });

  const withinCreateRange = creates.length >= expect.createsMin && creates.length <= expect.createsMax;
  // The reuse oracle asks whether the plan factored something and REUSED it, so
  // it is satisfied by one such component — not by every create reaching the
  // bar. A plan that correctly factors a shared badge and also creates a page
  // is not wrong about reuse, and a rule that scored it as wrong would punish
  // the behaviour this cell exists to protect.
  const meetsReuse =
    expect.minPlacementSites === undefined ||
    placements.some((p) => p.sites >= (expect.minPlacementSites as number));

  return {
    creates: creates.length,
    updates: updates.length,
    docs: operations.filter((o) => o.kind === 'doc').length,
    createTargets,
    updateTargets: updates.map((o) => o.target),
    logicCreates: createTargets.filter((t) => /logic/i.test(t)),
    registersPages: updates.some((o) => /(^|\/)app$/i.test(o.target.replace(/^\//, ''))),
    placements,
    singleUseCreates: placements.filter((p) => p.sites === 1).map((p) => p.target),
    reusedCreates: placements.filter((p) => p.sites >= 2).map((p) => p.target),
    unplacedCreates: placements.filter((p) => p.sites === 0).map((p) => p.target),
    withinExpectation: withinCreateRange && meetsReuse
  };
}
