/**
 * NAT-009 — the work board's decisions, graded where they are made.
 *
 * ## 🔴 The four claims this file exists to hold, and each is a measurement
 *
 * 1. **The response floor is twenty characters and the composer says so.** `rfp_response_message_shape`
 *    is `between 20 and 4000`. A client guarding only the ceiling sends *"I can do this"* and
 *    renders a 400 for a rule nobody was told about.
 * 2. **`postedNote` is NAT-007's predicate, not its sentence.** It asks whether the response is
 *    IN the copy about to be drawn, by id — so it catches the arm a timestamp check calls fine.
 * 3. **A response's state cannot move, so no sentence offers a next step.** `acceptConnection`
 *    has no caller on the platform outside its own suite.
 * 4. **No sentence in this module claims the poster was emailed.** The relay's reply address is
 *    on an unregistered domain — D10, open — and NAT-014 AC2 is unmet.
 *
 * ⚠️ Written before the module was wired to anything, which is why a spec is the caller. The
 * views that place these are NAT-009's remainder; see the task file's §Status.
 *
 * @module noodl-editor/tests-unit/nat-009/rfpboardview
 */
import type {
  MeResponse,
  MyRfpResponse,
  Paged,
  Read,
  ResponseAccepted,
  RfpSummary,
  Write
} from '@noodl-models/community/communityapi';
import {
  boardBoundLine,
  canSendResponse,
  composeBoard,
  composeBrief,
  composeMyResponses,
  composeResponseBox,
  myResponseMeta,
  NO_NEXT_STEP_NOTE,
  postedNote,
  RELAY_NOTICE,
  RESPONSE_MAX_CHARACTERS,
  RESPONSE_MIN_CHARACTERS,
  RESPONSE_SENT_LINE,
  responseFailureLine,
  responseRefusal,
  rfpMeta,
  selectRfps
} from '@noodl-models/community/rfpboardview';

const NOW = Date.parse('2026-08-20T12:00:00Z');

function rfp(over: Partial<RfpSummary> = {}): RfpSummary {
  return {
    id: 'rfp-1',
    title: 'A stock dashboard that reads our CSV exports',
    description: 'Weekly CSVs, four charts, one filter bar.',
    budgetBand: '£2k–£5k',
    timeline: '6 weeks',
    state: 'open',
    posterHandle: 'nia-new',
    responseCount: 1,
    responsesRemaining: 2,
    createdAt: '2026-08-19T12:00:00Z',
    closedAt: null,
    ...over
  };
}

function paged<T>(items: T[], total = items.length): Paged<T> {
  return { items, page: { limit: 50, offset: 0, total, nextOffset: null } };
}

function mine(over: Partial<MyRfpResponse> = {}): MyRfpResponse {
  return {
    id: 'resp-1',
    rfpId: 'rfp-1',
    rfpTitle: 'A stock dashboard that reads our CSV exports',
    rfpState: 'open',
    posterHandle: 'nia-new',
    message: 'I have shipped three of these and can start next week.',
    createdAt: '2026-08-20T09:00:00Z',
    connectedAt: null,
    posterAccepted: false,
    youAccepted: false,
    ...over
  };
}

const ME_PRESENT: Read<MeResponse> = {
  outcome: 'ok',
  value: { viewer: { handle: 'ada-builds' }, community: { surface: 'present', capabilities: {} } }
} as unknown as Read<MeResponse>;

const ME_ABSENT: Read<MeResponse> = {
  outcome: 'ok',
  value: { viewer: null, community: { surface: 'absent' } }
} as unknown as Read<MeResponse>;

const boxInputs = {
  rfp: rfp(),
  signedIn: true,
  alreadyResponded: false,
  draft: '',
  sending: false,
  last: null as Write<ResponseAccepted> | null,
  onChange: () => undefined,
  onSubmit: () => undefined,
  onHandoff: () => undefined
};

// ── (1) The floor nobody guesses ─────────────────────────────────────────────

describe('the response length rule, both ends of it', () => {
  it('refuses a draft under the platform’s minimum', () => {
    expect(canSendResponse('I can do this')).toBe(false);
    expect(canSendResponse('x'.repeat(RESPONSE_MIN_CHARACTERS))).toBe(true);
    expect(canSendResponse('x'.repeat(RESPONSE_MAX_CHARACTERS))).toBe(true);
    expect(canSendResponse('x'.repeat(RESPONSE_MAX_CHARACTERS + 1))).toBe(false);
  });

  /** 🔴 `btrim`, not `length` — a box of spaces is a message of length 0 to the constraint. */
  it('counts what the constraint counts, which is the trimmed message', () => {
    expect(canSendResponse(`   ${'x'.repeat(RESPONSE_MIN_CHARACTERS - 1)}   `)).toBe(false);
    expect(canSendResponse(`   ${'x'.repeat(RESPONSE_MIN_CHARACTERS)}   `)).toBe(true);
    expect(canSendResponse(' '.repeat(500))).toBe(false);
  });

  /**
   * 🔴 THE SPLIT THAT IS THE POINT. An empty box explains itself — the disabled verb beside it
   * IS the reason. A box with forty characters in it does not: the writer has finished, the verb
   * is dead, and the only thing between them and sending is a floor nobody mentioned.
   */
  it('says nothing about an empty box and names the floor for a short one', () => {
    expect(responseRefusal('')).toBeNull();
    expect(responseRefusal('   ')).toBeNull();

    const short = responseRefusal('I can do this');
    expect(short).toContain(String(RESPONSE_MIN_CHARACTERS));
    expect(short).toContain('7 more');
  });

  it('names the ceiling and by how much', () => {
    const over = responseRefusal('x'.repeat(RESPONSE_MAX_CHARACTERS + 12));
    expect(over).toContain(String(RESPONSE_MAX_CHARACTERS));
    expect(over).toContain('12 characters over');
  });
});

// ── (2) postedNote — NAT-007's predicate ─────────────────────────────────────

describe('postedNote asks whether the thing is in the copy, not how old the copy is', () => {
  const sent: ResponseAccepted = { responseId: 'resp-1', outcome: 'relayed' };

  it('says nothing when nothing has been sent', () => {
    expect(postedNote(null, { outcome: 'ok', value: paged([]) })).toBeNull();
  });

  it('says nothing when the response is in the list about to be drawn', () => {
    expect(postedNote(sent, { outcome: 'ok', value: paged([mine({ id: 'resp-1' })]) })).toBeNull();
  });

  /**
   * 🔴 THE ARM A TIMESTAMP CHECK CALLS FINE. The re-read SUCCEEDED. There is no banner, no
   * staleness, nothing to notice — and the response is not there. Without this the screen reads
   * as *it never sent*, which is the exact failure the composer's error arm exists to prevent.
   */
  it('speaks up when a SUCCESSFUL re-read comes back without it', () => {
    const note = postedNote(sent, { outcome: 'ok', value: paged([mine({ id: 'resp-other' })]) });
    expect(note).toContain('was sent');
    expect(note).toContain('not appeared');
  });

  it('speaks up when the re-read failed, and says which half is which', () => {
    const note = postedNote(sent, { outcome: 'unreachable', status: null, detail: 'offline' });
    expect(note).toContain('was sent');
    expect(note).toContain('could not be re-read');
  });

  /** ⚠️ Nothing read yet is not a lie — the composer's own "Sent" line is still the whole truth. */
  it('stays quiet before the re-read has been attempted', () => {
    expect(postedNote(sent, undefined)).toBeNull();
  });
});

// ── (3) A state that cannot move ─────────────────────────────────────────────

describe('what a sent response says about itself', () => {
  /**
   * 🔴 NOTHING ON THE PLATFORM CALLS `acceptConnection`, so no response has ever connected and
   * none can. A sentence promising a next step would be describing a process nobody is running.
   */
  it('reports what happened and offers no next step', () => {
    const meta = myResponseMeta(mine(), NOW);
    expect(meta).toContain('to @nia-new');
    expect(meta).toContain('sent');
    expect(meta).toContain('request open');
    for (const promise of ['waiting', 'pending', 'accept', 'review']) {
      expect(`${promise}|${meta.toLowerCase()}`).not.toContain(`|${promise}`);
    }
  });

  /**
   * ⚠️ The arm nothing can produce, asserted anyway — so the day somebody builds the caller,
   * this line is already right and a failure here is what says the platform started producing it.
   */
  it('has a sentence ready for the connection that cannot currently happen', () => {
    expect(myResponseMeta(mine({ connectedAt: '2026-08-20T10:00:00Z' }), NOW)).toContain('connected');
  });

  it('the list says the conversation continues elsewhere, once', () => {
    const shown = composeMyResponses({
      me: ME_PRESENT,
      read: { outcome: 'ok', value: paged([mine(), mine({ id: 'resp-2', rfpId: 'rfp-2' })]) },
      onOpen: () => undefined,
      now: NOW
    });
    expect(shown.surface).toBe('shown');
    if (shown.surface !== 'shown') return;
    expect(shown.view.standingNote).toBe(NO_NEXT_STEP_NOTE);
    expect(shown.view.section.state).toBe('items');
  });

  /**
   * 🔴 THE ARM THAT FIRES, and the reason `/v1/me/rfp-responses` answers 401 rather than an
   * empty list. An empty list is what a signed-out read of a personal list looks like, and
   * *"you have sent nothing"* is a lie to tell somebody whose session expired.
   */
  it('a signed-out read is an offer to sign in, never an empty list', () => {
    const shown = composeMyResponses({
      me: ME_PRESENT,
      read: { outcome: 'unauthenticated' },
      onOpen: () => undefined
    });
    expect(shown.surface).toBe('shown');
    if (shown.surface !== 'shown') return;
    expect(shown.view.section.state).toBe('unreachable');
    if (shown.view.section.state !== 'unreachable') return;
    expect(shown.view.section.detail).toContain('Sign in');
  });
});

// ── (4) No sentence claims delivery ──────────────────────────────────────────

describe('nothing here says the poster has been emailed', () => {
  /**
   * 🔴 The relay's `Reply-To` is on `relay.nodegx.dev`, unregistered, with nothing receiving mail
   * on it — **D10 open, NAT-014 AC2 unmet**. Every sentence this module can draw is swept.
   */
  it('no drawable sentence claims a delivery', () => {
    const failures = (['unauthenticated', 'absent', 'refused', 'unreachable'] as const).map((o) =>
      responseFailureLine({ outcome: o, detail: 'x', status: null } as unknown as Write<ResponseAccepted>)
    );
    const everySentence = [
      RESPONSE_SENT_LINE,
      NO_NEXT_STEP_NOTE,
      ...failures.filter((line): line is string => line !== null)
    ];
    for (const line of everySentence) {
      expect(line.toLowerCase()).not.toContain('emailed');
      expect(line.toLowerCase()).not.toContain('has been sent to');
      expect(line.toLowerCase()).not.toContain('in their inbox');
    }
  });

  /** ⚠️ It does say HOW a response travels, before anybody writes one — including the refusal. */
  it('the relay notice is drawn beside an open request and names the address rule', () => {
    expect(RELAY_NOTICE).toContain('relay');
    expect(RELAY_NOTICE.toLowerCase()).toContain('address');
    const brief = composeBrief({
      rfp: rfp(),
      signedIn: true,
      draft: '',
      sending: false,
      last: null,
      sent: null,
      onChange: () => undefined,
      onSubmit: () => undefined,
      onHandoff: () => undefined,
      now: NOW
    });
    expect(brief.relayNotice).toBe(RELAY_NOTICE);
  });
});

// ── The composer's four arms ─────────────────────────────────────────────────

describe('the responding affordance', () => {
  it('draws nothing at all on a closed request', () => {
    expect(composeResponseBox({ ...boxInputs, rfp: rfp({ state: 'closed' }) })).toBeNull();
  });

  it('gives a signed-out reader the labelled hand-off, not a dead box', () => {
    const box = composeResponseBox({ ...boxInputs, signedIn: false });
    expect(box?.kind).toBe('handoff');
  });

  /**
   * 🔴 The one refusal a client may predict, because it predicts it from something it HOLDS —
   * the caller's own list. ⚠️ D8's bar and a ban are facts about the account this client cannot
   * see, and guessing at those would mean re-implementing D15 in the editor.
   */
  it('draws nothing once this viewer has already responded', () => {
    expect(composeResponseBox({ ...boxInputs, alreadyResponded: true })).toBeNull();
  });

  it('is a composer otherwise, disabled until the floor is met', () => {
    const box = composeResponseBox({ ...boxInputs, draft: 'too short' });
    expect(box?.kind).toBe('composer');
    if (box?.kind !== 'composer') return;
    expect(box.canSubmit).toBe(false);
    expect(box.blockedReason).toContain(String(RESPONSE_MIN_CHARACTERS));
  });

  /** 🔴 AC4's rule, inherited: every failure arm keeps the text and says so. */
  it('keeps the text on every failure, and says it is still there', () => {
    for (const outcome of ['unauthenticated', 'absent', 'refused', 'unreachable'] as const) {
      const write = { outcome, detail: 'the cap is spent.', status: null } as unknown as Write<ResponseAccepted>;
      const line = responseFailureLine(write);
      // ⚠️ The outcome is put in the SUBJECT rather than in a second argument: `expect(v, msg)`
      // is vitest's and this runner is jest, where the extra argument is a type error.
      expect(`${outcome}: ${line}`).toContain('still here');
      const box = composeResponseBox({ ...boxInputs, draft: 'x'.repeat(50), last: write });
      expect(box?.kind).toBe('composer');
      if (box?.kind !== 'composer') return;
      expect(box.value).toBe('x'.repeat(50));
      expect({ outcome, note: box.note }).toEqual({ outcome, note: null });
    }
  });

  /** ⚠️ The platform's own words reach the reader — seven sentences this client could not write. */
  it('carries the platform’s sentence through a refusal', () => {
    const line = responseFailureLine({
      outcome: 'refused',
      detail: 'this request has taken all the responses it will take.'
    } as Write<ResponseAccepted>);
    expect(line).toContain('all the responses it will take');
  });
});

// ── The board itself ─────────────────────────────────────────────────────────

describe('the board', () => {
  const inputs = { query: '', state: 'open' as const, onOpen: () => undefined, now: NOW };

  /** 🔴 D15, off `me` alone, before anything is fetched. */
  it('is not drawn at all for a viewer the community is absent for', () => {
    expect(composeBoard({ ...inputs, me: ME_ABSENT }).surface).toBe('hidden');
  });

  /**
   * 🔴 "Nobody is hiring" and "we could not ask" are opposite facts, and the first is the one
   * that makes somebody stop looking for work in this editor.
   */
  it('a failed read is unreachable and never an empty board', () => {
    const shown = composeBoard({
      ...inputs,
      me: ME_PRESENT,
      read: { outcome: 'unreachable', status: null, detail: 'offline' }
    });
    if (shown.surface !== 'shown') throw new Error('hidden');
    expect(shown.view.section.state).toBe('unreachable');
  });

  it('an empty board says what the board is FOR, and a fruitless search says something else', () => {
    const empty = composeBoard({ ...inputs, me: ME_PRESENT, read: { outcome: 'ok', value: paged([]) } });
    if (empty.surface !== 'shown') throw new Error('hidden');

    const searched = composeBoard({
      ...inputs,
      query: 'kubernetes',
      me: ME_PRESENT,
      read: { outcome: 'ok', value: paged([rfp()]) }
    });
    if (searched.surface !== 'shown') throw new Error('hidden');
    expect(searched.view.section.state).toBe('empty');
    expect(searched.view.emptyLine).not.toBe(empty.view.emptyLine);
    expect(searched.view.emptyLine.toLowerCase()).toContain('matches that');
  });

  /** 🔴 The endpoint has no `q` — the fifth in this API with none. The filter is local. */
  it('searches the fields the row shows', () => {
    const rows = [
      rfp(),
      rfp({
        id: 'rfp-2',
        title: 'A booking app',
        description: 'Rooms and times',
        posterHandle: 'ada-builds',
        // ⚠️ A distinct band, or the budget assertion below matches BOTH rows off the default
        // fixture and reads as a search that ignored its needle. Caught by the assertion.
        budgetBand: 'under £1k'
      })
    ];
    expect(selectRfps(rows, 'booking').map((r) => r.id)).toEqual(['rfp-2']);
    expect(selectRfps(rows, 'ada').map((r) => r.id)).toEqual(['rfp-2']);
    expect(selectRfps(rows, '£2k').map((r) => r.id)).toEqual(['rfp-1']);
    expect(selectRfps(rows, '').length).toBe(2);
  });

  /**
   * 🔴 A BOUNDED QUERY REPORTS ITS BOUND. A search box over one page is a search over a fraction
   * of the board that looks like a search over all of it.
   */
  it('says how much of the board it actually searched, and stays quiet when it searched all of it', () => {
    expect(boardBoundLine(paged([rfp()], 1))).toBeNull();
    const bounded = boardBoundLine(paged([rfp()], 40));
    expect(bounded).toContain('1 request');
    expect(bounded).toContain('40');
  });

  it('the summary’s denominator is what we hold, not what the platform says exists', () => {
    const shown = composeBoard({
      ...inputs,
      query: 'stock',
      me: ME_PRESENT,
      read: { outcome: 'ok', value: paged([rfp(), rfp({ id: 'rfp-2', title: 'A booking app' })], 40) }
    });
    if (shown.surface !== 'shown') throw new Error('hidden');
    expect(shown.view.summary).toBe('1 of 2 requests');
    expect(shown.view.boundLine).toContain('40');
  });

  it('a row leads with the state a screen reader would otherwise never hear', () => {
    const shown = composeBoard({
      ...inputs,
      state: 'closed',
      me: ME_PRESENT,
      read: { outcome: 'ok', value: paged([rfp({ state: 'closed' })]) }
    });
    if (shown.surface !== 'shown' || shown.view.section.state !== 'items') throw new Error('no items');
    expect(shown.view.section.items[0].ariaLabel).toContain('Closed request');
  });

  it('a row’s meta shows the approach to the cap, which is what a reader acts on', () => {
    expect(rfpMeta(rfp(), NOW)).toContain('room for 2 more');
    expect(rfpMeta(rfp({ state: 'closed', responsesRemaining: 0 }), NOW)).toContain('closed');
  });
});

describe('the brief', () => {
  const base = {
    signedIn: true,
    draft: '',
    sending: false,
    last: null,
    sent: null,
    onChange: () => undefined,
    onSubmit: () => undefined,
    onHandoff: () => undefined,
    now: NOW
  };

  it('says whether this viewer has already responded, and stops offering the box', () => {
    const brief = composeBrief({
      ...base,
      rfp: rfp(),
      mine: { outcome: 'ok', value: paged([mine({ rfpId: 'rfp-1' })]) }
    });
    expect(brief.alreadyRespondedLine).toContain('already responded');
    expect(brief.reply).toBeNull();
  });

  /** ⚠️ A response to a DIFFERENT request must not close this one's composer. */
  it('a response to another request leaves this one open', () => {
    const brief = composeBrief({
      ...base,
      rfp: rfp(),
      mine: { outcome: 'ok', value: paged([mine({ id: 'r2', rfpId: 'rfp-other' })]) }
    });
    expect(brief.alreadyRespondedLine).toBeNull();
    expect(brief.reply?.kind).toBe('composer');
  });

  it('a closed request draws its standing and no composer', () => {
    const brief = composeBrief({ ...base, rfp: rfp({ state: 'closed', responseCount: 3 }) });
    expect(brief.standing).toContain('closed');
    expect(brief.reply).toBeNull();
    expect(brief.relayNotice).toBeNull();
  });
});
