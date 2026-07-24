import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { MarginPaddingInput, MarginPaddingValue } from '../components/MarginPaddingInput';
import { TypeView } from '../TypeView';

export class MarginPaddingType extends TypeView {
  defaults: Record<string, MarginPaddingValue>;
  values: Record<string, MarginPaddingValue | undefined>;
  ports: TSFixme;
  el: TSFixme;
  private root: Root | null = null;

  constructor() {
    super();
    this.defaults = {};
    this.values = {};
    this.ports = {};
  }

  static fromPort(args) {
    const p = args.port;
    const parent = args.parent;

    const toolTypeId = 'marginsandpadding-' + p.group;
    if (!parent._toolsType[toolTypeId]) {
      const view = (parent._toolsType[toolTypeId] = new MarginPaddingType());

      view.parent = parent;
      view.group = p.group;

      view.addComponentPort(p);

      return view;
    } else {
      parent._toolsType[toolTypeId].addComponentPort(p);
    }
  }

  render() {
    const div = document.createElement('div');
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    this.renderReact();

    this.el = div;
    return this.el;
  }

  private refreshDefault(comp: string) {
    // Update the default value in case we are resetting
    const defaultValue = this.parent.model.getParameter(this.ports[comp].name);
    if (typeof defaultValue === 'object') {
      this.defaults[comp] = defaultValue;
    } else {
      this.defaults[comp] = { value: defaultValue, unit: this.ports[comp].type.defaultUnit };
    }
  }

  private update(comp: string, value: MarginPaddingValue | undefined, opts?: { drag?: boolean; oldValue?: MarginPaddingValue }) {
    this.values[comp] = value;

    const undoArgs = {
      undo: true,
      label: 'margin or padding changed',
      oldValue: opts ? opts.oldValue : undefined
    };
    this.parent.model.setParameter(this.ports[comp].name, value, opts && opts.drag ? undefined : undoArgs);

    this.refreshDefault(comp);
    this.renderReact();
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(MarginPaddingInput, {
        values: { ...this.values },
        defaults: { ...this.defaults },
        onUpdate: (comp, value, opts) => this.update(comp, value, opts),
        onReset: () => {
          Object.keys(this.defaults).forEach((comp) => {
            if (this.values[comp] !== undefined) {
              this.update(comp, undefined);
            }
          });
        }
      })
    );
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }

  addComponentPort(p) {
    const comp = p.type.marginPaddingComp;

    this.ports[comp] = p;
    let value = this.parent.model.parameters[p.name];
    if (typeof value === 'number') value = { value: value, unit: p.type.defaultUnit };
    this.values[comp] = value;

    this.refreshDefault(comp);
  }
}
