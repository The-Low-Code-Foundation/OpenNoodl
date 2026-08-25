import fs from 'fs';
import nodePath from 'path';
import fse, { mkdirp } from 'fs-extra';
import JSZip from 'jszip';
import { FileBlob, FileInfo, FileStat, IFileSystem, OpenDialogOptions } from '@noodl/platform';

/**
 * 🔴 **Where a zip entry is allowed to land, and where it is not.**
 *
 * A zip is a list of names the *archive* chooses, and `path.join(root, name)`
 * happily resolves `../../.ssh/authorized_keys` to somewhere that is not `root`.
 * Every archive this app extracts comes from a URL — a downloaded project, a
 * module or prefab from the library, a forge template — so the names are a
 * stranger's input on every path that reaches here.
 *
 * ⚠️ **Containment is checked on the RESOLVED path, not by looking for `..` in
 * the name.** A substring check is defeated by encoding, by a name that reaches
 * outside without a literal `..` (an absolute path, a drive letter on Windows),
 * and by nothing at all on a name like `ok/../ok/x` that is in fact safe. Asking
 * the path module where the file actually ends up is the only question with a
 * reliable answer.
 *
 * @returns the absolute destination, or `null` if the entry escapes `root`.
 */
export function resolveZipEntryPath(root: string, entryName: string): string | null {
  const base = nodePath.resolve(root);
  const dest = nodePath.resolve(base, entryName);

  // `base + sep` rather than `base`: without the separator, a sibling directory
  // whose name merely starts with the root's (`/tmp/app-evil` beside `/tmp/app`)
  // would read as contained.
  if (dest !== base && !dest.startsWith(base + nodePath.sep)) return null;
  return dest;
}

/** Raised when an archive names an entry that would land outside its target. */
export class ZipEntryEscapesTargetError extends Error {
  constructor(public readonly entryName: string) {
    super(
      `This archive contains an entry ("${entryName}") that would be written outside the folder it is being extracted into, so nothing was extracted.`
    );
    this.name = 'ZipEntryEscapesTargetError';
  }
}

/**
 * Extract a loaded zip into `path`.
 *
 * 🔴 **Module-level rather than a closure inside `unzipUrl`, so it can be
 * graded.** `unzipUrl` reaches for `XMLHttpRequest`, which does not exist under
 * a plain-Node runner — a traversal guard that could only be exercised inside a
 * renderer is a guard nobody checks. This takes the loaded archive and does the
 * writing; the transport stays where it was.
 *
 * ⚠️ **Refuses the WHOLE archive on one bad entry**, and does so before writing
 * anything. A per-entry skip would leave a half-extracted directory that every
 * caller here would then treat as a successfully downloaded project.
 */
export async function extractZipToFolder(zip: JSZip, path: string): Promise<void> {
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

  // Checked in full, first. Nothing is written until every name is known to land
  // inside the target.
  for (const name of names) {
    if (resolveZipEntryPath(path, name) === null) throw new ZipEntryEscapesTargetError(name);
  }

  for (const name of names) {
    const dest = resolveZipEntryPath(path, name)!;
    const buffer = await zip.file(name)!.async('nodebuffer');
    await new Promise<void>((resolve, reject) => {
      mkdirp(nodePath.dirname(dest), (err) => (err ? reject(err) : resolve()));
    });
    fs.writeFileSync(dest, buffer);
  }
}

export class FileSystemNode implements IFileSystem {
  resolve(...paths: string[]): string {
    return nodePath.resolve(...paths);
  }

  join(...paths: string[]): string {
    return nodePath.join(...paths);
  }

  exists(path: string): boolean {
    return fs.existsSync(path);
  }

  dirname(path: string): string {
    return nodePath.dirname(path);
  }

  basename(path: string): string {
    return nodePath.basename(path);
  }

  file(path: string): FileStat {
    const stat = fs.lstatSync(path);
    return { size: stat.size };
  }

  writeFile(path: string, blob: FileBlob): Promise<void> {
    if (typeof blob === 'string') {
      return fs.promises.writeFile(path, Buffer.from(blob));
    }

    return fs.promises.writeFile(path, blob);
  }

  async writeFileOverride(path: string, blob: FileBlob): Promise<void> {
    try {
      await this.removeFile(path);
    } catch (error) {
      // noop
    }

    await this.writeFile(path, blob);
  }

  /**
   * Read file content, with utf-8 encoding.
   *
   * @param path
   * @returns
   */
  readFile(path: string): Promise<string> {
    return fs.promises.readFile(path, 'utf8');
  }

  async readBinaryFile(path: string): Promise<Buffer> {
    const content = await fs.promises.readFile(path, 'binary');
    return Buffer.from(content, 'binary');
  }

  removeFile(path: string): Promise<void> {
    return fs.promises.unlink(path);
  }

  renameFile(oldPath: string, newPath: string): Promise<void> {
    return fs.promises.rename(oldPath, newPath);
  }

  copyFile(from: string, to: string): Promise<void> {
    return fs.promises.copyFile(from, to);
  }

  copyFolder(from: string, to: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fse.copy(from, to, { recursive: true }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Read a JSON file, with utf-8 encoding.
   *
   * @param path
   * @returns
   */
  async readJson<T = any>(path: string): Promise<T> {
    const fileContent = await fs.promises.readFile(path, 'utf8');
    return JSON.parse(fileContent) as T;
  }

  async writeJson(path: string, obj: any): Promise<void> {
    const tmpFileName = path + '.tmp-' + Date.now();

    let jsonText = '';

    try {
      // Indented, not minified. `project.json` is the main thing written through
      // here, and a one-line project makes every graph edit a whole-file diff —
      // in a product that ships git integration, a graph merge driver (SUB-007)
      // and example projects it asks people to read. Two spaces matches the
      // repo's `tabWidth` and the examples that are already committed that way.
      jsonText = JSON.stringify(obj, null, 2);
    } catch (error) {
      console.log('Error serializing json', error);
      throw error;
    }

    try {
      await fs.promises.writeFile(tmpFileName, jsonText);
      await fs.promises.rename(tmpFileName, path);
    } catch (error) {
      await fs.promises.unlink(tmpFileName);
      console.log('Error writing json file', error);
      throw error;
    }
  }

  /**
   * Returns whether the folder is empty.
   *
   * @param path
   * @returns Returns true, if the folder is empty; Otherwise, false.
   */
  async isDirectoryEmpty(path: string): Promise<boolean> {
    const files = await this.listDirectory(path);
    return files.length === 0;
  }

  /**
   * List all entries in the directory.
   *
   * @param path
   * @returns A list of all entries.
   */
  async listDirectory(path: string): Promise<FileInfo[]> {
    const files = await fs.promises.readdir(path);
    return files.map(function (f) {
      return {
        fullPath: path + '/' + f,
        name: f,
        isDirectory: fs.lstatSync(path + '/' + f).isDirectory()
      };
    });
  }

  /**
   * Returns all the files including all sub folders.
   *
   * @param path
   * @returns
   */
  listDirectoryFiles(path: string): Promise<FileInfo[]> {
    // https://stackoverflow.com/a/5827895
    const walk = function (dir: string, done: (error: unknown, results?: string[]) => void) {
      let results = [];
      fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
          file = nodePath.resolve(dir, file);
          fs.stat(file, function (err, stat) {
            if (stat && stat.isDirectory()) {
              walk(file, function (err, res) {
                results = results.concat(res);
                if (!--pending) done(null, results);
              });
            } else {
              results.push(file);
              if (!--pending) done(null, results);
            }
          });
        });
      });
    };

    return new Promise<FileInfo[]>((resolve, reject) => {
      walk(path, function (error, files) {
        if (error) {
          reject(error);
        } else {
          resolve(
            files.map(function (fullPath) {
              const isDirectory = (function () {
                try {
                  return fs.lstatSync(fullPath).isDirectory();
                } catch (_err) {
                  return false;
                }
              })();

              return {
                fullPath,
                name: nodePath.basename(fullPath),
                isDirectory
              };
            })
          );
        }
      });
    });
  }

  /**
   * https://github.com/jprichardson/node-fs-extra/blob/HEAD/docs/ensureDir.md
   * @param path
   * @returns
   */
  makeDirectory(path: string): Promise<void> {
    if (path.length === 0 || fs.existsSync(path)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      mkdirp(path, function (err) {
        if (err) reject({ result: 'failure', err: err });
        else resolve();
      });
    });
  }

  removeDirRecursive(path: string): void {
    fse.removeSync(path);
  }

  openDialog(args: OpenDialogOptions): Promise<string> {
    throw new Error('Not Supported');
  }

  unzipUrl(url: string, to: string): Promise<void> {
    const _this = this;

    /**
     * The transport half. The writing half is {@link extractZipToFolder}, which
     * is module-level so a plain-Node spec can reach it — see its header.
     *
     * ⚠️ **The failure message is now the extractor's own**, not a fixed
     * "Failed to extract". A refused archive names the entry that refused it;
     * telling a user only that extraction failed, when we know exactly which
     * entry and why, is the silence this repo keeps paying for elsewhere.
     */
    function unzipToFolder(
      path: string,
      blob: any,
      callback: (_: { result: 'success' | 'failure'; message?: string }) => void
    ) {
      JSZip.loadAsync(blob)
        .then((zip) => extractZipToFolder(zip, path))
        .then(() => callback({ result: 'success' }))
        .catch((e) => callback({ result: 'failure', message: e instanceof Error ? e.message : undefined }));
    }

    /**
     * 🔴 **`isDirectoryEmpty` is `async`, and this guard used to read its
     * PROMISE.** `const isEmpty = this.isDirectoryEmpty(to)` without `await`
     * yields a Promise, a Promise is always truthy, and so `!isEmpty` was always
     * false: the "folder must be empty" refusal below **could not fire**, and had
     * not since it was written. An archive would extract straight over whatever
     * was already in the target.
     *
     * ⚠️ **The one reachable caller was masked.** `unzipIntoDirectory` performs
     * the same check itself, correctly awaited, before it calls this — so the
     * dead guard cost nothing through that route and everything through a direct
     * call, which is exactly what `TemplateRegistry.download` does.
     *
     * The check has to happen outside the executor because it is asynchronous;
     * a `new Promise(async (resolve, reject) => …)` would swallow a throw from
     * the awaited call instead of rejecting.
     */
    return this.isDirectoryEmpty(to).then((isEmpty) => {
      if (!isEmpty) {
        return Promise.reject({ result: 'failure', message: 'Folder must be empty' });
      }

      return new Promise<void>((resolve, reject) => {
        // Load zip file from URL
        // @ts-ignore XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = function (_e) {
          unzipToFolder(to, this.response, function (r) {
            if (r.result !== 'success') {
              reject({ result: 'failure', message: r.message ?? 'Failed to extract' });
              _this.removeDirRecursive(to);
              return;
            }

            resolve();
          });
        };

        /**
         * 🔴 **Without these, a transport failure settles this promise NEVER.**
         *
         * `onload` fires for an HTTP *response*, including a 404 — that case was
         * already handled, badly but finitely: the error body reaches JSZip, which
         * refuses it, and the caller gets 'Failed to extract'. What never fired was
         * the case with no response at all — offline, DNS failure, connection
         * refused, a `file://` URL that does not exist. `onerror` is the event for
         * those, and there was no handler, so `await filesystem.unzipUrl(...)`
         * simply never returned.
         *
         * ⚠️ **That is a hang on a reachable path, not a theoretical one.**
         * `unzipIntoDirectory` awaits this function and has four callers —
         * `modulelibrarymodel.installModule`/`installPrefab`, `LessonsProjectModel`,
         * `LocalProjectsModel` and `EditorPage._importProject`. Installing a module
         * from the library with the network down left the editor waiting forever,
         * and `unzipIntoDirectory`'s own try/catch was dead code for that case
         * because nothing ever rejected.
         *
         * ✅ The three events are spelled out rather than folded into one handler:
         * they are genuinely different failures, and NAT-013's trap — *"a refused
         * connection and a timeout are different measurements"* — is the reason to
         * keep them distinguishable in the message a user reads.
         *
         * ⚠️ **The target directory is left alone here, unlike the extract failure
         * above.** Nothing was written, and this function did not create it — the
         * caller did, and the caller's contract is that it hands over an empty
         * directory. Removing somebody else's directory on a failed download is a
         * second bug waiting for the day a caller passes something it still wants.
         */
        const failed = (message: string) => reject({ result: 'failure', message });

        xhr.onerror = function (_e) {
          failed(`Could not download the archive at ${url}. The network may be unavailable.`);
        };
        xhr.ontimeout = function (_e) {
          failed(`Timed out downloading the archive at ${url}.`);
        };
        xhr.onabort = function (_e) {
          failed(`The download of ${url} was cancelled.`);
        };

        xhr.send();
      });
    });
  }

  makeUniquePath(path: string): string {
    let _path = path;
    let count = 1;
    while (fs.existsSync(_path)) {
      _path = path + '-' + count;
      count++;
    }
    return _path;
  }
}
