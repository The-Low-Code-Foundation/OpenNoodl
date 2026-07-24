import { ProjectModel } from '@noodl-models/projectmodel';

import { ContentPickerItem } from '../../components/ContentPicker';
import { getEditType } from '../../utils';
import { folderForProjectPath } from '../../components/fontItems';
import { PickerTypeView } from '../PickerTypeView';

export class SourceCodeType extends PickerTypeView {
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

  protected openPicker() {
    const picker = this.openContentPicker({ title: 'Choose file' });

    ProjectModel.instance.listFilesInProjectDirectory((files) => {
      const items: ContentPickerItem[] = files.map((fileEntry) => {
        const pathInProjectFolder = fileEntry.fullPath.substring(
          ProjectModel.instance._retainedProjectDirectory.length + 1
        );
        return {
          name: fileEntry.name,
          fullPath: pathInProjectFolder,
          folder: folderForProjectPath(pathInProjectFolder)
        };
      });
      picker.addItems(items);
    }, ['js']);
  }
}
