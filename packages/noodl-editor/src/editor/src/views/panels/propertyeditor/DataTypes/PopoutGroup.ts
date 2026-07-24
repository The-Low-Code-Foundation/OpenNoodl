import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { PropertyPanelButton } from '@noodl-core-ui/components/property-panel/PropertyPanelButton';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';

import View from '../../../../../../shared/view';
import { Ports } from './Ports';

/**
 * A group of ports that live behind an "Edit" button and are rendered into a
 * popout as their own `Ports` view.
 */
export class PopoutGroup extends View {
  popoutGroup: TSFixme;
  label: TSFixme;
  view: Ports | null = null;
  el: HTMLElement;
  group: TSFixme;
  parent: TSFixme;
  private root: Root | null = null;

  constructor(args) {
    super();
    this.group = args.group;
    this.popoutGroup = args.popoutGroup;
    this.label = args.label;
    this.parent = args.parent;
  }

  render() {
    const div = document.createElement('div');
    div.className = 'property-popout-group';
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    this.el = div;

    this.root.render(
      React.createElement(PropertyPanelRow, {
        label: this.label,
        // The click must not reach PopupLayer's document handler, which would
        // close the popout we are about to open (legacy: evt.stopPropagation()).
        children: React.createElement(
          'div',
          { onClick: (e: React.MouseEvent) => e.stopPropagation() },
          React.createElement(PropertyPanelButton, {
            properties: {
              buttonLabel: 'Edit',
              onClick: () => this.onPopoutClicked()
            }
          })
        )
      })
    );

    return this.el;
  }

  onPopoutClicked() {
    this.view = new Ports({
      model: this.parent.model,
      popout: this.popoutGroup
    });

    this.view.render();
    this.view.el.style.width = '300px';
    this.view.el.style.overflowY = 'auto';

    const anchor = this.el.querySelector('button') || this.el;

    this.parent.showPopout({
      content: { el: this.view.el },
      attachTo: anchor,
      position: 'right',
      onClose: () => {
        this.view && this.view.dispose();
      }
    });
  }

  dispose() {
    this.view && this.view.dispose();
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
