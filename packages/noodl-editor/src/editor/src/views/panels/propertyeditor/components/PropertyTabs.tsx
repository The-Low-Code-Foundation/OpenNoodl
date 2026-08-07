import classNames from 'classnames';
import React from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

export interface PropertyTabsProps {
  tabs: string[];
  selectedTab: string;
  onTabClicked: (tab: string) => void;
}

/**
 * UIX-011: the tab name used to select a CSS `content: url(...)` background
 * (`.property-tab-icon.borders-all` and friends). Those SVGs carried baked
 * white fills and could not follow the theme, so the name now selects a
 * core-ui `currentColor` glyph instead. The 32x32 box is preserved exactly —
 * a background painted in the element's own box, an Icon is a child with its
 * own, and the old rule sized the element.
 */
const TAB_ICON: Record<string, IconName> = {
  'borders-all': IconName.BorderAll,
  'borders-left': IconName.BorderLeft,
  'borders-right': IconName.BorderRight,
  'borders-bottom': IconName.BorderDown,
  'borders-top': IconName.BorderUp,
  'corners-all': IconName.RoundedCornerAll,
  'corners-top-left': IconName.RoundedCornerLeftUp,
  'corners-top-right': IconName.RoundedCornerRightUp,
  'corners-bottom-left': IconName.RoundedCornerLeftDown,
  'corners-bottom-right': IconName.RoundedCornerRightDown
};

/**
 * The row of icon tabs above a tab group's properties (legacy `tab-group` /
 * `tab-group-tab` templates).
 */
export function PropertyTabs({ tabs, selectedTab, onTabClicked }: PropertyTabsProps) {
  return (
    <div
      className="tabs"
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 4,
        marginRight: 6
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab}
          className={classNames('property-tab', tab === selectedTab && 'selected')}
          data-tab={tab}
          onClick={() => onTabClicked(tab)}
        >
          <div className={classNames('property-tab-icon', tab)}>
            {TAB_ICON[tab] && <Icon icon={TAB_ICON[tab]} UNSAFE_style={{ width: 32, height: 32 }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
