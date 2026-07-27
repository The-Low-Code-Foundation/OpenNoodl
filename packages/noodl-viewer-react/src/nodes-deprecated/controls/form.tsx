import React from 'react';

import { flexDirectionValues } from '../../constants/flex';
import Layout from '../../layout';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition, type StyleObject } from '../../react-component-node';
import type { Noodl, Slot } from '../../types';

interface FormProps extends Noodl.ReactProps {
  /** Wired to the `onSubmit` output port; absent until something connects to it. */
  onSubmit?: () => void;
  children?: Slot;
}

function Form(props: FormProps) {
  const style: StyleObject = { ...props.style };
  Layout.size(style, props);
  Layout.align(style, props);

  let className = 'ndl-controls-form';
  if (props.className) className = className + ' ' + props.className;

  return (
    <form
      className={className}
      style={style}
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit && props.onSubmit();
      }}
    >
      {props.children}
    </form>
  );
}

const FormNode: ReactNodeDefinition = {
  name: 'Form',
  docs: 'https://docs.noodl.net/nodes/visual/form',
  allowChildren: true,
  noodlNodeAsProp: true,
  deprecated: true,
  initialize() {},
  defaultCss: {
    display: 'flex',
    position: 'relative',
    flexDirection: 'column'
  },
  getReactComponent() {
    return Form;
  },
  inputs: {
    flexDirection: {
      //don't rename for backwards compat
      index: 11,
      displayName: 'Layout',
      group: 'Layout',
      type: {
        name: 'enum',
        enums: [
          { label: 'None', value: 'none' },
          { label: 'Vertical', value: 'column' },
          { label: 'Horizontal', value: 'row' }
        ]
      },
      default: 'column',
      set(value: string) {
        this.props.layout = value;

        if (value !== 'none') {
          this.setStyle({ flexDirection: value });
        } else {
          this.removeStyle(['flexDirection']);
        }

        if (this.context.editorConnection) {
          // Send warning if the value is wrong
          // Widened deliberately: the port is an enum, but the value can also
          // arrive over a connection as any string — which is what this warns about.
          if (value !== 'none' && !(flexDirectionValues as readonly string[]).includes(value)) {
            this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'layout-warning', {
              message: 'Invalid Layout value has to be a valid flex-direction value.'
            });
          } else {
            this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'layout-warning');
          }
        }

        this.forceUpdate();
      }
    }
  },
  inputProps: {},
  outputProps: {
    onSubmit: { type: 'signal', displayName: 'Submit', group: 'Events' }
  }
};

NodeSharedPortDefinitions.addDimensions(FormNode, { defaultSizeMode: 'contentSize', contentLabel: 'Content' });
NodeSharedPortDefinitions.addAlignInputs(FormNode);
NodeSharedPortDefinitions.addTransformInputs(FormNode);
NodeSharedPortDefinitions.addMarginInputs(FormNode);
NodeSharedPortDefinitions.addPaddingInputs(FormNode);
NodeSharedPortDefinitions.addSharedVisualInputs(FormNode);

export default createNodeFromReactComponent(FormNode);
