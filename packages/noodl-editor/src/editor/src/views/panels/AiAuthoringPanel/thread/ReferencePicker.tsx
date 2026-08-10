/**
 * BLD-011 — the first path to a reference.
 *
 * `@` is the *keyboard* path and it is BLD-016's; drag-and-drop is BLD-013's; a
 * capture is BLD-014's. All three attach to the same list through the same
 * `resolveCandidate`, so this button is not a fourth mechanism — it is the one
 * path that can exist before any of them, and the one that makes the frame
 * driveable in this session rather than in three tasks' time.
 *
 * ⚠️ See the stylesheet for why this is neither a `MenuDialog` nor a native
 * `<select>`; both choices are measurements from earlier tasks in this phase,
 * not preferences.
 *
 * @module AiAuthoringPanel/thread/ReferencePicker
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import type { ReferenceCandidate } from '../../../../models/AiAssistant/authoring/referenceSources';

import css from './ReferencePicker.module.scss';

export interface ReferencePickerProps {
  /** Everything attachable, already labelled and sorted. */
  candidates: readonly ReferenceCandidate[];
  /** Targets already on the chip row, so the list can say so rather than re-add. */
  attachedTargets: ReadonlySet<string>;
  onAttach: (candidate: ReferenceCandidate) => void;
  /** Re-read the project when the list opens — components change while it is shut. */
  onOpen?: () => void;
  isDisabled?: boolean;
}

export function ReferencePicker({ candidates, attachedTargets, onAttach, onOpen, isDisabled }: ReferencePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on an outside click or Escape. Both, not either: a list that closes
  // only on Escape is a trap for the mouse, and one that closes only on an
  // outside click is a trap for the keyboard.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) onOpen?.();
      return !wasOpen;
    });
  }, [onOpen]);

  const components = candidates.filter((c) => c.kind === 'component');
  const docs = candidates.filter((c) => c.kind === 'doc');

  return (
    <div className={css['Picker']} ref={rootRef} data-test="reference-picker">
      {/*
       * ⚠️ `MutedOnLowBg`, not `Ghost`, and the drive is why.
       *
       * Measured in the running editor: `Ghost`'s accent label came out at
       * **4.33:1 in light** on the composer's `bg-2` — the exact figure already
       * on the design-system list as C7 (BLD-002) and hardened by BLD-008's R12,
       * now seen a third time. Fixing it per-call-site with a specificity
       * override is how one token defect becomes five copies that disagree, so
       * the row stays filed and this control uses a variant that passes:
       * `fg-default` measures **6.66 dark / 6.54 light** on `bg-3`.
       *
       * It is also the better control on the merits. Attaching context is
       * secondary to Send, which is the composer's CTA — an accent-bordered
       * button beside it was competing with the thing it supports. And the
       * muted variants carry POL-016's inset ring, so it still reads as a
       * control rather than a label.
       */}
      <PrimaryButton
        label="Add context"
        icon={IconName.Plus}
        variant={PrimaryButtonVariant.MutedOnLowBg}
        size={PrimaryButtonSize.Small}
        isDisabled={isDisabled}
        onClick={toggle}
        testId="reference-picker-toggle"
      />

      {open && (
        <div className={css['List']} role="listbox" data-test="reference-picker-list">
          {candidates.length === 0 && (
            <div className={css['Empty']}>
              <Text textType={TextType.Default}>Nothing to attach — this project has no components or docs yet.</Text>
            </div>
          )}
          {renderGroup('Components', components, attachedTargets, onAttach, setOpen)}
          {renderGroup('Documents', docs, attachedTargets, onAttach, setOpen)}
        </div>
      )}
    </div>
  );
}

function renderGroup(
  title: string,
  items: readonly ReferenceCandidate[],
  attachedTargets: ReadonlySet<string>,
  onAttach: (candidate: ReferenceCandidate) => void,
  setOpen: (open: boolean) => void
) {
  if (items.length === 0) return null;
  return (
    <React.Fragment key={title}>
      <div className={css['Group']}>{title}</div>
      {items.map((candidate) => {
        const attached = attachedTargets.has(candidate.target);
        return (
          <button
            key={candidate.target}
            type="button"
            role="option"
            /* A stable hook for driving. `cdp click` takes a selector and this
               repo has a measured trap where a coordinate click lands on the
               control underneath (BEN, `cdp-click-races-the-layout`); an
               attribute selector on the target is the one thing here that
               cannot drift with the layout. BLD-010 drives this list too. */
            data-target={candidate.target}
            aria-selected={attached}
            disabled={attached}
            className={`${css['Item']} ${attached ? css['is-attached'] : ''}`}
            onClick={() => {
              if (attached) return;
              onAttach(candidate);
              // One attach per open. The list is a picker, not a multi-select:
              // every attach reads a file and changes the meter, and leaving it
              // open would hide both behind the list.
              setOpen(false);
            }}
          >
            <span className={css['ItemLabel']}>{candidate.label}</span>
            {attached && <span className={css['ItemNote']}>attached</span>}
          </button>
        );
      })}
    </React.Fragment>
  );
}
