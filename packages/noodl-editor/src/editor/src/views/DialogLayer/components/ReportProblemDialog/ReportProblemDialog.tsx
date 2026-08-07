/**
 * ALPHA-007 §1, §2 and §5 — the composer.
 *
 * Three things about this dialog are design, not decoration:
 *
 * 1. **It opens over whatever is already open and dismisses nothing.** It is
 *    rendered into the DialogLayer, which is a sibling of the PopupLayer and
 *    sits above it, and `CoreBaseDialog` is given no `onClose` — so a click on
 *    the backdrop does nothing at all. Half of all UI bugs are about menus, and
 *    a reporter that closes the thing being reported cannot report it.
 * 2. **The screenshot arrives already taken.** The main process captures it in
 *    the menu click handler and hands this component a preview; by the time
 *    this renders, the evidence is behind it.
 * 3. **The reporter reads the payload before it posts.** On a public repository
 *    that is not a nicety — it is the control that stops a tester's API key
 *    becoming a permanent search result. "What gets sent" is expandable, and
 *    the browser then shows them the whole form again before they submit.
 *
 * The app transmits nothing. The user's own browser posts the issue, under
 * their own GitHub identity.
 */

import { ipcRenderer } from 'electron';
import React, { useMemo, useState } from 'react';
import { platform } from '@noodl/platform';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { FeedbackType } from '@noodl-constants/FeedbackType';

import { collectContext, guessSurface } from '@noodl-utils/report/collect';
import { composeReport, newReportId } from '@noodl-utils/report/compose';
import {
  FIELD,
  FRESH_PROJECT_OPTIONS,
  SEVERITY_OPTIONS,
  SURFACE_OPTIONS
} from '@noodl-utils/report/issueForm';

import css from './ReportProblemDialog.module.scss';

export interface ReportProblemDialogProps {
  /** Handle for the screenshot the main process is holding. */
  captureId: string | null;
  /** A small JPEG data URL, for the thumbnail. */
  preview: string | null;
  /** When the screenshot was taken — which is click time, not send time. */
  capturedAt: string;
  onClose: () => void;
}

type Stage = 'composing' | 'sending' | 'sent';

type Option = { label: string; value: string };

const asOptions = (values: readonly string[]): Option[] => values.map((value) => ({ label: value, value }));

/**
 * A native `<select>`, deliberately, where the rest of the editor uses core-ui's.
 *
 * core-ui's `Select` renders its option list through `BaseDialog`, which
 * portals into `.dialog-layer-portal-target` — a body sibling styled
 * `z-index: 666`, exactly the same as the DialogLayer this composer lives in.
 * On a tie the later element in the DOM wins, and the portal target is created
 * *first*, so an option list opened from inside a DialogLayer dialog paints
 * behind it. A dropdown you cannot see is worse than an unbranded one, and this
 * form is the one place in NodeGX a stranger uses exactly once.
 *
 * See ALPHA-007-NOTES.md — this looks like a core-ui defect that outlives this
 * task, but proving it needs the running editor.
 */
function NativeSelect({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={css['Field']}>
      <span className={css['FieldLabel']}>{label}</span>
      <select className={css['Select']} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReportProblemDialog({ captureId, preview, capturedAt, onClose }: ReportProblemDialogProps) {
  const [whatHappened, setWhatHappened] = useState('');
  const [surface, setSurface] = useState<string>(() => guessSurface());
  const [severity, setSeverity] = useState<string>('serious');
  const [freshProject, setFreshProject] = useState<string>("Haven't tried");
  const [steps, setSteps] = useState('');

  const [showPayload, setShowPayload] = useState(false);
  const [stage, setStage] = useState<Stage>('composing');
  const [bundlePath, setBundlePath] = useState<string | null>(null);
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Recomposed as the reporter types, so "what gets sent" is never stale — a
  // preview of a payload that is not the payload would be worse than none.
  const report = useMemo(
    () =>
      composeReport({
        reportId: newReportId(),
        capturedAt,
        user: { whatHappened, surface, severity, freshProject, steps },
        ...collectContext()
      }),
    [whatHappened, surface, severity, freshProject, steps, capturedAt]
  );

  const canSend = whatHappened.trim().length > 0 && stage === 'composing';

  async function send() {
    setStage('sending');
    setFailure(null);

    try {
      // §5, in this order. The clipboard and the bundle first — the browser
      // takes focus, and a reporter who tabs away mid-write should already have
      // everything on disk.
      const result = await ipcRenderer.invoke('report-send', {
        reportId: report.diagnostics.reportId,
        files: report.bundle,
        captureId
      });

      setBundlePath(result?.bundlePath ?? null);
      setHasScreenshot(Boolean(result?.hasScreenshot));

      await platform.openExternal(report.url);
      setStage('sent');
    } catch (error) {
      // The bundle is the fallback, so a failure here still leaves the reporter
      // somewhere to go — as long as we say so instead of failing silently.
      setFailure(String((error as Error)?.message || error));
      setStage('sent');
    }
  }

  function reveal() {
    if (!bundlePath) return;
    ipcRenderer.invoke('report-reveal', bundlePath);
  }

  return (
    <CoreBaseDialog title="Report a problem" isVisible hasBackdrop>
      {/* No `onClose` on the dialog: dismissal is the explicit button only, so
          nothing the reporter clicks by accident throws the report away. */}
      <Box hasXSpacing hasYSpacing UNSAFE_style={{ width: '620px', maxWidth: '90vw' }}>
        {stage === 'sent' ? (
          <VStack>
            {failure ? (
              <Text hasBottomSpacing textType={FeedbackType.Danger}>
                Something went wrong opening GitHub: {failure}
              </Text>
            ) : (
              <Text hasBottomSpacing>
                GitHub is open in your browser with the report already filled in. Read it, add anything
                else, and press <strong>Submit new issue</strong> — nothing is filed until you do.
              </Text>
            )}

            {hasScreenshot && (
              <Text hasBottomSpacing textType={TextType.Shy}>
                Your screenshot is on the clipboard — press {platform.os === 'macOS' ? '⌘V' : 'Ctrl+V'} in the
                description box to attach it.
              </Text>
            )}

            <Text hasBottomSpacing textType={TextType.Shy}>
              A copy of everything, including the screenshot, was saved on this machine — so nothing is
              lost if you clear the clipboard on the way.
            </Text>

            {/* Criterion 7: a tester with no GitHub account needs a path that
                does not involve one, stated here rather than only in the spec.
                TODO(ALPHA-007 open question 3): this wants a real address.
                ALPHA-005 owes the same decision for PRIVACY.md §12 and
                TERMS.md §11 — one decision, three places. */}
            <Text hasBottomSpacing textType={TextType.Shy}>
              No GitHub account? Send that folder to whoever gave you this build instead. It is a plain
              folder with a Markdown file and an image in it, and you can read both before you do.
            </Text>

            <HStack hasSpacing>
              <PrimaryButton
                label="Reveal in file manager"
                variant={PrimaryButtonVariant.Muted}
                size={PrimaryButtonSize.Small}
                isDisabled={!bundlePath}
                onClick={reveal}
              />
              <PrimaryButton label="Done" size={PrimaryButtonSize.Small} onClick={onClose} />
            </HStack>
          </VStack>
        ) : (
          <VStack>
            <Text hasBottomSpacing textType={TextType.Shy}>
              NodeGX sends nothing on its own. This fills in a GitHub issue and opens it in your browser —
              you see the whole thing, and can edit or abandon it, before anything is filed.
            </Text>

            {preview && (
              <div className={css['Preview']}>
                <img src={preview} alt="What the editor looked like when you opened this" />
                <Text textType={TextType.Shy}>
                  Captured the moment you opened this, so it shows what was on screen — menus and all.
                </Text>
              </div>
            )}

            <TextArea
              label="What happened"
              placeholder="What you did, and what NodeGX did instead of what you expected."
              value={whatHappened}
              hasBottomSpacing
              isAutoFocus
              onChange={(event) => setWhatHappened(event.target.value)}
            />

            <NativeSelect label="Where" options={asOptions(SURFACE_OPTIONS)} value={surface} onChange={setSurface} />

            <NativeSelect
              label="How bad is it"
              options={SEVERITY_OPTIONS.map((option) => ({ label: option.label, value: option.slug }))}
              value={severity}
              onChange={setSeverity}
            />

            <NativeSelect
              label="Does it happen in a brand-new project?"
              options={asOptions(FRESH_PROJECT_OPTIONS)}
              value={freshProject}
              onChange={setFreshProject}
            />

            <TextArea
              label="Steps to reproduce (optional)"
              placeholder={'1. New project\n2. Drag a Text node in\n3. Type into it'}
              value={steps}
              hasBottomSpacing
              onChange={(event) => setSteps(event.target.value)}
            />

            <button type="button" className={css['Disclosure']} onClick={() => setShowPayload(!showPayload)}>
              {showPayload ? '▾' : '▸'} What gets sent
            </button>

            {showPayload && (
              <pre className={css['Payload']}>
                {report.fields[FIELD.diagnostics]}
                {report.fields[FIELD.errors] ? '\n\n--- error text ---\n' + report.fields[FIELD.errors] : ''}
              </pre>
            )}

            <Box hasTopSpacing>
              {/* Button convention (UIX-004): primary on the right. */}
              <HStack hasSpacing>
                <PrimaryButton
                  label="Cancel"
                  variant={PrimaryButtonVariant.Muted}
                  size={PrimaryButtonSize.Small}
                  onClick={onClose}
                />
                <PrimaryButton
                  label={stage === 'sending' ? 'Opening GitHub…' : 'Open GitHub with this filled in'}
                  size={PrimaryButtonSize.Small}
                  isDisabled={!canSend}
                  onClick={send}
                />
              </HStack>
            </Box>
          </VStack>
        )}
      </Box>
    </CoreBaseDialog>
  );
}
