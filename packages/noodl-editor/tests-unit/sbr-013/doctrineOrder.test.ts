/**
 * SBR-013 — the doctrine rule, on the editor's side of the substrate.
 *
 * ## What this grades, and why it is a list rather than an assertion
 *
 * The task's own trap says it: *"a ruling names a place; ruling ≠ checking it —
 * an instruction added in one of three surfaces is a third of a rule."* Phase 77
 * is the measured case of exactly that failure at a larger scale — eighteen
 * honest tasks, every acceptance criterion met, and a template nobody would
 * ship, because the look and the screen list were decided AFTER the components
 * that had to carry them.
 *
 * So the deliverable is not the rewritten paragraph, it is this enumeration. A
 * doctrine string that reaches a model and does not state the order is a hole
 * shaped like the defect, and the only thing that can find it is a list of every
 * such string checked one at a time.
 *
 * ## Why the predicate is "order", not "tokens"
 *
 * Every one of these strings already said to use tokens — `DESIGN_DOCTRINE_MD`
 * §4 has said "emit var(--token) always" since phase 54, and phase 77 shipped
 * anyway. A check for the word "token" would have been green throughout the
 * failure it is supposed to catch. What was missing was a SEQUENCE: the look and
 * the screens are settled BEFORE the component tree. So the predicate is two
 * things in one paragraph — a design/look/token subject and an explicit ordering
 * word — which is the smallest thing that can tell "use tokens" from "use tokens
 * first".
 *
 * ⚠️ The MCP half of the same rule (`instructions`, `get_project_info`'s
 * doctrine fields on the wire, and the lesson brief) is graded in
 * `packages/noodl-mcp/tests/sbr013Doctrine.test.ts` — a different package, a
 * different suite, and neither one alone is the rule.
 */
import {
  DESIGN_AUTHORING,
  DESIGN_PLANNING,
  DESIGN_DOCTRINE_MD
} from '../../src/editor/src/models/AiAssistant/authoring/prompts/design';
import {
  DECOMPOSITION_AUTHORING,
  DECOMPOSITION_PLANNING,
  DECOMPOSITION_DOCTRINE_MD
} from '../../src/editor/src/models/AiAssistant/authoring/prompts/decomposition';
import { systemPrompt } from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';
import { planningSystemPrompt } from '../../src/editor/src/models/AiAssistant/authoring/prompts/planning';

/**
 * The strings that decide WHAT GETS BUILT — a planner choosing components, or a
 * project-facing doctrine handed to an external agent before it authors. Every
 * one of them must state the order.
 *
 * ⚠️ The two per-turn AUTHORING strings are deliberately NOT here. A model
 * authoring one component cannot settle a project's identity, and an ordering
 * instruction it cannot act on is noise on every turn of every session — they
 * are graded below on the thing they CAN do, which is refuse to invent a look.
 */
const DECIDING_STRINGS: Array<[string, string]> = [
  ['DESIGN_DOCTRINE_MD', DESIGN_DOCTRINE_MD],
  ['DESIGN_PLANNING', DESIGN_PLANNING],
  ['DECOMPOSITION_DOCTRINE_MD', DECOMPOSITION_DOCTRINE_MD],
  ['DECOMPOSITION_PLANNING', DECOMPOSITION_PLANNING]
];

/** A paragraph, or a single bullet — a bullet is a unit of advice here too. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n(?=\s*[-*\d] )/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The look/design subject, however this particular string phrases it. */
const LOOK = /\b(look|design tokens?|identity|style vocabulary|get_style_vocabulary|accent)\b/i;

/**
 * An explicit ordering claim. "first"/"before" are the words; `THE ORDER` is the
 * heading form the MCP instructions use, kept here so the two surfaces can be
 * grepped with one pattern.
 */
const ORDERING = /\b(first|before|THE ORDER|comes? first|then the)\b/i;

/** The component tree — the thing the order says comes AFTER. */
const COMPONENTS = /\b(component tree|components?|graph|nodes?)\b/i;

describe('SBR-013 — every deciding doctrine states the order, not just the rules', () => {
  for (const [name, text] of DECIDING_STRINGS) {
    it(`${name}: one paragraph puts the look before the components`, () => {
      const stating = paragraphs(text).filter(
        (p) => LOOK.test(p) && ORDERING.test(p) && COMPONENTS.test(p)
      );

      // Report the paragraph, not a boolean. A tripwire that fails with
      // "expected true, received false" is one the next person deletes.
      expect(stating.length > 0 ? 'states the order' : paragraphs(text).slice(0, 3)).toBe('states the order');
    });

    it(`${name}: names the SCREENS as their own step, not just the styling`, () => {
      // The half a "use tokens first" rewrite loses. A component tree is a
      // decomposition of a screen list; phase 77 had neither written down.
      expect(text).toMatch(/\b(screens?|screen list|pages? (the app|it) has|page list)\b/i);
    });
  }
});

describe('SBR-013 — the per-turn authoring strings carry the half a leaf can act on', () => {
  it('DECOMPOSITION_AUTHORING tells a leaf author not to invent the look', () => {
    // It cannot settle an identity — it can decline to choose one by accident,
    // which is exactly how phase 77's template got its colours.
    expect(DECOMPOSITION_AUTHORING).toMatch(/not yours to invent|do not pick one|say so/i);
    expect(DECOMPOSITION_AUTHORING).toMatch(/get_style_vocabulary/);
  });

  it('DESIGN_AUTHORING still fits the per-turn budget it has always had', () => {
    // Guarded because this file's edits are adjacent to it: the LAS-008 spec
    // caps it at 700 and that cap is paid on every authoring turn.
    expect(DESIGN_AUTHORING.length).toBeLessThanOrEqual(700);
  });
});

describe('SBR-013 — the order survives composition into the prompts that ship', () => {
  it('the planning system prompt states it', () => {
    // 🔴 The constants above are inputs; this is the artefact. A doctrine that
    // is correct in its own module and dropped by the composer is the shape of
    // defect this repo has met before, and it is invisible to a constant check.
    const shipped = planningSystemPrompt();
    expect(shipped).toContain('THE ORDER');
    expect(shipped).toMatch(/screen/i);
  });

  it('the authoring system prompt carries the leaf half', () => {
    const shipped = systemPrompt('create');
    expect(shipped).toMatch(/THE LOOK IS NOT YOURS TO INVENT/);
  });
});
