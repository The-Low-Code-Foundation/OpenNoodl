import { Git } from '@noodl/git';

import { mergeProject, mergeV2ComponentFiles } from '@noodl-versioning';

import { ProjectModel } from '@noodl-models/projectmodel';

/**
 * Git stats used for deployment of frontend.
 *
 * WF-007: relocated from `models/CloudServices/GitStats.ts` — unrelated to
 * Parse, it just happened to live in that folder. Moved here (next to its
 * only consumer, `compilation.ts`) before the CloudServices folder was
 * deleted.
 */
export async function getGitStats() {
  try {
    const git = new Git(mergeProject, mergeV2ComponentFiles);
    await git.openRepository(ProjectModel.instance._retainedProjectDirectory);

    const gitBranch: string = await git.getCurrentBranchName();
    const gitSha: string = await git.getHeadCommitId();
    const gitLocalChanges: boolean = (await git.status()).length > 0;
    return { gitBranch, gitSha, gitLocalChanges };
  } catch (err) {
    console.error(err);
  }

  return {
    gitBranch: 'unknown',
    gitSha: 'unknown',
    gitLocalChanges: false
  };
}
