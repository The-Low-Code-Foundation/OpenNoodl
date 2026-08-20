/**
 * NAT-009 — the work board, as data.
 *
 * ## Why this is a module and not a component
 *
 * `threadview.ts`, `peopleview.ts` and `threadwrites.ts` all give the reason and it is unchanged:
 * this repo's jest has no DOM, so **every decision with a word in it** — which sentence an empty
 * board gets, what a 19-character draft says, whether a composer is drawn at all, whether a
 * response that was just sent is actually in the list about to be drawn — has to be a function a
 * spec can call.
 *
 * ## 🔴 The three findings this module is built around, all measured rather than assumed
 *
 * **1. The response cap is a MINIMUM as well as a maximum, and nothing on the board mentions it.**
 * `rfp_response_message_shape` is `check (length(btrim(message)) between 20 and 4000)`. Twenty is
 * the number nobody guesses: somebody who types *"I can do this, email me"* is refused for being
 * too short, and a client that only guarded the ceiling would send it and render a 400.
 *
 * **2. A response's state cannot move, and drawing it as a process would be a lie.** The relay
 * thread beside a response has an accept-and-connect step; `acceptConnection` — the only function
 * that performs it — has no caller anywhere on the platform but its own suite. So `connectedAt`
 * is null and both accepts are false on every response that will ever exist until somebody builds
 * that caller. {@link myResponseMeta} states what is true and offers no next step, because there
 * is none to offer.
 *
 * **3. The reply address does not exist.** The double-blind email carries a `Reply-To` on
 * `relay.nodegx.dev`, an **unregistered domain with nothing receiving mail on it** — D10, open.
 * So no sentence in this module says a response has been *delivered*. {@link RESPONSE_SENT_LINE}
 * claims what this client can actually stand behind, and NAT-009 AC5 stays open until NAT-014's
 * AC2 puts mail in a real inbox.
 *
 * ## 🔴 `postedNote` is NAT-007's fix, copied as a PREDICATE and not as a sentence
 *
 * That task found a screen true in every word and still a lie: post an answer, the re-read fails,
 * and what is left is a cached copy taken *before* the post, under a banner saying so — every
 * sentence accurate, the answer missing, nothing saying why. The fix's shape is what matters. It
 * asks **"is the thing I just sent IN the copy I am about to draw"**, by id against the array,
 * rather than comparing timestamps — which also catches the arm a timestamp check calls fine: a
 * re-read that *succeeds* and comes back without it.
 *
 * @module noodl-editor/models/community/rfpboardview
 */

import {
  metaLine,
  relativeTime,
  type CommunityReplyBox,
  type CommunityRowProps,
  type CommunitySectionState
} from '@noodl-core-ui/components/community';

import type {
  MeResponse,
  MyRfpResponse,
  Paged,
  Read,
  ResponseAccepted,
  RfpSummary,
  Write
} from './communityapi';

// ── The platform's own numbers, copied, and the copy is declared ──────────────

/**
 * `rfp_response_message_shape`, both ends.
 *
 * ⚠️ **This is a second copy of a rule that lives in a migration.** `threadwrites.ts` makes the
 * same trade for `bench_post_body_shape` and its argument holds here: no endpoint publishes these
 * numbers, they were **read off the constraint** rather than inferred, and being wrong is
 * *visible* — too high gets a 400 whose words are drawn, too low refuses a draft in a sentence
 * naming the number. NAT-008's four guessed rate-band keys drew nothing at all, which is the
 * failure mode this one does not have.
 */
export const RESPONSE_MIN_CHARACTERS = 20;
export const RESPONSE_MAX_CHARACTERS = 4000;

/** 🔴 `btrim`, not `length` — the constraint counts the trimmed message. */
export function responseLength(draft: string): number {
  return draft.trim().length;
}

export function canSendResponse(draft: string): boolean {
  const length = responseLength(draft);
  return length >= RESPONSE_MIN_CHARACTERS && length <= RESPONSE_MAX_CHARACTERS;
}

/**
 * The sentence under a refused verb, or `null` when the refusal explains itself.
 *
 * 🔴 **An EMPTY box gets `null` and a SHORT one gets a sentence, and the split is the whole
 * point.** `threadwrites.draftRefusal` returns null for empty because a disabled verb beside an
 * empty field is already legible — the reason is the empty field. That reasoning does **not**
 * extend to a box with forty characters in it: the writer has finished, the verb is dead, and
 * the only thing between them and sending is a floor nobody told them about.
 */
export function responseRefusal(draft: string): string | null {
  const length = responseLength(draft);
  if (length === 0) return null;
  if (length < RESPONSE_MIN_CHARACTERS) {
    const short = RESPONSE_MIN_CHARACTERS - length;
    return `A response is at least ${RESPONSE_MIN_CHARACTERS} characters — ${short} more to go.`;
  }
  if (length > RESPONSE_MAX_CHARACTERS) {
    const over = length - RESPONSE_MAX_CHARACTERS;
    return `That is ${over} character${over === 1 ? '' : 's'} over the board's limit of ${RESPONSE_MAX_CHARACTERS}.`;
  }
  return null;
}

/**
 * What a failed send says.
 *
 * 🔴 **Every arm keeps the text, and says so.** NAT-009 inherits AC4's rule from NAT-007 —
 * *"losing somebody's typed answer to a network blip is worse than the browser hand-off this
 * task replaces"* — and a response is a longer piece of writing than an answer, composed once.
 *
 * ⚠️ **`refused` carries the platform's own sentence and this is where that pays.** This route
 * answers `409` for four different reasons — the request is closed, you posted it, you already
 * responded, the cap is spent — plus `403` for D8's bar, `400` for a smuggled address and `429`
 * for the hourly rate. Seven sentences a person can act on, none of which this client could have
 * written, all of which arrive in `write.detail`.
 *
 * ⚠️ `absent` must not narrate. A 404 here is a hidden request, a missing one, a malformed id
 * **and** a viewer D15 refuses, byte-identical on purpose — `docs/API.md` §4.
 */
export function responseFailureLine(write: Write<ResponseAccepted>): string | null {
  switch (write.outcome) {
    case 'ok':
      return null;
    case 'unauthenticated':
      return 'Your session has expired, so this was not sent. Sign in to the community again — your response is still here.';
    case 'absent':
      return 'This request is not available any more, so this was not sent. Your response is still here.';
    case 'refused':
      return `The board did not accept this: ${write.detail} Your response is still here.`;
    case 'unreachable':
      return 'The community could not be reached, so this was not sent. Your response is still here — try again when you are back on the network.';
  }
}

/**
 * What a successful send says, before the re-read lands.
 *
 * 🔴 **IT DOES NOT SAY THE POSTER HAS BEEN EMAILED, AND THE OMISSION IS DELIBERATE.** The
 * platform queues a double-blind email whose `Reply-To` is on `relay.nodegx.dev` — a domain
 * nobody has registered, with nothing receiving mail on it. **D10 is open and NAT-014's AC2 is
 * unmet**, so *"the poster has been emailed"* is a sentence this client cannot stand behind. What
 * it can stand behind is that the response is recorded against the request, which is what it says.
 */
export const RESPONSE_SENT_LINE = 'Sent, and recorded against this request.';

/**
 * The standing sentence about how a response travels, drawn **before** anybody writes one.
 *
 * ⚠️ The web's own words, near enough: *"the answers go straight to the poster by email, through
 * our relay — neither side sees the other's address unless both choose to connect."* Two things
 * matter about saying it up front. It is the one piece of information that changes what somebody
 * writes; and the smuggled-address refusal (`[relay-address-leak]`) is otherwise a 400 out of
 * nowhere for somebody who thought they were being helpful.
 */
export const RELAY_NOTICE =
  'Responses reach the poster by email through the community’s relay. Neither of you sees the other’s address unless you both choose to connect — so leave your own address out of the message; the board will refuse one.';

// ── AC4: posting a request stays on the web, and says so ─────────────────────

/**
 * 🔴 **NAT-009 AC4, ANSWERED IN THIS FILE: read and respond ship; POSTING a request stays on the
 * web behind a labelled hand-off.** The criterion asked for the decision to be explicit rather
 * than discovered, and the reasoning is the criterion's own: posting is the one verb here a
 * person is more likely to do from a desk than from a graph, it needs a title, a brief, a budget
 * band and a timeline, and it is the surface where getting the brief wrong wastes other people's
 * time. D6's pattern — say the hand-off out loud rather than silently opening a browser.
 */
export const POST_A_REQUEST_LINE = 'Posting a request for work opens the community in your browser.';
export const POST_A_REQUEST_LABEL = 'Post a request on the web';

// ── The board ─────────────────────────────────────────────────────────────────

export type BoardFilterKey = 'open' | 'closed';

export type BoardFilterPill = { key: BoardFilterKey; label: string; count: number; active: boolean };

export type BoardView = {
  section: CommunitySectionState<CommunityRowProps>;
  /** `4 of 11 requests`, or `11 requests`. */
  summary: string | null;
  /** 🔴 Non-null when the search looked at less than the whole board. */
  boundLine: string | null;
  emptyLine: string;
  searchLabel: string;
  query: string;
  filters: BoardFilterPill[];
};

function countOf(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** `£2k–£5k · 6 weeks · @nia-new · 2 of 3 responses`. */
export function rfpMeta(rfp: RfpSummary, now: number): string {
  const responses =
    rfp.state === 'closed'
      ? `${countOf(rfp.responseCount, 'response', 'responses')} · closed`
      : `${countOf(rfp.responseCount, 'response', 'responses')} · room for ${rfp.responsesRemaining} more`;
  return (
    metaLine([
      rfp.budgetBand || null,
      rfp.timeline,
      rfp.posterHandle ? `@${rfp.posterHandle}` : null,
      rfp.createdAt ? (relativeTime(rfp.createdAt, now) ?? null) : null,
      responses
    ]) ?? ''
  );
}

export function rfpRow(rfp: RfpSummary, now: number, onOpen: (id: string) => void): CommunityRowProps {
  return {
    title: rfp.title,
    meta: rfpMeta(rfp, now),
    detail: rfp.description || null,
    onClick: () => onOpen(rfp.id),
    // ⚠️ A row's visible title says nothing about whether it is still taking responses, and the
    // meta line is long. The label leads with the state so it is the first thing announced.
    ariaLabel: `${rfp.state === 'open' ? 'Open request' : 'Closed request'}: ${rfp.title}`
  };
}

/**
 * The board's local filter.
 *
 * 🔴 **THE SEARCH IS LOCAL BECAUSE THE ENDPOINT HAS NO `q`** — the fifth endpoint in this API
 * with none, and `peopleview.ts` found the first four. Sending one is silently ignored, which is
 * the failure that draws an unfiltered list and calls it a result.
 *
 * ⚠️ **The `state` filter is NOT local**, and the asymmetry is deliberate: `/v1/community/rfps`
 * takes `state=open|closed` natively, and a client that filtered it locally would be filtering a
 * page it had already truncated. The pill changes what is *fetched*; the box narrows what was
 * fetched. {@link boardBoundLine} is what makes that difference legible.
 */
export function selectRfps(rfps: RfpSummary[], query: string): RfpSummary[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return rfps;
  return rfps.filter((rfp) =>
    [rfp.title, rfp.description, rfp.budgetBand, rfp.timeline ?? '', rfp.posterHandle]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
}

/**
 * 🔴 **A BOUNDED QUERY REPORTS ITS BOUND.** The board pages, one window at a time, and a search
 * box over one page is a search over a fraction of the board that looks like a search over all of
 * it. `page.total` is what the platform says exists; `items.length` is what we hold.
 */
export function boardBoundLine(page: Paged<RfpSummary>): string | null {
  if (page.items.length >= page.page.total) return null;
  return `Searching the ${countOf(page.items.length, 'request', 'requests')} loaded so far, of ${page.page.total} on the board.`;
}

export type BoardInputs = {
  /** 🔴 D15, read off `me` before anything is fetched. See `peopleview.composeDirectory`. */
  me?: Read<MeResponse>;
  read?: Read<Paged<RfpSummary>>;
  query: string;
  state: BoardFilterKey;
  onOpen: (id: string) => void;
  now?: number;
};

export function composeBoard(
  inputs: BoardInputs
): { surface: 'hidden' } | { surface: 'shown'; view: BoardView } {
  const { me, read, query, state } = inputs;
  const now = inputs.now ?? Date.now();

  // 1. D15, off `me` alone and before anything else is read.
  if (me?.outcome === 'ok' && me.value.community.surface === 'absent') return { surface: 'hidden' };

  const narrowed = query.trim() !== '';
  const filters: BoardFilterPill[] = [
    { key: 'open', label: 'Open', count: 0, active: state === 'open' },
    { key: 'closed', label: 'Closed', count: 0, active: state === 'closed' }
  ];

  const shell = (
    section: CommunitySectionState<CommunityRowProps>,
    extra: Partial<BoardView> = {}
  ): { surface: 'shown'; view: BoardView } => ({
    surface: 'shown',
    view: {
      section,
      summary: null,
      boundLine: null,
      // ⚠️ Two different empties. One says what the board is FOR; the other says a search
      // matched nothing and is a state the reader caused and can undo.
      emptyLine: narrowed
        ? 'No request here matches that — try fewer words, or clear the box.'
        : state === 'open'
          ? 'People post paid work here. When somebody needs something built, it appears in this list.'
          : 'Requests that have stopped taking responses appear here.',
      searchLabel: 'Search titles, briefs, budgets and posters',
      query,
      filters,
      ...extra
    }
  });

  if (read === undefined) return shell({ state: 'loading' });

  // 🔴 A failed read is `unreachable` and NEVER an empty board. "Nobody is hiring" and "we could
  // not ask" are opposite facts, and the first is the one that makes somebody stop looking.
  if (read.outcome === 'unreachable') return shell({ state: 'unreachable', detail: read.detail });

  // ⚠️ A 404 on the LIST is D15 and nothing else: this route is gated and answers 200 to a
  // stranger. Reached only when `me` did not say so first, and the safer reading is the refusal.
  if (read.outcome === 'absent') return { surface: 'hidden' };

  // ⚠️ Cannot fire today — `/v1/community/rfps` answers 200 for a null viewer on purpose, so a
  // signed-out read is indistinguishable from a member's. Branched rather than cast, for
  // `peopleview`'s reason: if it ever DOES fire this view needs a state of its own, because
  // "sign in" and "could not reach" are different offers.
  if (read.outcome === 'unauthenticated') {
    return shell({ state: 'unreachable', detail: 'Sign in to see the work board.' });
  }

  const rows = selectRfps(read.value.items, query);
  return shell(
    rows.length === 0
      ? { state: 'empty' }
      : { state: 'items', items: rows.map((rfp) => rfpRow(rfp, now, inputs.onOpen)) },
    {
      // ⚠️ The denominator is what we HOLD, not `page.total` — saying "2 of 340" beside a search
      // that looked at 40 would compute a number over one population and print it against
      // another. `boundLine` is the honest statement of the gap.
      summary: narrowed
        ? `${rows.length} of ${countOf(read.value.items.length, 'request', 'requests')}`
        : countOf(read.value.items.length, 'request', 'requests'),
      boundLine: boardBoundLine(read.value)
    }
  );
}

// ── The brief, and responding to it ───────────────────────────────────────────

export type BriefView = {
  title: string;
  /** The state, budget, timeline and poster, in one line. */
  meta: string;
  /** The brief itself. */
  body: string;
  /** `2 responses · room for 1 more`, or the closed form. */
  standing: string;
  /** How a response travels — {@link RELAY_NOTICE}, always drawn beside a composer. */
  relayNotice: string | null;
  /** 🔴 Null when the request is closed, when signed out it is the hand-off arm. */
  reply: CommunityReplyBox | null;
  /** Non-null when this viewer has already responded — AC3, on the surface it matters. */
  alreadyRespondedLine: string | null;
  /** 🔴 NAT-007's predicate. See {@link postedNote}. */
  postedNote: string | null;
};

/**
 * 🔴 **NAT-007'S PREDICATE, AND IT IS THE SHAPE RATHER THAN THE SENTENCE THAT MATTERS.**
 *
 * A person sends a response; the re-read that follows fails, or succeeds and comes back without
 * it. Either way the list on screen does not contain the thing they just sent, and *nothing says
 * why* — which reads as *it never sent*, the exact failure the composer's error arm exists to
 * prevent, arriving one step later than that arm looks.
 *
 * So the question is **"is the response I just sent in the copy I am about to draw"**, asked by
 * id against the array. A timestamp comparison would pass the second arm — a fresh re-read that
 * simply does not contain it — and that arm is the one with no banner on it at all.
 *
 * @param sent the accepted write, or null if nothing has been sent this session
 * @param mine the responses we are about to draw, or the failed read that replaced them
 */
export function postedNote(
  sent: ResponseAccepted | null,
  mine: Read<Paged<MyRfpResponse>> | undefined
): string | null {
  if (!sent) return null;
  // Nothing to draw yet: the composer's own "sent" line is still the whole truth.
  if (mine === undefined) return null;
  if (mine.outcome !== 'ok') {
    return 'Your response was sent. This list could not be re-read, so it is not showing here yet.';
  }
  if (mine.value.items.some((row) => row.id === sent.responseId)) return null;
  return 'Your response was sent. It has not appeared in this list yet.';
}

export type BriefInputs = {
  rfp: RfpSummary;
  signedIn: boolean;
  /** This viewer's own responses, used only to tell whether one of them is for THIS request. */
  mine?: Read<Paged<MyRfpResponse>>;
  draft: string;
  sending: boolean;
  last: Write<ResponseAccepted> | null;
  /** The accepted write, kept so {@link postedNote} can look for it. */
  sent: ResponseAccepted | null;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onHandoff: () => void;
  now?: number;
};

export function composeBrief(inputs: BriefInputs): BriefView {
  const { rfp, mine, draft, sending, last, sent } = inputs;
  const now = inputs.now ?? Date.now();

  const alreadyResponded =
    mine?.outcome === 'ok' && mine.value.items.some((row) => row.rfpId === rfp.id);

  const standing =
    rfp.state === 'closed'
      ? `${countOf(rfp.responseCount, 'response', 'responses')} · this request is closed`
      : `${countOf(rfp.responseCount, 'response', 'responses')} · room for ${rfp.responsesRemaining} more`;

  return {
    title: rfp.title,
    meta:
      metaLine([
        rfp.state === 'open' ? 'Work board · open' : 'Work board · closed',
        rfp.budgetBand || null,
        rfp.timeline,
        rfp.posterHandle ? `posted by @${rfp.posterHandle}` : null,
        rfp.createdAt ? (relativeTime(rfp.createdAt, now) ?? null) : null
      ]) ?? '',
    body: rfp.description,
    standing,
    relayNotice: rfp.state === 'open' ? RELAY_NOTICE : null,
    reply: composeResponseBox({
      rfp,
      signedIn: inputs.signedIn,
      alreadyResponded,
      draft,
      sending,
      last,
      onChange: inputs.onChange,
      onSubmit: inputs.onSubmit,
      onHandoff: inputs.onHandoff
    }),
    alreadyRespondedLine: alreadyResponded
      ? 'You have already responded to this request. The board takes one response per person.'
      : null,
    postedNote: postedNote(sent, mine)
  };
}

/**
 * The responding affordance, whichever of the four it is.
 *
 * The order of the arms is the argument:
 *
 * 1. 🔴 **A closed request draws nothing.** Not a disabled box with a reason — the request is
 *    over, and a dead composer under it is an invitation to write something that cannot be sent.
 * 2. **Signed out gets the labelled hand-off**, `threadwrites`' reason unchanged: the rail panel
 *    has no sign-in control of its own, so a sentence naming a button in another window is a
 *    dead end.
 * 3. 🔴 **Already responded draws nothing either.** The board takes one response per person
 *    (`rfp_responses_rfp_id_responder_account_id_key`), and this is the one refusal a client can
 *    predict from something it actually holds — the caller's own list. ⚠️ Predicting it is safe
 *    where predicting D8's bar or a ban would not be: those are facts about the account that
 *    this client cannot see, and guessing them would mean re-implementing D15 in the editor.
 * 4. Otherwise, the composer.
 */
export function composeResponseBox(inputs: {
  rfp: RfpSummary;
  signedIn: boolean;
  alreadyResponded: boolean;
  draft: string;
  sending: boolean;
  last: Write<ResponseAccepted> | null;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onHandoff: () => void;
}): CommunityReplyBox | null {
  if (inputs.rfp.state === 'closed') return null;
  if (!inputs.signedIn) {
    return {
      kind: 'handoff',
      line: 'You are not signed in to the community, so a response cannot be sent from the editor.',
      actionLabel: 'Respond on the web',
      onAction: inputs.onHandoff
    };
  }
  if (inputs.alreadyResponded) return null;

  const failure = inputs.last ? responseFailureLine(inputs.last) : null;
  return {
    kind: 'composer',
    label: 'Your response',
    placeholder:
      'What you would build, what you have built like it, and when you could start. At least 20 characters.',
    value: inputs.draft,
    onChange: inputs.onChange,
    onSubmit: inputs.onSubmit,
    submitLabel: inputs.sending ? 'Sending…' : 'Send response',
    canSubmit: canSendResponse(inputs.draft),
    blockedReason: responseRefusal(inputs.draft),
    busy: inputs.sending,
    error: failure,
    // ⚠️ Never both — a screen saying "Sent" and "could not be reached" at once is one whose
    // reader has to decide which half to believe.
    note: !failure && inputs.last?.outcome === 'ok' ? RESPONSE_SENT_LINE : null
  };
}

// ── AC3: what you sent ────────────────────────────────────────────────────────

/**
 * One of your own responses, as a line.
 *
 * 🔴 **IT REPORTS A STATE AND OFFERS NO NEXT STEP, BECAUSE THERE IS NONE.** `connectedAt` and the
 * two accepts are the only things that could change about a response after it is sent, and
 * nothing on the platform can change them: `acceptConnection` has no caller outside its own
 * suite. A sentence like *"waiting for the poster to accept"* would be a lie about a process
 * nobody is running. What is drawn instead is what happened — you sent this, on this date — and
 * whether the request is still open.
 *
 * ⚠️ The `connected` arm is written even though nothing can produce it. When somebody builds the
 * caller, this line is already right; and a spec asserting it is what will notice the day the
 * platform starts producing it.
 */
export function myResponseMeta(row: MyRfpResponse, now: number): string {
  const when = row.createdAt ? (relativeTime(row.createdAt, now) ?? null) : null;
  return (
    metaLine([
      row.posterHandle ? `to @${row.posterHandle}` : null,
      when ? `sent ${when}` : null,
      row.rfpState === 'closed' ? 'request closed' : 'request open',
      row.connectedAt ? 'you and the poster have connected' : null
    ]) ?? ''
  );
}

export function myResponseRow(
  row: MyRfpResponse,
  now: number,
  onOpen: (rfpId: string) => void
): CommunityRowProps {
  return {
    title: row.rfpTitle,
    meta: myResponseMeta(row, now),
    detail: row.message || null,
    onClick: () => onOpen(row.rfpId),
    ariaLabel: `Your response to ${row.rfpTitle}`
  };
}

export type MyResponsesView = {
  section: CommunitySectionState<CommunityRowProps>;
  emptyLine: string;
  /**
   * 🔴 The sentence that stops this screen being a progress tracker. See {@link myResponseMeta}.
   * Drawn once under the list rather than on every row — it is a fact about the board, not about
   * any one response.
   */
  standingNote: string | null;
};

export const NO_NEXT_STEP_NOTE =
  'A response goes to the poster and the conversation continues by email. Nothing more happens here.';

export function composeMyResponses(inputs: {
  me?: Read<MeResponse>;
  read?: Read<Paged<MyRfpResponse>>;
  onOpen: (rfpId: string) => void;
  now?: number;
}): { surface: 'hidden' } | { surface: 'shown'; view: MyResponsesView } {
  const now = inputs.now ?? Date.now();
  if (inputs.me?.outcome === 'ok' && inputs.me.value.community.surface === 'absent') {
    return { surface: 'hidden' };
  }

  const shell = (
    section: CommunitySectionState<CommunityRowProps>,
    standingNote: string | null = null
  ): { surface: 'shown'; view: MyResponsesView } => ({
    surface: 'shown',
    view: {
      section,
      emptyLine: 'Responses you send from the editor appear here, with what you said.',
      standingNote
    }
  });

  if (inputs.read === undefined) return shell({ state: 'loading' });
  if (inputs.read.outcome === 'unreachable') {
    return shell({ state: 'unreachable', detail: inputs.read.detail });
  }
  if (inputs.read.outcome === 'absent') return { surface: 'hidden' };
  /**
   * 🔴 **THIS ARM FIRES, unlike its twin on the board**, and that is why the route answers 401
   * rather than an empty list. *"You have sent nothing"* is a lie to tell somebody whose session
   * expired, and an empty list is exactly what a signed-out read of a personal list looks like.
   */
  if (inputs.read.outcome === 'unauthenticated') {
    return shell({
      state: 'unreachable',
      detail: 'Sign in to the community to see the responses you have sent.'
    });
  }

  const rows = inputs.read.value.items;
  return shell(
    rows.length === 0
      ? { state: 'empty' }
      : { state: 'items', items: rows.map((row) => myResponseRow(row, now, inputs.onOpen)) },
    rows.length === 0 ? null : NO_NEXT_STEP_NOTE
  );
}
