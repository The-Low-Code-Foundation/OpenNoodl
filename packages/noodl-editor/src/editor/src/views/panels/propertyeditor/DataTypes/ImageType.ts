import { ProjectModel } from '@noodl-models/projectmodel';
import FileSystem from '@noodl-utils/filesystem';
import { importFileIntoProjectAssets, PROJECT_ASSETS_FOLDER } from '@noodl-utils/projectAssets';
import ThumbnailCache from '@noodl-utils/thumbnailcache';

import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import { ContentPickerItem } from '../components/ContentPicker';
import { imagePickerActions, imagePickerEmptyState } from '../components/pickerEmptyStates';
import { folderForProjectPath } from '../components/fontItems';
import { getEditType } from '../utils';
import { ContentPickerHandle, PickerTypeView } from './PickerTypeView';

/** The extensions the walk is asked for, and the filter the import dialog offers. */
export const IMAGE_EXTENSIONS = ['png', 'jpeg', 'jpg', 'svg', 'gif', 'webp'];

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
    // `picker` is referenced by the empty state's own buttons, which cannot run before
    // `openContentPicker` has returned — the popout has to be on screen for one to be clicked.
    let picker: ContentPickerHandle;

    picker = this.openContentPicker({
      title: 'Choose image',
      emptyState: imagePickerEmptyState(),
      actions: imagePickerActions({
        onImport: () => this.importImage(picker),
        onShowProjectFolder: () => this.showProjectFolder()
      })
    });

    this.loadImages(picker);
  }

  /**
   * Fill the picker with the project's image files.
   *
   * 🔴 Every path out of here reports to the picker, including the ones that find nothing. The
   * filed bug was one line — `if (!filesLeft) return;` — which meant a project with no images
   * never got `addItems` at all, so the picker had no way to tell "empty" from "still loading",
   * and drew the same blank panel for both.
   */
  private loadImages(picker: ContentPickerHandle) {
    picker.setLoading();

    // `listFilesInProjectDirectory` returns without calling back when no project directory is
    // retained, so it cannot be the thing that clears the loading state on its own.
    if (!ProjectModel.instance?._retainedProjectDirectory) {
      picker.setItems([]);
      return;
    }

    ProjectModel.instance.listFilesInProjectDirectory((files) => {
      if (!picker.isOpen()) return;

      const entries = files || [];
      if (entries.length === 0) {
        picker.setItems([]);
        return;
      }

      const items: ContentPickerItem[] = [];
      let filesLeft = entries.length;

      entries.forEach((fileEntry) => {
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

          if (--filesLeft === 0 && picker.isOpen()) picker.setItems(items);
        });
      });
    }, IMAGE_EXTENSIONS);
  }

  /**
   * FB-015 AC2 — choose a file, copy it under `assets/`, select it, and reload the list.
   *
   * The popout survives the native dialog: `popuplayer` only dismisses on a pointerdown *and*
   * pointerup that both land outside it, and it explicitly disarms on `window.blur`.
   */
  private importImage(picker: ContentPickerHandle) {
    FileSystem.instance.chooseFile(
      (path: string) => {
        if (!path) return;

        importFileIntoProjectAssets(
          {
            projectDirectory: ProjectModel.instance._retainedProjectDirectory,
            exists: (p: string) => FileSystem.instance.fileExistsSync(p),
            makeDirectory: (p: string) =>
              new Promise<void>((resolve, reject) => {
                FileSystem.instance.makeDirectory(p, (result: { result: string }) =>
                  result?.result === 'success' ? resolve() : reject(new Error('makeDirectory failed'))
                );
              }),
            copyFile: (from: string, to: string) =>
              new Promise<void>((resolve, reject) => {
                FileSystem.instance.copyFile(from, to, (result: { result: string }) =>
                  result?.result === 'success' ? resolve() : reject(new Error('copyFile failed'))
                );
              })
          },
          path
        ).then((result) => {
          if (result.status === 'failed') {
            ToastLayer.showError(result.reason);
            return;
          }

          // Selected as well as listed: the author opened this picker to set Source, and clicked
          // Import from inside it. The reload is what makes AC2's "selectable" true for the
          // *next* row too, and what puts the thumbnail on screen.
          this.commit(result.projectRelativePath);
          this.loadImages(picker);
        });
      },
      { accept: IMAGE_EXTENSIONS.map((ext) => '.' + ext).join(',') }
    );
  }

}
