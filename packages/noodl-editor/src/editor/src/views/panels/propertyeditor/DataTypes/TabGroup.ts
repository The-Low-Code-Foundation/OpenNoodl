import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import View from '../../../../../../shared/view';
import { PropertyTabs } from '../components/PropertyTabs';

/** Converted child views expose a raw HTMLElement as `el`; legacy ones a jQuery set. */
function setElementVisible(el: TSFixme, visible: boolean) {
  if (el && el.jquery) {
    visible ? el.show() : el.hide();
  } else if (el) {
    el.style.display = visible ? '' : 'none';
  }
}

function appendChildEl(parent: HTMLElement, el: TSFixme) {
  if (el && el.jquery) {
    parent.appendChild(el[0]);
  } else if (el) {
    parent.appendChild(el);
  }
}

export class TabGroup extends View {
  tabGroup: TSFixme;
  views: TSFixme[];
  tabs: string[];
  el: HTMLElement;
  group: TSFixme;
  parent: TSFixme;

  private tabsHost: HTMLElement | null = null;
  private tabsRoot: Root | null = null;
  private propertiesEl: HTMLElement | null = null;

  constructor(args) {
    super();
    this.group = args.group;
    this.tabGroup = args.tabGroup;
    this.parent = args.parent;
    this.views = [];
    this.tabs = [];
  }

  private get selectedTab() {
    return this.parent._selectedTabForGroup[this.tabGroup] || this.tabs[0];
  }

  render() {
    const div = document.createElement('div');
    div.className = 'property-tab-group';

    if (!this.tabsHost) this.tabsHost = document.createElement('div');
    div.appendChild(this.tabsHost);

    this.propertiesEl = document.createElement('div');
    this.propertiesEl.className = 'properties';
    div.appendChild(this.propertiesEl);

    this.el = div;

    if (!this.tabsRoot) {
      this.tabsRoot = createRoot(this.tabsHost);
    }
    this.renderTabs();

    const selectedTab = this.selectedTab;
    this.views.forEach((v) => {
      v.render();
      appendChildEl(this.propertiesEl, v.el);

      if (v.port.tab.tab !== selectedTab) setElementVisible(v.el, false);
    });

    return this.el;
  }

  private renderTabs() {
    if (!this.tabsRoot) return;

    this.tabsRoot.render(
      React.createElement(PropertyTabs, {
        tabs: this.tabs,
        selectedTab: this.selectedTab,
        onTabClicked: (tab: string) => this.onTabClicked(tab)
      })
    );
  }

  onTabClicked(tab: string) {
    const selectedTab = (this.parent._selectedTabForGroup[this.tabGroup] = tab);
    this.views.forEach((v) => {
      setElementVisible(v.el, v.port.tab.tab === selectedTab);
    });

    this.renderTabs();
  }

  addView(view) {
    this.views.push(view);
    if (this.tabs.indexOf(view.port.tab.tab) === -1) this.tabs.push(view.port.tab.tab);
  }

  dispose() {
    if (this.tabsRoot) {
      this.tabsRoot.unmount();
      this.tabsRoot = null;
    }
  }
}
