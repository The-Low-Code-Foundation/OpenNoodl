import { loadFontItems } from '../components/fontItems';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class FontType extends PickerTypeView {
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

  protected openPicker() {
    const picker = this.openContentPicker({ title: 'Choose font' });
    loadFontItems(picker.addItems);
  }
}
