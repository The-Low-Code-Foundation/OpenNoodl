import { ProjectModel } from '@noodl-models/projectmodel';
import ThumbnailCache from '@noodl-utils/thumbnailcache';

import { ContentPickerItem } from '../components/ContentPicker';
import { folderForProjectPath } from '../components/fontItems';
import { getEditType } from '../utils';
import { PickerTypeView } from './PickerTypeView';

export class ImageType extends PickerTypeView {
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

  protected openPicker() {
    const picker = this.openContentPicker({ title: 'Choose image' });

    ProjectModel.instance.listFilesInProjectDirectory(
      (files) => {
        const items: ContentPickerItem[] = [];
        let filesLeft = files.length;
        if (!filesLeft) return;

        files.forEach((fileEntry) => {
          ThumbnailCache.instance.getThumbnailForFile(fileEntry, (thumbnail) => {
            const pathInProjectFolder = fileEntry.fullPath.substring(
              ProjectModel.instance._retainedProjectDirectory.length + 1
            );

            items.push({
              name: fileEntry.name,
              fullPath: pathInProjectFolder,
              folder: folderForProjectPath(pathInProjectFolder),
              thumbnail: thumbnail ? thumbnail.dataUrl : ''
            });

            if (--filesLeft === 0) picker.addItems(items);
          });
        });
      },
      ['png', 'jpeg', 'jpg', 'svg', 'gif', 'webp']
    );
  }
}
