import { getEditType } from '../../utils';
import { PickerTypeView } from '../PickerTypeView';
import FilePicker from './filepicker';

export class SourceCodeType extends PickerTypeView {
  private filePicker: TSFixme;

  static fromPort(args) {
    const view = new SourceCodeType();

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
    this.filePicker = new FilePicker({
      onItemSelected: (name: string) => {
        this.commit(name);
        this.parent.hidePopout();
      },
      fileTypes: ['js']
    });
    this.filePicker.render();

    this.parent.showPopout({
      content: this.filePicker,
      attachTo: $(anchor),
      position: 'right'
    });
  }

  protected filterPicker(text: string) {
    this.filePicker && this.filePicker.setFilter(text);
  }
}
