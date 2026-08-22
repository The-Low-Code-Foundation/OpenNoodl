/**
 * UNI-011 AC2 — *"Ask about this node"*, the composer.
 *
 * > the composer opens prefilled with type, warning, version and OS; the graph excerpt is **off
 * > until enabled**, and what it will send is **shown before it sends**.
 *
 * ## Three things that are design rather than decoration
 *
 * 1. 🔴 **The preview is the payload.** The `<pre>` below renders `question.body`, and the button
 *    copies `question.body`. There is no second formatter and no "roughly what will be sent" —
 *    the failure this prevents is a user who reviewed one string and published another, and two
 *    code paths that agree today are exactly the arrangement that stops agreeing. The default
 *    for the excerpt lives in `composeNodeQuestion` for the same reason: a default held in a
 *    `useState` here is one refactor from being lost, and what would be lost is silent.
 *
 * 2. 🔴 **TWO ROUTES, AND WHICH ONE RUNS IS DECIDED BY WHETHER THERE IS A CREDENTIAL** —
 *    amended by UNI-016 (2026-08-18), which is the task that built the other end. Signed in,
 *    the composer `POST`s through
 *    [`communityapi.ts`](../../../../models/community/communityapi.ts) and the payload arrives
 *    **structured**: the node, its ports, the count of the ones held back, the capture's
 *    dimensions — D19's *"the unit of content is a graph with a question attached"*. Signed
 *    out, it copies and opens the browser exactly as it always did.
 *
 *    ⚠️ **The hand-off is kept deliberately and UNI-016 AC5 says so** — *"the tempting cleanup
 *    is to delete it"*. It is not a fallback for a feature that half-works: it is D16's entry
 *    point, and it is **the only route any real user can take today**, because UNI-001 has no
 *    issuer and `readCommunitySession()` therefore returns `null` for everybody. See
 *    [`communitysession.ts`](../../../../models/community/communitysession.ts), which says so
 *    at length rather than pretending otherwise.
 *
 *    What is editor-only here remains the **composition** — the prefill and the redacted
 *    excerpt, neither of which a browser can build — and that is the half D14 calls the reason
 *    to transition.
 *
 * 3. **Nothing leaves the machine before the user acts**, which is the same promise AC3 makes
 *    about the capture. Composing is local; the clipboard write and the browser open are both on
 *    the button.
 *
 * ## UNI-011 AC3 — *"share what you're seeing"*, in the same composer
 *
 * > A capture from the running preview can be attached with per-port share toggles, defaulting to
 * > **off** for anything record-shaped. Nothing leaves the machine before the user posts.
 *
 * ⚠️ **AC3 is built here rather than in a second dialog**, because the criterion's own verb is
 * *attached* — an attachment belongs to a post, and a second composer would mean two payloads, two
 * previews and two chances for the string shown to stop being the string sent. The rule lives in
 * [`portshare.ts`](../../../../models/community/portshare.ts); this file owns two things it cannot,
 * and both are about time rather than disclosure:
 *
 * 1. 🔴 **A tick survives the poll.** `usePortValues` re-answers every second, so a component that
 *    recomputed the default set from the rows on every render would silently re-tick a box the user
 *    had just cleared. The state held here is therefore the user's **overrides**, and the default is
 *    consulted only for a port nobody has decided about — which also gives a port that appears
 *    late, when its component mounts, the same default a port present from the start got.
 * 2. **The capture is taken on demand.** Grabbing it as the dialog opens would photograph whatever
 *    was on screen at right-click time, and the reason someone attaches a picture is usually that
 *    they are about to make the app do the thing.
 *
 * @module views/DialogLayer/components/AskAboutNodeDialog/AskAboutNodeDialog
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { platform } from '@noodl/platform';

import { Checkbox, CheckboxVariant } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { COMMUNITY_SIGN_IN_LABEL } from '@noodl-core-ui/constants/communityCopy';

import { CommunityApiClient, type Write } from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import { signIntoCommunity, type SignInProgress } from '@noodl-models/community/communitysignin';
import { buildNodeArtifacts } from '@noodl-models/community/nodeartifact';
import { GraphExcerpt } from '@noodl-models/community/nodeexcerpt';
import { LibraryPorts } from '@noodl-models/community/nodeexcerpt';
import { SharablePortRef, saveCaptureNextTo } from '@noodl-models/community/nodesharecontext';
import { composeNodeQuestion } from '@noodl-models/community/nodequestion';
import { QuestionEnvironment } from '@noodl-models/community/nodequestion';
import { OFF_REASON_TEXT, ShareAttachment, describeSharablePorts } from '@noodl-models/community/portshare';
import { RedactorOptions } from '@noodl-utils/report/redact';
import { requestCommunityThread } from '@noodl-utils/community/communityThreadRequest';

import { captureLivePreview, hasLivePreview, type PreviewCapture } from '../../../SandboxSurface';
import { portValueKey, type PortValueRef } from '../../../panels/propertyeditor/components/PortsTab/portValues';
import { usePortValues } from '../../../panels/propertyeditor/components/PortsTab/usePortValues';

import css from './AskAboutNodeDialog.module.scss';

/**
 * Where the entry point goes while the mirror is gated.
 *
 * 🔴 **MOVED to `@noodl-models/community/communityorigin` by UNI-001 E1** and re-exported here
 * so no caller had to change. It grew a second and third consumer — the device sign-in and
 * sign-out — and a constant exported from a *view* is one a *model* cannot import without
 * pointing the dependency arrow backwards. The reasoning about `.io` vs `.dev`, and about the
 * host resolving while nothing serves it, now lives with the constant.
 */
export { COMMUNITY_URL } from '@noodl-models/community/communityorigin';

/**
 * Where a node question lands on the Bench.
 *
 * `bench_section` is `help | showcase | meetups`, and a question about a misbehaving node is
 * `help` every time — 🔴 which is why it is a constant and not a picker. UNI-016's scope is
 * that *the editor already produces the payload*; asking the user to classify it would be a
 * decision the composer can make correctly for them, and a section dropdown whose only sensible
 * answer is preselected is chrome that can only be got wrong.
 */
const ASK_SECTION = 'help';

/**
 * What the composer is doing, as one value.
 *
 * ⚠️ Not three booleans. `posting`/`posted`/`failed` held separately have eight states, five
 * of which are nonsense, and the one that ships is the pair that got out of step — a spinner
 * over a success message. The union has exactly the states that exist.
 */
type PostState =
  | { phase: 'idle' }
  | { phase: 'posting' }
  | { phase: 'posted'; threadId: string; pointsAwarded: number }
  | { phase: 'failed'; message: string };

/**
 * The refusal, in words for the person who is about to try again.
 *
 * 🔴 `refused` carries the PLATFORM's sentence and this passes it through unedited.
 * `bench-http.ts` picks those words through one table for a stated reason — a caller learns
 * *that* it was refused and, for rules about its own input, enough to fix it, while never
 * learning that D15 exists. Substituting our own wording would either lose the actionable half
 * or reconstruct the half that was withheld on purpose.
 *
 * ⚠️ `absent` is the exception and it must NOT be narrated as a refusal. The platform answers
 * an org-minor with the same 404 the read gets, deliberately, *so that a pupil is not told a
 * door exists* — so the composer says the thing that is true for everyone whose post did not
 * land, and says nothing about why.
 */
function describeWriteFailure(result: Write<unknown>): string {
  switch (result.outcome) {
    case 'unauthenticated':
      return 'Your community session has expired. Use the browser button below instead.';
    case 'refused':
      return result.detail;
    case 'absent':
      return 'That could not be posted from here. Use the browser button below instead.';
    case 'unreachable':
      return `The community could not be reached (${result.detail}). Use the browser button below instead.`;
    default:
      return 'That could not be posted.';
  }
}

export interface AskAboutNodeDialogProps {
  focus: { typename?: string };
  library: LibraryPorts | null;
  warning: string | null;
  environment: QuestionEnvironment;
  excerpt: GraphExcerpt | null;
  paths: RedactorOptions;
  /** AC3 — the node's id in its graph, used to address the live-value poll. Never published. */
  nodeId: string;
  /** AC3 — every port worth offering, with the library's verdict on each name already in it. */
  portRefs: SharablePortRef[];
  onClose: () => void;
}

export function AskAboutNodeDialog({
  focus,
  library,
  warning,
  environment,
  excerpt,
  paths,
  nodeId,
  portRefs,
  onClose
}: AskAboutNodeDialogProps) {
  const [asked, setAsked] = useState('');
  // ⚠️ `false` here agrees with the composer's default rather than establishing it. If these two
  // ever disagree, the composer wins, and `tests-unit/uni-011/nodequestion.test.ts` is what says
  // which one that is.
  const [includeExcerpt, setIncludeExcerpt] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);

  /**
   * UNI-016 — the credential, or the absence of one.
   *
   * 🔴 `undefined` while the store is being read, and the distinction is load-bearing rather
   * than tidy: `null` renders the signed-out composer, and rendering that for the frame before
   * the read resolves would flash the browser hand-off at somebody who is signed in. It is the
   * same reason `overrides` distinguishes *"has not decided"* from *"off"* two fields above.
   */
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [postState, setPostState] = useState<PostState>({ phase: 'idle' });

  /**
   * UNI-001 E1 — signing in, from the composer.
   *
   * 🔴 HERE AND NOT ONLY IN THE LAUNCHER, and the reason is the alpha bar's own sentence: *"a
   * stranger can … ask a question about a node from inside the editor."* A person who has
   * written their question and then discovers they must go and find a launcher card has been
   * asked to abandon what they were doing. ⚠️ UNI-001 AC2 still names a launcher affordance and
   * it is still owed — this is the loop's sign-in, not a substitute for that one.
   *
   * ⚠️ `undefined` means *not signing in*, distinct from a progress value, for exactly the
   * reason `session` uses `undefined` above.
   */
  const [signIn, setSignIn] = useState<SignInProgress | undefined>(undefined);
  const [signInError, setSignInError] = useState<string | null>(null);
  const abandoned = useRef(false);
  useEffect(() => () => {
    abandoned.current = true;
  }, []);

  useEffect(() => {
    let live = true;
    void readCommunitySession().then((found) => {
      // ⚠️ The dialog can be dismissed while the read is in flight; setting state on an
      // unmounted component is the warning nobody reads and the leak nobody finds.
      if (live) setSession(found);
    });
    return () => {
      live = false;
    };
  }, []);

  /** AC3 — the user's decisions, keyed by port. Absent means *"has not decided"*, never *"off"*. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [capture, setCapture] = useState<PreviewCapture | null>(null);
  const [includeCapture, setIncludeCapture] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const valueRefs = useMemo<PortValueRef[]>(
    () => portRefs.map((ref) => ({ node: ref.node, port: ref.port, direction: ref.direction })),
    [portRefs]
  );
  const live = usePortValues(valueRefs, nodeId);

  /** The rows, with their defaults. Rebuilt from each poll, which is why the *decisions* are not. */
  const rows = useMemo(
    () =>
      describeSharablePorts(
        portRefs.map((ref) => ({
          port: ref.port,
          direction: ref.direction,
          value: live.values[portValueKey(ref.node, ref.port, ref.direction)],
          declared: ref.declared
        })),
        paths
      ),
    [portRefs, live.values, paths]
  );

  const attachment = useMemo<ShareAttachment>(() => {
    const shared = new Set<string>();
    for (const row of rows) {
      const decided = overrides[row.key];
      if (decided === undefined ? row.sharedByDefault : decided) shared.add(row.key);
    }
    return {
      capture: capture && includeCapture ? { width: capture.width, height: capture.height, bytes: capture.bytes } : null,
      ports: rows,
      shared
    };
  }, [rows, overrides, capture, includeCapture]);

  const question = useMemo(
    () =>
      composeNodeQuestion({
        focus,
        library,
        warning,
        environment,
        excerpt,
        includeExcerpt,
        attachment,
        question: asked,
        paths
      }),
    [focus, library, warning, environment, excerpt, includeExcerpt, attachment, asked, paths]
  );

  /**
   * UNI-016 — the same decisions, in the shape that survives the door.
   *
   * 🔴 Built from `question.nodeType` and `attachment` — the composed, BUCKETED type and the
   * ticked set — never from `focus.typename` and never from `rows`. `nodeartifact.ts` explains
   * at length why the structured payload has to be subordinate to the prose rather than
   * parallel to it, and this is the line where that is either true or not.
   */
  const artifacts = useMemo(
    () => buildNodeArtifacts({ nodeType: question.nodeType, environment, attachment }),
    [question.nodeType, environment, attachment]
  );

  /**
   * UNI-016 — the post.
   *
   * ⚠️ The capture is still written to the asker's Documents folder on this path too, and
   * that is not an oversight: a `capture` attachment carries its dimensions and its consent
   * record and **no image**, because blob storage is owned by no task. Until it is, the file
   * on disk is the only copy of the picture there is, and dropping it here would make the
   * signed-in route lose something the signed-out route keeps.
   */
  async function postToBench(token: string) {
    setPostState({ phase: 'posting' });
    if (capture && includeCapture) setSavedTo(await saveCaptureNextTo(capture.data));

    const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token });
    const result = await client.askQuestion({
      section: ASK_SECTION,
      // 🔴 The same two values the `<pre>` below renders. Not recomposed, not re-derived —
      // this is UNI-011 AC2's *"the string shown IS the string sent"*, and the artifacts
      // travel beside it rather than instead of it.
      title: question.title,
      body: question.body,
      attachments: artifacts
    });

    if (result.outcome === 'ok') {
      setPostState({
        phase: 'posted',
        threadId: result.value.threadId,
        pointsAwarded: result.value.pointsAwarded
      });
      return;
    }
    setPostState({ phase: 'failed', message: describeWriteFailure(result) });
  }

  async function grabCapture() {
    setCapturing(true);
    try {
      // Local: `capturePage()` on the preview webview. Nothing is sent, and nothing is written to
      // disk either — the file only appears when the user commits, on the button below.
      setCapture(await captureLivePreview());
    } finally {
      setCapturing(false);
    }
  }

  async function handOff() {
    // The exact value that was on screen. Not recomposed, not re-derived.
    void navigator.clipboard.writeText(`${question.title}\n\n${question.body}`);
    if (capture && includeCapture) setSavedTo(await saveCaptureNextTo(capture.data));
    platform.openExternal(COMMUNITY_URL);
    setHandedOff(true);
  }

  /**
   * Runs the device dance and, on success, re-reads the store the same way the dialog does on
   * mount — so the signed-in composer that appears is rendered from the credential that was
   * actually persisted, not from the value the flow happened to return.
   *
   * 🔴 `isCancelled` reads a REF and not the `signIn` state, and that is not a style
   * preference: the poll loop closes over its arguments once and runs for up to fifteen
   * minutes, so a state value captured there is frozen at the value it had on the first
   * render and the loop would never see a cancellation. The ref is set by the unmount effect
   * below — without it, a dismissed dialog leaves a poll hammering the platform every five
   * seconds until the pairing lapses.
   */
  async function beginSignIn() {
    setSignInError(null);
    const result = await signIntoCommunity(setSignIn, {
      openExternal: (url) => platform.openExternal(url),
      isCancelled: () => abandoned.current
    });
    setSignIn(undefined);
    if (result.outcome === 'signed-in') {
      setSession(await readCommunitySession());
      return;
    }
    if (result.outcome === 'expired') {
      setSignInError('That sign-in timed out. Try again, or use the browser button below.');
      return;
    }
    if (result.outcome === 'failed') setSignInError(result.detail);
  }

  return (
    <CoreBaseDialog isVisible hasArrow={false}>
      <Box hasXSpacing hasYSpacing UNSAFE_className={css['Root']}>
        <VStack hasSpacing={3}>
          <Text textType={TextType.DefaultContrast}>Ask the community about this node</Text>
          <Text textType={TextType.Shy}>
            The question is written for you from what the editor already knows. Read it before you post — it goes
            somewhere public.
          </Text>

          <TextArea
            label="What would you like to ask?"
            value={asked}
            onChange={(event) => setAsked(event.target.value)}
            placeholder="Why does this keep failing on the second call?"
          />

          <Checkbox
            variant={CheckboxVariant.Default}
            label="Include a graph excerpt (types and wiring only — no names, parameters or data)"
            isChecked={includeExcerpt}
            onChange={(event) => setIncludeExcerpt(event.target.checked)}
          />

          {/*
            AC3. The capture, then the values — the order they are decided in, and the order they
            appear in the payload below.
          */}
          <VStack hasSpacing={1}>
            <HStack hasSpacing={2}>
              <PrimaryButton
                label={capture ? 'Take another capture' : 'Attach a capture of the running preview'}
                variant={PrimaryButtonVariant.MutedOnLowBg}
                size={PrimaryButtonSize.Small}
                isDisabled={capturing || !hasLivePreview()}
                onClick={() => void grabCapture()}
              />
              {capture && (
                <Checkbox
                  variant={CheckboxVariant.Default}
                  label={`Attach it (${capture.width} × ${capture.height})`}
                  isChecked={includeCapture}
                  onChange={(event) => setIncludeCapture(event.target.checked)}
                />
              )}
            </HStack>
            {!hasLivePreview() && <Text textType={TextType.Shy}>Run the preview to attach a capture.</Text>}
          </VStack>

          {rows.length > 0 && (
            <VStack hasSpacing={1}>
              <Text textType={TextType.Shy}>
                Live values on this node. Records, text and ports you named yourself start switched off.
              </Text>
              <div className={css['PortList']}>
                {rows.map((row) => {
                  const checked = overrides[row.key] === undefined ? row.sharedByDefault : overrides[row.key];
                  const why = row.offBecause.map((reason) => OFF_REASON_TEXT[reason]).join(', ');
                  return (
                    <Checkbox
                      key={row.key}
                      variant={CheckboxVariant.Default}
                      label={`${row.port} (${row.direction}) = ${row.value}${why ? `  — ${why}` : ''}`}
                      UNSAFE_className={css['PortValue']}
                      isChecked={checked}
                      onChange={(event) =>
                        setOverrides((previous) => ({ ...previous, [row.key]: event.target.checked }))
                      }
                    />
                  );
                })}
              </div>
            </VStack>
          )}

          <VStack hasSpacing={1}>
            <Text textType={TextType.Shy}>This is exactly what will be posted:</Text>
            <pre className={css['Payload']}>
              {question.title}
              {'\n\n'}
              {question.body}
            </pre>
          </VStack>

          {/*
            🔴 UNI-016 — TWO ROUTES, AND BOTH SHIP.

            Signed in, the primary button POSTs and the payload keeps its structure. Signed
            out, the hand-off is the whole of it, unchanged — AC5, which warns in as many
            words that *"the tempting cleanup is to delete it"*. ⚠️ The hand-off stays visible
            when signed in as well, and that is deliberate rather than clutter: it is what a
            person reaches for when the post is refused or the platform cannot be reached, and
            `describeWriteFailure` sends them to it by name.
          */}
          {/*
            🔴 UNI-001 E1 — the sign-in, and it appears only when we KNOW there is no session.
            `session === null` and not `!session`: `undefined` is "the store has not answered
            yet", and rendering this on that frame would flash "Sign in" at somebody who is
            already signed in — the same distinction the `session` state's own comment makes.
          */}
          {session === null && (
            <VStack hasSpacing={1}>
              {signIn?.phase === 'waiting' ? (
                <>
                  <Text textType={TextType.Default}>
                    Type this code in the browser window that just opened:
                  </Text>
                  <pre className={css['Payload']}>{signIn.userCode}</pre>
                  <Text textType={TextType.Shy}>
                    {/* ⚠️ The address is shown as well as opened. A browser that opened on a
                        different profile, or did not open at all, leaves a person with a code
                        and nowhere to put it. */}
                    {signIn.verificationUri}
                  </Text>
                </>
              ) : (
                <HStack hasSpacing={2}>
                  <PrimaryButton
                    label={signIn ? 'Starting…' : COMMUNITY_SIGN_IN_LABEL}
                    size={PrimaryButtonSize.Small}
                    isDisabled={signIn !== undefined}
                    onClick={() => void beginSignIn()}
                  />
                  <Text textType={TextType.Shy}>
                    Sign in to post from here — or use the browser button below, which needs no
                    account.
                  </Text>
                </HStack>
              )}
              {signInError && <Text textType={TextType.Danger}>{signInError}</Text>}
            </VStack>
          )}

          <HStack hasSpacing={2}>
            {session && (
              <PrimaryButton
                label={
                  postState.phase === 'posting'
                    ? 'Posting…'
                    : postState.phase === 'posted'
                      ? 'Posted to the community'
                      : `Post to the community${session.handle ? ` as @${session.handle}` : ''}`
                }
                size={PrimaryButtonSize.Small}
                isDisabled={postState.phase === 'posting' || postState.phase === 'posted'}
                onClick={() => void postToBench(session.token)}
              />
            )}
            <PrimaryButton
              label={handedOff ? 'Copied — opened in your browser' : 'Copy and open the community'}
              variant={session ? PrimaryButtonVariant.MutedOnLowBg : PrimaryButtonVariant.Cta}
              size={PrimaryButtonSize.Small}
              onClick={() => void handOff()}
            />
            <PrimaryButton
              label="Cancel"
              variant={PrimaryButtonVariant.MutedOnLowBg}
              size={PrimaryButtonSize.Small}
              onClick={onClose}
            />
          </HStack>

          {/*
            🔴 NAT-012 AC4 — the ask no longer ends at a sentence. It used to say "Answers will
            appear on the Bench" and stop: the one project-relevant verb D6 leaves in the editor,
            finishing with nowhere to click. Richard's bar is *"whatever you do in the editor can
            be viewed and solved in the editor"*, and this is the click that makes it true.

            ⚠️ The dialog CLOSES on the way. The thread opens in the rail panel behind it, and a
            modal left standing over the answer it just opened is the same dead end with an extra
            step. See `communityThreadRequest` for why the request is stashed as well as emitted —
            somebody asking their first question has never opened that panel.
          */}
          {postState.phase === 'posted' && (
            <VStack hasSpacing={1} UNSAFE_style={{ alignItems: 'flex-start' }}>
              <Text textType={TextType.Shy}>
                {postState.pointsAwarded > 0
                  ? `Posted — ${postState.pointsAwarded} points.`
                  : 'Posted.'}
              </Text>
              <PrimaryButton
                label="Open the thread"
                variant={PrimaryButtonVariant.MutedOnLowBg}
                size={PrimaryButtonSize.Small}
                onClick={() => {
                  requestCommunityThread(postState.threadId);
                  onClose();
                }}
              />
            </VStack>
          )}
          {postState.phase === 'failed' && <Text textType={TextType.Shy}>{postState.message}</Text>}

          {/*
            🔴 Shown here and nowhere in the payload. The path names this machine and usually the
            project; `formatShareAttachment` publishes the picture's size and never its location.
          */}
          {savedTo && <Text textType={TextType.Shy}>{`Capture saved to ${savedTo} — drag it into your post.`}</Text>}
        </VStack>
      </Box>
    </CoreBaseDialog>
  );
}
