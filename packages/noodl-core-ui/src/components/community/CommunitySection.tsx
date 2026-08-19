/**
 * NAT-005 — a community section with its own heading and card, for the launcher's page density.
 *
 * ⚠️ **The rail panel does NOT use this.** It already has chrome — `BasePanel` plus
 * `sidebar/Section` — and wrapping a card in a panel section would be two frames saying the same
 * thing. What the rail shares is everything inside: {@link CommunitySectionBody} and
 * {@link CommunityRow}. This component is the *page* half of the vocabulary, and it exists so the
 * four Tier-3 surfaces do not each invent a heading, a count and a card.
 *
 * ## The count in the heading
 *
 * `n` is drawn beside the title only when the section has items. It is the same honesty D21 kept
 * from D16 — *"a threshold nobody can see the approach to is a threshold that gets crossed by
 * rounding"* — applied to a list: a reader scanning three sections wants to know which one has
 * anything in it before reading any of them. ⚠️ It is **not** drawn as "3 of 20": that would put
 * back the progress bar towards a threshold D21 removed.
 *
 * @module noodl-core-ui/components/community/CommunitySection
 */

import React from 'react';

import { CommunityDensity } from './CommunityRow';
import { CommunitySectionBody, CommunitySectionState } from './CommunitySectionBody';
import css from './Community.module.scss';

export interface CommunitySectionProps<T> {
  title: string;
  state: CommunitySectionState<T>;
  /** 🔴 REQUIRED and per-section — see {@link CommunitySectionBody}. */
  emptyLine: string;
  onRetry: () => void;
  children: (items: T[]) => React.ReactNode;
}

export function CommunitySection<T>({ title, state, emptyLine, onRetry, children }: CommunitySectionProps<T>) {
  const count = state.state === 'items' ? state.items.length : null;

  return (
    <section className={css['Section']}>
      <div className={css['SectionCard']}>
        <div className={css['SectionHead']}>
          <h3 className={css['SectionTitle']}>{title}</h3>
          {count !== null && (
            <span className={css['SectionCount']}>
              {count} {count === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
        <CommunitySectionBody
          state={state}
          emptyLine={emptyLine}
          onRetry={onRetry}
          density={CommunityDensity.Page}
        >
          {children}
        </CommunitySectionBody>
      </div>
    </section>
  );
}
