/**
 * UNI-007 AC1 — the launcher's half of "the intake, and the path it produces".
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THIS HOOK IS THE CALLER, AND THE CALLER IS THE POINT.** The platform end of AC1 shipped
 * on 2026-08-19 — three routes, 29 specs, `tsc` clean — and had **no caller anywhere**. That
 * is the same shape UNI-006 was in before its bridge was built, and building that bridge is
 * what found the transport had never made a real request. So this file is not the last 5% of
 * AC1; it is the half that tells you whether the other half works.
 *
 * ⚠️ **Two facts about the API this hook is built around, and both are easy to undo:**
 *
 *  1. **`GET /me/intake` needs no token**, so the questions load before anybody has signed in
 *     and the signed-out state can show the actual form. Fetching it *after* a session check
 *     would work perfectly and would quietly turn signing in into a prerequisite for seeing
 *     what it is for. The two reads therefore start together and only the path one waits.
 *  2. **`GET /me/path` never calls a model, `POST /me/path/project` does.** Refreshing is free
 *     for ever and projecting costs money once per (learner, concept) — for ever, because the
 *     pair is a primary key claimed before the call. Nothing here may "helpfully" project the
 *     un-projected steps on load: that is the money-spending read the platform split the
 *     routes to prevent, reintroduced in its only client.
 *
 * 🔴 **The path is re-read after a projection, not patched in locally.** A local patch is one
 * line shorter and makes the editor the second place that decides what a step's projection is;
 * a re-read keeps the mirror a mirror. It is free — see fact 2.
 *
 * @module noodl-editor/hooks/useLearnerPath
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CommunityApiClient,
  type IntakeAnswers,
  type IntakeState,
  type PathState,
  type ProjectionOutcome,
  type Read
} from '../models/community/communityapi';
import { COMMUNITY_URL } from '../models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '../models/community/communitysession';
import { learnerPathSurface, projectionNote, type LearnerPathSurface } from '../models/community/learnerpathview';
import { onCommunityChanged } from '../models/community/communitychanged';

export type LearnerPathHost = {
  surface: LearnerPathSurface;
  onChoose: (questionKey: string, value: string) => void;
  onSubmit: () => void;
  onRetake: () => void;
  onProject: (concept: string) => void;
  projecting: string | null;
  projectionNote: string | null;
};

/**
 * What to say when the intake could not be saved. ⚠️ The platform's own words when it chose
 * some (`refused` carries them); ours only for the outcomes that have none.
 */
function submitFailure(write: { outcome: string; detail?: string }): string {
  switch (write.outcome) {
    case 'unauthenticated':
      return 'Your session has expired — sign in again and your answers will save.';
    case 'refused':
      return write.detail ?? 'The community refused those answers.';
    case 'absent':
      // D15: the surface does not exist for this viewer. Not narrated as a door.
      return 'Your answers could not be saved.';
    default:
      return 'Couldn’t reach the community, so your answers weren’t saved. Try again in a moment.';
  }
}

export function useLearnerPath(): LearnerPathHost {
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [intake, setIntake] = useState<Read<IntakeState> | undefined>(undefined);
  const [path, setPath] = useState<Read<PathState> | undefined>(undefined);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [retaking, setRetaking] = useState(false);
  const [projecting, setProjecting] = useState<string | null>(null);
  const [lastProjection, setLastProjection] = useState<ProjectionOutcome | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  /**
   * 🔴 FIX-025 — THE SESSION IS RE-READ WHEN IT CHANGES, not only on mount.
   *
   * Richard: *"I'm signed in on the projects page, but on the Learning page it says 'Sign in to
   * NodeGX'... I used the Sign in button on the learning page, it showed me the code in the
   * browser, but coming back to the editor the sign in button still persisted."*
   *
   * Both halves are this effect's empty dependency array. The Learning tab's sign-in button is
   * `useCommunityAccount`'s `onSignIn` — the *same* device flow — so on success that hook
   * updated its own state and this one, which had read the store once, still held `null` and
   * kept drawing the door. A surface that offers a sign-in and then ignores its result is worse
   * than one that never offered it.
   *
   * ⚠️ The re-read goes back to the STORE rather than trusting the notification's word for it:
   * `writeCommunitySession` announces that the key changed, never what it now holds, so this
   * stays a mirror of the one place the token lives. Same argument as the path re-read below.
   */
  useEffect(() => {
    let live = true;
    const read = () => {
      void readCommunitySession().then((found) => {
        if (!live) return;
        setSession(found ?? null);
      });
    };
    read();
    const unsubscribe = onCommunityChanged((change) => {
      if (change === 'session') read();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const client = useMemo(
    () => new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null }),
    [session]
  );

  // The questions. ⚠️ Deliberately NOT gated on a session — see fact 1 in the header.
  useEffect(() => {
    if (session === undefined) return;
    let live = true;
    void client.intake().then((read) => {
      if (live) setIntake(read);
    });
    return () => {
      live = false;
    };
  }, [client, session, generation]);

  useEffect(() => {
    if (session === undefined) return;
    // 🔴 Signed out, the path read is not attempted at all and the state is synthesised —
    // NOT because a 401 would be mishandled (it is handled now; that was this task's first
    // finding) but because a request we already know the answer to is a request that should
    // not be made. ⚠️ The reverse inference is the trap: a HELD token is not a VALID session,
    // so an expired one still goes to the network and comes back `unauthenticated`. That is
    // the case a token check reports as signed in.
    if (session === null) {
      setPath({ outcome: 'unauthenticated' });
      return;
    }
    let live = true;
    void client.path().then((read) => {
      if (live) setPath(read);
    });
    return () => {
      live = false;
    };
  }, [client, session, generation]);

  const onChoose = useCallback((questionKey: string, value: string) => {
    setChosen((previous) => ({ ...previous, [questionKey]: value }));
  }, []);

  const onSubmit = useCallback(() => {
    // ⚠️ Cast at the one place the closed answer set meets a typed field. The values came from
    // the platform's own option list and its `parseIntake` is the authority — see the client's
    // note on why the editor does not narrow them.
    const answers = chosen as unknown as IntakeAnswers;
    setSubmitError(null);
    void client.submitIntake(answers).then((write) => {
      // 🔴 EVERY NON-OK OUTCOME IS SAID OUT LOUD. This used to be a bare `return`, and the
      // drive found what that looks like: the button does nothing, for ever, with no way for
      // the learner to tell a rate limit from an expired session from a broken editor.
      if (write.outcome !== 'ok') {
        setSubmitError(submitFailure(write));
        return;
      }
      setRetaking(false);
      setChosen({});
      // Re-read rather than build the path from the write's echo: the write answers with the
      // answers, and the path is the platform's to derive from them.
      setPath(undefined);
      setGeneration((n) => n + 1);
    });
  }, [chosen, client]);

  const onRetake = useCallback(() => {
    setChosen({});
    setRetaking(true);
  }, []);

  const onProject = useCallback(
    (concept: string) => {
      setProjecting(concept);
      setLastProjection(null);
      void client.projectConcept(concept).then((write) => {
        setProjecting(null);
        if (write.outcome !== 'ok') {
          // 🔴 A refusal from the ROUTE (409 "take the intake first", a rate limit) is worded by
          // the platform and shown as-is. It arrives here as `refused` only because `post()`
          // gained a 409 branch for this caller; before that it was `unreachable`.
          if (write.outcome === 'refused') {
            setLastProjection({ kind: 'failed', failure: write.detail });
          }
          return;
        }
        setLastProjection(write.value.outcome);
        // ⚠️ D10's refusal arrives inside a 200 — the route succeeded and the projection was
        // declined — so re-reading on anything but `ready` would poll a decision that will not
        // change. Only a fresh projection changes the path.
        if (write.value.outcome.kind === 'ready') {
          setGeneration((n) => n + 1);
        }
      });
    },
    [client]
  );

  const surface = learnerPathSurface({ intake, path, chosen, retaking, submitError });

  return {
    surface,
    onChoose,
    onSubmit,
    onRetake,
    onProject,
    projecting,
    projectionNote: projectionNote(lastProjection)
  };
}
