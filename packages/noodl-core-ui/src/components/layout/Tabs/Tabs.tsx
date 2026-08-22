import { Slot, UnsafeStyleProps } from '@noodl-core-ui/types/global';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { Text } from '../../typography/Text';
import css from './Tabs.module.scss';

export enum TabsVariant {
  Default = 'is-variant-default',
  Text = 'is-variant-text',
  Sidebar = 'is-variant-sidebar',
  /**
   * The pill-in-a-track control used by the refreshed chrome (UIX-013): tabs
   * sit in a bordered track and the active one is a raised card. Buttons size
   * to their label rather than splitting the width, so a `slotEnd` can sit
   * beside them.
   */
  Segmented = 'is-variant-segmented'
}

/** What the strip needs to draw a button. {@link TabsTab} adds the content behind it. */
export interface TabStripTab {
  label: string;
  id?: string;
  testId?: string;
}

export interface TabsTab extends TabStripTab {
  content: Slot;
}

export interface TabsProps extends UnsafeStyleProps {
  tabs: TabsTab[];
  /**
   * Set the initial active tab, updating this value will not change the tab.
   */
  initialActiveTab?: TabsTab['label'];
  /**
   * Set the active tab, updating this value will change the active tab.
   */
  activeTab?: TabsTab['label'];
  variant?: TabsVariant;

  keepTabsAlive?: boolean;

  /** Trailing content on the tab row — actions, hints. */
  slotEnd?: Slot;

  onChange?: (activeTab: string) => void;
}

function getTabId(tab: TabStripTab) {
  return tab.hasOwnProperty('id') ? tab.id : tab.label;
}

export interface TabStripProps {
  tabs: TabStripTab[];
  /** The tab drawn as active. This component holds no state — the caller owns which one it is. */
  activeTabId: string;
  variant?: TabsVariant;
  slotEnd?: Slot;
  onSelect: (tab: TabStripTab) => void;
}

/**
 * The button row on its own, controlled and **hook-free**.
 *
 * ## FB-006 — why this is split out of {@link Tabs}
 *
 * A surface that wants the strip but not the state cannot use `Tabs`: `Tabs` holds the active tab
 * in `useState`, and the launcher's community tab needs the choice to live beside the rest of its
 * host state so the pure half of the view stays a function of its props. 🔴 The concrete cost is a
 * spec: `tests-unit/support/renderElements.ts` evaluates an element tree by *calling* every
 * function component it meets, and **a component that calls a hook throws there**. A community tab
 * that rendered `Tabs` would take NAT-005's whole render spec down with it — twenty assertions
 * about what D15 draws, replaced by an exception.
 *
 * ⚠️ So the alternative was a second segmented control in the launcher, which is the drift shape
 * FB-006 AC3 exists to prevent (`a-second-copy-of-a-palette-drifts`). One strip, one stylesheet,
 * two callers: `Tabs` (stateful) and `views/Community` (controlled).
 *
 * ⚠️ `Tabs` renders this in place of the markup it used to hold inline, so **the DOM it produces
 * is unchanged** — seven editor panels draw from it and none of them should notice this task.
 */
export function TabStrip({ tabs, activeTabId, variant = TabsVariant.Default, slotEnd, onSelect }: TabStripProps) {
  const tabWidth = `calc(${100 / tabs.length}% - 2px)`;
  const isAutoWidth = variant === TabsVariant.Text || variant === TabsVariant.Segmented;

  return (
    <div className={css['ButtonRow']}>
      <nav className={css['Buttons']} role="tablist">
        {tabs.map((tab) => (
          <button
            key={getTabId(tab)}
            role="tab"
            aria-selected={activeTabId === getTabId(tab)}
            className={classNames([css['Button'], activeTabId === getTabId(tab) && css['is-active']])}
            onClick={() => onSelect(tab)}
            style={{ width: isAutoWidth ? null : tabWidth }}
            data-test={tab.testId}
          >
            <Text>{tab.label}</Text>
          </button>
        ))}
      </nav>

      {Boolean(slotEnd) && <div className={css['SlotEnd']}>{slotEnd}</div>}
    </div>
  );
}

export function Tabs({
  tabs,
  initialActiveTab,
  activeTab,
  variant = TabsVariant.Default,
  keepTabsAlive = false,
  slotEnd,

  onChange,

  UNSAFE_className,
  UNSAFE_style
}: TabsProps) {
  const [activeTabId, setActiveTabId] = useState(() => initialActiveTab || getTabId(tabs[0]));

  useEffect(() => {
    if (!activeTab) return;

    setActiveTabId(activeTab);
  }, [activeTab]);

  function changeTab(tab: TabStripTab) {
    const tabId = getTabId(tab);
    setActiveTabId(tabId);
    onChange && onChange(tabId);
  }

  return (
    <div className={classNames(css['Root'], css[variant], UNSAFE_className)} style={UNSAFE_style}>
      <TabStrip tabs={tabs} activeTabId={activeTabId} variant={variant} slotEnd={slotEnd} onSelect={changeTab} />

      <div className={css['TabContent']}>
        {Boolean(keepTabsAlive)
          ? tabs.map((tab) => {
              const tabId = getTabId(tab);
              return (
                <div
                  key={tabId}
                  className={css['KeepAliveTab']}
                  style={{ display: tabId === activeTabId ? 'block' : 'none' }}
                >
                  {tab.content}
                </div>
              );
            })
          : tabs.find((tab) => getTabId(tab) === activeTabId).content}
      </div>
    </div>
  );
}
