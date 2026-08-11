/**
 * LEG-003 §2 — the author's words, above the generated ones.
 *
 * A component's description and a node's comment are the only text in a project
 * a person typed on purpose. This block renders them verbatim, at the top of the
 * explanation, before a model has said anything — so the one non-generated
 * sentence in the graph reaches the reader whether or not a provider is
 * configured, and whether or not the answer happens to mention it.
 *
 * **Three cues, only one of which is colour**, because a distinction carried by
 * colour alone is not one:
 *
 *  1. a 2px left rule in `fg-default-shy` — 5.98:1 dark / 5.34:1 light against
 *     the panel it sits on, so the shape is visible, not merely present;
 *  2. a pencil icon and the words "Written by the author", which say what the
 *     block is in text a screen reader also gets;
 *  3. a raised card and a brighter foreground than the generated prose beside it
 *     (`fg-default-contrast` 11.20:1 dark / 11.13:1 light on the card, against
 *     `fg-default` 7.70:1 / 7.10:1 for the model's text).
 *
 * ⚠️ `white-space: pre-wrap` is load-bearing: an author's line breaks are part
 * of what they wrote. Nothing here reflows, trims or shortens the text.
 *
 * @module noodl-editor/views/panels/ExplainPanel/components/AuthoredNotes
 */

import React, { useCallback } from 'react';

import type { AuthoredNote } from '@noodl-models/AiAssistant/explain/authoredNotes';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { clearCitedHighlight, highlightCitedNode, revealCitedNode } from '../canvasLink';
import css from './AuthoredNotes.module.scss';

export interface AuthoredNotesProps {
  notes: AuthoredNote[];
  /** Notes on this component that are not shown — component scope only. */
  omitted?: number;
  /** Component the notes belong to; needed to reveal a cited node on canvas. */
  componentName: string;
}

function attributionFor(note: AuthoredNote): string {
  return note.kind === 'component-description' ? 'What this component is for —' : 'Note on';
}

export function AuthoredNotes({ notes, omitted = 0, componentName }: AuthoredNotesProps) {
  const reveal = useCallback(
    (nodeId: string) => () => revealCitedNode(componentName, nodeId),
    [componentName]
  );

  if (notes.length === 0) return null;

  return (
    <section className={css['Root']} aria-label="Written by the author">
      <header className={css['Header']}>
        <Icon icon={IconName.NotePencil} size={IconSize.Small} />
        <Text textType={TextType.Shy} isSpan>
          Written by the author — shown exactly as typed, not generated
        </Text>
      </header>

      {notes.map((note) => {
        // Bound once: narrowing `note.nodeId` does not survive into the handlers.
        const nodeId = note.nodeId;
        return (
          <article className={css['Note']} key={`${note.kind}:${nodeId ?? note.subject}`}>
            <Text textType={TextType.Shy} isSpan className={css['Attribution']}>
              {attributionFor(note)}{' '}
              {nodeId ? (
                <button
                  type="button"
                  className={`${css['Subject']} ${css['Clickable']}`}
                  onClick={reveal(nodeId)}
                  onMouseEnter={() => highlightCitedNode(nodeId)}
                  onMouseLeave={clearCitedHighlight}
                >
                  {note.subject}
                </button>
              ) : (
                <span className={css['Subject']}>{note.subject}</span>
              )}
            </Text>
            <p className={css['Body']}>{note.text}</p>
          </article>
        );
      })}

      {omitted > 0 && (
        <Text textType={TextType.Shy} isSpan className={css['Omitted']}>
          {omitted} further note{omitted === 1 ? '' : 's'} on nodes in this component — select a node to
          read it.
        </Text>
      )}
    </section>
  );
}
