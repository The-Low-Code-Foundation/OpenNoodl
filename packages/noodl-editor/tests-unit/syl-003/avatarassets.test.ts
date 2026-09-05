/**
 * SYL-003 AC3 — the chosen avatar becomes a file the project owns.
 *
 * The disk is injected, so what is graded is the naming and the routing. The file actually landing
 * is the drive.
 */
import {
  AssetWriteDeps,
  PROJECT_ASSETS_FOLDER,
  writeGeneratedAssetIntoProject
} from '../../src/editor/src/utils/projectAssets';

const PROJECT = '/Users/someone/projects/My App';

function fakeDisk(existing: string[] = []) {
  const files = new Set(existing);
  const made: string[] = [];
  const writes: Array<{ path: string; contents: string }> = [];

  const deps: AssetWriteDeps = {
    projectDirectory: PROJECT,
    exists: (p) => files.has(p),
    makeDirectory: async (p) => {
      made.push(p);
    },
    writeFile: async (p, contents) => {
      writes.push({ path: p, contents });
      files.add(p);
    }
  };

  return { deps, made, writes, files };
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"></svg>';

describe('SYL-003 AC3 — writing a generated avatar into the project', () => {
  it('creates assets/ and writes the file there, returning the project-relative path', async () => {
    const disk = fakeDisk();

    const result = await writeGeneratedAssetIntoProject(disk.deps, 'nibbles-thumbs.svg', SVG);

    expect(result).toEqual({ status: 'imported', projectRelativePath: 'assets/nibbles-thumbs.svg' });
    expect(disk.made).toEqual([`${PROJECT}/${PROJECT_ASSETS_FOLDER}`]);
    expect(disk.writes).toEqual([{ path: `${PROJECT}/assets/nibbles-thumbs.svg`, contents: SVG }]);
  });

  /**
   * 🔴 The counter goes BEFORE the extension, for the reason `projectAssets` opens with: the image
   * walk lists by extension, so `nibbles-thumbs.svg-1` would not appear in the picker that just
   * made it. A generated file is not exempt — two authors typing `Nibbles` into one project is the
   * ordinary case.
   */
  it('does not overwrite an avatar that is already there', async () => {
    const disk = fakeDisk([`${PROJECT}/assets/nibbles-thumbs.svg`]);

    const result = await writeGeneratedAssetIntoProject(disk.deps, 'nibbles-thumbs.svg', SVG);

    expect(result).toEqual({ status: 'imported', projectRelativePath: 'assets/nibbles-thumbs-1.svg' });
    expect(disk.writes[0].path).toBe(`${PROJECT}/assets/nibbles-thumbs-1.svg`);
    // The existing file is untouched.
    expect(disk.writes).toHaveLength(1);
  });

  it('refuses with a reason when there is no open project', async () => {
    const disk = fakeDisk();
    const result = await writeGeneratedAssetIntoProject(
      { ...disk.deps, projectDirectory: undefined as unknown as string },
      'nibbles-thumbs.svg',
      SVG
    );

    expect(result).toEqual({ status: 'failed', reason: 'There is no open project to save into.' });
    expect(disk.writes).toEqual([]);
  });

  it('refuses to write an empty picture rather than leaving a 0-byte asset selected', async () => {
    const disk = fakeDisk();
    const result = await writeGeneratedAssetIntoProject(disk.deps, 'nibbles-thumbs.svg', '');

    expect(result).toEqual({
      status: 'failed',
      reason: 'nibbles-thumbs.svg was empty, so it was not saved.'
    });
    expect(disk.writes).toEqual([]);
  });

  /**
   * 🔴 The failure path is live. `FileSystem.writeFile` is callback-style and returns `undefined`,
   * so the caller in `ImageType` has to wrap it into a promise that really rejects; this is the
   * half of that contract this side can grade — a rejecting disk must produce a reported failure
   * and NOT a committed path.
   */
  it('reports a disk that refused, instead of committing a path to nothing', async () => {
    const disk = fakeDisk();
    const result = await writeGeneratedAssetIntoProject(
      {
        ...disk.deps,
        writeFile: async () => {
          throw new Error('EACCES');
        }
      },
      'nibbles-thumbs.svg',
      SVG
    );

    expect(result).toEqual({
      status: 'failed',
      reason: 'nibbles-thumbs.svg could not be saved into assets/.'
    });
  });
});
