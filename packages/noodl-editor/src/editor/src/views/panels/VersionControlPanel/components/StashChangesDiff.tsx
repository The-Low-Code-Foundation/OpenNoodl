import {ProjectDiff, diffProject} from '@noodl-utils/projectmerger.diff';
import React, { useEffect, useState } from 'react';
import { FileChange } from '@noodl/git/src/core/models/status';
import { ProjectModel } from '@noodl-models/projectmodel';
import { SnapshotEntry, Stash } from '@noodl/git/src/core/models/snapshot';
import { useVersionControlContext } from '../context';
import { getProjectRootInRepo } from '../context/DiffUtils';
import { GraphProjectDiff, safeGraphDiff } from '../context/graphDiff';
import { readProjectFromSnapshot } from '../context/snapshotProject';
import { getCommit } from '@noodl/git/src/core/logs';
import { DiffList } from './DiffList';

export interface StashChangesDiffProps {
  stash: Stash;
}

export function StashChangesDiff({ stash }: StashChangesDiffProps) {
  const [diff, setDiff] = useState<ProjectDiff>(null);
  const [graphDiff, setGraphDiff] = useState<GraphProjectDiff>(null);
  const [commitFiles, setCommitFiles] = useState<readonly FileChange[]>(null);

  const { repositoryPath, fetch } = useVersionControlContext();

  useEffect(() => {
    //This component might re-render with a new diff, so reset diff to show loading indicator again
    setDiff(null);
    setGraphDiff(null);
    setCommitFiles(null);

    if (!fetch.currentCommitSha) {
      return;
    }

    async function doDiff() {
      // A stash is taken over the whole repository, so the project sits at the
      // same root here as it does in a commit.
      const root = getProjectRootInRepo(repositoryPath, ProjectModel.instance._retainedProjectDirectory);
      const getProjectFile = (snapshot: SnapshotEntry) => readProjectFromSnapshot(snapshot, root);

      const commit = await getCommit(repositoryPath, fetch.currentCommitSha);

      const files = await stash.getFiles();
      setCommitFiles(files);

      const [thisProject, otherProject] = await Promise.all([getProjectFile(commit), getProjectFile(stash)]);
      const diff = diffProject(otherProject, thisProject);
      setDiff(diff);
      setGraphDiff(safeGraphDiff(otherProject, thisProject));
    }

    doDiff();
  }, [stash]);

  return (
    <DiffList
      diff={diff}
      graphDiff={graphDiff}
      fileChanges={commitFiles}
      componentDiffTitle={`Changes made in stash #${stash.sha.slice(0, 7)} by ${stash.author.name}`}
    />
  );
}
