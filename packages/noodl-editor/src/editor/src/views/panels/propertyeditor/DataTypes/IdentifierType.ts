import IdentifierPicker from '../identifierpicker';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class IdentifierType extends PickerTypeView {
  identifierType: TSFixme;
  private identifierPicker: TSFixme;

  static fromPort(args) {
    const view = new IdentifierType();

    const p = args.port;
    const parent = args.parent;

    view.port = p;
    view.displayName = p.displayName ? p.displayName : p.name;
    view.name = p.name;
    view.type = getEditType(p);
    view.group = p.group;
    view.identifierType = p.type.identifierOf;
    view.value = parent.model.getParameter(p.name);
    view.parent = parent;
    view.isConnected = parent.model.isPortConnected(p.name, 'target');
    view.isDefault = parent.model.parameters[p.name] === undefined;

    return view;
  }

  protected openPicker(anchor: HTMLElement) {
    this.identifierPicker = new IdentifierPicker({
      title: this.type.identifierDisplayName || 'Identifiers',
      identifierType: this.identifierType,
      onItemSelected: (name: string) => {
        this.commit(name);
        this.parent.hidePopout();
      }
    });
    this.identifierPicker.render();

    this.parent.showPopout({
      content: this.identifierPicker,
      attachTo: $(anchor),
      position: 'right'
    });
  }

  protected filterPicker(text: string) {
    this.identifierPicker && this.identifierPicker.setFilter(text);
  }
}
