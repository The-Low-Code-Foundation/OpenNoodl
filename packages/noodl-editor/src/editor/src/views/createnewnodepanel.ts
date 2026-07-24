import { ipcRenderer } from 'electron';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphModel, NodeGraphNode } from '@noodl-models/nodegraphmodel';

import View from '../../../shared/view';
import { NodeLibrary } from '../models/nodelibrary';
import { IVector2 } from './nodegrapheditor';
import { NodePicker } from './NodePicker/NodePicker';

export interface CreateNewNodePanelOptions {
  model: NodeGraphModel;
  parentModel?: NodeGraphNode;
  attachToRoot?: boolean;
  pos: IVector2;
  runtimeType: string;
}

export class CreateNewNodePanel extends View {
  model: NodeGraphModel;
  parentModel: NodeGraphNode;
  attachToRoot: boolean;
  pos: IVector2;
  runtimeType: string;
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
      runtimeType: this.runtimeType
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
    
    // Set explicit dimensions so PopupLayer can measure correctly
    // before React 18's async rendering completes
    // These dimensions match NodePicker.module.scss: width: 800px, height: 600px
    div.style.width = '800px';
    div.style.height = '600px';

    this.renderReact(div);

    this.el = div;
    return this.el;
  }
}
