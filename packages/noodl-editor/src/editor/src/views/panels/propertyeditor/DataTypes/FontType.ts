import FontPicker from '../fontpicker';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class FontType extends PickerTypeView {
  private fontPicker: TSFixme;

  static fromPort(args) {
    const view = new FontType();

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

  protected openPicker(anchor: HTMLElement) {
    this.fontPicker = new FontPicker({
      onItemSelected: (name: string) => {
        this.commit(name);
        this.parent.hidePopout();
      }
    });

    this.fontPicker.render();

    this.parent.showPopout({
      content: this.fontPicker,
      attachTo: $(this.el),
      position: 'right'
    });
  }

  protected filterPicker(text: string) {
    this.fontPicker && this.fontPicker.setFilter(text);
  }
}
