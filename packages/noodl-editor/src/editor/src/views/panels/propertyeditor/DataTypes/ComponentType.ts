import { ComponentPicker } from '../componentpicker';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class ComponentType extends PickerTypeView {
  private componentPicker: TSFixme;

  static fromPort(args) {
    const view = new ComponentType();

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

  protected openPicker(anchor: HTMLElement) {
    this.componentPicker = new ComponentPicker({
      components: this.type.components,
      ignoreSheetName: this.type.ignoreSheetName,
      onItemSelected: (name: string) => {
        this.commit(name);
        this.parent.hidePopout();
      }
    });
    // ComponentPicker manages its own popout, anchored to the input
    this.componentPicker.render(anchor);
  }

  protected filterPicker(text: string) {
    this.componentPicker && this.componentPicker.setFilter(text);
  }
}
