import classNames from 'classnames';
import React, { ReactNode, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonState, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Collapsible } from '@noodl-core-ui/components/layout/Collapsible';
import { SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { UnsafeStyleProps } from '@noodl-core-ui/types/global';

import css from './CollapsableSection.module.scss';

export interface CollapsableSectionProps extends UnsafeStyleProps {
  variant?: SectionVariant;
  title?: string;
  isClosed?: boolean;

  hasGutter?: boolean;
  hasBottomSpacing?: boolean;
  hasVisibleOverflow?: boolean;
  hasTopDivider?: boolean;

  actions?: ReactNode;
  children?: ReactNode;
}

export function CollapsableSection({
  variant = SectionVariant.Default,
  title,
  isClosed,

  hasGutter,
  hasBottomSpacing,
  hasVisibleOverflow,
  hasTopDivider,

  actions,
  children,

  UNSAFE_className,
  UNSAFE_style
}: CollapsableSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(!!isClosed);

  return (
    <section
      className={classNames([
        css['Root'],
        css[`is-variant-${variant}`],
        hasVisibleOverflow && css['has-visible-overflow'],
        hasTopDivider && css['has-top-divider'],
        UNSAFE_className
      ])}
      style={UNSAFE_style}
    >
      {(Boolean(title) || Boolean(actions)) && (
        <div
          onClick={() => setIsCollapsed((prev) => !prev)}
          className={classNames([css['Header'], css[`is-variant-${variant}`], css['is-collapsable']])}
        >
          {/* PNL-005: a plain span for the same reason as `PanelHeader.Title` —
              `Label` is `display: block; white-space: pre`, so a long section
              title could not ellipsise and pushed the caret out of the panel. */}
          <div className={css['Title']} title={title}>
            {title}
          </div>
          {Boolean(actions) && <div>{actions}</div>}
          <IconButton
            icon={IconName.CaretUp}
            variant={IconButtonVariant.Transparent}
            state={isCollapsed ? IconButtonState.Rotated : null}
          />
        </div>
      )}

      <Collapsible isCollapsed={isCollapsed}>
        <div
          className={classNames([
            css['Body'],
            css[`is-variant-${variant}`],
            hasGutter && css['has-gutter'],
            hasBottomSpacing && css['has-bottom-spacing'],
            hasVisibleOverflow && css['has-visible-overflow']
          ])}
        >
          {Boolean(children) && children}
        </div>
      </Collapsible>
    </section>
  );
}
