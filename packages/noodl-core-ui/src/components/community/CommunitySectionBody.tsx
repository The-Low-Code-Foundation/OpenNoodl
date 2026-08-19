/**
 * NAT-005 — the four states a community section can be in, drawn once.
 *
 * ## 🔴 The four states are the load-bearing thing on this surface
 *
 * They existed before this task and they existed **twice** — once as inline styles in the
 * launcher's `views/Community.tsx` and once as a `SectionBody` in the editor's `CommunityPanel`.
 * This is that component, in the one place both surfaces can import from.
 *
 * | state | means | why it is not one of the others |
 * |---|---|---|
 * | `loading` | we have asked and not heard | UNI-011 paid for this: an empty list for 300ms tells every user on every open that the community is dead |
 * | `items` | there is something | — |
 * | `empty` | the community is quiet | D21's licence to be empty is **not** a licence to be blank |
 * | `unreachable` | *our* fetch failed | a flaky network must not read like a quiet room, or like a school policy |
 *
 * ⚠️ And they are three different **shapes**, not three greys: `loading` pulses, `unreachable`
 * carries a rule and a retry, `empty` carries neither. A redesign that renders all three as one
 * shy paragraph re-buys UNI-011's bug while passing any test that only asks whether a string
 * appeared.
 *
 * ## ⚠️ `emptyLine` is required, and has no default
 *
 * It says what the section is *for*. A shared default would let a new section inherit a sentence
 * written about a different one, which is how four honest empties collapse into one shrug —
 * D21's surviving obligation and the only thing protecting this surface now that D16's threshold
 * does not.
 *
 * @module noodl-core-ui/components/community/CommunitySectionBody
 */

import React from 'react';

import { CommunityDensity } from './CommunityRow';
import css from './Community.module.scss';

/**
 * One section's state.
 *
 * ⚠️ Declared here rather than beside a renderer because both renderers need it and neither owns
 * it. `views/Community.tsx` re-exports it under its original name, which is what the editor's
 * `mirrorview.ts` has always imported.
 */
export type CommunitySectionState<T> =
  | { state: 'loading' }
  | { state: 'items'; items: T[] }
  | { state: 'empty' }
  | { state: 'unreachable'; detail: string };

export interface CommunitySectionBodyProps<T> {
  state: CommunitySectionState<T>;
  /** 🔴 REQUIRED and per-section. Says what this section is for, never "nothing here". */
  emptyLine: string;
  onRetry: () => void;
  density?: CommunityDensity;
  children: (items: T[]) => React.ReactNode;
}

export function CommunitySectionBody<T>({
  state,
  emptyLine,
  onRetry,
  density = CommunityDensity.Page,
  children
}: CommunitySectionBodyProps<T>) {
  const bodyClass = `${css['Body']} ${css[`is-density-${density}`]}`;

  if (state.state === 'loading') {
    return (
      <div className={bodyClass}>
        <div className={css['Loading']}>
          <span className={css['LoadingPulse']} aria-hidden="true" />
          <p className={css['StateLine']}>Loading…</p>
        </div>
      </div>
    );
  }

  if (state.state === 'unreachable') {
    return (
      <div className={bodyClass}>
        <div className={css['Unreachable']}>
          {/* ⚠️ The detail is OUR fetch error, never platform prose — a stranger cannot reach
              this string, which is why it can be shown verbatim. */}
          <p className={css['StateLine']}>Could not reach the community ({state.detail}).</p>
          <button type="button" className={css['RetryButton']} onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (state.state === 'empty') {
    return (
      <div className={bodyClass}>
        <p className={css['StateLine']}>{emptyLine}</p>
      </div>
    );
  }

  return (
    <div className={`${css['Rows']} ${css[`is-density-${density}`]}`}>{children(state.items)}</div>
  );
}
