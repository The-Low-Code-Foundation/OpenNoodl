/**
 * BLD-006 — which conversation you are in, and how to leave it.
 *
 * ## Why it refuses instead of resolving
 *
 * ⚠️ **A switch while work is live is disabled, not reconciled.** The obvious
 * build calls the panel's `retire()` on the way out, which is what a send does
 * — but `retire()` calls `PlanSessionStore.discard()`, and AIB-003's rule is
 * that authored output is durable from the moment it validates and **no
 * navigation may destroy it without the user saying so**. Sending a new request
 * is the user saying so; opening a dropdown to read yesterday's conversation is
 * not, and the cost of getting that wrong is a staged eight-node component
 * evaporating on a click.
 *
 * The alternative — showing an old thread while a live control belongs to
 * another — is worse still: `renderOutcome` matches live ids, so the Accept
 * card would mount under a conversation it has nothing to do with.
 *
 * So the control states its reason and waits. Every path out of "live" is one
 * the user already has: accept it, discard it, or let it finish.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/ThreadSwitcher
 */

import React, { useRef, useState } from 'react';

import { byRecency, threadLabel, threadWhen, type ThreadRecord } from '@noodl-models/AiAssistant/thread';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { MenuDialog, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './ThreadSwitcher.module.scss';

export interface ThreadSwitcherProps {
  threads: readonly ThreadRecord[];
  currentId: string;
  onSelect: (threadId: string) => void;
  onNew: () => void;
  /**
   * Why switching to an existing thread is refused right now.
   *
   * A sentence rather than a boolean: a control that is simply grey reads as
   * broken, and every reason this panel has for holding on to a conversation
   * also names the way out of it.
   */
  lockedReason?: string;
  /**
   * Whether a new conversation may be started.
   *
   * ⚠️ Deliberately **not** the same condition as {@link lockedReason}, and the
   * asymmetry is the whole point of the component. Reading another thread is
   * navigation, which may not destroy authored output; starting a new one is
   * the user declaring they are done with this build, which is the contract
   * `retire()` already has for a send. The one thing both refuse is doing it
   * while something is mid-flight.
   */
  canStartNew: boolean;
}

export function ThreadSwitcher({
  threads,
  currentId,
  onSelect,
  onNew,
  lockedReason,
  canStartNew
}: ThreadSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const current = threads.find((thread) => thread.id === currentId) ?? threads[0];
  const locked = Boolean(lockedReason);
  // Read once per open rather than per row, so every row in one dropdown is
  // measured against the same instant — two rows a millisecond apart must not
  // be able to say "just now" and "1 min ago" about the same moment.
  const now = Date.now();

  return (
    <>
      <div className={css['Switcher']}>
        <button
          type="button"
          ref={triggerRef}
          className={`${css['Current']} ${locked ? css['is-disabled'] : ''}`}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          disabled={locked}
          data-test="thread-switcher"
          onClick={() => setIsOpen((open) => !open)}
        >
          <Icon icon={IconName.Chat} size={IconSize.Tiny} />
          <Text textType={TextType.Shy}>{current ? threadLabel(current) : 'New thread'}</Text>
          <span className={css['Caret']}>
            <Icon icon={IconName.CaretDown} size={IconSize.Tiny} />
          </span>
        </button>
        {/*
          ⚠️ Icon-only, and that is B8's lesson rather than minimalism.
          `IconButton`'s `label` renders as visible text, and a fixed-width
          label beside the title takes its space from the one element in this
          row that shrinks — at 240px the title is what disappears to make room
          for a word the icon already says. Driven with the label in place: the
          row read "New thread ⌄ + New thread", the same words twice.
        */}
        <Tooltip content="Start a new thread" showAfterMs={400}>
          <IconButton
            icon={IconName.Plus}
            size={IconSize.Tiny}
            variant={IconButtonVariant.Transparent}
            isDisabled={!canStartNew}
            testId="thread-new"
            onClick={onNew}
          />
        </Tooltip>
      </div>
      {lockedReason && (
        <div className={css['Reason']}>
          <Text textType={TextType.Shy}>{lockedReason}</Text>
        </div>
      )}
      <MenuDialog
        isVisible={isOpen}
        triggerRef={triggerRef}
        width={MenuDialogWidth.Medium}
        title="Conversations"
        onClose={() => setIsOpen(false)}
        items={byRecency(threads).map((thread) => {
          const isCurrent = thread.id === currentId;
          return {
            key: thread.id,
            label: threadLabel(thread),
            isHighlighted: isCurrent,
            endSlot: (
              // ⚠️ `is-current` is not decoration — see the stylesheet. The
              // highlighted row paints `--theme-color-primary` behind this and
              // `MenuDialog` does not recolour its own end slot, so without it
              // the selected row's timestamp measures 1.16:1.
              <span className={`${css['ItemWhen']} ${isCurrent ? css['is-current'] : ''}`}>
                <Text textType={TextType.Shy}>{threadWhen(thread.updatedAt, now)}</Text>
              </span>
            ),
            onClick: () => onSelect(thread.id)
          };
        })}
      />
    </>
  );
}
