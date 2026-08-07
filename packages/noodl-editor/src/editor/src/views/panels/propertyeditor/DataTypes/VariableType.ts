import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { VariableInput } from '../components/VariableInput';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';
import { BasicType } from './BasicType';
import { BooleanType } from './BooleanType';
import { ColorType } from './ColorPicker/ColorType';

function inferType(value) {
  if (typeof value === 'string') {
    if ((value[0] === '#' && value.length === 7) || value.length === 4) return 'Co';
    if (value.startsWith('rgb(') || value.startsWith('rgba(')) return 'Co';
    return 'Ab';
  } else if (typeof value === 'boolean') {
    return 'Bo';
  } else if (typeof value === 'number') {
    return '12';
  }

  return '12';
}

export class VariableType extends TypeView {
  el: TSFixme;
  propertyType: string;
  typeView: TSFixme;
  private root: Root | null = null;

  static fromPort(args) {
    const view = new VariableType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);

    view.group = p.group;

    view.parent = parent;

    const param = parent.model.parameters[p.name];
    view.isDefault = false;
    view.propertyType = inferType(param);

    return view;
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

  private createTypeView() {
    this.typeView && this.typeView.dispose && this.typeView.dispose();

    const port = {
      displayName: this.port.displayName,
      name: this.port.name
    };

    if (this.propertyType === '12') {
      // @ts-expect-error
      port.type = 'number';
      this.typeView = BasicType.fromPort({ port: port, parent: this.parent });
    } else if (this.propertyType === 'Ab') {
      // @ts-expect-error
      port.type = 'string';
      this.typeView = BasicType.fromPort({ port: port, parent: this.parent });
    } else if (this.propertyType === 'Co') {
      // @ts-expect-error
      port.type = 'color';
      this.typeView = ColorType.fromPort({ port: port, parent: this.parent });
    } else if (this.propertyType === 'Bo') {
      // @ts-expect-error
      port.type = 'boolean';
      this.typeView = BooleanType.fromPort({ port: port, parent: this.parent });
    }

    this.typeView.render();
  }

  renderReact() {
    if (!this.root) return;

    this.createTypeView();

    this.root.render(
      React.createElement(VariableInput, {
        types: this.type.types || [],
        currentType: this.propertyType,
        childEl: this.typeView.el,
        onTypeChange: (type: string) => {
          this.parent.setParameter(this.name, undefined);

          this.propertyType = type;
          this.renderReact();
        }
      })
    );
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.typeView && this.typeView.dispose && this.typeView.dispose();
    super.dispose();
  }
}
