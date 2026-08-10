/**
 * BLD-011 — Rule 6, graded as a byte comparison.
 *
 * **This is the reason the task exists**, and it is the one claim in it that a
 * live drive is worse at proving than a spec. AIX-007 made the opening turn's
 * prefix byte-stable across every turn of every session so that a caching
 * provider can set a breakpoint at `cacheBoundary`; attachments are the same
 * problem with a much bigger gun, because a dropped screenshot is per-turn
 * content by construction. If a reference ever lands *above* the boundary, every
 * send that carries one silently re-bills the entire prefix — and the only
 * symptom is the invoice. Nothing on screen changes, no test that grades
 * behaviour fails, and the panel keeps working perfectly.
 *
 * So the assertion is not "references appear in the message". It is: **the
 * stable half is identical, byte for byte, with and without them** — and the
 * boundary offset is unchanged, because a boundary that moved would be a prefix
 * that changed even if its bytes happened to match.
 */

import {
  initialUserMessage,
  updateUserMessage
} from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';
import { planningUserMessage } from '../../src/editor/src/models/AiAssistant/authoring/prompts/planning';
import { renderReferenceBlock } from '../../src/editor/src/models/AiAssistant/thread/references';
import type { AttachedReference } from '../../src/editor/src/models/AiAssistant/thread/references';

const REQUEST = { description: 'Add a basket popup.', componentPath: 'Components/Basket' };
const OVERVIEW = '--- overview text ---';
const CATALOG = '--- catalog text ---';

function ready(id: string, label: string, text: string): AttachedReference {
  return {
    id,
    kind: 'component',
    label,
    target: label,
    pinned: true,
    status: 'ready',
    resolution: { text, chars: text.length, truncated: false, originalChars: text.length }
  };
}

const REFS = [ready('a', 'Pages/Home', 'HOME SOURCE'), ready('b', 'Pages/Cart', 'CART SOURCE')];

describe('BLD-011 Rule 6 — references ride behind the cache boundary', () => {
  it('leaves the stable prefix byte-identical on a create turn', () => {
    const block = renderReferenceBlock(REFS);
    const without = initialUserMessage(REQUEST, OVERVIEW, CATALOG);
    const with_ = initialUserMessage(REQUEST, OVERVIEW, CATALOG, undefined, undefined, undefined, undefined, undefined, undefined, block);

    // The boundary itself must not move: a prefix that is the same length by
    // luck is not the same prefix.
    expect(with_.cacheBoundary).toBe(without.cacheBoundary);
    expect(with_.content.slice(0, with_.cacheBoundary)).toBe(without.content.slice(0, without.cacheBoundary));

    // And the references really did arrive — an assertion that only checked the
    // prefix would pass just as happily if the block had been dropped entirely,
    // which is the failure this whole mechanism is meant to make impossible.
    expect(with_.content).toContain('HOME SOURCE');
    expect(with_.content).toContain('CART SOURCE');
    expect(with_.content.indexOf('HOME SOURCE')).toBeGreaterThan(with_.cacheBoundary);
  });

  it('leaves the stable prefix byte-identical on an update turn', () => {
    const block = renderReferenceBlock(REFS);
    const source = '{ "current": true }';
    const without = updateUserMessage(REQUEST, source, OVERVIEW, CATALOG);
    const with_ = updateUserMessage(REQUEST, source, OVERVIEW, CATALOG, undefined, undefined, undefined, undefined, undefined, undefined, block);

    expect(with_.cacheBoundary).toBe(without.cacheBoundary);
    expect(with_.content.slice(0, with_.cacheBoundary)).toBe(without.content.slice(0, without.cacheBoundary));
    expect(with_.content.indexOf('HOME SOURCE')).toBeGreaterThan(with_.cacheBoundary);
  });

  it('produces a byte-identical turn when nothing is attached', () => {
    // `renderReferenceBlock` returns `undefined` rather than an empty string
    // precisely so this holds — the absent-means-omitted convention every other
    // optional block in this prompt keeps. A project that never attaches
    // anything must pay zero bytes for the feature existing.
    expect(renderReferenceBlock([])).toBeUndefined();

    const before = initialUserMessage(REQUEST, OVERVIEW, CATALOG);
    const after = initialUserMessage(
      REQUEST,
      OVERVIEW,
      CATALOG,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      renderReferenceBlock([])
    );
    expect(after.content).toBe(before.content);
    expect(after.cacheBoundary).toBe(before.cacheBoundary);
  });

  it('keeps the request last on the planning turn', () => {
    // Planning carries no `cacheBoundary` — nothing in it is stable enough to
    // cache — so what is graded here is the other half of the ordering rule:
    // the task keeps recency. An attachment that displaced the request would put
    // 24k of component JSON between the model and the thing it was asked to do.
    const message = planningUserMessage('Add a basket popup.', OVERVIEW, undefined, renderReferenceBlock(REFS));
    expect(message.indexOf('HOME SOURCE')).toBeLessThan(message.indexOf('--- THE REQUEST ---'));
    expect(message.trimEnd().endsWith('Produce the plan and submit it with submit_plan.')).toBe(true);
  });

  it('omits the block from the planning turn when nothing is attached', () => {
    const before = planningUserMessage('Add a basket popup.', OVERVIEW);
    const after = planningUserMessage('Add a basket popup.', OVERVIEW, undefined, renderReferenceBlock([]));
    expect(after).toBe(before);
  });
});
