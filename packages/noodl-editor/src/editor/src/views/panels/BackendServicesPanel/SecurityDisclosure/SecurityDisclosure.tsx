/**
 * What choosing this backend means for the app the user is about to publish.
 *
 * ## Why it looks like this
 *
 * It is one line, closed, with the rest a click away. Three reasons, and all
 * three are from the task's own traps:
 *
 * - **It is not a warning.** BCN-009: *"The disclosure will be tempting to write
 *   as a warning. A red banner on every backend teaches nothing and gets
 *   dismissed."* So there is no red anywhere in this component — red in this
 *   product means danger, a destructive action or a failure, and "your Supabase
 *   anon key is public, which is how Supabase works" is a fact about a backend,
 *   not a failure. The tint is the azure primary at 13%, which is the token this
 *   design system already uses to mean *pay attention to this, it is
 *   informational*.
 * - **It is always present.** Every backend gets one, including the two that
 *   publish nothing a visitor can use. A disclosure that only appears when
 *   something is wrong teaches the user to read its absence as safety, and the
 *   absence is not the same claim.
 * - **It is one sentence until asked.** A card holds several of these and a wall
 *   of prose on each is a wall nobody reads.
 *
 * Open question 6 in the phase's register asks whether OPS-001's maturity levels
 * should gate this — BCN-009 shows it always, OPS-001's Playing level shows
 * nothing. It is shown always here, as specced, and the alternative is recorded
 * for Richard rather than decided in a component.
 *
 * @module BackendServicesPanel/SecurityDisclosure
 */

import React, { useCallback, useState } from 'react';

import { BackendSecurityDisclosure } from '@noodl-models/BackendServices';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './SecurityDisclosure.module.scss';

export interface SecurityDisclosureProps {
  disclosure: BackendSecurityDisclosure;
  /** For the test hook, so a live pass can name the card it is looking at. */
  testId?: string;
}

export function SecurityDisclosure({ disclosure, testId }: SecurityDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  return (
    <div className={css.Root} data-test={testId}>
      <button type="button" className={css.Summary} onClick={toggle} aria-expanded={isOpen}>
        <span className={css.SummaryIcon}>
          <Icon icon={IconName.QuestionFree} size={IconSize.Tiny} />
        </span>
        <Text className={css.Headline} textType={TextType.Default} isSpan>
          {disclosure.headline}
        </Text>
        <span className={css.SummaryCaret}>
          <Icon icon={isOpen ? IconName.CaretUp : IconName.CaretDown} size={IconSize.Tiny} />
        </span>
      </button>

      {isOpen && (
        <div className={css.Body}>
          <Text className={css.Paragraph} textType={TextType.Shy}>
            {disclosure.visitorsCanSee}
          </Text>
          <Text className={css.Paragraph} textType={TextType.Shy}>
            {disclosure.rulesAreSet}
          </Text>
          {disclosure.learnMore && (
            <a className={css.Link} href={disclosure.learnMore.url} target="_blank" rel="noreferrer">
              <Text textType={TextType.Default} isSpan>
                {disclosure.learnMore.label}
              </Text>
              <Icon icon={IconName.ExternalLink} size={IconSize.Tiny} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
