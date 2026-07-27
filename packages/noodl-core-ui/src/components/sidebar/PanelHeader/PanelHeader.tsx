import classNames from 'classnames';
import React from 'react';

import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { Slot, UnsafeStyleProps } from '@noodl-core-ui/types/global';

import css from './PanelHeader.module.scss';

export interface PanelHeaderProps extends UnsafeStyleProps {
  title?: string;

  hasNoHeaderDivider?: boolean;

  children?: Slot;

  /**
   * Chrome owned by the side panel rather than by any one panel — PNL-003's
   * wide/hide controls. `BasePanel` fills it from `PanelModeSlotContext`, so a
   * panel never has to know it exists. See PanelHeader.context.tsx.
   */
  modeSlot?: Slot;
}

export function PanelHeader({
  title,
  hasNoHeaderDivider,
  children,
  modeSlot,
  UNSAFE_className,
  UNSAFE_style
}: PanelHeaderProps) {
  return (
    <div
      className={classNames(css['Root'], hasNoHeaderDivider && css._hasNoHeaderDivider, UNSAFE_className)}
      style={UNSAFE_style}
    >
      <div className={css['Title']}>
        <Label size={LabelSize.Big}>{title}</Label>
      </div>
      <div className={css['Children']}>
        {children}
        {Boolean(modeSlot) && <div className={css['ModeGroup']}>{modeSlot}</div>}
      </div>
    </div>
  );
}
