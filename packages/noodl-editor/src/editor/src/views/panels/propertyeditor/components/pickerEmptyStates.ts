/**
 * FB-015 AC1/AC5 — the copy each picker shows when it has nothing to list.
 *
 * The empty state is one shared component (`ContentPicker`), and this is the per-type half of it.
 * It lives here rather than inline in the six `PickerTypeView` subclasses for one reason worth the
 * indirection: those subclasses reach `ProjectModel`, Electron and the DOM, so nothing can grade
 * them outside a running editor, and an empty state that exists only as a string literal inside an
 * unreachable file is graded by reading the file — which passes just as well on a literal nothing
 * renders. Built here, the strings and the wiring of the buttons are both real values a spec can
 * call and check.
 *
 * @module noodl-editor/views/panels/propertyeditor/components/pickerEmptyStates
 */
import { PROJECT_ASSETS_FOLDER } from '@noodl-utils/projectAssets';

import { ContentPickerAction, ContentPickerEmptyState } from './ContentPicker';

/**
 * The image picker. The filed report is the specification: *"the source input doesn't make it
 * clear in any way that you need to either add a URL, or add an image… to your project folder"*,
 * and *"it's an empty box by default with no explanation why"* — so the message says why, and both
 * routes are named, because neither is discoverable from a blank panel.
 */
export function imagePickerEmptyState(): ContentPickerEmptyState {
  return {
    message: 'This project has no images yet.',
    hint: `Type or paste an image URL into the field, or import a file — it is copied into your project's ${PROJECT_ASSETS_FOLDER}/ folder and appears here.`
  };
}

/**
 * The image picker's footer, drawn whether or not the project has images.
 *
 * 🔴 These lived inside the empty state until AC2's drive: importing the first image removed the
 * empty state and took the Import button with it, so a second image could not be imported at all.
 * A route out of a picker is not a property of the picker being empty.
 */
export function imagePickerActions(routes: {
  onImport: () => void;
  onCreateAvatar?: () => void;
  onShowProjectFolder: () => void;
}): ContentPickerAction[] {
  return [
    { label: 'Import image…', onClick: routes.onImport },
    // SYL-003 — the third route, and the only one that does not require the author to already have
    // a picture. It sits in the footer for the reason the other two do: a route out of a picker is
    // not a property of the picker being empty, and the author most likely to want a generated
    // avatar is the one whose project has no images yet AND the one filling a second card.
    ...(routes.onCreateAvatar ? [{ label: 'Create an avatar…', onClick: routes.onCreateAvatar }] : []),
    { label: 'Show project folder', onClick: routes.onShowProjectFolder }
  ];
}

/**
 * The JavaScript file picker. Same blank panel, same cause — no import route here, because a
 * `.js` file is source the author writes rather than an asset they have lying around, and
 * "Import script…" would be a second, worse way to make one — see `sourceCodePickerActions`.
 */
export function sourceCodePickerEmptyState(): ContentPickerEmptyState {
  return {
    message: 'This project has no JavaScript files yet.',
    hint: 'Add a .js file anywhere in your project folder and it appears here.'
  };
}

export function sourceCodePickerActions(routes: { onShowProjectFolder: () => void }): ContentPickerAction[] {
  return [{ label: 'Show project folder', onClick: routes.onShowProjectFolder }];
}

/**
 * The identifier pickers — not a filesystem source, but the same blank panel for the same reason:
 * the list is built out of what the project already uses, so a project using none drew nothing.
 * No footer at all, because the route out is to type in the field the picker is attached to.
 */
export function identifierPickerEmptyState(displayName: string): ContentPickerEmptyState {
  return {
    message: `Nothing in this project uses ${displayName.toLowerCase()} yet.`,
    hint: 'Type a name in the field to make the first one — every other port of this kind will then offer it here.'
  };
}
