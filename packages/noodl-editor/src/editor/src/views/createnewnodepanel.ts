import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphModel, NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { RuntimeType } from '@noodl-models/nodelibrary/NodeLibraryData';

import View from '../../../shared/ListenableView';
import { NodeLibrary } from '../models/nodelibrary';
import { IVector2 } from './nodegrapheditor';
import { getNodePickerSize, NodePickerSize } from './NodePicker/NodePicker.constants';
import { NodePicker } from './NodePicker/NodePicker';

export interface CreateNewNodePanelOptions {
  model: NodeGraphModel;
  parentModel?: NodeGraphNode;
  attachToRoot?: boolean;
  pos: IVector2;
  runtimeType: RuntimeType;
}

export class CreateNewNodePanel extends View {
  model: NodeGraphModel;
  parentModel: NodeGraphNode;
  attachToRoot: boolean;
  pos: IVector2;
  runtimeType: RuntimeType;
  size: NodePickerSize = getNodePickerSize();
  root: Root | null = null;

  static shouldShow(context: { component: ComponentModel; parentModel: NodeGraphNode }) {
    const nodeTypes = NodeLibrary.instance.getNodeTypes();
    const componentTypes = NodeLibrary.instance.getComponents();

    const allTypes = nodeTypes.concat(componentTypes);

    const creatableTypes = allTypes.filter((t) => {
      const status = context.component.getCreateStatus({
        parent: context.parentModel,
        type: t
      });
      return status.creatable;
    });

    return creatableTypes.length > 0;
  }

  constructor(args: CreateNewNodePanelOptions) {
    super();

    this.model = args.model;
    this.parentModel = args.parentModel;
    this.attachToRoot = !!args.attachToRoot;
    this.pos = args.pos;
    this.runtimeType = args.runtimeType;

    // console.log(`Debug: Open Node Picker (runtime: ${args.runtimeType})`);
  }

  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    ipcRenderer.send('viewer-show');
  }

  renderReact(div: HTMLElement) {
    const props = {
      model: this.model,
      parentModel: this.parentModel,
      pos: this.pos,
      attachToRoot: this.attachToRoot,
      runtimeType: this.runtimeType,
      size: this.size
    };

    // hide viwer first...
    ipcRenderer.send('viewer-hide');

    // ... then render the picker
    if (!this.root) {
      this.root = createRoot(div);
    }
    this.root.render(React.createElement(NodePicker, props));
  }

  render() {
    const div = document.createElement('div');

    // PopupLayer measures this element before React has rendered into it, so it
    // needs explicit dimensions. UIX-013: the number comes from
    // `NodePicker.constants` and is handed to the React tree as a prop, rather
    // than being written here and again in the stylesheet and kept in sync by
    // hand. It is clamped to the viewport — the editor window's minimum is
    // smaller than the panel's preferred size.
    this.size = getNodePickerSize();
    div.style.width = `${this.size.width}px`;
    div.style.height = `${this.size.height}px`;

    this.renderReact(div);

    this.el = div;
    return this.el;
  }
}
