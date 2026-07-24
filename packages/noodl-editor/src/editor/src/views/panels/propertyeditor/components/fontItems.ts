import { ProjectModel } from '@noodl-models/projectmodel';
import FileSystem from '@noodl-utils/filesystem';

import { ContentPickerItem } from './ContentPicker';

export const COMMON_FONTS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Arial Black',
  'Impact',
  'Tahoma',
  'Courier New',
  'Lucida Console'
];

export function folderForProjectPath(pathInProjectFolder: string): string {
  const parts = pathInProjectFolder.split('/');
  if (parts.length === 1) return '/';
  return parts.splice(0, parts.length - 1).join('/');
}

const fontDataURLCache: Record<string, string> = {};
const injectedFontFaces = new Set<string>();

function getFontDataURL(fileEntry: TSFixme, callback: (content: string) => void) {
  if (fontDataURLCache[fileEntry.name]) {
    callback(fontDataURLCache[fileEntry.name]);
    return;
  }

  FileSystem.instance.downloadAsDataURI(fileEntry.fullPath, (content: string) => {
    fontDataURLCache[fileEntry.name] = content;
    callback(content);
  });
}

/** Register a project font with the document so pickers can preview it */
function injectFontFace(family: string, dataURL: string) {
  if (injectedFontFaces.has(family)) return;
  injectedFontFaces.add(family);

  const style = document.createElement('style');
  style.textContent = '@font-face {font-family: "' + family + '"; src: url(' + dataURL + ');}';
  document.head.appendChild(style);
}

/**
 * Load the font picker's item list: the common built-in fonts synchronously,
 * then the project's font files (with @font-face registration for preview)
 * as they resolve.
 */
export function loadFontItems(push: (items: ContentPickerItem[]) => void) {
  push(
    COMMON_FONTS.map((name) => ({
      name,
      fullPath: name,
      folder: 'Common fonts',
      fontFamily: name
    }))
  );

  ProjectModel.instance.listFilesInProjectDirectory(
    (files) => {
      const items: ContentPickerItem[] = [];
      let filesLeft = files.length;
      if (!filesLeft) return;

      files.forEach((fileEntry) => {
        getFontDataURL(fileEntry, (dataURL) => {
          if (dataURL) {
            const nameWithoutExtension = fileEntry.name.slice(0, -4);
            const family = nameWithoutExtension.replace(/\s/g, '');
            const pathInProjectFolder = fileEntry.fullPath.substring(
              ProjectModel.instance._retainedProjectDirectory.length + 1
            );

            injectFontFace(family, dataURL);

            items.push({
              name: nameWithoutExtension,
              fullPath: pathInProjectFolder,
              folder: folderForProjectPath(pathInProjectFolder),
              fontFamily: family
            });
          }

          if (--filesLeft === 0) push(items);
        });
      });
    },
    ['otf', 'ttf', 'woff', 'woff2']
  );
}
