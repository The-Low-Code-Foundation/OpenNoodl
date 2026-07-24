import path from 'path';
import { git } from './client';
import { setConfigValue } from './config';
import { DEFAULT_BRANCH } from '../constants';

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
}

/**
 * The paths the Noodl merge driver should own: the monolithic project file and
 * the three files each decomposed v2 component is written to.
 */
export const NOODL_MERGE_ATTRIBUTES = [
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
