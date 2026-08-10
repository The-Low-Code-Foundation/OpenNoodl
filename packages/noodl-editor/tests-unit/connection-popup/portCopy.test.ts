/**
 * SIG-001/002/004 — the copy, graded as copy.
 *
 * Three of these specs are unusual: they assert what the strings **do not**
 * say. That is deliberate. The phase's one hard constraint is that no sentence
 * shipped here may claim a signal never carries a value — `boolean -> signal` is
 * in the cast table, so a builder can disprove it in an afternoon — and a
 * constraint held only by whoever last read the task file is a constraint with
 * an expiry date. These are the expiry date.
 */

import {
  escapeHtml,
  portTypeSentence,
  portTypeSentenceHtml,
  redirectOffer,
  refusalHeadline,
  refusedGroupSummary,
  TIMING_INTENT_ANSWER
} from '../../src/editor/src/views/ConnectionPopup/portCopy';

/** Every string this module can produce, for the "never says X" sweep. */
function everySentence(): string[] {
  return [
    portTypeSentenceHtml('signal', 'input'),
    portTypeSentenceHtml('signal', 'output'),
    portTypeSentenceHtml('string', 'input'),
    portTypeSentenceHtml('string', 'output'),
    refusalHeadline('signal-rule', 'string', 'signal'),
    refusalHeadline('type-mismatch', 'string', 'number'),
    refusalHeadline('duplicate', 'string', 'string'),
    refusedGroupSummary(4, 'type-mismatch', 'signal'),
    refusedGroupSummary(3, 'signal-rule', undefined),
    refusedGroupSummary(1, 'type-mismatch', 'number'),
    refusedGroupSummary(2, 'duplicate'),
    redirectOffer('Text', 'string', [{ displayName: 'Label' }], true).text,
    redirectOffer('Text', 'string', [{ displayName: 'Label' }, { displayName: 'X' }], false).text,
    redirectOffer('Done', 'signal', [{ displayName: 'Do' }], true).text,
    redirectOffer('Done', 'signal', [{ displayName: 'Do' }, { displayName: 'X' }], false).text,
    redirectOffer('Text', 'string', [], true).text,
    TIMING_INTENT_ANSWER
  ].filter(Boolean) as string[];
}

describe('SIG-004 — the type sentence', () => {
  it('calls a signal a moment, in both directions, with one wording', () => {
    const asInput = portTypeSentence('signal', 'input');
    const asOutput = portTypeSentence('signal', 'output');

    expect(asInput.lead).toBe('Signal — a moment, not a value.');
    // Not merely equal wording — the same object, so a future edit cannot give
    // signal inputs and signal outputs two vocabularies by touching one branch.
    expect(asOutput).toBe(asInput);
  });

  it('calls a value live, and does not tell an output about its own source', () => {
    expect(portTypeSentence('string', 'input').lead).toBe('Value — live.');
    expect(portTypeSentence('string', 'input').body).toContain('whenever the source changes');

    expect(portTypeSentence('string', 'output').lead).toBe('Value — live.');
    // An output has no source; saying "whenever the source changes" on one is
    // the direction bug this split exists to prevent.
    expect(portTypeSentence('string', 'output').body).not.toContain('the source');
  });

  it('has nothing type-level to say about the wildcard type', () => {
    // A `*` port is neither a moment nor a standing state. Inventing a third
    // sentence for it is how one vocabulary becomes three.
    expect(portTypeSentence('*', 'input')).toBeUndefined();
    expect(portTypeSentenceHtml('*', 'input')).toBeUndefined();
    expect(portTypeSentence(undefined, 'input')).toBeUndefined();
  });

  it('bolds the lead and nothing else', () => {
    const html = portTypeSentenceHtml('signal', 'input');
    expect(html).toContain('<strong>Signal — a moment, not a value.</strong>');
    expect(html.match(/<strong>/g)).toHaveLength(1);
  });
});

describe('SIG-001 — the refusal, in the builder’s terms', () => {
  it('names the category when a value is dragged at a signal', () => {
    expect(refusalHeadline('signal-rule', 'string', 'signal')).toBe('Signal inputs are moments, not values.');
  });

  it('names both types when the cast table is what refused', () => {
    const headline = refusalHeadline('type-mismatch', 'string', 'number');
    expect(headline).toContain('<strong>string</strong>');
    expect(headline).toContain('<strong>number</strong>');
  });

  it('says a duplicate is a duplicate, not a type problem', () => {
    expect(refusalHeadline('duplicate', 'signal', 'signal')).toBe('Already connected.');
  });

  it('summarises a refused group by its category, pluralised', () => {
    // A String dragged at a Button: the cast table refuses it, so the reason is
    // `type-mismatch` and the *target* is what names the category.
    expect(refusedGroupSummary(4, 'type-mismatch', 'signal')).toBe('4 signal inputs · a moment, not a value');
    expect(refusedGroupSummary(1, 'type-mismatch', 'signal')).toBe('1 signal input · a moment, not a value');
  });

  it('says the same thing from the other end when a signal was dragged at values', () => {
    // `isBlockedBySignalRule` excludes `signal` and `*`, so every port it
    // refuses is a value port — which is why this may be said even though the
    // refused ports do not share one type.
    expect(refusedGroupSummary(3, 'signal-rule', undefined)).toBe(
      '3 value inputs · a signal is a moment, not a value'
    );
  });

  it('falls back to a generic summary when the ports do not share a type', () => {
    expect(refusedGroupSummary(3, 'other', undefined)).toBe("3 ports this wire can't reach");
  });
});

describe('SIG-001 §5 — the wire they meant', () => {
  it('names the target and promises the wire when the redirect is confident', () => {
    const offer = redirectOffer('Text', 'string', [{ displayName: 'Label' }], true);
    expect(offer.actionable).toBe(true);
    expect(offer.text).toContain('<strong>Label</strong>');
    expect(offer.text).toContain('updates by itself');
  });

  /*
   * The defect, measured live: this branch used to read "connect it to
   * **Label** instead" and be clickable, while the click scrolled the list and
   * drew no wire. The verb and the behaviour now come off the same flag.
   */
  it('promises nothing it will not do when the best candidate is only first', () => {
    const offer = redirectOffer('Text', 'string', [{ displayName: 'Label' }, { displayName: 'Placeholder' }], false);
    expect(offer.actionable).toBe(false);
    expect(offer.text).not.toMatch(/connect it to/);
    expect(offer.text).toContain('pick a value input below');
    expect(offer.text).toContain('updates by itself');
  });

  it('does not tell a signal output that it is already live', () => {
    // The phase is named for two opposite questions. "Is already live" is the
    // answer to one of them and the wrong lesson, confidently delivered, for the
    // other — a `Done` output is not live, it is a moment.
    const offer = redirectOffer('Done', 'signal', [{ displayName: 'Do' }], true);
    expect(offer.actionable).toBe(true);
    expect(offer.text).not.toContain('already live');
    expect(offer.text).toContain('is a moment');
    expect(offer.text).toContain('<strong>Do</strong>');
  });

  it('keeps the signal wording in the advisory branch too', () => {
    const offer = redirectOffer('Done', 'signal', [{ displayName: 'Do' }, { displayName: 'Clear' }], false);
    expect(offer.actionable).toBe(false);
    expect(offer.text).not.toContain('already live');
    expect(offer.text).toContain('pick a signal input below');
  });

  it('offers nothing, and says so, when nothing on the node can take the source', () => {
    const offer = redirectOffer('Done', 'signal', [], true);
    expect(offer.actionable).toBe(false);
    expect(offer.text).toBe('Nothing on this node takes a <strong>signal</strong>.');
  });

  it('escapes a port name, because a custom module writes these', () => {
    const offer = redirectOffer('<img src=x>', 'string', [{ displayName: 'Label' }], true);
    expect(offer.text).not.toContain('<img');
    expect(offer.text).toContain('&lt;img src=x&gt;');
  });

  it('escapes the ampersand first, so an escape cannot be double-applied', () => {
    expect(escapeHtml('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });
});

describe('SIG-002 — the answer at the empty search', () => {
  it('names both mechanisms for controlling when a value lands', () => {
    expect(TIMING_INTENT_ANSWER).toContain('<strong>Variable</strong>');
    expect(TIMING_INTENT_ANSWER).toContain('<strong>Run On Value Change</strong>');
  });

  it('says the value inputs update on their own', () => {
    expect(TIMING_INTENT_ANSWER).toContain('update on their own');
  });
});

describe('⚠️ the falsehood this phase may not ship', () => {
  it('never claims a signal cannot carry a value', () => {
    // `nodelibraryexport.ts:207` allows `boolean -> signal`. Any of these
    // phrasings is disprovable by wiring one Boolean output.
    const forbidden = [
      /signals? (?:never|do(?:es)?n't|do not|cannot|can't|carr(?:y|ies) no)/i,
      /carr(?:y|ies) no value/i,
      /without (?:a |any )?value/i
    ];

    for (const sentence of everySentence()) {
      for (const pattern of forbidden) {
        expect(sentence).not.toMatch(pattern);
      }
    }
  });

  it('never paints a refusal as the builder’s mistake', () => {
    // Phase 23: red is danger only, and a refused connection is a category the
    // editor is explaining — not an error somebody made.
    for (const sentence of everySentence()) {
      expect(sentence).not.toMatch(/\b(error|invalid|illegal|wrong|not allowed|forbidden)\b/i);
    }
  });
});
