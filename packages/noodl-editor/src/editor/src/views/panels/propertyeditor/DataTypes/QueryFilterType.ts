import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import QueryEditor from '../components/QueryEditor';
import { TypeView } from '../TypeView';
import { getEditType } from '../utils';

export class QueryFilterType extends TypeView {
  el: TSFixme;
  private root: Root | null = null;

  static fromPort(args) {
    const view = new QueryFilterType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.default = p.default;
    view.group = p.group;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }
  render() {
    const onChange = (filter) => {
      const undoArgs = { undo: true, label: 'query changed', oldValue: this.value };
      this.value = filter;
      this.parent.model.setParameter(this.name, filter, undoArgs);
      this.isDefault = false;
    };

    const div = document.createElement('div');

    const renderFilters = () => {
      const props = {
        filter: this.value,
        schema: this.type.schema,
        onChange
      };

      if (!this.root) {
        this.root = createRoot(div);
      }
      this.root.render(React.createElement(QueryEditor.Filter, props));
    };

    renderFilters();

    this.el = div;

    return this.el;
  }
}
