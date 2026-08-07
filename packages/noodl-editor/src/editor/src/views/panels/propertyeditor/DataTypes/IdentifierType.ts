import { ProjectModel } from '@noodl-models/projectmodel';

import { ContentPickerItem } from '../components/ContentPicker';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class IdentifierType extends PickerTypeView {
  identifierType: TSFixme;

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

  protected openPicker() {
    const picker = this.openContentPicker({
      title: this.type.identifierDisplayName || 'Identifiers',
      sortMode: 'nameDesc'
    });

    // Collect every value used for this identifier type across the project
    const identifiers: Record<string, boolean> = {};
    ProjectModel.instance.forEachComponent((c) => {
      c.forEachNode((n) => {
        n.getPorts().forEach((p) => {
          if (typeof p.type === 'object' && p.type.name === 'string' && p.type.identifierOf === this.identifierType) {
            const _id = n.parameters[p.name];
            if (_id !== undefined) identifiers[_id] = true;
          }
        });
      });
    });

    const items: ContentPickerItem[] = Object.keys(identifiers).map((_id) => ({
      name: _id,
      fullPath: _id
    }));
    picker.addItems(items);
  }
}
