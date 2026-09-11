/**
 * FB-015 AC2 — copying a chosen image into the project, under `assets/`.
 *
 * The editor has never had an import path: `ProjectModel._listFilesInDirectory` finds files
 * wherever they already are, and putting them there was the author's job with a Finder window and
 * nothing telling them so. This module is the copy step, and it is deliberately dependency-injected
 * rather than reaching `filesystem` itself, so the naming rules below are gradeable without a disk.
 *
 * ## 🔴 `filesystem.makeUniquePath` cannot be used here
 *
 * The platform's helper appends its counter to the **end of the whole path** — `assets/logo.png`
 * becomes `assets/logo.png-1`. For a project file that is merely ugly; for an *image* it is a
 * defect with two halves: the picker lists files by extension, so `logo.png-1` would not appear in
 * the picker that just imported it, and a browser handed that URL gets no type. Names here are made
 * unique before the extension — `logo-1.png` — which is also what every OS file manager does.
 *
 * ## `assets/` is a suggestion, not a rule
 *
 * Nothing reads this folder name to find files; the walk already finds images anywhere in the
 * project. It exists so that an import lands somewhere sane and so that "where do I put my images"
 * has an answer. Existing projects are unaffected.
 *
 * @module noodl-editor/utils/projectAssets
 */

/** Where an imported file lands. Created on demand, never required to exist. */
export const PROJECT_ASSETS_FOLDER = 'assets';

export interface AssetImportDeps {
  /** Absolute path of the open project's directory. */
  projectDirectory: string;
  exists(path: string): boolean;
  makeDirectory(path: string): Promise<void>;
  copyFile(from: string, to: string): Promise<void>;
}

/**
 * SYL-003 — the same disk, for content that has no source file.
 *
 * A generated avatar is a string, not a path, so there is nothing to copy: the only difference
 * from {@link AssetImportDeps} is `writeFile`. It is a separate interface rather than an optional
 * member so that a caller which can only copy cannot be passed where a write is required.
 */
export interface AssetWriteDeps {
  /** Absolute path of the open project's directory. */
  projectDirectory: string;
  exists(path: string): boolean;
  makeDirectory(path: string): Promise<void>;
  writeFile(path: string, contents: string): Promise<void>;
}

/**
 * The three outcomes, discriminated by a string rather than an `ok` boolean.
 *
 * ⚠️ Not a stylistic choice: this program compiles with `strictNullChecks` off, and a boolean
 * discriminant does not narrow a union under it — `result.reason` after `if (!result.ok)` is a
 * type error. A string discriminant narrows either way, and it names `already-in-project`, which
 * a boolean was hiding inside "success".
 */
export type AssetImportResult =
  /** Copied into `assets/`. */
  | { status: 'imported'; projectRelativePath: string }
  /** The file was already inside the project, so it was left where it was and simply selected. */
  | { status: 'already-in-project'; projectRelativePath: string }
  | { status: 'failed'; reason: string };

/** Project paths are stored `/`-separated whatever the host does with separators. */
export function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/** The last path segment, without depending on Node's `path`. */
export function baseName(path: string): string {
  const parts = toPosixPath(path).split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Splits a file name into its stem and its extension, where a leading dot belongs to the stem —
 * `.gitignore` is a name with no extension, not an extension with no name.
 */
export function splitFileName(fileName: string): { stem: string; extension: string } {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return { stem: fileName, extension: '' };
  return { stem: fileName.slice(0, dot), extension: fileName.slice(dot) };
}

/**
 * A file name that no existing file claims, with the counter placed **before** the extension.
 * `isTaken` is asked about each candidate in turn, so a caller can back it with a disk check or a
 * set of names it already holds.
 */
export function uniqueFileName(fileName: string, isTaken: (candidate: string) => boolean): string {
  if (!isTaken(fileName)) return fileName;

  const { stem, extension } = splitFileName(fileName);
  for (let count = 1; ; count++) {
    const candidate = `${stem}-${count}${extension}`;
    if (!isTaken(candidate)) return candidate;
  }
}

/**
 * Whether `absolutePath` already lives inside the project directory — in which case importing it
 * would leave the author with two copies of the same image and a picker listing both.
 *
 * ⚠️ Compared case-sensitively. On a case-insensitive volume a path differing only in case reads as
 * outside the project and gets copied; that produces a redundant copy, never a lost file.
 */
export function isInsideProject(projectDirectory: string, absolutePath: string): boolean {
  const root = toPosixPath(projectDirectory).replace(/\/+$/, '');
  return toPosixPath(absolutePath).startsWith(root + '/');
}

/** The project-relative, `/`-separated form of a path inside the project. */
export function toProjectRelativePath(projectDirectory: string, absolutePath: string): string {
  const root = toPosixPath(projectDirectory).replace(/\/+$/, '');
  return toPosixPath(absolutePath).slice(root.length + 1);
}

/**
 * Copy one file into the project's `assets/` folder, creating the folder if it is not there, and
 * return the project-relative path the picker should commit.
 *
 * A file already inside the project is **not** copied — its existing path is returned, so
 * "Import" on something the author already has selects the right file instead of leaving them with
 * two copies of it and a picker listing both.
 */
export async function importFileIntoProjectAssets(
  deps: AssetImportDeps,
  sourcePath: string
): Promise<AssetImportResult> {
  if (!deps.projectDirectory) return { status: 'failed', reason: 'There is no open project to import into.' };
  if (!sourcePath) return { status: 'failed', reason: 'No file was chosen.' };

  if (isInsideProject(deps.projectDirectory, sourcePath)) {
    return {
      status: 'already-in-project',
      projectRelativePath: toProjectRelativePath(deps.projectDirectory, sourcePath)
    };
  }

  const root = toPosixPath(deps.projectDirectory).replace(/\/+$/, '');
  const assetsDirectory = `${root}/${PROJECT_ASSETS_FOLDER}`;
  const fileName = uniqueFileName(baseName(sourcePath), (candidate) => deps.exists(`${assetsDirectory}/${candidate}`));

  try {
    await deps.makeDirectory(assetsDirectory);
    await deps.copyFile(sourcePath, `${assetsDirectory}/${fileName}`);
  } catch (error) {
    // 🔴 Reported, never swallowed. The awaited-callback trap this repo has thirteen sites of is a
    // write whose failure path is dead; here the caller is told, and tells the author.
    return { status: 'failed', reason: `${baseName(sourcePath)} could not be copied into ${PROJECT_ASSETS_FOLDER}/.` };
  }

  return { status: 'imported', projectRelativePath: `${PROJECT_ASSETS_FOLDER}/${fileName}` };
}

/**
 * Write generated content into the project's `assets/` folder under a name nothing else claims,
 * and return the project-relative path the picker should commit.
 *
 * The naming goes through {@link uniqueFileName} for the reason documented at the top of this
 * module — the counter belongs *before* the extension, or the file the author just made would not
 * appear in the picker that made it, the image walk listing by extension. That trap is not one a
 * generated file is exempt from: two authors typing `Nibbles` in the same project is the ordinary
 * case, not the edge one.
 *
 * 🔴 The failure path is reported rather than swallowed. This repo has thirteen sites of the
 * awaited-callback write whose error path is dead; the caller here is told, and tells the author.
 */
export async function writeGeneratedAssetIntoProject(
  deps: AssetWriteDeps,
  fileName: string,
  contents: string
): Promise<AssetImportResult> {
  if (!deps.projectDirectory) return { status: 'failed', reason: 'There is no open project to save into.' };
  if (!fileName) return { status: 'failed', reason: 'The generated file has no name.' };
  if (!contents) return { status: 'failed', reason: `${fileName} was empty, so it was not saved.` };

  const root = toPosixPath(deps.projectDirectory).replace(/\/+$/, '');
  const assetsDirectory = `${root}/${PROJECT_ASSETS_FOLDER}`;
  const unique = uniqueFileName(fileName, (candidate) => deps.exists(`${assetsDirectory}/${candidate}`));

  try {
    await deps.makeDirectory(assetsDirectory);
    await deps.writeFile(`${assetsDirectory}/${unique}`, contents);
  } catch (error) {
    return { status: 'failed', reason: `${unique} could not be saved into ${PROJECT_ASSETS_FOLDER}/.` };
  }

  return { status: 'imported', projectRelativePath: `${PROJECT_ASSETS_FOLDER}/${unique}` };
}
