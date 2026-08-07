import { IMergeTreeEntry, MergeTreeError } from './core/models/merge';
import { getFileContents } from './core/cat-file';
import { addAll } from './core/add';

import path from 'path';
import fs from 'fs';

function tryParseJson(str: string | null) {
  if (str === null) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

type JSON_OBJECT = {
  [key: string]: any;
};

/** Merge the project.json file */
export type MergeStrategyFunc = (ancestors: JSON_OBJECT, ours: JSON_OBJECT, theirs: JSON_OBJECT) => JSON_OBJECT;

/** The three files a decomposed v2 component is written to. */
export interface V2ComponentFileSet {
  component?: JSON_OBJECT;
  nodes?: JSON_OBJECT;
  connections?: JSON_OBJECT;
}

/**
 * Merge one v2 component with all three of its files at once. Doing them
 * together is what makes cross-file cases visible — a connection whose
 * endpoint node the other side deleted cannot be seen from connections.json
 * alone.
 */
export type MergeV2ComponentFunc = (
  ancestors: V2ComponentFileSet,
  ours: V2ComponentFileSet,
  theirs: V2ComponentFileSet
) => { files: Required<V2ComponentFileSet> };

const V2_FILE_NAMES = ['component.json', 'nodes.json', 'connections.json'] as const;
type V2FileName = (typeof V2_FILE_NAMES)[number];

function v2FileNameOf(filePath: string): V2FileName | undefined {
  const name = filePath.split('/').pop() as V2FileName;
  return V2_FILE_NAMES.includes(name) ? name : undefined;
}

function componentDirOf(filePath: string): string {
  return filePath.split('/').slice(0, -1).join('/');
}

/**
 * Defines the Noodl custom merge strategy.
 */
export class MergeStrategy {
  constructor(
    public readonly repositoryDir: string,
    private readonly mergeProject: MergeStrategyFunc,
    public readonly strategy: 'our' | 'their' = 'our',
    /**
     * Supplied by the editor (SUB-007). Without it, v2 component files fall
     * back to taking one side wholesale, which is what happened before.
     */
    private readonly mergeV2Component?: MergeV2ComponentFunc
  ) {}

  public async solveConflicts(tree: MergeTreeError) {
    const projectJsonFiles = new Set<IMergeTreeEntry>(); //handle repos with multiple noodl projects
    const otherFiles = new Set<IMergeTreeEntry>();
    // v2 component files are grouped by their component directory so all three
    // are merged as one graph rather than three unrelated JSON documents.
    const v2Components = new Map<string, Map<V2FileName, IMergeTreeEntry>>();

    for (const entry of tree.conflictedEntries) {
      if (entry.hasConflicts) {
        const parent = entry.base || entry.our || entry.their;
        const v2Name = this.mergeV2Component ? v2FileNameOf(parent.path) : undefined;

        if (parent.path === 'project.json' || parent.path.slice(-13) === '/project.json') {
          projectJsonFiles.add(entry);
        } else if (v2Name) {
          const dir = componentDirOf(parent.path);
          const group = v2Components.get(dir) ?? new Map<V2FileName, IMergeTreeEntry>();
          group.set(v2Name, entry);
          v2Components.set(dir, group);
        } else {
          otherFiles.add(entry);
        }
      }
    }

    // Resolve conflicts
    const projectPromises = Array.from(projectJsonFiles).map((x) => this.resolveProjectJsonConflict(x));
    const v2Promises = Array.from(v2Components.entries()).map(([dir, group]) => this.resolveV2ComponentConflict(dir, group));
    const otherFilePromises = Array.from(otherFiles).map((x) => this.resolveFileConflict(x));

    const allPromises = [...projectPromises, ...v2Promises, ...otherFilePromises];
    await Promise.all(allPromises);

    // Mark all the file as resolved resolution
    await addAll(this.repositoryDir);

    // Return all files that were resolved
    const v2Entries = Array.from(v2Components.values()).flatMap((group) => Array.from(group.values()));
    return [...projectJsonFiles, ...v2Entries, ...otherFiles];
  }

  /**
   * Merge every conflicted file of one v2 component in a single pass, then
   * write all three back. Files of the component that were not conflicted are
   * read from the working tree so the merge sees the whole graph.
   */
  private async resolveV2ComponentConflict(componentDir: string, group: Map<V2FileName, IMergeTreeEntry>) {
    console.log('resolveV2ComponentConflict', componentDir);

    const sides: Record<'base' | 'our' | 'their', V2ComponentFileSet> = { base: {}, our: {}, their: {} };

    for (const fileName of V2_FILE_NAMES) {
      const key = fileName.replace('.json', '') as keyof V2ComponentFileSet;
      const entry = group.get(fileName);

      if (entry) {
        const [base, ours, theirs] = await Promise.all([
          entry.base ? getFileContents(this.repositoryDir, entry.base.sha) : Promise.resolve(null),
          entry.our ? getFileContents(this.repositoryDir, entry.our.sha) : Promise.resolve(null),
          entry.their ? getFileContents(this.repositoryDir, entry.their.sha) : Promise.resolve(null)
        ]);
        sides.base[key] = base ? tryParseJson(base.toString()) : undefined;
        sides.our[key] = ours ? tryParseJson(ours.toString()) : undefined;
        sides.their[key] = theirs ? tryParseJson(theirs.toString()) : undefined;
        continue;
      }

      // Not conflicted: the same content is on every side.
      const onDisk = tryParseJson(await readFileOrNull(path.join(this.repositoryDir, componentDir, fileName)));
      if (onDisk) {
        sides.base[key] = onDisk;
        sides.our[key] = onDisk;
        sides.their[key] = onDisk;
      }
    }

    const { files } = this.mergeV2Component(sides.base, sides.our, sides.their);

    await Promise.all(
      V2_FILE_NAMES.map((fileName) => {
        const key = fileName.replace('.json', '') as keyof V2ComponentFileSet;
        const content = files[key];
        if (!content) return Promise.resolve();
        return fs.promises.writeFile(
          path.join(this.repositoryDir, componentDir, fileName),
          JSON.stringify(content, null, 2)
        );
      })
    );
  }

  private async resolveFileConflict(entry: IMergeTreeEntry) {
    const parent = entry.base || entry.our || entry.their;
    console.log('resolveFileConflict', parent.path);

    const targetEntry = entry[this.strategy];
    console.log('vcs: resolving file conflict', targetEntry.path, 'using', this.strategy);
    const ourBlob = await getFileContents(this.repositoryDir, targetEntry.sha);

    const absolutePath = path.join(this.repositoryDir, parent.path);
    // Write our version of the file
    await fs.promises.writeFile(absolutePath, ourBlob);
  }

  private async resolveProjectJsonConflict(entry: IMergeTreeEntry) {
    const parent = entry.base || entry.our || entry.their;
    console.log('resolveProjectJsonConflict', parent.path);

    const results = await Promise.all([
      entry.base ? getFileContents(this.repositoryDir, entry.base.sha) : Promise.resolve('{}'),
      entry.our ? getFileContents(this.repositoryDir, entry.our.sha) : Promise.resolve('{}'),
      entry.their ? getFileContents(this.repositoryDir, entry.their.sha) : Promise.resolve('{}')
    ]);

    const ancestor = tryParseJson(results[0].toString());
    const ours = tryParseJson(results[1].toString());
    const theirs = tryParseJson(results[2].toString());

    if (!ancestor) {
      throw new Error("Failed to solve project.json conflict. Couldn't parse ancestor: " + results[0].toString());
    }
    if (!ours) {
      throw new Error("Failed to solve project.json conflict. Couldn't parse ours: " + results[1].toString());
    } else if (!theirs) {
      throw new Error("Failed to solve project.json conflict. Couldn't parse theirs: " + results[2].toString());
    }

    const mergedResult = this.mergeProject(ancestor, ours, theirs);

    const absolutePath = path.join(this.repositoryDir, parent.path);
    await fs.promises.writeFile(absolutePath, JSON.stringify(mergedResult));
  }
}
