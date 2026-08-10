/**
 * BLD-016 — the `@` menu.
 *
 * ## It shares `ReferencePicker`'s stylesheet on purpose
 *
 * These are two doors onto one list — the button that says "Add context" and
 * the `@` you type — and they must not drift into two lists that look different
 * and contain different things. So the sources are one function
 * (`referenceCandidates`), the group order is one constant (`CANDIDATE_GROUPS`)
 * and the paint is one stylesheet. What differs is only what a keyboard-driven
 * menu needs and a button-driven one does not: a highlighted row, and arrow keys
 * that move it.
 *
 * ⚠️ **This is a controlled menu with no state of its own beyond the highlight.**
 * The query, the open/closed decision and the insertion all belong to the
 * composer, because they are all functions of the composer's text and caret —
 * `mentionQuery` decides whether the caret is inside a mention, and a menu that
 * kept its own idea of that would be a second answer to a question the text has
 * already answered.
 *
 * ⚠️ The list needs a **positioned ancestor** — the same requirement
 * `ReferencePicker` documents at both ends, and the same ancestor
 * (`.ComposerControls`). It is absolutely positioned, so it is out of flow and
 * adds nothing to the control row's height: the row is 30px open or shut.
 *
 * @module AiAuthoringPanel/thread/MentionMenu
 */

import React, { useEffect, useMemo, useRef } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import {
  CANDIDATE_GROUPS,
  type ReferenceCandidate
} from '../../../../models/AiAssistant/authoring/referenceSources';
import { filterMentionCandidates, MENTION_GROUP_LIMIT } from '../../../../models/AiAssistant/thread/mentions';
import type { ReferenceKind } from '../../../../models/AiAssistant/thread/references';

import css from './ReferencePicker.module.scss';

/** The same glyphs the chips use, so a row and the chip it becomes match. */
const KIND_ICONS: Record<ReferenceKind, IconName> = {
  component: IconName.Component,
  doc: IconName.File,
  page: IconName.File,
  collection: IconName.FolderClosed,
  file: IconName.FileFill,
  capture: IconName.Image,
  search: IconName.Search
};

export interface MentionMenuProps {
  /** What the caret has typed after the `@`. `''` the instant it is pressed. */
  query: string;
  candidates: readonly ReferenceCandidate[];
  /** Index into {@link MentionMenuProps.candidates} once filtered and flattened. */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onPick: (candidate: ReferenceCandidate) => void;
}

/**
 * The rows the menu will show, in group order — exported because the composer
 * needs the same flattened list to move the highlight and to know what Enter
 * picks. **One derivation, used by the keyboard and the paint alike**; two would
 * be a menu whose highlighted row is not the row Enter selects, which is the
 * kind of defect that only shows up under a keyboard and never under a mouse.
 */
export function mentionRows(candidates: readonly ReferenceCandidate[], query: string): ReferenceCandidate[] {
  const matched = filterMentionCandidates(candidates, query);
  const rows: ReferenceCandidate[] = [];
  for (const group of CANDIDATE_GROUPS) {
    rows.push(...matched.filter((candidate) => candidate.kind === group.kind).slice(0, MENTION_GROUP_LIMIT));
  }
  return rows;
}

export function MentionMenu({ query, candidates, activeIndex, onActiveIndexChange, onPick }: MentionMenuProps) {
  const rows = useMemo(() => mentionRows(candidates, query), [candidates, query]);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Keep the highlight on screen. `block: 'nearest'` rather than `'center'`:
  // the list is 260px and centring every step makes the whole thing lurch under
  // a held arrow key.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (rows.length === 0) {
    return (
      <div className={css['List']} data-test="mention-menu">
        <div className={css['Empty']}>
          <Text textType={TextType.Default}>
            {query ? `Nothing here is called “${query}”.` : 'Nothing in this project can be mentioned yet.'}
          </Text>
        </div>
      </div>
    );
  }

  let index = -1;
  return (
    <div className={css['List']} role="listbox" data-test="mention-menu">
      {CANDIDATE_GROUPS.map((group) => {
        const items = rows.filter((row) => row.kind === group.kind);
        if (items.length === 0) return null;
        return (
          <React.Fragment key={group.kind}>
            <div className={css['Group']}>{group.title}</div>
            {items.map((candidate) => {
              index += 1;
              const at = index;
              const active = at === activeIndex;
              return (
                <button
                  key={`${candidate.kind}:${candidate.target}`}
                  ref={active ? activeRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-target={candidate.target}
                  className={`${css['Item']} ${active ? css['is-active'] : ''}`}
                  /*
                   * ⚠️ `onMouseDown` with the default prevented, not `onClick`.
                   * Clicking a row would otherwise blur the text area first, and
                   * the composer closes the menu when the caret leaves the
                   * mention — so the click would land on a menu that had already
                   * decided it was shut. Keeping focus in the text area is also
                   * what lets the caret land after the inserted token.
                   */
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onPick(candidate);
                  }}
                  onMouseEnter={() => onActiveIndexChange(at)}
                >
                  <Icon icon={KIND_ICONS[candidate.kind]} size={IconSize.Tiny} />
                  <span className={css['ItemLabel']}>{candidate.label}</span>
                  {/* The deciding fact for this row — node count, column count,
                      the router that lists a page, and the one that saves money:
                      a doc that is already sent on every turn. */}
                  {candidate.note && <span className={css['ItemNote']}>{candidate.note}</span>}
                </button>
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}
