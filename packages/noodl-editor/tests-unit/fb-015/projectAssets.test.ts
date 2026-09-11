/**
 * FB-015 AC2 — copying a chosen file into the project under `assets/`.
 *
 * The disk is injected, so what is graded here is the naming and the routing, which is where the
 * defects are. The copy actually landing is AC2's drive.
 */
import {
  AssetImportDeps,
  baseName,
  importFileIntoProjectAssets,
  isInsideProject,
  PROJECT_ASSETS_FOLDER,
  splitFileName,
  toProjectRelativePath,
  uniqueFileName
} from '../../src/editor/src/utils/projectAssets';

const PROJECT = '/Users/someone/projects/My App';

/** A disk that starts with the given absolute paths and records what was asked of it. */
function fakeDisk(existing: string[] = []) {
  const files = new Set(existing);
  const made: string[] = [];
  const copies: Array<{ from: string; to: string }> = [];

  const deps: AssetImportDeps = {
    projectDirectory: PROJECT,
    exists: (p) => files.has(p),
    makeDirectory: async (p) => {
      made.push(p);
    },
    copyFile: async (from, to) => {
      copies.push({ from, to });
      files.add(to);
    }
  };

  return { deps, made, copies, files };
}

describe('FB-015 AC2 — naming an imported asset', () => {
  it('splits an extension off, and leaves a dotfile alone', () => {
    expect(splitFileName('logo.png')).toEqual({ stem: 'logo', extension: '.png' });
    expect(splitFileName('hero.image.jpg')).toEqual({ stem: 'hero.image', extension: '.jpg' });
    expect(splitFileName('README')).toEqual({ stem: 'README', extension: '' });
    // A leading dot is a name, not an extension — `.gitignore` must not become `-1.gitignore`.
    expect(splitFileName('.gitignore')).toEqual({ stem: '.gitignore', extension: '' });
  });

  it('keeps the name when nothing claims it', () => {
    expect(uniqueFileName('logo.png', () => false)).toBe('logo.png');
  });

  /**
   * 🔴 THE POINT OF THIS MODULE. The platform's own `makeUniquePath` appends to the end of the
   * whole path, so `logo.png` becomes `logo.png-1` — which the image walk, filtering by
   * extension, would then never list. An imported file that does not appear in the picker that
   * imported it is exactly the bug FB-015 exists to remove, arriving by a different door.
   */
  it('inserts the counter BEFORE the extension, and keeps counting', () => {
    const taken = new Set(['logo.png', 'logo-1.png']);
    expect(uniqueFileName('logo.png', (c) => taken.has(c))).toBe('logo-2.png');
    expect(uniqueFileName('logo.png', (c) => taken.has(c)).endsWith('.png')).toBe(true);
  });

  it('reads the last path segment on either separator', () => {
    expect(baseName('/tmp/pictures/logo.png')).toBe('logo.png');
    expect(baseName('C:\\Users\\me\\logo.png')).toBe('logo.png');
  });
});

describe('FB-015 AC2 — where the file goes', () => {
  it('copies into assets/, creating the folder, and returns the project-relative path', async () => {
    const disk = fakeDisk();

    const result = await importFileIntoProjectAssets(disk.deps, '/tmp/pictures/logo.png');

    expect(result).toEqual({ status: 'imported', projectRelativePath: 'assets/logo.png' });
    expect(disk.made).toEqual([`${PROJECT}/${PROJECT_ASSETS_FOLDER}`]);
    expect(disk.copies).toEqual([{ from: '/tmp/pictures/logo.png', to: `${PROJECT}/assets/logo.png` }]);
  });

  it('does not overwrite an asset of the same name', async () => {
    const disk = fakeDisk([`${PROJECT}/assets/logo.png`]);

    const result = await importFileIntoProjectAssets(disk.deps, '/tmp/other/logo.png');

    expect(result).toEqual({ status: 'imported', projectRelativePath: 'assets/logo-1.png' });
    expect(disk.copies[0].to).toBe(`${PROJECT}/assets/logo-1.png`);
    // The existing file is untouched — nothing was copied over it.
    expect(disk.copies.some((c) => c.to === `${PROJECT}/assets/logo.png`)).toBe(false);
  });

  it('leaves a file that is already in the project where it is, and still selects it', async () => {
    const disk = fakeDisk();

    const result = await importFileIntoProjectAssets(disk.deps, `${PROJECT}/pictures/hero.png`);

    expect(result).toEqual({ status: 'already-in-project', projectRelativePath: 'pictures/hero.png' });
    expect(disk.copies).toEqual([]);
    expect(disk.made).toEqual([]);
  });

  /**
   * 🔴 A path-anchored check, not a substring one. `/Users/someone/projects/My App Backup/x.png`
   * starts with the project path as a *string* and is a different project.
   */
  it('does not mistake a sibling directory with a shared prefix for the project', async () => {
    expect(isInsideProject(PROJECT, `${PROJECT} Backup/x.png`)).toBe(false);
    expect(isInsideProject(PROJECT, `${PROJECT}/x.png`)).toBe(true);

    const disk = fakeDisk();
    const result = await importFileIntoProjectAssets(disk.deps, `${PROJECT} Backup/x.png`);
    expect(result.status).toBe('imported');
  });

  it('reports a failed copy rather than reporting success', async () => {
    const disk = fakeDisk();
    disk.deps.copyFile = async () => {
      throw new Error('EACCES');
    };

    const result = await importFileIntoProjectAssets(disk.deps, '/tmp/pictures/logo.png');

    expect(result.status).toBe('failed');
    expect(result.status === 'failed' && result.reason).toContain('logo.png');
  });

  it('reports a failed mkdir rather than copying into nowhere', async () => {
    const disk = fakeDisk();
    disk.deps.makeDirectory = async () => {
      throw new Error('EROFS');
    };

    const result = await importFileIntoProjectAssets(disk.deps, '/tmp/pictures/logo.png');

    expect(result.status).toBe('failed');
    expect(disk.copies).toEqual([]);
  });

  it('refuses when there is no open project', async () => {
    const disk = fakeDisk();
    disk.deps.projectDirectory = '';

    expect((await importFileIntoProjectAssets(disk.deps, '/tmp/logo.png')).status).toBe('failed');
  });

  it('stores a project path with forward slashes whatever the host uses', () => {
    expect(toProjectRelativePath('C:\\p\\App', 'C:\\p\\App\\assets\\logo.png')).toBe('assets/logo.png');
  });
});
