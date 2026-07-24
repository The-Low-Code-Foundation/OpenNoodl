import classNames from 'classnames';
import React from 'react';

export interface PropertyTabsProps {
  tabs: string[];
  selectedTab: string;
  onTabClicked: (tab: string) => void;
}

/**
 * The row of icon tabs above a tab group's properties (legacy `tab-group` /
 * `tab-group-tab` templates). The tab name doubles as the icon class — see
 * `.property-tab-icon.borders-all` and friends in propertyeditor.css.
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
          <div className={classNames('property-tab-icon', tab)} />
        </div>
      ))}
    </div>
  );
}
