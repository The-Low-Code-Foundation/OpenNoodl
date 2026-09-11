/**
 * GeneratedCodeModal
 *
 * A read-only modal for viewing generated code from Logic Builder.
 * Uses the CodeMirror-based JavaScriptEditor in read-only mode.
 *
 * ## VFN-014 — two renderings of one program, and which one leads
 *
 * > *"The generated code looks absolutely nutter butter, nothing we can do about that?"*
 *
 * What this used to show is the node's stored `generatedCode` parameter, which is the
 * **instrumented** build: every value wrapped in `__p(blockId, …)` and every statement preceded
 * by `__s(blockId)`. That instrumentation is LGC-003's value tracing — it is what draws the
 * badges on the blocks — and it must not be removed from what runs. It is also unreadable.
 *
 * So the readable rendering leads and the instrumented one is one press away. 🔴 **Neither is
 * hidden**: the toggle says which is which, because the thing that actually executes must always
 * be reachable and must always be labelled as the thing that actually executes. See
 * `BlocklyEditor/readableCode.ts` — the readable build comes from the *same* generator with the
 * probe wrapper simply not applied, so there is no second truth about the program.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

import { JavaScriptEditor } from '@noodl-core-ui/components/code-editor';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';

import css from './GeneratedCodeModal.module.scss';

export interface GeneratedCodeModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The node name for display */
  nodeName: string;
  /**
   * The **instrumented** program — the node's stored `generatedCode`, byte for byte.
   *
   * ⚠️ This is what the app runs, and it is what *Copy Code* hands over when the tracing view is
   * the one on screen. It is never edited here and never regenerated here.
   */
  code: string;
  /**
   * VFN-014 — the same program with no probes in it, for reading.
   *
   * Absent means the readable rendering declined (a broken saved-block graph, an unparseable
   * workspace). The modal then shows the instrumented build and says why, rather than showing an
   * empty editor: a refusal that publishes its silence is the defect this feature has shipped
   * twice one level down.
   */
  readableCode?: string;
  /** Why the readable rendering declined, when it did. One sentence, shown in the info bar. */
  readableError?: string;
  /** Called when modal is closed */
  onClose: () => void;
}

/**
 * Read-only modal for viewing generated JavaScript code
 */
export function GeneratedCodeModal({
  isOpen,
  nodeName,
  code,
  readableCode,
  readableError,
  onClose
}: GeneratedCodeModalProps) {
  /**
   * Which of the two is on screen. Starts on the readable one whenever there is one — that is the
   * whole of VFN-014 — and resets every time the modal opens, so a builder who looked at the
   * tracing once is not still looking at it a week later without having asked.
   */
  const [showTracing, setShowTracing] = useState(false);

  useEffect(() => {
    if (isOpen) setShowTracing(false);
  }, [isOpen]);

  const hasReadable = typeof readableCode === 'string';
  const shown = hasReadable && !showTracing ? (readableCode as string) : code;

  const codeRef = useRef<string>(shown);

  // Keep code ref updated — `Copy Code` copies what is on screen, not the other one.
  useEffect(() => {
    codeRef.current = shown;
  }, [shown]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    if (codeRef.current) {
      navigator.clipboard.writeText(codeRef.current).then(
        () => {
          console.log('[GeneratedCodeModal] Code copied to clipboard');
        },
        (err) => {
          console.error('[GeneratedCodeModal] Failed to copy code:', err);
        }
      );
    }
  }, []);

  if (!isOpen) return null;

  const displayCode =
    shown || '// No code generated yet.\n// Add some blocks in the Logic Builder and close the editor.';

  /**
   * The info bar has to answer one question: *is this the thing that runs?* Both answers are
   * stated in full rather than implied by a toggle's label.
   */
  const info = readableError
    ? 'This is the program with value tracing in it — the readable rendering could not be produced: ' + readableError
    : showTracing || !hasReadable
      ? 'This is exactly what the app runs. The __p / __s calls are the value tracing that draws the ' +
        'badges on your blocks; __p hands back the value it is given, so the program computes the same result.'
      : 'This is the JavaScript your blocks describe. The app runs the same program with value tracing ' +
        'added — press Show tracing to see it. Lines marked with a // comment came from a saved block.';

  // Render into portal to escape any z-index issues
  return ReactDOM.createPortal(
    <div className={css['Overlay']} onClick={onClose}>
      <div className={css['Modal']} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css['Header']}>
          <span className={css['Title']}>Generated Code: {nodeName}</span>
          <span className={css['ReadOnlyBadge']}>
            {showTracing || !hasReadable ? 'What runs · Read-Only' : 'Read-Only'}
          </span>
        </div>

        {/* Info */}
        <div className={css['InfoBar']}>
          <span className={css['InfoText']}>{info}</span>
        </div>

        {/* Body with editor */}
        <div className={css['Body']}>
          <div className={css['EditorWrapper']}>
            <JavaScriptEditor
              value={displayCode}
              onChange={() => {}} // No-op since read-only
              validationType="script"
              height={400}
              width={700}
              disabled={true}
            />
          </div>
        </div>

        {/* Footer with buttons */}
        <div className={css['Footer']}>
          {hasReadable && (
            <PrimaryButton
              label={showTracing ? 'Show readable code' : 'Show tracing'}
              variant={PrimaryButtonVariant.Muted}
              onClick={() => setShowTracing((current) => !current)}
            />
          )}
          <PrimaryButton
            label="Copy Code"
            variant={PrimaryButtonVariant.Muted}
            icon={IconName.Copy}
            onClick={handleCopy}
            isDisabled={!shown}
          />
          <PrimaryButton label="Close" variant={PrimaryButtonVariant.Cta} onClick={onClose} />
        </div>
      </div>
    </div>,
    document.body
  );
}
