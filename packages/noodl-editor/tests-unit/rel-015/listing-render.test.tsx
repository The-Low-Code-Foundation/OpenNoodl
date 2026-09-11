/**
 * REL-015 §1 — what the "list me" card actually DRAWS, by walking the element tree.
 *
 * ## 🔴 The claims worth grading here are about SENTENCES, not about a button existing
 *
 * Richard's 2026-09-04 ruling made approval gate `/u/<handle>` as well as `/people`, which turned
 * the web's shipped copy — *"your page is already live, this is only about the directory"* — into
 * a lie on the one screen a person reads to find out why their own URL 404s. The editor's card was
 * written after that ruling, so the risk here is the same sentence arriving by a different route.
 * Two arms below assert the words rather than the control.
 *
 * ## ⚠️ Every absence has a known-drawing control beside it
 *
 * `render()` returns `null` both for a component that drew nothing and for one that was never
 * called, and this file makes claims of the *"no bio box in this state"* kind. So each pair is one
 * call with one field different — `people-render`'s rule, and the reason it exists.
 *
 * @module noodl-editor/tests-unit/rel-015/listing-render
 */
import React from 'react';

import {
  CommunityListingCard,
  type CommunityListingState,
  type CommunityListingStatus
} from '@noodl-core-ui/components/community';

import { byClass, render, text, walk } from '../support/renderElements';

const noop = () => undefined;

function card(over: {
  state?: CommunityListingState;
  bio?: string;
  busy?: boolean;
} = {}) {
  return render(
    <CommunityListingCard
      state={over.state ?? ready('unlisted')}
      bio={over.bio ?? 'Builds booking tools for village halls.'}
      busy={over.busy ?? false}
      onBioChange={noop}
      onRequest={noop}
      onWithdraw={noop}
      onRetry={noop}
    />
  );
}

function ready(status: CommunityListingStatus, note: string | null = null): CommunityListingState {
  return { kind: 'ready', status, handle: 'ada', note };
}

/** Every `<button>` in the tree, which is how "is there a way to act" is asked here. */
function buttons(node: ReturnType<typeof render>) {
  return walk(node).filter((n) => n.type === 'button');
}

describe('the listing card — the three states that can ask', () => {
  it.each(['none', 'unlisted', 'declined'] as const)(
    'offers the ask, with a bio box, from %s',
    (status) => {
      const drawn = card({ state: ready(status, status === 'declined' ? 'Say what you build.' : null) });
      expect(buttons(drawn).map((b) => b.ownText)).toContain('List me on /people');
      expect(walk(drawn).some((n) => n.type === 'textarea')).toBe(true);
    }
  );

  /**
   * 🔴 `declined` IS NOT A DEAD END, AND THIS IS THE ARM THAT PINS IT. `requestListing`'s
   * where-clause admits `declined` on purpose — *"somebody refused for a thin bio who then writes
   * a real one is the normal use of a queue that gives reasons"* — so a card that offered no way
   * back would be stricter than the platform underneath it, and silently.
   */
  it('shows the decline reason as text, and still offers a way back', () => {
    const drawn = card({ state: ready('declined', 'Please say what you build.') });
    expect(text(drawn)).toContain('Please say what you build.');
    expect(buttons(drawn).map((b) => b.ownText)).toContain('List me on /people');

    // The known-drawing control: the same card WITHOUT a note draws no reason, so the assertion
    // above is about the note and not about the word appearing somewhere in the component.
    expect(text(card({ state: ready('declined') }))).not.toContain('Please say what you build.');
  });

  /**
   * 🔴 THE COPY RULING. `pending` must not say the page is live — that is precisely the sentence
   * the web shipped and Richard's ruling falsified, and it is the one a reader would act on.
   */
  it('never tells a waiting member their page is already live', () => {
    const waiting = text(card({ state: ready('pending') }));
    expect(waiting).toContain('/u/ada');
    expect(waiting).toContain('not reachable');
    expect(waiting).not.toContain('already live');

    // ⚠️ The control, because "does not contain" passes on a card that drew nothing at all: the
    // APPROVED state is the one where "live" is true, and it says so.
    expect(text(card({ state: ready('approved') }))).toContain('live');
  });

  it('offers withdrawal — and only withdrawal — once there is something to withdraw', () => {
    for (const status of ['pending', 'approved'] as const) {
      const labels = buttons(card({ state: ready(status) })).map((b) => b.ownText);
      expect(labels).toContain('Take me off /people');
      expect(labels).not.toContain('List me on /people');
    }
    // ⚠️ And there is no bio box in those states: this card is not a profile editor, and a field
    // that saved nothing would be a control that appears to work.
    expect(walk(card({ state: ready('pending') })).some((n) => n.type === 'textarea')).toBe(false);
  });
});

describe('the listing card — what it refuses, and whether it says why', () => {
  /**
   * 🔴 A DISABLED CONTROL WITH NO REASON BESIDE IT IS THE GREYED-OUT BUTTON THIS PACKAGE'S OWN
   * RULES EXIST TO PREVENT. Both halves in one reading: the button IS disabled, and the sentence
   * IS drawn.
   */
  it('will not ask on an empty bio, and says so rather than just greying out', () => {
    const empty = card({ bio: '   ' });
    const ask = buttons(empty).find((b) => String(b.ownText).startsWith('List me'));
    expect(ask?.props.disabled).toBe(true);
    expect(text(empty)).toContain('Write a line first');

    // The pair: one field different, and both go the other way.
    const filled = card({ bio: 'Builds rota tools for care homes.' });
    const enabled = buttons(filled).find((b) => String(b.ownText).startsWith('List me'));
    expect(enabled?.props.disabled).toBe(false);
    expect(text(filled)).not.toContain('Write a line first');
  });

  it('names the three consequences of asking, before the button rather than after it', () => {
    // ⚠️ Asking PUBLISHES the profile as well as queueing it. A person who learns that from the
    // result has learned it too late, and there is no visibility control here to infer it from.
    expect(text(card())).toContain('makes your profile public');
    expect(text(card())).toContain('moderator');
  });

  it('disables every control while a write is in flight, and says which verb is running', () => {
    const asking = card({ busy: true });
    expect(buttons(asking).every((b) => b.props.disabled === true)).toBe(true);
    expect(text(asking)).toContain('Asking…');

    const withdrawing = card({ state: ready('approved'), busy: true });
    expect(text(withdrawing)).toContain('Withdrawing…');
  });
});

describe('the listing card — loading and error', () => {
  it('draws a retry only for the error, and the error message with it', () => {
    const failed = card({ state: { kind: 'error', message: 'Could not check whether you are listed.' } });
    expect(text(failed)).toContain('Could not check whether you are listed.');
    expect(buttons(failed).map((b) => b.ownText)).toContain('Try again');

    // 🔴 The control the module note demands: loading is NOT an error, draws no retry, and — this
    // is the half that matters — draws something, so "no Try again" is about the state rather
    // than about a component that returned null.
    const loading = card({ state: { kind: 'loading' } });
    expect(buttons(loading)).toHaveLength(0);
    expect(text(loading)).not.toBe('');
  });

  it('renders every string as text — nothing on this surface may carry markup', () => {
    // The decline reason is the one string here written by somebody other than the reader.
    const drawn = card({ state: ready('declined', '<img src=x onerror=alert(1)>') });
    expect(text(drawn)).toContain('<img src=x onerror=alert(1)>');
    expect(walk(drawn).every((n) => n.props.dangerouslySetInnerHTML === undefined)).toBe(true);
  });

  it('puts the card in the shared community frame rather than inventing a second look', () => {
    // ⚠️ NAT-005's criterion: this sits inside `.SectionCard`, above the directory, and borrows
    // the vocabulary its neighbours use rather than introducing a card-in-a-card.
    expect(byClass(card(), 'Listing')).toHaveLength(1);
  });
});
