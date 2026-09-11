/**
 * REL-015 §1's editor half — *"list me on /people"*, from inside the editor.
 *
 * > *"there's no people… we currently have no button to add a 'person', it should be free for any
 * > registered member to do so."* — Richard, 2026-09-04
 *
 * ## 🔴 Why this control has to say more than "List me"
 *
 * Asking to be listed does **three** things, and a button whose label names only the third is a
 * button that surprises the person who pressed it:
 *
 * 1. it creates a profile row if the account has never had one;
 * 2. it sets the profile **public**, because `listDirectory` ANDs `visibility = 'public'` and a
 *    request that can never be granted is worse than a control that explains itself — `/settings`
 *    on the web disables its checkbox while private for exactly this reason, and the editor has
 *    no visibility control to disable, so it says so in words instead;
 * 3. it puts a row in a queue a **person** clears.
 *
 * ⚠️ And since Richard's 2026-09-04 ruling, approval also gates `/u/<handle>` — the page does not
 * exist until somebody says yes. `pending` is therefore not *"you are live, just not listed"*; it
 * is *"nothing of yours is reachable yet"*, and the copy below says that rather than the more
 * flattering half-truth the web page shipped with for one day.
 *
 * ## ⚠️ What this component is NOT allowed to be
 *
 * **It is not a profile editor.** `/settings` on the web owns the bio, the display name, the
 * avatar and the links, and a second editor for those in a launcher tab is the *"two copies, and
 * a fix lands on one of them"* arrangement this package's own header was written about. The one
 * field here is the bio, because a directory row with no blurb is a row that says nothing about
 * the person in it, and because a member who is in the editor is not going to open a browser to
 * write one line.
 *
 * ## 🔴 `status` is read from the server, never inferred from the press
 *
 * `AccountForm` on the web makes the same point one surface along: a status derived from the
 * control's own state *"would tell somebody they were approved the moment they asked."* The host
 * re-reads `GET /api/v1/me/profile` after every write, and this component renders what came back.
 *
 * ⚠️ **No hooks.** This file is graded by walking its element tree with no renderer, the way its
 * neighbours are, and any hook throws there.
 *
 * @module noodl-core-ui/components/community/CommunityListingCard
 */

import React from 'react';

import css from './Community.module.scss';

/**
 * The five answers `GET /api/v1/me/profile` can produce for a signed-in caller.
 *
 * 🔴 **`none` AND `unlisted` ARE DIFFERENT AND BOTH LEAD TO THE SAME BUTTON**, which is exactly
 * why they are not collapsed. `none` is `item: null` — no profile row has ever existed — and
 * `unlisted` is a row that exists and has not asked, or has withdrawn. They take the same action
 * and they need different sentences: one is *"you are not here yet"* and the other is *"you took
 * yourself off"*. A single state would have to pick one of those to tell everybody.
 */
export type CommunityListingStatus = 'none' | 'unlisted' | 'pending' | 'approved' | 'declined';

/**
 * ⚠️ Four states, the same four every other surface in this package uses — and `refused` is not
 * among them on purpose. D15's refusal and an unwired host both draw NOTHING, and the host
 * expresses that by passing no card at all rather than by a fifth branch here. See
 * `LauncherCommunityPeoplePane.listing`, which documents `null` against `undefined`.
 */
export type CommunityListingState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      status: CommunityListingStatus;
      handle: string;
      /**
       * 🔴 The DECLINE's reason and null in every other state — `0025` enforces that as a
       * biconditional, so this cannot carry a stale sentence from a decision later reversed.
       */
      note: string | null;
    };

export interface CommunityListingCardProps {
  state: CommunityListingState;
  /**
   * The bio the person is about to publish, held by the host.
   *
   * ⚠️ **Held by the host and not by this component**, for the reason `activeTab` is: a
   * `useState` here would lose what somebody typed the moment the tab re-rendered around them,
   * and this card sits inside a list that re-renders whenever the directory refreshes.
   */
  bio: string;
  /** 🔴 True while a write is in flight. Every button is disabled and says which verb is running. */
  busy: boolean;
  onBioChange: (bio: string) => void;
  onRequest: () => void;
  onWithdraw: () => void;
  onRetry: () => void;
}

/**
 * ⚠️ One sentence per state, and each names the CONSEQUENCE rather than the status word. "Pending"
 * on its own is a status; "nobody can see your page yet" is what the person actually wants to know.
 */
function line(status: CommunityListingStatus, handle: string): string {
  switch (status) {
    case 'none':
      return 'You are not in the community directory, and you have no profile page yet.';
    case 'unlisted':
      return 'You are not in the community directory. Nobody can open your page while that stands.';
    case 'pending':
      return `Waiting for a moderator. Your page at /u/${handle} goes live at the same moment — until then it is not reachable, for you either.`;
    case 'approved':
      return `You are listed on /people, and your page at /u/${handle} is live.`;
    case 'declined':
      return 'Your listing was declined. Change what it says below and ask again.';
  }
}

export function CommunityListingCard({
  state,
  bio,
  busy,
  onBioChange,
  onRequest,
  onWithdraw,
  onRetry
}: CommunityListingCardProps) {
  if (state.kind === 'loading') {
    return (
      <div className={css['Listing']}>
        <p className={css['ReplyBlocked']}>Checking whether you are listed…</p>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className={css['Listing']}>
        {/* ⚠️ `fg-danger` text and not a filled red panel, matching `.ReplyError` one component
            along: this lands on the section's own ground and a fill would make a retryable read
            failure louder than the directory it sits above. */}
        <p className={css['ReplyError']}>{state.message}</p>
        <button className={css['RetryButton']} type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  /**
   * 🔴 THE THREE STATES THAT ASK ARE `none`, `unlisted` AND `declined`, AND `declined` BELONGS
   * WITH THEM RATHER THAN BEING A DEAD END. `requestListing`'s where-clause admits `declined` on
   * purpose — *"somebody refused for a thin bio who then writes a real one is the normal use of a
   * queue that gives reasons"* — so a card that offered no way back would be stricter than the
   * platform underneath it, and silently.
   */
  const canAsk = state.status === 'none' || state.status === 'unlisted' || state.status === 'declined';

  return (
    <div className={css['Listing']}>
      <p className={css['ReplyBlocked']}>{line(state.status, state.handle)}</p>

      {/* 🔴 The decline's reason, verbatim from the moderator, and rendered as TEXT — this whole
          package refuses `dangerouslySetInnerHTML` and this is the one string on this surface a
          person other than the reader wrote. */}
      {state.status === 'declined' && state.note ? (
        <p className={css['ReplyError']}>{state.note}</p>
      ) : null}

      {canAsk && (
        <>
          <label className={css['ReplyLabel']} htmlFor="community-listing-bio">
            One line about what you build — this is what your directory row says
          </label>
          <textarea
            id="community-listing-bio"
            className={css['ReplyInput']}
            value={bio}
            disabled={busy}
            onChange={(event) => onBioChange(event.target.value)}
          />
          {/* 🔴 THE THREE CONSEQUENCES, BEFORE THE BUTTON AND NOT AFTER IT. See the module note:
              asking publishes the profile as well as queueing it, and a person who learns that
              from the result has learned it too late. */}
          <p className={css['ReplyBlocked']}>
            Asking makes your profile public and puts it in front of a moderator. You can take
            yourself off again at any time.
          </p>
        </>
      )}

      <div className={css['ReplyActions']}>
        {canAsk ? (
          <button
            className={css['ReplySubmit']}
            type="button"
            disabled={busy || bio.trim() === ''}
            onClick={onRequest}
          >
            {busy ? 'Asking…' : 'List me on /people'}
          </button>
        ) : (
          /* ⚠️ Outlined and not filled, on `.AcceptButton`'s reasoning: taking yourself off is a
             verb a listed person needs available and should not be the loudest thing on screen. */
          <button className={css['AcceptButton']} type="button" disabled={busy} onClick={onWithdraw}>
            {busy ? 'Withdrawing…' : 'Take me off /people'}
          </button>
        )}
      </div>

      {/* ⚠️ Drawn for `canAsk` too, and it is not redundant with the sentence above: an empty bio
          disables the button, and a disabled control with no reason beside it is the refusal this
          package's own rules call a greyed-out button that explains nothing. */}
      {canAsk && bio.trim() === '' ? (
        <p className={css['ReplyBlocked']}>Write a line first — an empty row tells nobody anything.</p>
      ) : null}
    </div>
  );
}
