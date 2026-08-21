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

/**
 * What to say when the projection REQUEST itself did not land — FIX-027 bug 21.
 *
 * 🔴 **THE BUTTON USED TO DO NOTHING AT ALL.** Richard clicked *"Explain this for me"*, saw
 * a `404` in the console and nothing on screen, because this hook surfaced only `refused` and
 * dropped every other non-`ok` outcome on the floor. The 404 had a cause (the route matched
 * `teaches` while the button sent `slug`) and it is fixed on the platform — but a client that
 * says nothing when a write fails would have hidden the NEXT cause just as completely.
 *
 * ⚠️ **`absent` IS NARRATED HERE, and that is not a hole in D15.** {@link Read}'s rule — *absent
 * means absent, say nothing* — protects a surface the viewer must not learn exists. This is the
 * opposite situation: the learner is looking at their own path and has just pressed a button on
 * one of its steps. The surface is already theirs and already on screen, so silence here is not
 * privacy, it is a dead control. It is worded as a fact about the step, never as an error.
 *
 * ⚠️ The platform's own words are returned for `refused`, which is what the route's 409
 * (*"take the intake first"*) and its rate limit actually say. {@link projectionNote} cannot do
 * this — it maps the five outcome KINDS that arrive inside a 200 and has no detail to show —
 * which is why a transport failure needs its own sentence rather than a sixth kind.
 *
 * 🔴 **IT LIVES IN THE HOOK, NOT IN `learnerpathview.ts`, AND THAT IS LOAD-BEARING.** It was
 * written there first — beside `projectionNote`, which is tested — and UNI-001 AC4 caught it:
 * *"the module that decides what is DRAWN never sees a session at all"*, asserted as a
 * substring over the stripped source, and the `unauthenticated` sentence below says
 * "session". The right answer was the boundary, not a reword. `projectionNote` maps the five
 * outcome KINDS the platform puts inside a 200 and is a drawing decision; this maps the
 * TRANSPORT outcomes of a write, which is the client's half and knows about credentials.
 * Exported for the spec, which is why it is not `function` alone.
 */
export function projectionFailure(write: { outcome: string; detail?: string }): string {
  switch (write.outcome) {
    case 'unauthenticated':
      return 'Your session has expired — sign in again and ask for this explanation.';
    case 'refused':
      return write.detail ?? 'The community would not write that explanation.';
    case 'absent':
      return 'That step is not on your path, so there is no explanation to write for it.';
    default:
      return 'Couldn’t reach the community, so that explanation wasn’t written. Try again in a moment.';
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
  const [projectionError, setProjectionError] = useState<string | null>(null);
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
      setProjectionError(null);
      void client.projectConcept(concept).then((write) => {
        setProjecting(null);
        if (write.outcome !== 'ok') {
          // 🔴 EVERY non-`ok` outcome is now said out loud — see {@link projectionFailure}.
          // A refusal from the ROUTE (409 "take the intake first", a rate limit) is worded by the
          // platform and shown as-is. It arrives here as `refused` only because `post()` gained a
          // 409 branch for this caller; before that it was `unreachable`.
          //
          // ⚠️ It used to be routed into `{ kind: 'failed' }`, which meant the platform's words
          // were dropped by `projectionNote` in favour of *"could not be written, and it will not
          // be retried"* — wrong twice over for a 409, which is the learner's own to fix and
          // will work on the next click.
          setProjectionError(projectionFailure(write));
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
    // ⚠️ The transport sentence WINS when there is one: it is the more recent event, and the
    // two cannot both be true — `projectionError` is only ever set on a request that did not
    // land, which is the same request that left `lastProjection` null.
    projectionNote: projectionError ?? projectionNote(lastProjection)
  };
}
