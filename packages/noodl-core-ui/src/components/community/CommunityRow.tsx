/**
 * NAT-005 — one community row, on either surface.
 *
 * ## What this replaced, and why it is one component and not two
 *
 * The launcher tab drew `<div style={rowStyle} onClick={...}>{title}</div>` and the rail panel
 * drew a `ListItem`. Both drew **the title and nothing else**, while the view model handed them
 * `createdAt`, `firstReplyMinutes`, `summary`, `kind`, `heldOn` and `description` and threw all
 * six away. Two copies is the arrangement where a fix lands on one of them, and NAT-005's whole
 * premise is that the four Tier-3 surfaces are about to need this same row.
 *
 * ## 🔴 It is a `<button>`, and that is a fix, not a style choice
 *
 * Both previous rows were a `div` with an `onClick`: not focusable, not announced, not operable
 * from a keyboard. A row here is the entry point to a thread, a guide or a replay — the thing
 * this phase exists to make reachable — and an entry point you cannot tab to is one a
 * screen-reader user does not have. A `button` gets focus, Enter and Space for free; nothing here
 * re-implements them.
 *
 * ## ⚠️ Text children only
 *
 * `title`, `meta` and `detail` are `string`, not `ReactNode`, deliberately. This renders in the
 * same `nodeIntegration: true, contextIsolation: false` window as the editor, and a `ReactNode`
 * prop is a hole an element carrying `dangerouslySetInnerHTML` fits through. React escapes text
 * children because they are text; the type is what keeps them text.
 *
 * @module noodl-core-ui/components/community/CommunityRow
 */

import React from 'react';

import css from './Community.module.scss';

export enum CommunityDensity {
  /** The launcher tab: a card on the `bg-0` canvas. */
  Page = 'page',
  /** The editor's rail panel: no card, inheriting `BasePanel`'s `bg-2`. */
  Panel = 'panel'
}

export interface CommunityRowProps {
  /** The thing itself — a thread title, a guide title, a replay title. */
  title: string;
  /** Who/when/how-answered. Build it with `metaLine()`; `null` draws no line at all. */
  meta?: string | null;
  /** The row's own words — a summary, a description. Clamped, never truncated mid-sentence. */
  detail?: string | null;
  onClick?: () => void;
  density?: CommunityDensity;
  /** What a screen reader hears instead of the visible title, when the title alone is thin. */
  ariaLabel?: string;
  /** A drawn poster beside the words — the media lists. See {@link CommunityRowPoster}. */
  poster?: CommunityRowPoster | null;
}

/**
 * 2026-09-06 — a poster beside a row, for the media lists (Replays, video Tutorials).
 *
 * 🔴 DRAWN, NEVER FETCHED. The obvious version of this is the host's thumbnail
 * (`i.ytimg.com/vi/<id>/hqdefault.jpg`), and it is refused for the reason the platform's own
 * replay page refuses it: *"a thumbnail URL looks like an image and behaves like a tracker"*.
 * Opening the Community tab must not ask a video host for anything. So the poster is a gradient
 * with a mark on it, and the mark is what says which kind of thing this is: a play triangle for a
 * recording, a page for a written guide, a dimmed play mark for a call whose recording is not
 * posted yet. A written tutorial and a video one then line up in the same list.
 */
export type CommunityRowPoster = { kind: 'video' | 'guide' | 'pending' };

export function CommunityRow({
  title,
  meta,
  detail,
  onClick,
  density = CommunityDensity.Page,
  ariaLabel,
  poster
}: CommunityRowProps) {
  return (
    <button
      type="button"
      className={`${css['Row']} ${css[`is-density-${density}`]}${poster ? ` ${css['is-media']}` : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {poster ? (
        <span className={`${css['Poster']} ${css[`is-poster-${poster.kind}`]}`} aria-hidden="true">
          {poster.kind === 'guide' ? (
            <svg className={css['PosterMark']} viewBox="0 0 24 24" width="18" height="18">
              <path d="M6 3h9l5 5v13H6z" />
              <path d="M9 12h7M9 16h7" />
            </svg>
          ) : (
            <span className={css['PosterPlay']} />
          )}
        </span>
      ) : null}
      <span className={css['RowWords']}>
        <span className={css['RowTitle']}>{title}</span>
        {meta ? <span className={css['RowMeta']}>{meta}</span> : null}
        {detail ? <span className={css['RowDetail']}>{detail}</span> : null}
      </span>
    </button>
  );
}
