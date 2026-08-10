/**
 * BLD-016 — the mention mechanism, which is the part that has no appearance.
 *
 * The acceptance criterion this file exists for is *"deleting the inserted token
 * removes the chip, and vice versa"*, and that is a statement about a
 * reconciliation nobody can see. A menu that lists the right things and a chip
 * row that shows the right chips can both be correct while the two disagree
 * about what the message carries — and the only symptom would be a turn that
 * sends an attachment the user deleted, or omits one they can see.
 *
 * So the grammar, the settle rule, both directions of reconciliation and the
 * refusal all get graded here, in a plain-Node runner, before any of it is on
 * screen.
 */

import {
  filterMentionCandidates,
  insertMention,
  mentionQuery,
  mentionToken,
  parseMentions,
  reconcileMentions,
  removeMentionToken,
  type AttachedForMention,
  type MentionCandidate
} from '../../src/editor/src/models/AiAssistant/thread/mentions';

const CANDIDATES: MentionCandidate[] = [
  { kind: 'component', label: 'Library/Layout/Row', target: '/Library/Layout/Row' },
  { kind: 'page', label: 'Pages/Checkout', target: '/#__page__/Checkout' },
  { kind: 'doc', label: 'docs/BRIEF.md', target: 'docs/BRIEF.md' },
  { kind: 'collection', label: 'Orders', target: 'Orders' },
  { kind: 'component', label: 'My Cart Widget', target: '/My Cart Widget' }
];

function attached(over: Partial<AttachedForMention> = {}): AttachedForMention {
  return {
    id: over.id ?? 'r1',
    label: over.label ?? 'Pages/Checkout',
    ...(over.mention ? { mention: over.mention } : {})
  };
}

describe('BLD-016 the token grammar', () => {
  it('reads a bare token including the slashes that make it a path', () => {
    const [mention] = parseMentions('look at @Library/Layout/Row please');
    expect(mention.token).toBe('@Library/Layout/Row');
    expect(mention.label).toBe('Library/Layout/Row');
  });

  it('quotes a label the bare grammar cannot spell, and reads it back', () => {
    const token = mentionToken('My Cart Widget');
    expect(token).toBe('@"My Cart Widget"');
    const [mention] = parseMentions(`copy ${token} exactly`);
    expect(mention.label).toBe('My Cart Widget');
  });

  it('leaves an ordinary name unquoted', () => {
    expect(mentionToken('Pages/Checkout')).toBe('@Pages/Checkout');
  });

  /**
   * The one `@` everybody writes without meaning a mention. A grammar that
   * matched it would refuse every message containing an email address.
   */
  it('is not fooled by an email address', () => {
    expect(parseMentions('mail richard@digitalbricks.io about it')).toEqual([]);
  });

  it('ignores a bare @ with nothing after it', () => {
    expect(parseMentions('ping @ me later')).toEqual([]);
  });

  it('ignores an unclosed quote — that is a mention still being typed', () => {
    expect(parseMentions('use @"My Cart')).toEqual([]);
  });

  /**
   * The settle rule, which is the whole of "do not accuse the user of six
   * mistakes on the way to typing one name".
   */
  it('marks the last token unsettled and every earlier one settled', () => {
    const mentions = parseMentions('@Orders and @Pages/Che');
    expect(mentions.map((m) => m.settled)).toEqual([true, false]);
  });

  it('settles a token the moment any character follows it — including a space', () => {
    expect(parseMentions('@Orders ')[0].settled).toBe(true);
  });
});

describe('BLD-016 the caret and the menu', () => {
  it('reports the run the caret is inside', () => {
    const text = 'look at @Pages/Che';
    expect(mentionQuery(text, text.length)).toEqual({ start: 8, query: 'Pages/Che' });
  });

  it('opens with an empty query the instant @ is pressed', () => {
    expect(mentionQuery('go @', 4)).toEqual({ start: 3, query: '' });
  });

  it('reports nothing once the caret leaves the run', () => {
    expect(mentionQuery('@Orders and more', 16)).toBeUndefined();
  });

  it('reports nothing inside an email', () => {
    const text = 'richard@digitalbricks.io';
    expect(mentionQuery(text, text.length)).toBeUndefined();
  });

  it('inserts over the run being typed and leaves the caret after a trailing space', () => {
    const next = insertMention('look at @Pages/Che', 18, '@Pages/Checkout');
    expect(next.text).toBe('look at @Pages/Checkout ');
    expect(next.caret).toBe(next.text.length);
  });

  it('inserts mid-sentence without eating what follows', () => {
    const text = 'see @Pag for the layout';
    const next = insertMention(text, 8, '@Pages/Checkout');
    expect(next.text).toBe('see @Pages/Checkout  for the layout');
    expect(next.caret).toBe('see @Pages/Checkout '.length);
  });

  /** The inserted token is settled, so the picked path and the typed path agree. */
  it('produces a settled token, so picking and typing converge', () => {
    const next = insertMention('go @', 4, '@Orders');
    expect(parseMentions(next.text)[0].settled).toBe(true);
  });
});

describe('BLD-016 removing a token', () => {
  it('takes one following space with it', () => {
    expect(removeMentionToken('see @Pages/Checkout for the layout', '@Pages/Checkout')).toBe('see for the layout');
  });

  /**
   * Two tokens are one chip, so removing the chip has to remove both — a Remove
   * button that leaves the reference attached is a control that visibly does
   * nothing.
   */
  it('removes every occurrence, not the first', () => {
    const text = '@Orders then @Orders again';
    expect(removeMentionToken(text, '@Orders')).toBe('then again');
  });

  it('leaves text alone when the token is not there', () => {
    expect(removeMentionToken('nothing here', '@Orders')).toBe('nothing here');
  });
});

describe('BLD-016 reconciliation — the one rule', () => {
  it('attaches a settled token that names something', () => {
    const result = reconcileMentions({
      text: 'change @Pages/Checkout please',
      candidates: CANDIDATES,
      attached: []
    });
    expect(result.attach).toHaveLength(1);
    expect(result.attach[0].candidate.target).toBe('/#__page__/Checkout');
    expect(result.attach[0].token).toBe('@Pages/Checkout');
    expect(result.refusals).toEqual([]);
  });

  /** Nothing is read while a name is half-typed. */
  it('does not attach the token still under the caret', () => {
    const result = reconcileMentions({ text: 'change @Pages/Che', candidates: CANDIDATES, attached: [] });
    expect(result.attach).toEqual([]);
    expect(result.refusals).toEqual([]);
  });

  it('grades the in-flight token at send time', () => {
    const result = reconcileMentions({
      text: 'change @Pages/Che',
      candidates: CANDIDATES,
      attached: [],
      includeUnsettled: true
    });
    expect(result.attach).toEqual([]);
    expect(result.refusals.map((r) => r.token)).toEqual(['@Pages/Che']);
  });

  /** 🔴 The acceptance criterion, in the direction that is easy to forget. */
  it('detaches a mention whose token has been edited', () => {
    const result = reconcileMentions({
      text: 'change @Pages/Chec',
      candidates: CANDIDATES,
      attached: [attached({ id: 'r7', mention: '@Pages/Checkout' })]
    });
    expect(result.detach).toEqual(['r7']);
  });

  /**
   * ⚠️ The interaction the two rules could have got wrong together: `attach`
   * respects `settled` and `detach` does not, so deleting the space after a
   * finished mention makes it unsettled — and must NOT drop the chip, because
   * the token is still every character it was.
   */
  it('does not detach when only the trailing space is deleted', () => {
    const result = reconcileMentions({
      text: 'change @Pages/Checkout',
      candidates: CANDIDATES,
      attached: [attached({ id: 'r7', mention: '@Pages/Checkout' })]
    });
    expect(result.detach).toEqual([]);
    expect(result.attach).toEqual([]);
  });

  it('never detaches a reference the picker or a drop put there', () => {
    const result = reconcileMentions({
      text: 'no mentions at all',
      candidates: CANDIDATES,
      attached: [attached({ id: 'dropped', label: 'mock.png' })]
    });
    expect(result.detach).toEqual([]);
  });

  it('makes one chip out of the same token written twice', () => {
    const result = reconcileMentions({
      text: '@Orders here and @Orders there',
      candidates: CANDIDATES,
      attached: []
    });
    expect(result.attach).toHaveLength(1);
  });

  /**
   * BLD-016's fifth kind. The bytes are already riding the turn; mentioning the
   * file names it in the sentence and must not attach a second copy.
   */
  it('treats a token naming something already on the row as satisfied', () => {
    const result = reconcileMentions({
      text: 'match the spacing in @mock.png',
      candidates: [...CANDIDATES, { kind: 'file', label: 'mock.png', target: 'mock.png' }],
      attached: [attached({ id: 'dropped', label: 'mock.png' })]
    });
    expect(result.attach).toEqual([]);
    expect(result.refusals).toEqual([]);
  });

  it('resolves a differently-cased name to the one thing it can mean', () => {
    const result = reconcileMentions({ text: '@orders here', candidates: CANDIDATES, attached: [] });
    expect(result.attach[0].candidate.label).toBe('Orders');
  });

  /** Two things that differ only by case is an ambiguity, not a match. */
  it('refuses rather than guessing between two case-variant names', () => {
    const result = reconcileMentions({
      text: '@orders here',
      candidates: [
        { kind: 'collection', label: 'Orders', target: 'Orders' },
        { kind: 'collection', label: 'orders', target: 'orders' }
      ],
      attached: []
    });
    // The exact spelling still wins outright — this is only about the fallback.
    expect(result.attach[0].candidate.target).toBe('orders');

    const ambiguous = reconcileMentions({
      text: '@ORDERS here',
      candidates: [
        { kind: 'collection', label: 'Orders', target: 'Orders' },
        { kind: 'collection', label: 'orders', target: 'orders' }
      ],
      attached: []
    });
    expect(ambiguous.attach).toEqual([]);
    expect(ambiguous.refusals).toHaveLength(1);
  });

  /** AIB-010's finding, in the composer: a name must not silently mean nothing. */
  it('refuses a settled token that names nothing, by name', () => {
    const result = reconcileMentions({ text: 'change @Chekcout now', candidates: CANDIDATES, attached: [] });
    expect(result.refusals).toEqual([
      { token: '@Chekcout', label: 'Chekcout', reason: 'Nothing in this project is called Chekcout.' }
    ]);
  });

  /** …and must not trap somebody asking about `@media` queries. */
  it('drops a refusal the user has dismissed as literal', () => {
    const result = reconcileMentions({
      text: 'use @media queries here',
      candidates: CANDIDATES,
      attached: [],
      dismissed: new Set(['@media'])
    });
    expect(result.refusals).toEqual([]);
    expect(result.attach).toEqual([]);
  });
});

describe('BLD-016 the menu filter', () => {
  it('ranks a whole-label prefix above a path segment above a bare substring', () => {
    const ranked = filterMentionCandidates(
      [
        { kind: 'component', label: 'Widgets/Order', target: 'a' },
        { kind: 'component', label: 'Orders', target: 'b' },
        { kind: 'component', label: 'ReorderRow', target: 'c' }
      ],
      'order'
    );
    expect(ranked.map((c) => c.target)).toEqual(['b', 'a', 'c']);
  });

  /**
   * Every useful component name in this product is the tail of a path, so a
   * prefix-only filter would make the menu useless for anyone who types the name
   * of the thing rather than the folder it lives in.
   */
  it('finds a component by its last path segment', () => {
    const ranked = filterMentionCandidates(CANDIDATES, 'row');
    expect(ranked.map((c) => c.label)).toEqual(['Library/Layout/Row']);
  });

  it('returns everything for an empty query', () => {
    expect(filterMentionCandidates(CANDIDATES, '')).toHaveLength(CANDIDATES.length);
  });
});
