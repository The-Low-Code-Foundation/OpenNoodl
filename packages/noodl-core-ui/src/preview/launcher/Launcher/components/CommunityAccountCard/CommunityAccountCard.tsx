import classNames from 'classnames';
import React from 'react';

import {
  COMMUNITY_GATES_NOTHING,
  COMMUNITY_SIGN_IN_LABEL,
  COMMUNITY_SIGN_OUT_LABEL
} from '@noodl-core-ui/constants/communityCopy';
import {
  LauncherButton,
  LauncherButtonVariant
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherButton';

import css from './CommunityAccountCard.module.scss';

/**
 * UNI-001 AC2 — the launcher's sign-in affordance and the signed-in chip.
 *
 * ## Why there is a second sign-in, when the composer already has one
 *
 * E1 put the sign-in in `AskAboutNodeDialog` because the alpha bar's sentence is *"ask a question
 * about a node from inside the editor"*, and sending somebody off to find a launcher card in the
 * middle of writing a question is asking them to abandon what they were doing. That was the
 * **loop's** sign-in. 🔴 **AC2 asks for a different one**: a person who has not opened a project
 * yet, has no node to ask about, and simply wants an account — and, once they have one, somewhere
 * that says who they are and lets them stop being that person. Neither surface substitutes for
 * the other, and the copy they share is a constant rather than a literal apiece
 * (`constants/communityCopy.ts`, the FUN-001 shape D2 names).
 *
 * ## 🔴 The card says the login gates nothing, on the surface that implies the opposite
 *
 * This is the launcher. A card asking for an account is the single most likely place in the whole
 * editor for a new user to conclude that the thing they downloaded is gated — which is the exact
 * reverse of the phase's first principle. So {@link COMMUNITY_GATES_NOTHING} is rendered in the
 * same breath as the offer, not in a tooltip and not further down.
 *
 * ## The states, and the one that renders nothing
 *
 * `unknown → signed-out | signed-in`, with `starting` and `waiting` in between.
 *
 * 🔴 **`unknown` renders NOTHING, and that is a bug fix rather than an optimisation.** The store
 * is read asynchronously, so on the first frame the host does not yet know whether there is a
 * session. Rendering the signed-out card on that frame flashes *"Sign in to NodeGX"* at somebody
 * who is already signed in, on every single launch — the same distinction the composer's
 * `session === null` guard makes, for the same reason.
 *
 * ⚠️ **`waiting` carries the code AND the address.** The browser is opened for you, but a browser
 * that opened on a different profile — or did not open at all — leaves a person holding nothing.
 * Both halves, or the flow has a silent dead end.
 */
export enum CommunityAccountVariant {
  /** First launch, no projects — beside the welcome, where a new user actually looks. */
  Prominent = 'is-prominent',
  /** They have projects. Same offer, quieter, and it does not push the grid down. */
  Row = 'is-row'
}

/**
 * What the host knows about the account right now.
 *
 * ⚠️ This mirrors `SignInProgress` in `models/community/communitysignin.ts` **without importing
 * it**: `noodl-core-ui` renders in Storybook, where `noodl-editor` does not exist. The host maps
 * one to the other in `useCommunityAccount`, and a spec asserts the two agree.
 */
export type CommunityAccountState =
  /** The store has not answered yet. Renders nothing — see the note above. */
  | { phase: 'unknown' }
  | { phase: 'signed-out' }
  | { phase: 'starting' }
  | { phase: 'waiting'; userCode: string; verificationUri: string }
  | { phase: 'signed-in'; handle?: string };

export interface CommunityAccountCardProps {
  variant?: CommunityAccountVariant;
  state: CommunityAccountState;
  /** Whatever went wrong last time, in a sentence a person can act on. Never an exception. */
  error?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** Two letters for the chip. A handle with no letters in it gets the anonymous glyph instead. */
export function handleInitials(handle?: string): string {
  const source = (handle ?? '').replace(/^@/, '').trim();
  if (!source) return '';
  const parts = source.split(/[-_.\s]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function CommunityAccountCard({
  variant = CommunityAccountVariant.Prominent,
  state,
  error,
  onSignIn,
  onSignOut
}: CommunityAccountCardProps) {
  // 🔴 Not `!state` and not a spinner: nothing at all, until the store has answered.
  if (state.phase === 'unknown') return null;

  const isBusy = state.phase === 'starting' || state.phase === 'waiting';

  return (
    <div className={classNames(css['Root'], css[variant])} data-test="community-account-card">
      {state.phase === 'signed-in' ? (
        <>
          <div className={css['Chip']} data-test="community-account-chip">
            <span className={classNames(css['Avatar'], !handleInitials(state.handle) && css['is-anonymous'])} aria-hidden="true">
              {handleInitials(state.handle) || (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="5.5" r="2.6" />
                  <path d="M2.8 13.4c0-2.6 2.3-4.2 5.2-4.2s5.2 1.6 5.2 4.2" />
                </svg>
              )}
            </span>
            <span className={css['ChipText']}>
              <span className={css['Handle']}>
                {/* ⚠️ A session can be real and carry no handle — the store's `handle` is a cache
                    of a fact the platform owns. "Signed in" is still true and still worth saying. */}
                {state.handle ? `@${state.handle}` : 'Signed in to NodeGX'}
              </span>
              <span className={css['Aside']}>Signed in to the NodeGX community</span>
            </span>
          </div>

          <LauncherButton
            label={COMMUNITY_SIGN_OUT_LABEL}
            variant={LauncherButtonVariant.Secondary}
            onClick={onSignOut}
            testId="community-account-signout"
          />
        </>
      ) : (
        <>
          <div className={css['Body']}>
            <h3 className={css['Title']}>Join the NodeGX community</h3>
            <p className={css['Text']}>
              Ask about a node and get an answer, share what you have built, follow the tutorials.
            </p>
            {/* 🔴 The first principle, said out loud on the surface that would otherwise imply
                the opposite. Not a tooltip, not below the fold. */}
            <p className={css['Aside']}>{COMMUNITY_GATES_NOTHING}</p>
          </div>

          {state.phase === 'waiting' ? (
            <div className={css['Waiting']} data-test="community-account-waiting">
              <p className={css['Text']}>Type this code in the browser window that just opened:</p>
              <pre className={css['Code']} data-test="community-account-code">
                {state.userCode}
              </pre>
              {/* ⚠️ Shown as well as opened: a browser on a different profile, or none. */}
              <p className={css['Aside']}>{state.verificationUri}</p>
            </div>
          ) : (
            <div className={css['Actions']}>
              <LauncherButton
                label={state.phase === 'starting' ? 'Starting…' : COMMUNITY_SIGN_IN_LABEL}
                isDisabled={isBusy}
                onClick={onSignIn}
                testId="community-account-signin"
              />
            </div>
          )}
        </>
      )}

      {/* A failure is never a dead end here either: the button above stays live and this says
          what happened. */}
      {error && (
        <p className={css['Failure']} data-test="community-account-error">
          {error}
        </p>
      )}
    </div>
  );
}
