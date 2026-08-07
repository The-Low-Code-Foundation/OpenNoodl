import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { StylesModel } from '@noodl-models/StylesModel';
import { UndoQueue } from '@noodl-models/undo-queue-model';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import TextStylePicker from '../../../TextStylePicker/TextStylePicker';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class TextStyleType extends PickerTypeView {
  private pickerRoot: Root | null = null;
  private pickerProps: TSFixme = {};

  static fromPort(args) {
    const view = new TextStyleType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  render() {
    const el = super.render();

    EventDispatcher.instance.off(this); // safeguard against multiple renders
    EventDispatcher.instance.on(
      'Model.stylesChanged',
      (event) => {
        if (event.args.type === 'text') {
          this.resetToDefault();
        }
      },
      this
    );

    return el;
  }

  protected openPicker(anchor: HTMLElement) {
    const props: TSFixme = (this.pickerProps = {});

    const newStyleProps = {};
    if (this.port.type.childPorts) {
      const prefix = this.port.type.childPortPrefix;
      for (const childPort of this.port.type.childPorts) {
        const value = this.parent.model.getParameter(prefix + childPort);
        if (value !== undefined) {
          newStyleProps[childPort] = value;
        }
      }
    }

    props.newStyleProps = newStyleProps;
    props.selectedStyle = this.getCurrentValue().value;
    props.inputValue = (anchor as HTMLInputElement).value;

    props.onItemSelected = (name: string) => {
      this.commit(name ?? '');
      this.parent.hidePopout();
    };

    props.createNewStyle = (styleName: string, newStyle: TSFixme) => {
      this.parent.hidePopout();

      //reset the values that are now moved to the text style
      const prevValue = this.parent.model.parameters[this.name];
      const portValuesToReset = {};

      if (this.port.type.childPorts) {
        const prefix = this.port.type.childPortPrefix;
        for (const childPort of this.port.type.childPorts) {
          const value = this.parent.model.parameters[prefix + childPort];
          if (value !== undefined) {
            portValuesToReset[prefix + childPort] = value;
          }
        }
      }

      const portsToReset = Object.keys(portValuesToReset);

      // @ts-expect-error
      UndoQueue.instance.pushAndDo({
        label: `create new text style: ${styleName}`,
        do: () => {
          const stylesModel = new StylesModel();
          stylesModel.setStyle('text', styleName, newStyle);
          stylesModel.dispose();

          //Set the new text style
          this.parent.model.setParameter(this.name, styleName === '' ? undefined : styleName, { undo: false });

          if (portsToReset.length) {
            for (const portName of portsToReset) {
              this.parent.model.setParameter(portName, undefined, { undo: false });
            }

            //the ports have changed values so we need to re-render the ports
            //this will reset any bound popouts, which causes some minor UX issues
            this.parent._portsHash = undefined;
            this.parent.renderGroups();
          }

          this.valueUpdated();
        },
        undo: () => {
          const stylesModel = new StylesModel();
          stylesModel.deleteStyle('text', styleName);
          stylesModel.dispose();

          this.parent.model.setParameter(this.name, prevValue === '' ? undefined : prevValue, { undo: false });

          if (portsToReset.length) {
            for (const portName of portsToReset) {
              this.parent.model.setParameter(portName, portValuesToReset[portName], { undo: false });
            }

            //the ports have changed values so we need to re-render the ports
            //this will reset any bound popouts, which causes some minor UX issues
            this.parent._portsHash = undefined;
            this.parent.renderGroups();
          }

          this.valueUpdated();
        }
      });
    };

    const div = document.createElement('div');
    this.pickerRoot = createRoot(div);
    this.pickerRoot.render(React.createElement(TextStylePicker, props));

    this.parent.showPopout({
      content: { el: div },
      attachTo: this.el,
      position: 'right',
      onClose: () => {
        if (this.pickerRoot) {
          this.pickerRoot.unmount();
          this.pickerRoot = null;
        }
      }
    });
  }

  protected filterPicker(text: string) {
    if (!this.pickerRoot) return;

    this.pickerProps.filter = text;
    this.pickerRoot.render(React.createElement(TextStylePicker, this.pickerProps));
  }

  protected onEnterPressed() {
    this.parent.hidePopout();
  }

  protected commit(value: string) {
    super.commit(value);
    this.refreshChildPortViews();
  }

  private valueUpdated() {
    this.isDefault = this.getCurrentValue().isDefault;
    this.renderReact();
    this.refreshChildPortViews();
  }

  /**
   * The child ports (font family, size, etc.) derive their default values from
   * the selected style, so views showing a default value must refresh.
   */
  private refreshChildPortViews() {
    if (this.parent.views && this.port.type.childPorts) {
      const prefix = this.port.type.childPortPrefix;
      for (const childPort of this.port.type.childPorts) {
        const portName = prefix + childPort;
        for (const portView of this.parent.views) {
          if (portView.isDefault && portView.port && portView.port.name === portName) {
            //resetToDefault actually doesn't reset, it just updates the value in the DOM to the current value from the model
            portView.resetToDefault && portView.resetToDefault();
          }
        }
      }
    }
  }
}
