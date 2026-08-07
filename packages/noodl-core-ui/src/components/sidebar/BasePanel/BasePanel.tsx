import classNames from 'classnames';
import React from 'react';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { PanelHeader, PanelHeaderProps, usePanelModeSlot } from '@noodl-core-ui/components/sidebar/PanelHeader';
import { Slot } from '@noodl-core-ui/types/global';

import css from './BasePanel.module.scss';

export interface BasePanelProps extends PanelHeaderProps {
  hasActivityBlocker?: boolean;
  hasContentScroll?: boolean;
  hasNoHeaderDivider?: boolean;

  /** Set the content size to be 100% height. */
  isFill?: boolean;
  headerSlot?: Slot;
  footerSlot?: Slot;

  /**
   * PNL-005: optional. A panel that is still loading has no content yet, and it
   * must not have to choose between `{null}` boilerplate and rendering no chrome
   * at all — the second is what `VersionControlPanel` was doing.
   */
  children?: Slot;

  /** TODO: Only used for testing Copilot */
  UNSAFE_content_style?: React.CSSProperties;
}

export function BasePanel({
  title,
  hasActivityBlocker,
  hasContentScroll,
  hasNoHeaderDivider,

  isFill,
  headerSlot,
  footerSlot,
  children,

  UNSAFE_className,
  UNSAFE_style,
  UNSAFE_content_style
}: BasePanelProps) {
  const modeSlot = usePanelModeSlot();
  const hasHeader = Boolean(title);

  return (
    <div
      className={classNames(css['Root'], hasHeader && css['has-panel-header'], UNSAFE_className)}
      style={UNSAFE_style}
    >
      {hasHeader && (
        <PanelHeader hasNoHeaderDivider={hasNoHeaderDivider} title={title} modeSlot={modeSlot}>
          {headerSlot}
        </PanelHeader>
      )}

      <div className={css['Inner']}>
        <div
          className={classNames(
            css['ChildrenContainer'],
            hasContentScroll && css['has-content-scroll'],
            isFill && css['is-fill']
          )}
          style={UNSAFE_content_style}
        >
          {children}
        </div>
        {footerSlot && <div className={css['Footer']}>{footerSlot}</div>}
      </div>

      {hasActivityBlocker && <ActivityIndicator isOverlay />}
    </div>
  );
}
