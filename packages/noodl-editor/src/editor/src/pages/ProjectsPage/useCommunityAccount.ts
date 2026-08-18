import { useCallback, useEffect, useRef, useState } from 'react';

import { platform } from '@noodl/platform';

import type { CommunityAccountState } from '@noodl-core-ui/preview/launcher/Launcher/components/CommunityAccountCard';
import type { CommunityAccountHostState } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import { readCommunitySession } from '../../models/community/communitysession';
import { signIntoCommunity, signOutOfCommunity } from '../../models/community/communitysignin';

/**
 * UNI-001 AC2 — the launcher's half of "sign in to NodeGX".
 *
 * ## Where the work happens, and why not here
 *
 * Nothing about the device flow lives in this file. `signIntoCommunity` owns the negotiation and
 * `communitysession` owns the store — this hook is the *adapter* between them and a card in
 * `noodl-core-ui`, which cannot import either (it renders in Storybook, where `noodl-editor` does
 * not exist). `useConnectAgent` is the precedent for the shape: the renderer composes, and the
 * module that knows how does the knowing.
 *
 * 🔴 **The card is ALWAYS offered, even when the platform cannot be reached**, and that is the
 * opposite of `useConnectAgent`'s `return undefined`. The reasons differ: a connect-an-agent
 * button with no bundle to point at *cannot work*, whereas a community that is down right now is
 * a community that is up in ten minutes, and hiding the account because a fetch failed would
 * make signing in look like a feature that comes and goes.
 *
 * ## The three states that are easy to conflate
 *
 * `undefined` — the store has not answered yet. Rendered as `unknown`, which draws **nothing**.
 * 🔴 The frame this protects is the first one: `null` and `undefined` are both falsy, so a
 * `!session` test flashes *"Sign in to NodeGX"* at somebody who is already signed in on every
 * single launch. The composer's `session === null` guard makes the same distinction.
 *
 * `null` — the store answered, and there is no session. That is the offer.
 *
 * A session — signed in. The handle is a **cache** of a fact the platform owns, so it may be
 * absent; "signed in with no handle" is a real state and the card says so rather than showing
 * `@undefined`.
 */
export function useCommunityAccount(): CommunityAccountHostState {
  /** `undefined` = not asked yet · `null` = asked, signed out · a state = the answer. */
  const [state, setState] = useState<CommunityAccountState>({ phase: 'unknown' });
  const [error, setError] = useState<string | null>(null);

  /**
   * 🔴 A REF, not the state, and not a style preference. The poll loop inside `signIntoCommunity`
   * closes over its arguments once and runs for up to fifteen minutes; a state value read there
   * is frozen at the value it had on the first render, so the loop would never see the launcher
   * go away and would hammer the platform every five seconds until the pairing lapsed. The same
   * bug, and the same fix, as the composer's `abandoned` ref.
   */
  const abandoned = useRef(false);
  useEffect(
    () => () => {
      abandoned.current = true;
    },
    []
  );

  useEffect(() => {
    let live = true;
    void readCommunitySession().then((found) => {
      // ⚠️ The launcher can be torn down while the read is in flight.
      if (!live) return;
      setState(found ? { phase: 'signed-in', handle: found.handle } : { phase: 'signed-out' });
    });
    return () => {
      live = false;
    };
  }, []);

  const onSignIn = useCallback(() => {
    setError(null);
    void (async () => {
      const result = await signIntoCommunity(
        (progress) => {
          if (abandoned.current) return;
          if (progress.phase === 'waiting') {
            setState({ phase: 'waiting', userCode: progress.userCode, verificationUri: progress.verificationUri });
          } else if (progress.phase === 'starting') {
            setState({ phase: 'starting' });
          }
          // `signed-in` is deliberately NOT handled here: the state below is rendered from the
          // credential that was actually persisted, not from the one the flow reported.
        },
        {
          openExternal: (url) => platform.openExternal(url),
          isCancelled: () => abandoned.current
        }
      );
      if (abandoned.current) return;

      if (result.outcome === 'signed-in') {
        const stored = await readCommunitySession();
        setState(stored ? { phase: 'signed-in', handle: stored.handle } : { phase: 'signed-out' });
        return;
      }

      setState({ phase: 'signed-out' });
      // ⚠️ `cancelled` is not an error and says nothing — a person who closed the launcher
      // mid-flow has not failed at anything. The other two get a sentence they can act on.
      //
      // ⚠️ These sentences are NOT shared with the composer's, deliberately. Its timeout message
      // ends "…or use the browser button below", and there is no browser button below this card.
      // One string with one owner is for copy that IS the same, not copy that looks similar.
      if (result.outcome === 'expired') {
        setError('That sign-in timed out before it was approved. Try again when you are ready.');
      } else if (result.outcome === 'failed') {
        setError(result.detail);
      }
    })();
  }, []);

  const onSignOut = useCallback(() => {
    setError(null);
    void (async () => {
      // 🔴 The order is inside `signOutOfCommunity`: revoke on the platform first, forget
      // locally second, and forget locally whether or not the revoke succeeded. Somebody
      // offline must still be able to sign out of their own editor.
      await signOutOfCommunity();
      if (abandoned.current) return;
      // Re-read rather than assume: the store is the thing the rest of the editor reads, so it
      // is the thing this state must agree with.
      const stored = await readCommunitySession();
      setState(stored ? { phase: 'signed-in', handle: stored.handle } : { phase: 'signed-out' });
    })();
  }, []);

  return { state, error, onSignIn, onSignOut };
}
