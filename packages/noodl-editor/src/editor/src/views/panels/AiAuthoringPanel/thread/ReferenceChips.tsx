/**
 * BLD-011 — what the composer is carrying, above the composer.
 *
 * The chip row is the whole of the task's visible surface: a reference's kind,
 * its label, what it costs, whether it rides the next turn, and how to remove
 * it. Every later kind (a dropped file, a capture, a search) appears here with
 * no change to this file — it renders `AttachedReference`, which is a closed
 * union over `ReferenceKind`, so a new kind that forgets its glyph is a compile
 * error rather than a blank chip.
 *
 * ## The meter says the thing that is easy to get wrong
 *
 * Rule 6 puts every reference *after* the cache boundary, so **none of this is
 * ever cached**. A meter that reported one undifferentiated total would let a
 * pinned 24k component look like a one-off cost; it is 24k of fresh input on
 * the planning turn and again on every component the plan authors. The second
 * line says so in those words, and only when something is actually pinned.
 *
 * @module AiAuthoringPanel/thread/ReferenceChips
 */

import React from 'react';

import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { FeedbackType } from '@noodl-constants/FeedbackType';

import {
  blockingReferences,
  referenceCost,
  staleAge,
  type AttachedReference,
  type ReferenceKind,
  type TurnReference
} from '../../../../models/AiAssistant/thread/references';

import css from './ReferenceChips.module.scss';

/**
 * One glyph per kind, exhaustive by type.
 *
 * A `Record<ReferenceKind, …>` rather than a lookup with a default: a default
 * would render BLD-013's first dropped file as whatever the fallback is and
 * nobody would notice, which is the shape of half the defects this phase has
 * filed. Adding a kind without a glyph does not compile.
 */
const KIND_ICONS: Record<ReferenceKind, IconName> = {
  component: IconName.Component,
  doc: IconName.File,
  page: IconName.File,
  collection: IconName.FolderClosed,
  file: IconName.FileFill,
  capture: IconName.Image,
  search: IconName.Search
};

/** Characters, in the shortest form that is still exact enough to act on. */
function formatChars(chars: number): string {
  if (chars < 1000) return `${chars}`;
  return `${(chars / 1000).toFixed(chars < 10_000 ? 1 : 0)}k`;
}

export interface ReferenceChipsProps {
  references: readonly AttachedReference[];
  onTogglePin: (id: string) => void;
  onRemove: (id: string) => void;
  /**
   * BLD-014 — the project's apply count, so a capture can go stale. Undefined
   * until something tracks it, which makes staleness a no-op rather than a
   * guess.
   */
  applyCount?: number;
}

export function ReferenceChips({ references, onTogglePin, onRemove, applyCount }: ReferenceChipsProps) {
  if (references.length === 0) return null;

  const cost = referenceCost(references);
  const blocked = blockingReferences(references);

  return (
    <VStack UNSAFE_style={{ gap: 4 }}>
      <div className={css['Row']}>
        {references.map((ref) => {
          const age = staleAge(ref, applyCount);
          const failed = ref.status === 'failed';
          const classes = [css['Chip'], failed ? css['is-failed'] : '', age !== undefined ? css['is-stale'] : '']
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={ref.id}
              className={classes}
              /*
               * The chip is a summary; the title is where the whole of it lives
               * — the full path an ellipsis ate, the resolver's error, the age
               * of a stale capture. Rule 7's "never sent silently" is satisfied
               * by the prompt text stating the age, not by this; this is for the
               * person deciding whether to refresh it.
               */
              title={chipTitle(ref, age)}
            >
              <Icon
                icon={KIND_ICONS[ref.kind]}
                size={IconSize.Tiny}
                variant={failed ? FeedbackType.Danger : age !== undefined ? FeedbackType.Notice : undefined}
              />
              {/* `isSpan` — a `<p>` inside a flex row brings block margins the
                  chip has no room for, and `Text` defaults to one. */}
              <Text textType={TextType.Default} isSpan className={css['Label']}>
                {ref.label}
              </Text>

              {ref.status === 'resolving' && <span className={css['Size']}>reading…</span>}
              {failed && (
                <span className={`${css['Size']} ${css['Blocked']}`}>could not read</span>
              )}
              {ref.status === 'ready' && ref.resolution && (
                <span className={css['Size']}>
                  {formatChars(ref.resolution.chars)}
                  {ref.resolution.truncated && <span className={css['Truncated']}> cut</span>}
                </span>
              )}

              {/*
               * Rule 7's control. Only ever offered on a reference that resolved
               * — pinning something that failed would promise it rides the next
               * turn, and `carryOver` drops it precisely because it does not.
               */}
              {ref.status === 'ready' && (
                <button
                  type="button"
                  className={css['Action']}
                  onClick={() => onTogglePin(ref.id)}
                  aria-pressed={ref.pinned}
                  aria-label={ref.pinned ? `Unpin ${ref.label}` : `Pin ${ref.label}`}
                >
                  <Icon icon={ref.pinned ? IconName.PinFill : IconName.Pin} size={IconSize.Tiny} />
                </button>
              )}
              <button
                type="button"
                className={css['Action']}
                onClick={() => onRemove(ref.id)}
                aria-label={`Remove ${ref.label}`}
              >
                <Icon icon={IconName.Close} size={IconSize.Tiny} />
              </button>
            </div>
          );
        })}
      </div>

      {blocked.length > 0 ? (
        <div className={`${css['Meter']} ${css['Blocked']}`}>
          {blocked.some((r) => r.status === 'failed')
            ? `${blocked.length === 1 ? 'One attachment' : `${blocked.length} attachments`} could not be read. Remove ${blocked.length === 1 ? 'it' : 'them'} to send.`
            : 'Reading attachments…'}
        </div>
      ) : (
        <div className={css['Meter']}>
          <span>
            {cost.count === 1 ? '1 attachment' : `${cost.count} attachments`} · {formatChars(cost.chars)} characters
            {cost.images > 0 ? ` · ${cost.images} image${cost.images === 1 ? '' : 's'}` : ''}
          </span>
          {/*
           * ⚠️ The sentence that stops a pinned reference reading as free. None
           * of this rides the cached prefix (Rule 6), and a plan opens one turn
           * per component — so a pinned attachment is charged again for each.
           */}
          {cost.pinnedChars > 0 && (
            <span>
              {formatChars(cost.pinnedChars)} of it is pinned — sent again, uncached, on every later turn.
            </span>
          )}
        </div>
      )}
    </VStack>
  );
}

/**
 * What a turn carried, read-only, under its request.
 *
 * A separate component from the row above rather than the same one in a
 * "read-only" mode, and the reason is the acceptance criterion: reopening a
 * thread must show what each turn carried, and it must be **impossible** to
 * unpin or remove something a turn already sent. A shared component behind a
 * boolean is one prop away from putting a live control on a historical turn —
 * the exact defect B10 was (`renderOutcome` mounting an Accept on a retired
 * turn), and this phase has paid for that shape once already.
 */
export function TurnReferences({ references }: { references: readonly TurnReference[] }) {
  if (references.length === 0) return null;
  return (
    <div className={`${css['Row']} ${css['is-record']}`} data-test="turn-references">
      {references.map((ref, index) => (
        <div key={`${ref.kind}:${ref.label}:${index}`} className={`${css['Chip']} ${css['is-record']}`}>
          <Icon icon={KIND_ICONS[ref.kind]} size={IconSize.Tiny} />
          <Text textType={TextType.Default} isSpan className={css['Label']}>
            {ref.label}
          </Text>
          <span className={css['Size']}>
            {formatChars(ref.chars)}
            {ref.truncated && <span className={css['Truncated']}> cut</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Everything the chip had to abbreviate, for the person deciding what to do. */
function chipTitle(ref: AttachedReference, age: number | undefined): string {
  const parts = [ref.label];
  if (ref.status === 'failed' && ref.error) parts.push(ref.error);
  if (ref.status === 'ready' && ref.resolution?.truncated) {
    parts.push(
      `Cut to ${ref.resolution.chars} of ${ref.resolution.originalChars} characters — the model is told what it is missing.`
    );
  }
  if (age !== undefined) parts.push(`Taken ${age} change${age === 1 ? '' : 's'} ago — refresh it, or it is sent with its age stated.`);
  if (ref.status === 'ready') parts.push(ref.pinned ? 'Pinned: rides every turn.' : 'Not pinned: rides this turn only.');
  return parts.join('\n');
}
