/**
 * A real filesystem, wired into `@noodl/platform`'s injectable singleton.
 *
 * `filesystem` is a module-level `let` set through `setFileSystem` — the editor
 * installs the Electron implementation at boot, and nothing installs one under
 * plain-Node jest. So a model that reaches for `filesystem` has to be given one.
 *
 * ⚠️ **This is an adapter over Node's real `fs`, not an in-memory fake.** The
 * behaviour `ProjectCodeFileModel` depends on — that a rename is atomic, that a
 * read after an external write returns the new bytes — is behaviour of an actual
 * filesystem. A fake would let the model pass while the property it relies on
 * was never exercised.
 *
 * Only the methods the model actually calls are implemented; anything else
 * throws rather than silently returning a plausible value.
 */

import * as fs from 'fs';
import * as nodePath from 'path';

import { setFileSystem } from '@noodl/platform';

function notImplemented(name: string): never {
  throw new Error(`testFileSystem: ${name} is not implemented — add it deliberately, do not stub it silently.`);
}

export function installTestFileSystem(): void {
  const impl = {
    resolve: (...parts: string[]) => nodePath.resolve(...parts),
    join: (...parts: string[]) => nodePath.join(...parts),
    dirname: (p: string) => nodePath.dirname(p),
    basename: (p: string) => nodePath.basename(p),
    exists: (p: string) => fs.existsSync(p),
    file: (p: string) => ({ size: fs.statSync(p).size }),

    readFile: async (p: string) => fs.promises.readFile(p, 'utf8'),
    writeFile: async (p: string, content: string) => {
      await fs.promises.writeFile(p, content, 'utf8');
    },
    writeFileOverride: async (p: string, content: string) => {
      await fs.promises.writeFile(p, content, 'utf8');
    },
    renameFile: async (from: string, to: string) => {
      await fs.promises.rename(from, to);
    },
    removeFile: async (p: string) => {
      await fs.promises.rm(p, { force: true });
    },
    makeDirectory: async (p: string) => {
      await fs.promises.mkdir(p, { recursive: true });
    },
    listDirectory: () => notImplemented('listDirectory'),
    listDirectoryFiles: () => notImplemented('listDirectoryFiles'),
    readBinaryFile: () => notImplemented('readBinaryFile'),
    readJson: () => notImplemented('readJson'),
    writeJson: () => notImplemented('writeJson'),
    copyFile: () => notImplemented('copyFile'),
    copyFolder: () => notImplemented('copyFolder'),
    isDirectoryEmpty: () => notImplemented('isDirectoryEmpty'),
    removeDirRecursive: () => notImplemented('removeDirRecursive'),
    openDialog: () => notImplemented('openDialog'),
    unzipUrl: () => notImplemented('unzipUrl'),
    makeUniquePath: () => notImplemented('makeUniquePath')
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFileSystem(impl as any);
}
