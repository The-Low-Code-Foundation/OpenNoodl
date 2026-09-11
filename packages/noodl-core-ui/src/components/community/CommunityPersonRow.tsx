/**
 * NAT-008 — one person, as a row.
 *
 * ## Why this is not just a `CommunityRow`
 *
 * A thread row is a title, a meta line and a summary. A person row is those three **plus two
 * things a thread has not got**: a face, and a set of chips. The web's review said the second
 * one out loud — *"the profile page has a gradient avatar and the LIST of people has none, the
 * one component whose whole job is to make people feel present"* — and the chips are how
 * *available for work*, *offers coaching*, a day rate and a set of skills reach a reader who is
 * scanning for somebody to ask.
 *
 * ⚠️ So this composes the same `.Row` styles rather than re-implementing them. The hover
 * grounds, the focus ring, the clamped detail line and the `button` element are all
 * `CommunityRow`'s decisions and none of them is restated here.
 *
 * ## 🔴 The avatar is a flat disc with a letter in it, and the web's is a gradient
 *
 * That is a deliberate divergence and it is worth one sentence. NAT-001 grades named `fg × bg`
 * pairings and **refuses to score a wash with no opaque surface named** — a gradient is a colour
 * that changes across the shape it fills, so the letter's contrast is a different number at the
 * top of the disc and at the bottom. A flat ground is one number, it has a row in the PAIRS
 * table, and it is the same letter. D15's *"a mirror may not disagree with the web"* is a rule
 * about **who and what is visible**; it is not a rule about ornament, and the editor has its own
 * contrast floor to answer to.
 *
 * ## ⚠️ Text children only, same as `CommunityRow`
 *
 * `title`, `meta`, `detail`, `initial` and every chip label are `string`. Handles, display names,
 * bios and skills are all **user content** — a `ReactNode` prop here would be a hole an element
 * carrying markup fits through, in a `nodeIntegration: true` window.
 *
 * @module noodl-core-ui/components/community/CommunityPersonRow
 */

import React from 'react';

import { CommunityDensity } from './CommunityRow';
import css from './Community.module.scss';

/**
 * A chip's tone.
 *
 * ⚠️ Three, and each has a row in NAT-001's PAIRS table on the chip's own ground. `good` and
 * `accent` are the two the web page gives its people rows (*available for work* and *offers
 * coaching* / skills); `neutral` is the day rate, which the web deliberately draws without a
 * tone because a rate is a fact rather than a recommendation.
 */
export type CommunityChipTone = 'neutral' | 'good' | 'accent';

export type CommunityChip = { label: string; tone: CommunityChipTone };

export type CommunityPersonRowView = {
  /** The id this surface navigates by. Never drawn on its own — see `title`. */
  handle: string;
  /** Their display name, or `@handle` when they have not set one. The host decides. */
  title: string;
  /** `@handle · 40 points · 2 of 12 badges · active 3 days ago`, already formatted. */
  meta: string | null;
  /** Their blurb. Clamped by `.RowDetail`, never cut mid-sentence by the host. */
  detail: string | null;
  /** One character. The host upper-cases it; this draws what it is given. */
  initial: string;
  chips: CommunityChip[];
};

export interface CommunityPersonRowProps {
  person: CommunityPersonRowView;
  onClick?: () => void;
  density?: CommunityDensity;
}

export function CommunityPersonRow({
  person,
  onClick,
  density = CommunityDensity.Page
}: CommunityPersonRowProps) {
  return (
    <button
      type="button"
      className={`${css['Row']} ${css['PersonRow']} ${css[`is-density-${density}`]}`}
      onClick={onClick}
      /* ⚠️ The row's accessible name is the person, not the person plus every chip. A screen
         reader reading "Ada Lovelace, available for work, offers coaching, £400–600, TypeScript,
         GraphQL" before the next row is a list nobody can scan by ear. The chips are still in the
         reading order, inside the row, where somebody exploring one row will meet them. */
      aria-label={`${person.title}, ${person.handle}`}
    >
      {/* ⚠️ `aria-hidden`: the letter is a decoration derived from the name that is already on
          screen. Announcing "A" before "Ada Lovelace" is noise. */}
      <span className={css['PersonAvatar']} aria-hidden="true">
        {person.initial}
      </span>

      <span className={css['PersonBody']}>
        <span className={css['RowTitle']}>{person.title}</span>
        {person.meta ? <span className={css['RowMeta']}>{person.meta}</span> : null}
        {person.detail ? <span className={css['RowDetail']}>{person.detail}</span> : null}
        {person.chips.length > 0 ? (
          <span className={css['ChipRow']}>
            {person.chips.map((chip) => (
              <span key={`${chip.tone}:${chip.label}`} className={`${css['Chip']} ${css[`is-tone-${chip.tone}`]}`}>
                {chip.label}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  );
}
