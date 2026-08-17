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
 * 2. ⚠️ **It hands off to the browser; it does not post.** That is not a shortcut, it is D16:
 *    *"until then the entry point opens the browser"*, and the threshold cannot be met today
 *    because UNI-009's forum does not exist to have threads in. What is editor-only here is the
 *    **composition** — the prefill and the redacted excerpt, neither of which a browser can
 *    build — and that is the half D14 calls the reason to transition. When there is a forum and
 *    UNI-001 has an issuer, the copy-and-open becomes a `POST` through
 *    [`communityapi.ts`](../../../../models/community/communityapi.ts) and nothing above it
 *    changes.
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

import React, { useMemo, useState } from 'react';

import { platform } from '@noodl/platform';

import { Checkbox, CheckboxVariant } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { GraphExcerpt } from '@noodl-models/community/nodeexcerpt';
import { LibraryPorts } from '@noodl-models/community/nodeexcerpt';
import { SharablePortRef, saveCaptureNextTo } from '@noodl-models/community/nodesharecontext';
import { composeNodeQuestion } from '@noodl-models/community/nodequestion';
import { QuestionEnvironment } from '@noodl-models/community/nodequestion';
import { OFF_REASON_TEXT, ShareAttachment, describeSharablePorts } from '@noodl-models/community/portshare';
import { RedactorOptions } from '@noodl-utils/report/redact';

import { captureLivePreview, hasLivePreview, type PreviewCapture } from '../../../SandboxSurface';
import { portValueKey, type PortValueRef } from '../../../panels/propertyeditor/components/PortsTab/portValues';
import { usePortValues } from '../../../panels/propertyeditor/components/PortsTab/usePortValues';

import css from './AskAboutNodeDialog.module.scss';

/**
 * Where the entry point goes while the mirror is gated.
 *
 * ✅ **`community.nodegx.io` resolves as of 2026-08-17** — an A record to nexus-1
 * (`49.12.102.195`), added by Richard. ⚠️ **The domain is `.io`, not `.dev`**: every phase-67
 * document said `community.nodegx.dev` for four days, including this constant, and it was never
 * checked against the registrar. It is a subdomain of the domain the landing page already uses.
 *
 * ⚠️ **Resolving is not being served.** nexus-1 runs the static `nodegx.io` landing page and two
 * other sites; the platform (`nodegx-community`) is deployed nowhere and Caddy has no site block
 * for this host. So the button opens a hostname that answers — which is still the right behaviour
 * under D16, because the alternative is a button that opens nothing.
 *
 * This constant remains the one place that changes, and it is deliberately not spread across the
 * composer: AC2 and AC3 both hand off through it.
 */
export const COMMUNITY_URL = 'https://community.nodegx.io';

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

          <HStack hasSpacing={2}>
            <PrimaryButton
              label={handedOff ? 'Copied — opened in your browser' : 'Copy and open the community'}
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
            🔴 Shown here and nowhere in the payload. The path names this machine and usually the
            project; `formatShareAttachment` publishes the picture's size and never its location.
          */}
          {savedTo && <Text textType={TextType.Shy}>{`Capture saved to ${savedTo} — drag it into your post.`}</Text>}
        </VStack>
      </Box>
    </CoreBaseDialog>
  );
}
