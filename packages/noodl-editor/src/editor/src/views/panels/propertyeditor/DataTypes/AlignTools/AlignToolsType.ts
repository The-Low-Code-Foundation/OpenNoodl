import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { AlignToolsInput } from '../../components/AlignToolsInput';
import { TypeView } from '../../TypeView';

export class AlignToolsType extends TypeView {
  defaults: TSFixme;
  values: TSFixme;
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

    let toolTypeId = 'aligntools-' + p.group;
    if (
      p.type.alignComp === 'justify-content' ||
      p.type.alignComp === 'align-items' ||
      p.type.alignComp === 'align-content'
    ) {
      toolTypeId += '-' + p.type.alignComp;
    }

    if (!parent._toolsType[toolTypeId]) {
      const view = (parent._toolsType[toolTypeId] = new AlignToolsType());

      view.parent = parent;
      view.group = p.group;

      view.addComponentPort(p);

      return view;
    } else {
      parent._toolsType[toolTypeId].addComponentPort(p);
    }
  }

  private isVertical() {
    return this.parent.model.parameters.flexDirection !== 'row';
  }

  render() {
    const div = document.createElement('div');
    div.style.width = '100%';

    if (!this.root) {
      this.root = createRoot(div);
    }

    // The align-items/justify-content icons rotate with the flex direction,
    // and undo/redo changes the alignment parameters under us
    this.parent.model.on(
      'parametersChanged',
      () => {
        Object.keys(this.ports).forEach((comp) => {
          this.values[comp] = this.parent.model.parameters[this.ports[comp].name];
        });
        this.renderReact();
      },
      this
    );

    this.renderReact();

    this.el = div;
    return this.el;
  }

  private renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(AlignToolsInput, {
        values: { ...this.values },
        defaults: this.defaults,
        isVertical: this.isVertical(),
        onToggle: (comp: string, value: string | undefined) => {
          this.values[comp] = value;
          this.parent.model.setParameter(this.ports[comp].name, value, {
            undo: true,
            label: 'alignment changed'
          });
          this.renderReact();
        },
        onReset: () => {
          Object.keys(this.defaults).forEach((comp) => {
            if (this.values[comp] !== undefined) {
              this.values[comp] = undefined;
              this.parent.model.setParameter(this.ports[comp].name, undefined, {
                undo: true,
                label: 'alignment changed'
              });
            }
          });
          this.renderReact();
        }
      })
    );
  }

  dispose() {
    this.parent.model.off(this);
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    super.dispose();
  }

  addComponentPort(p) {
    const comp = p.type.alignComp;

    this.ports[comp] = p;
    const value = this.parent.model.parameters[p.name];
    this.values[comp] = value;
    this.defaults[comp] = p.default;
  }
}
