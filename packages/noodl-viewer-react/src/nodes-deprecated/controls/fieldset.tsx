import React from 'react';

import { flexDirectionValues } from '../../constants/flex';
import Layout from '../../layout';
import NodeSharedPortDefinitions from '../../node-shared-port-definitions';
import { createNodeFromReactComponent, type ReactNodeDefinition, type StyleObject } from '../../react-component-node';
import type { Noodl, Slot } from '../../types';

interface FieldSetProps extends Noodl.ReactProps {
  children?: Slot;
}

function FieldSet(props: FieldSetProps) {
  const style: StyleObject = { ...props.style };
  Layout.size(style, props);
  Layout.align(style, props);

  let className = 'ndl-controls-fieldset';
  if (props.className) className = className + ' ' + props.className;

  return (
    <fieldset className={className} style={style}>
      {props.children}
    </fieldset>
  );
}

const FieldSetNode: ReactNodeDefinition = {
  name: 'Field Set',
  docs: 'https://docs.noodl.net/nodes/visual/fieldset',
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
    return FieldSet;
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
  outputProps: {}
};

NodeSharedPortDefinitions.addDimensions(FieldSetNode, { defaultSizeMode: 'contentSize', contentLabel: 'Content' });
NodeSharedPortDefinitions.addAlignInputs(FieldSetNode);
NodeSharedPortDefinitions.addTransformInputs(FieldSetNode);
NodeSharedPortDefinitions.addMarginInputs(FieldSetNode);
NodeSharedPortDefinitions.addPaddingInputs(FieldSetNode);
NodeSharedPortDefinitions.addSharedVisualInputs(FieldSetNode);

export default createNodeFromReactComponent(FieldSetNode);
