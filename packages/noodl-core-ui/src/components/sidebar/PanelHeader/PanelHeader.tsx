import classNames from 'classnames';
import React from 'react';

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
      data-test="panel-header"
      /* PNL-005 / F28: every mounted panel renders its own copy of the mode
         buttons (SidePanel keeps inactive panels mounted behind `display:none`),
         so `side-panel-wide-toggle` and friends are not unique in the document.
         Scoping them by the owning panel is the cheap half of the fix that lives
         in this file — `[data-panel-title="Components"] [data-test=…]`. The other
         half is in SidePanel.tsx; see PNL-005-NOTES.md. */
      data-panel-title={title}
    >
      {/* A plain span, not `<Label size={Big}>`: `Label` is `display: block` with
          `white-space: pre`, which means an ellipsis on the wrapper can never
          engage. The title's type now lives in exactly one place — the `.Title`
          rule in PanelHeader.module.scss. The native `title` attribute (rather
          than core-ui's `Tooltip`) is deliberate: `Tooltip` wraps its child in a
          trigger div with no `min-width: 0`, which is precisely what cost PNL-007
          its ellipsis (F26). */}
      <div className={css['Title']} title={title}>
        {title}
      </div>
      <div className={css['Children']}>
        {children}
        {Boolean(modeSlot) && <div className={css['ModeGroup']}>{modeSlot}</div>}
      </div>
    </div>
  );
}
