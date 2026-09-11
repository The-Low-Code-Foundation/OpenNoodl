/**
 * BLD-011 — the arithmetic, which is the part that is invisible when it is wrong.
 *
 * A cap that quietly drops half a document, a carry-over rule that re-attaches
 * something the user unpinned, a meter that under-reports what a pinned
 * reference costs — none of these look like anything on screen. They look like
 * a working panel that produces slightly wrong prompts and a slightly larger
 * bill. That is why this module is pure and why these run in a plain-Node
 * runner rather than only inside a renderer.
 */

import {
  blockingReferences,
  capReferenceText,
  carryOver,
  defaultPinned,
  isStale,
  referenceCost,
  renderReferenceBlock,
  staleAge,
  toTurnReferences,
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
    ...(over.error ? { error: over.error } : {}),
    ...(over.capturedAtApply !== undefined ? { capturedAtApply: over.capturedAtApply } : {})
  };
}

describe('BLD-011 caps', () => {
  it('states the truncation in the text the model reads', () => {
    // The contract `renderDocForPrompt` already keeps, for the reason the docs
    // format learned it: a silently short reference is worse than an absent
    // one, because the model answers confidently from half a source.
    const source = `# One\n${'a'.repeat(400)}\n\n# Two\n${'b'.repeat(400)}`;
    const result = capReferenceText(source, 'docs/BRIEF.md', 500);

    expect(result.truncated).toBe(true);
    expect(result.originalChars).toBe(source.length);
    expect(result.text).toContain('[TRUNCATED — docs/BRIEF.md is');
    expect(result.text).toContain('ask if the task depends on it');
    // `chars` is the length as SENT, notice included — a meter that reported
    // the pre-cap length would under-report a cut reference and over-report an
    // uncut one, in opposite directions.
    expect(result.chars).toBe(result.text!.length);
  });

  it('leaves a short reference untouched and unannotated', () => {
    const result = capReferenceText('# One\nshort', 'docs/BRIEF.md', 5000);
    expect(result.truncated).toBe(false);
    expect(result.text).toBe('# One\nshort');
    expect(result.chars).toBe(11);
  });
});

describe('BLD-011 Rule 7 — pinned, or it perishes', () => {
  it('defaults a capture to unpinned and everything else to pinned', () => {
    // A mock you are copying should ride ten turns; a screenshot of your own app
    // is true for about one, because the agent is changing the thing it depicts.
    expect(defaultPinned('capture')).toBe(false);
    expect(defaultPinned('component')).toBe(true);
    expect(defaultPinned('doc')).toBe(true);
    expect(defaultPinned('file')).toBe(true);
  });

  it('carries pinned references and drops unpinned ones', () => {
    const kept = ref({ id: 'keep', pinned: true });
    const gone = ref({ id: 'drop', pinned: false });
    expect(carryOver([kept, gone]).map((r) => r.id)).toEqual(['keep']);
  });

  it('never carries a failed reference, pinned or not', () => {
    // It did not ride the turn it was attached to either. Retrying it silently
    // on every later turn is how a broken attachment becomes permanent noise.
    const broken = ref({ id: 'broken', pinned: true, status: 'failed', error: 'gone', resolution: undefined });
    expect(carryOver([broken])).toEqual([]);
  });

  it('reports a capture as stale only after an apply, and says how many', () => {
    const capture = ref({ kind: 'capture', capturedAtApply: 2, pinned: false });
    expect(isStale(capture, 2)).toBe(false);
    expect(isStale(capture, 5)).toBe(true);
    expect(staleAge(capture, 5)).toBe(3);
    // A kind that records no capture point has no opinion, rather than an
    // exception it has to opt out of.
    expect(isStale(ref(), 99)).toBe(false);
    expect(staleAge(ref(), 99)).toBeUndefined();
  });

  it('states a stale reference’s age in the prompt rather than dropping it', () => {
    // "Nothing stale is ever sent silently" — but dropping it would be a silent
    // edit of what the user chose to send, which is the opposite failure.
    const capture = ref({ kind: 'capture', label: 'Home at 400px', capturedAtApply: 1, pinned: false });
    const block = renderReferenceBlock([capture], 3);
    expect(block).toContain('[STALE — taken 2 changes ago');
    expect(block).toContain('BODY');
  });
});

describe('BLD-011 the meter', () => {
  it('separates what this turn costs from what compounds', () => {
    // The number that matters is `pinnedChars`: none of this rides the cached
    // prefix (Rule 6), so a pinned reference is fresh input on every later turn
    // and again on every component a plan authors.
    const cost = referenceCost([
      ref({ id: 'a', pinned: true, resolution: { text: 'x'.repeat(100), chars: 100, truncated: false, originalChars: 100 } }),
      ref({ id: 'b', pinned: false, resolution: { text: 'y'.repeat(50), chars: 50, truncated: false, originalChars: 50 } })
    ]);
    expect(cost.chars).toBe(150);
    expect(cost.pinnedChars).toBe(100);
    expect(cost.count).toBe(2);
  });

  it('counts nothing for a reference that has not resolved or failed', () => {
    const cost = referenceCost([
      ref({ id: 'a', status: 'resolving', resolution: undefined }),
      ref({ id: 'b', status: 'failed', error: 'nope', resolution: undefined })
    ]);
    expect(cost.chars).toBe(0);
    expect(cost.count).toBe(2);
  });

  it('reports truncation so the meter can say the size is a cap, not a size', () => {
    const cost = referenceCost([
      ref({ resolution: { text: 'z', chars: 1, truncated: true, originalChars: 9000 } })
    ]);
    expect(cost.truncated).toBe(true);
  });
});

describe('BLD-011 build item 6 — a reference that cannot be fulfilled blocks the send', () => {
  it('blocks on a failure and while still reading', () => {
    // Failing closed: sending anyway produces a turn whose prompt is missing
    // something the user watched themselves attach, and the only evidence is a
    // chip they have already scrolled past.
    expect(blockingReferences([ref({ status: 'failed', error: 'x', resolution: undefined })])).toHaveLength(1);
    expect(blockingReferences([ref({ status: 'resolving', resolution: undefined })])).toHaveLength(1);
    expect(blockingReferences([ref()])).toHaveLength(0);
  });
});

describe('BLD-011 retention — the record, never the bytes', () => {
  it('persists kind, label, size and pin state and nothing else', () => {
    // A 24k component serialization per turn would make a thread file unusable
    // within a dozen turns and would put a second, silently diverging copy of
    // the project on disk.
    const persisted = toTurnReferences([
      ref({ label: 'Pages/Home', kind: 'component', resolution: { text: 'LONG'.repeat(1000), chars: 4000, truncated: true, originalChars: 90_000 } })
    ]);
    expect(persisted).toEqual([{ kind: 'component', label: 'Pages/Home', chars: 4000, pinned: true, truncated: true }]);
    expect(JSON.stringify(persisted)).not.toContain('LONG');
  });

  it('records nothing for a reference that never resolved', () => {
    expect(toTurnReferences([ref({ status: 'failed', error: 'x', resolution: undefined })])).toEqual([]);
  });
});

describe('BLD-011 the prompt block', () => {
  it('labels each reference by kind and closes every section it opens', () => {
    const block = renderReferenceBlock([
      ref({ id: 'a', kind: 'component', label: 'Pages/Home', resolution: { text: 'GRAPH', chars: 5, truncated: false, originalChars: 5 } }),
      ref({ id: 'b', kind: 'doc', label: 'docs/BRIEF.md', resolution: { text: 'BRIEF', chars: 5, truncated: false, originalChars: 5 } })
    ]);
    expect(block).toContain('--- COMPONENT: Pages/Home ---');
    expect(block).toContain('--- END COMPONENT ---');
    expect(block).toContain('--- DOCUMENT: docs/BRIEF.md ---');
    expect(block).toContain('--- END DOCUMENT ---');
    // It says what these are, so the model does not read an attached component
    // as a second task.
    expect(block).toContain('context for the task, not the task itself');
  });

  it('omits a reference that failed rather than sending an empty section', () => {
    const block = renderReferenceBlock([
      ref({ id: 'a', status: 'failed', error: 'deleted', resolution: undefined }),
      ref({ id: 'b', label: 'docs/BRIEF.md' })
    ]);
    expect(block).not.toContain('--- DOCUMENT: docs/BRIEF.md ---\n---');
    expect(block).toContain('BODY');
  });
});
