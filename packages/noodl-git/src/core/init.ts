import path from 'path';
import { git } from './client';
import { setConfigValue } from './config';
import { DEFAULT_BRANCH } from '../constants';

/**
 * The `diff=noodl` textconv command, or undefined when this process cannot
 * name a runnable one.
 *
 * ⚠️ Not the merge driver's command. Textconv runs once per blob per revision
 * — `git log -p` over one component's history invokes it dozens of times — so
 * booting the full Electron app for each one is the difference between a diff
 * people read and a diff nobody waits for. Both routes below run the driver as
 * plain Node:
 *
 *  - in a checkout, `node` is on the PATH and can run the source directly;
 *  - in a packaged app there is no `node`, but the Electron binary becomes one
 *    under `ELECTRON_RUN_AS_NODE=1`, which skips Chromium entirely.
 *
 * Returning undefined is a safe outcome, not a failure: `diff=noodl` in
 * `.gitattributes` with no `diff.noodl.textconv` configured is an unknown
 * driver, which git ignores and falls back to a normal JSON diff for. A wrong
 * command would be far worse — git reports a failing textconv as an error on an
 * otherwise ordinary `git log`.
 */
function textconvCommand(): string | undefined {
  if (process.env.devMode) {
    // Same assumption the merge driver's dev branch already makes: the editor's
    // cwd is `packages/noodl-editor`. The source is used rather than
    // `main.bundle.js` so a stale or missing bundle cannot break `git log`.
    const cli = path.join(process.cwd(), '..', 'noodl-git', 'src', 'textconv', 'cli.js');
    return `node "${cli}" --textconv`;
  }

  // `appPath` is set beside `exePath` in main.js at boot. An editor built
  // before that is the case where we install nothing.
  if (!process.env.exePath || !process.env.appPath) return undefined;

  const bundle = path.join(process.env.appPath, 'src', 'main', 'main.bundle.js');
  return `ELECTRON_RUN_AS_NODE=1 "${process.env.exePath}" "${bundle}" --textconv`;
}

export async function installMergeDriver(repositoryDir: string) {
  const driverPath = process.env.devMode
    ? `"${path.join(process.cwd(), 'electron')}"` + ' ' + `"${process.cwd()}"`
    : `"${process.env.exePath}"`;

  // %P is the path of the file being merged. Without it the driver only sees
  // three temp files and cannot tell a monolithic project.json from one of the
  // three files of a decomposed v2 component (SUB-007). Repositories set up
  // before this gain the argument automatically — _setupRepository rewrites
  // the config on every Git instance.
  const driver = `${driverPath} --merge %O %A %B %L %P`;
  await setConfigValue(
    repositoryDir,
    'merge.noodl.name',
    'Merge driver installed by Noodl to merge project graphs semantically.'
  );
  await setConfigValue(repositoryDir, 'merge.noodl.driver', driver);

  // LEG-004 — the same four paths, read rather than merged. This is the whole
  // distribution story for `diff=noodl`: _setupRepository calls this function on
  // every Git instance, so a repository opened once in the editor gains the
  // textconv without the user configuring anything.
  const textconv = textconvCommand();
  if (textconv) {
    await setConfigValue(
      repositoryDir,
      'diff.noodl.name',
      'Diff driver installed by NodeGX to render project graphs as text.'
    );
    await setConfigValue(repositoryDir, 'diff.noodl.textconv', textconv);
    // Deliberately NOT `diff.noodl.cachetextconv`. Git keys that cache on the
    // blob sha alone, so every rendering ever produced would survive a change
    // to the renderer and a reader would be shown output no version of the code
    // still emits. The cost of leaving it off is measured in LEG-004's register.
  }
}

/**
 * The paths the Noodl graph drivers should own: the monolithic project file and
 * the three files each decomposed v2 component is written to.
 *
 * `merge=noodl` picks the semantic merge driver; `diff=noodl` picks the LEG-004
 * textconv, which renders one file as stable, line-oriented text so that
 * `git diff`, `git log -p`, `git show` and `git blame` on the command line show
 * named nodes instead of JSON.
 */
export const NOODL_GRAPH_ATTRIBUTES = [
  // ⚠️ This note ships into the user's own repository, which is the only place
  // it is certain to be read. It says "command line" because that is the exact
  // limit of what LEG-004 delivers: `textconv` is a local git feature, and no
  // forge's web diff runs it. A pull request on GitHub still shows raw JSON.
  '# NodeGX renders these files as readable graphs in `git diff`, `git log -p`,',
  '# `git show` and `git blame` ON THE COMMAND LINE, for anyone who has opened',
  '# this project in the NodeGX editor. Web diffs (GitHub, GitLab) do not run',
  '# textconv and are unaffected. `git blame` changes what is displayed, not',
  '# what is attributed: line attribution is still computed on the stored JSON.',
  'project.json merge=noodl diff=noodl',
  'components/**/component.json merge=noodl diff=noodl',
  'components/**/nodes.json merge=noodl diff=noodl',
  'components/**/connections.json merge=noodl diff=noodl'
];

/**
 * Attribute lines these supersede. Without this, `appendGitAttributes` would
 * see `project.json merge=noodl` and `project.json merge=noodl diff=noodl` as
 * two different lines and keep both. Git would still do the right thing (the
 * last matching line wins), but every repository set up before LEG-004 would
 * carry eight lines saying what four say.
 */
export const NOODL_SUPERSEDED_GRAPH_ATTRIBUTES = [
  'project.json merge=noodl',
  'components/**/component.json merge=noodl',
  'components/**/nodes.json merge=noodl',
  'components/**/connections.json merge=noodl'
];

export interface InitOptions {
  bare?: boolean;
}

export async function init(repositoryDir: string, options?: InitOptions): Promise<string> {
  const args = ['-c', `init.defaultBranch=${DEFAULT_BRANCH}`, 'init'];

  if (options?.bare) {
    args.push('--bare');
  }

  await git(args, repositoryDir, 'init');

  return repositoryDir;
}
