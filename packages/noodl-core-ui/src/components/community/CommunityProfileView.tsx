/**
 * NAT-008 — a profile, as a thing you read in the editor.
 *
 * ## 🔴 The states are the thread view's, minus one and plus nothing
 *
 * `hidden / loading / gone / unreachable / ready` — the same five `CommunityThreadView` has, for
 * the same reasons, and the argument for their **order** lives with the host (`peopleview.ts`)
 * rather than here. The one worth restating: **`gone` is drawn for all four things a 404 can
 * mean** — a private profile, a hidden profile, a handle that never existed, and D15 refusing
 * this viewer — because the platform answers the same bytes for all four *on purpose*, and a
 * client that separated them would be publishing the difference the platform declined to.
 *
 * ⚠️ There is no `empty`. A profile with nothing on it is still a profile; the *sections* inside
 * it have their own empty lines, and each says what that section is for rather than "nothing
 * here". That is `CommunitySectionBody`'s rule applied one level down.
 *
 * ## 🔴 Badges are painted through a `mask`
 *
 * See `badgeMarks.ts`. Every string on this screen is the host's, already formatted — this file
 * reads no payload and decides no words, exactly like `CommunityThreadView`.
 *
 * @module noodl-core-ui/components/community/CommunityProfileView
 */

import React from 'react';

import { CommunityDensity } from './CommunityRow';
import type { CommunityChip } from './CommunityPersonRow';
import css from './Community.module.scss';

/**
 * One badge, ready to draw.
 *
 * 🔴 `mark` is `null` when this editor holds no drawing for the badge, and that is a state the
 * component renders rather than a defect — the title and the tier still appear. See
 * `badgeMarks.badgeMark`: a badge added on the platform tomorrow arrives here without a picture,
 * never with somebody else's.
 */
export type CommunityBadgeView = {
  title: string;
  /** `learning · bronze · earned 4 months ago`, already formatted. */
  meta: string;
  /** A `url(...)` value for `mask-image`, or `null`. */
  mark: string | null;
};

/**
 * A link somebody put on their profile.
 *
 * 🔴 **`url` is user content and this component never navigates to it.** `onOpenLink` is the
 * host's decided hand-off — the same seam `CommunityPostBody` uses for a link inside a post, and
 * the one NAT-012 audits. The scheme allow-list is a database constraint on the platform, so
 * what arrives is http or https; that is a reason the string is safe to *show*, not a reason for
 * this file to open it.
 */
export type CommunityProfileLink = { label: string; url: string };

export type CommunityProfileDetailView = {
  /** Their display name, or `@handle`. */
  title: string;
  /** `@handle`, always drawn, because the title may be a name two people share. */
  handle: string;
  initial: string;
  /** `Coach · Available for work`, or `null` when they claim neither. */
  eyebrow: string | null;
  bio: string | null;
  /** `40 points · 2 of 12 badges` — the profile page's own sentence, with its denominator. */
  stat: string;
  chips: CommunityChip[];
  badges: CommunityBadgeView[];
  /** 🔴 Required, per `CommunitySectionBody`'s rule. Says what badges *are*, not "none". */
  badgesEmptyLine: string;
  links: CommunityProfileLink[];
  /**
   * What listing would require, when this profile does not meet D8's bar.
   *
   * ⚠️ Drawn from `bar`, which the platform sends **because a public-but-unlisted profile can
   * say what listing would need** — dropping it would make the editor's profile a quieter thing
   * than the web's. `null` when the bar is met, because then it is not news.
   */
  barLine: string | null;
  /**
   * How to reach them, if there is a way.
   *
   * 🔴 AC6 — *"nothing labelled 'message' that opens Chrome."* The host supplies both the label
   * and the action, so the verb and what it does are decided in one place. `null` draws nothing,
   * which is the honest answer when the platform offers no contact route.
   */
  contact: { label: string; line: string | null; onAction: () => void } | null;
};

export type CommunityProfileState =
  /** 🔴 D15 refused this viewer. Draw NOTHING. */
  | { state: 'hidden' }
  | { state: 'loading' }
  /** 404 — and see the module note for the four different things that means. */
  | { state: 'gone' }
  | { state: 'unreachable'; detail: string }
  | { state: 'ready'; profile: CommunityProfileDetailView; cachedSince: string | null };

export interface CommunityProfileViewProps {
  state: CommunityProfileState;
  density?: CommunityDensity;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink?: (href: string) => void;
}

function Badge({ badge }: { badge: CommunityBadgeView }) {
  return (
    <li className={css['Badge']}>
      {/* 🔴 A MASK, NOT AN `<img>` — and `aria-hidden`, because the badge's title is right
          beside it in text. See `badgeMarks.ts` for why an `<img>` here renders twelve
          invisible marks in one theme and twelve black ones in the other. */}
      {badge.mark ? (
        <span
          className={css['BadgeArt']}
          aria-hidden="true"
          style={{ WebkitMaskImage: badge.mark, maskImage: badge.mark }}
        />
      ) : null}
      <span className={css['BadgeText']}>
        <span className={css['BadgeTitle']}>{badge.title}</span>
        <span className={css['BadgeMeta']}>{badge.meta}</span>
      </span>
    </li>
  );
}

export function CommunityProfileView({
  state,
  density = CommunityDensity.Page,
  onBack,
  onRetry,
  onOpenLink
}: CommunityProfileViewProps) {
  // 🔴 D15 first, and before anything else is read. Nothing drawn — not a frame, not a back
  // button, not a message. The same rule and the same position as `CommunityThreadView`.
  if (state.state === 'hidden') return null;

  const back = (
    <button type="button" className={css['ThreadBack']} onClick={onBack}>
      ← Back
    </button>
  );

  if (state.state === 'loading') {
    return (
      <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
        {back}
        <div className={css['Loading']}>
          <span className={css['LoadingPulse']} aria-hidden="true" />
          <p className={css['StateLine']}>Loading…</p>
        </div>
      </div>
    );
  }

  if (state.state === 'gone') {
    return (
      <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
        {back}
        {/* ⚠️ Four facts, one sentence, and that is the point — see the module note. It says what
            is true of all four ("there is no public profile here") and offers nothing to retry,
            because none of the four is fixed by asking again. */}
        <p className={css['StateLine']}>There is no public profile here.</p>
      </div>
    );
  }

  if (state.state === 'unreachable') {
    return (
      <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
        {back}
        <div className={css['Unreachable']}>
          <p className={css['StateLine']}>Could not reach the community ({state.detail}).</p>
          <button type="button" className={css['RetryButton']} onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { profile } = state;

  return (
    <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
      {back}

      <header className={css['ProfileHead']}>
        <span className={css['ProfileAvatar']} aria-hidden="true">
          {profile.initial}
        </span>
        <span className={css['ProfileHeadText']}>
          {profile.eyebrow ? <span className={css['ProfileEyebrow']}>{profile.eyebrow}</span> : null}
          <h2 className={css['ThreadTitle']}>{profile.title}</h2>
          <span className={css['ThreadMeta']}>{profile.handle}</span>
          <span className={css['ProfileStat']}>{profile.stat}</span>
        </span>
      </header>

      {state.cachedSince ? (
        <p className={css['ThreadCached']}>Showing a copy from {state.cachedSince}.</p>
      ) : null}

      {profile.bio ? <p className={css['ProfileBio']}>{profile.bio}</p> : null}

      {profile.chips.length > 0 ? (
        <div className={css['ChipRow']}>
          {profile.chips.map((chip) => (
            <span key={`${chip.tone}:${chip.label}`} className={`${css['Chip']} ${css[`is-tone-${chip.tone}`]}`}>
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      {profile.contact ? (
        <div className={css['ThreadReply']}>
          {/* 🔴 AC6 — the line says what the verb will do, and the host wrote both. */}
          {profile.contact.line ? <p className={css['StateLine']}>{profile.contact.line}</p> : null}
          <button type="button" className={css['RetryButton']} onClick={profile.contact.onAction}>
            {profile.contact.label}
          </button>
        </div>
      ) : null}

      <h3 className={css['ThreadAnswersHead']}>Badges</h3>
      {profile.badges.length === 0 ? (
        <p className={css['StateLine']}>{profile.badgesEmptyLine}</p>
      ) : (
        <ul className={css['BadgeList']}>
          {profile.badges.map((badge) => (
            <Badge key={badge.title} badge={badge} />
          ))}
        </ul>
      )}

      {profile.links.length > 0 ? (
        <>
          <h3 className={css['ThreadAnswersHead']}>Elsewhere</h3>
          <ul className={css['ProfileLinks']}>
            {profile.links.map((link) => (
              <li key={link.url}>
                {/* ⚠️ A `button`, not an `<a href>`. An anchor in this window navigates the
                    editor itself; the hand-off is the host's and it is the call site NAT-012
                    audits. */}
                <button type="button" className={css['PostLink']} onClick={() => onOpenLink?.(link.url)}>
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {profile.barLine ? <p className={css['ProfileBar']}>{profile.barLine}</p> : null}
    </div>
  );
}
