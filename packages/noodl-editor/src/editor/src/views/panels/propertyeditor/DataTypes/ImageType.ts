import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import { ProjectModel } from '@noodl-models/projectmodel';
import {
  AVATAR_CREDITS_FILE,
  avatarCreditFor,
  avatarFileName,
  upsertAvatarCredits
} from '@noodl-utils/avatargenerator';
import FileSystem from '@noodl-utils/filesystem';
import {
  importFileIntoProjectAssets,
  writeGeneratedAssetIntoProject,
  PROJECT_ASSETS_FOLDER
} from '@noodl-utils/projectAssets';
import ThumbnailCache from '@noodl-utils/thumbnailcache';

import { ToastLayer } from '../../../ToastLayer/ToastLayer';
import { installedAvatarStyles } from '@noodl-utils/avatarstyles';

import { AvatarChoice, AvatarPicker } from '../avatarpicker';
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
        onCreateAvatar: () => this.openAvatarPicker(),
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

  /**
   * SYL-003 — the route from a word to a picture, opened from the image picker's footer.
   *
   * The content picker is **closed first** rather than layered over: `showPopout` pushes onto a
   * stack, so opening this from inside the list would leave the list alive underneath it and two
   * blockers armed over the editor. Closing first also means one Escape gets the author out.
   */
  private openAvatarPicker() {
    this.parent.hidePopout();

    const div = document.createElement('div');
    let root: Root | null = createRoot(div);

    root.render(
      React.createElement(AvatarPicker, {
        // The node's own label, so naming a creature "Nibbles" on the canvas means the picker
        // opens already showing Nibbles rather than an empty box asking for a word again.
        initialKeyword: this.parent?.model?.label || '',
        onAvatarSelected: (choice: AvatarChoice) => this.saveAvatar(choice)
      })
    );

    this.parent.showPopout({
      content: { el: div },
      attachTo: this.el,
      position: 'right',
      onClose: () => {
        root?.unmount();
        root = null;
      }
    });
  }

  /**
   * Write the chosen avatar into `assets/` and select it.
   *
   * 🔴 `FileSystem.writeFile` is callback-style and returns `undefined`, so awaiting it directly is
   * a no-op with a dead error path — the shape this repo has thirteen sites of. It is wrapped into
   * a promise that actually rejects, exactly as `importImage` wraps `copyFile`, so the toast below
   * is reachable rather than decorative.
   */
  private saveAvatar(choice: AvatarChoice) {
    writeGeneratedAssetIntoProject(
      {
        projectDirectory: ProjectModel.instance?._retainedProjectDirectory,
        exists: (p: string) => FileSystem.instance.fileExistsSync(p),
        makeDirectory: (p: string) =>
          new Promise<void>((resolve, reject) => {
            FileSystem.instance.makeDirectory(p, (result: { result: string }) =>
              result?.result === 'success' ? resolve() : reject(new Error('makeDirectory failed'))
            );
          }),
        writeFile: (p: string, contents: string) =>
          new Promise<void>((resolve, reject) => {
            FileSystem.instance.writeFile(p, contents, (result: { result: string }) =>
              result?.result === 'success' ? resolve() : reject(new Error('writeFile failed'))
            );
          })
      },
      avatarFileName(choice.seed, choice.styleId),
      choice.svg
    ).then((result) => {
      if (result.status === 'failed') {
        ToastLayer.showError(result.reason);
        return;
      }

      this.writeAvatarCredit(choice, result.projectRelativePath);
      this.commit(result.projectRelativePath);
      this.parent.hidePopout();
    });
  }

  /**
   * Record the artist, for the styles whose licence obliges it.
   *
   * 🔴 **This is what makes shipping the CC BY styles legitimate rather than merely convenient.**
   * CC BY 4.0 asks that the artist is credited *wherever the work appears*, and what appears is
   * the learner's exported app — not this editor. So the credit is written into the project, beside
   * the picture, where it travels with anything they publish. A note in our own docs would satisfy
   * nobody.
   *
   * CC0 styles write nothing: public domain asks for no credit, and inventing one would put a
   * claim in the author's project that the licence does not make.
   *
   * Failures are surfaced but do NOT block the picture, which is already on disk and already
   * selected — the author is told the credit could not be written rather than losing the avatar to
   * a bookkeeping error they cannot act on.
   */
  private writeAvatarCredit(choice: AvatarChoice, projectRelativePath: string) {
    const style = installedAvatarStyles().find((entry) => entry.id === choice.styleId);
    if (!style) return;

    const credit = avatarCreditFor(projectRelativePath, style.name, style.style.meta);
    if (!credit) return;

    const directory = ProjectModel.instance?._retainedProjectDirectory;
    if (!directory) return;

    const creditsPath = `${directory}/${PROJECT_ASSETS_FOLDER}/${AVATAR_CREDITS_FILE}`;
    let existing = '';
    try {
      if (FileSystem.instance.fileExistsSync(creditsPath)) {
        existing = String(FileSystem.instance.readFileSync(creditsPath, 'utf8') || '');
      }
    } catch (error) {
      // An unreadable credits file is rewritten from this one credit rather than abandoned: a
      // missing older row is a smaller wrong than no attribution at all.
      existing = '';
    }

    FileSystem.instance.writeFile(creditsPath, upsertAvatarCredits(existing, credit), (result: { result: string }) => {
      if (result?.result !== 'success') {
        ToastLayer.showError(`The picture was saved, but its artist credit could not be written to ${AVATAR_CREDITS_FILE}.`);
      }
    });
  }

}
