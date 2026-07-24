import ImagePicker from '../imagepicker';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class ImageType extends PickerTypeView {
  private imagePicker: TSFixme;

  static fromPort(args) {
    const view = new ImageType();

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
    this.imagePicker = new ImagePicker({
      onItemSelected: (name: string) => {
        this.commit(name);
        this.parent.hidePopout();
      }
    });

    this.imagePicker.render();

    this.parent.showPopout({
      content: this.imagePicker,
      attachTo: $(anchor),
      position: 'right'
    });
  }

  protected filterPicker(text: string) {
    this.imagePicker && this.imagePicker.setFilter(text);
  }
}
