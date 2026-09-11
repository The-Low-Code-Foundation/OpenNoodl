/**
 * BLD-016 build item 2 — a mention **pre-authorises a read**, which is the part
 * of this task that is worth money rather than keystrokes.
 *
 * Mentioning a component is not a typing convenience. `get_component`'s own
 * description tells the agent to fetch a component when the overview is not
 * enough, and an attached component is not the overview — so without a sentence
 * saying otherwise the graph is in the prompt *and* fetched, which is a round
 * trip and a second copy of the same bytes to learn something already in hand.
 *
 * Two things are graded here and the second is the one a refactor breaks: the
 * sentence appears when a component or page rides the turn, and a turn that
 * carries neither is **byte-identical** to the block BLD-011 shipped. Absent
 * means omitted is the convention every block in this prompt keeps, and it is
 * what makes a cache comparison a comparison rather than an allowance.
 */

import {
  REFERENCE_CAPS,
  renderReferenceBlock,
  type AttachedReference
} from '../../src/editor/src/models/AiAssistant/thread/references';

function ref(over: Partial<AttachedReference> = {}): AttachedReference {
  const text = over.resolution?.text ?? 'BODY';
  return {
    id: over.id ?? 'r1',
    kind: over.kind ?? 'doc',
    label: over.label ?? 'docs/BRIEF.md',
    target: over.target ?? 'docs/BRIEF.md',
    pinned: over.pinned ?? true,
    status: over.status ?? 'ready',
    resolution:
      over.resolution ?? ({ text, chars: text.length, truncated: false, originalChars: text.length } as const),
    ...(over.mention ? { mention: over.mention } : {})
  };
}

const PREAUTH = 'The components and pages below are here in full — do not call get_component for any of them.';

describe('BLD-016 the read a mention pre-authorises', () => {
  it('names the tool when a component rides the turn', () => {
    const block = renderReferenceBlock([ref({ kind: 'component', label: 'Library/Layout/Row' })]);
    expect(block).toContain(PREAUTH);
  });

  it('names it for a page too — a page carries a component graph', () => {
    const block = renderReferenceBlock([ref({ kind: 'page', label: 'Pages/Checkout' })]);
    expect(block).toContain(PREAUTH);
  });

  /**
   * ⚠️ The one that a later "tidy this up" breaks. A doc-only turn must produce
   * exactly the bytes it produced before this task, or every turn in every
   * project that never mentions a component pays for a sentence about a tool it
   * is not going to call.
   */
  it('leaves a doc-only turn byte-identical to the block BLD-011 shipped', () => {
    const block = renderReferenceBlock([ref({ kind: 'doc', label: 'docs/BRIEF.md' })]);
    expect(block).toBe(
      [
        '--- ATTACHED CONTEXT ---',
        'The user attached these to this message. They are context for the task, not the task itself.',
        '',
        '--- DOCUMENT: docs/BRIEF.md ---',
        'BODY',
        '--- END DOCUMENT ---',
        '--- END ATTACHED CONTEXT ---'
      ].join('\n')
    );
  });

  it('is emitted once for a turn carrying several components', () => {
    const block = renderReferenceBlock([
      ref({ id: 'a', kind: 'component', label: 'A' }),
      ref({ id: 'b', kind: 'component', label: 'B' })
    ])!;
    expect(block.split(PREAUTH)).toHaveLength(2);
  });

  /** A reference that never resolved is not "here in full", so it cannot claim to be. */
  it('says nothing when the only component failed to resolve', () => {
    const block = renderReferenceBlock([
      ref({ kind: 'component', label: 'Broken', status: 'failed', resolution: undefined }),
      ref({ kind: 'doc' })
    ]);
    expect(block).not.toContain(PREAUTH);
  });
});

describe('BLD-016 the cap a page inherited', () => {
  /**
   * 🔴 A page's payload *is* a component's — the same v2 serialization, plus two
   * lines naming its router. BLD-011 declared `page: 12_000` beside `doc`, which
   * would have silently halved the graph of every mentioned page: the same
   * "classifying by folder quietly halves the cap" trap `componentDisplayLabel`
   * documents, arrived at from the other direction.
   */
  it('caps a page exactly as it caps a component', () => {
    expect(REFERENCE_CAPS.page).toBe(REFERENCE_CAPS.component);
  });
});
