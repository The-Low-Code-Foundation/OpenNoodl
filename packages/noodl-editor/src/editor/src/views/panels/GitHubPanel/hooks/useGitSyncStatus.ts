/**
 * useGitSyncStatus Hook
 *
 * Monitors git sync status including ahead/behind counts and uncommitted changes.
 * Provides push/pull functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { Git } from '@noodl/git';

import { ProjectModel } from '@noodl-models/projectmodel';
import { LocalProjectsModel } from '@noodl-utils/LocalProjectsModel';
import { mergeProject } from '@noodl-utils/projectmerger';

export interface GitSyncStatus {
  /** Number of commits ahead of remote */
  ahead: number;
  /** Number of commits behind remote */
  behind: number;
  /** Whether there are uncommitted changes */
  hasUncommittedChanges: boolean;
  /** Whether we're currently loading status */
  loading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Whether a push/pull operation is in progress */
  isSyncing: boolean;
}

interface UseGitSyncStatusResult extends GitSyncStatus {
  /** Push local commits to remote */
  push: () => Promise<void>;
  /** Pull remote commits to local */
  pull: () => Promise<void>;
  /** Refresh the sync status */
  refresh: () => Promise<void>;
}

export function useGitSyncStatus(): UseGitSyncStatusResult {
  const [status, setStatus] = useState<GitSyncStatus>({
    ahead: 0,
    behind: 0,
    hasUncommittedChanges: false,
    loading: true,
    error: null,
    isSyncing: false
  });

  const fetchStatus = useCallback(async () => {
    const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;
    if (!projectDirectory) {
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: 'No project directory'
      }));
      return;
    }

    try {
      // Ensure git auth is set up
      const projectId = ProjectModel.instance?.id || 'temp';
      LocalProjectsModel.instance.setCurrentGlobalGitAuth(projectId);

      const git = new Git(mergeProject);
      await git.openRepository(projectDirectory);

      // Check for remote
      const remoteName = await git.getRemoteName();
      if (!remoteName) {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: 'No remote configured'
        }));
        return;
      }

      // Fetch latest from remote (silently)
      try {
        await git.fetch({ onProgress: () => {} });
      } catch (fetchError) {
        console.warn('[useGitSyncStatus] Fetch warning:', fetchError);
        // Continue anyway - might be offline
      }

      // Get ahead/behind counts
      let ahead = 0;
      let behind = 0;
      try {
        const aheadBehind = await git.currentAheadBehind();
        ahead = aheadBehind.ahead;
        behind = aheadBehind.behind;
      } catch (abError) {
        console.warn('[useGitSyncStatus] Could not get ahead/behind:', abError);
        // Remote might not have any commits yet
      }

      // Check for uncommitted changes
      const changes = await git.status();
      const hasUncommittedChanges = changes.length > 0;

      setStatus({
        ahead,
        behind,
        hasUncommittedChanges,
        loading: false,
        error: null,
        isSyncing: false
      });
    } catch (error) {
      console.error('[useGitSyncStatus] Error:', error);
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status'
      }));
    }
  }, []);

  const push = useCallback(async () => {
    const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;
    if (!projectDirectory) {
      throw new Error('No project directory');
    }

    setStatus((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      // Ensure git auth is set up
      const projectId = ProjectModel.instance?.id || 'temp';
      LocalProjectsModel.instance.setCurrentGlobalGitAuth(projectId);

      const git = new Git(mergeProject);
      await git.openRepository(projectDirectory);

      // Check for uncommitted changes first
      const changes = await git.status();
      if (changes.length > 0) {
        // Auto-commit changes before pushing
        console.log('[useGitSyncStatus] Committing changes before push...');
        await git.commit('Auto-commit before push');
      }

      console.log('[useGitSyncStatus] Pushing to remote...');
      await git.push();
      console.log('[useGitSyncStatus] Push successful');

      // Refresh status
      await fetchStatus();
    } catch (error) {
      console.error('[useGitSyncStatus] Push error:', error);
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Push failed'
      }));
      throw error;
    }
  }, [fetchStatus]);

  const pull = useCallback(async () => {
    const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;
    if (!projectDirectory) {
      throw new Error('No project directory');
    }

    setStatus((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      // Ensure git auth is set up
      const projectId = ProjectModel.instance?.id || 'temp';
      LocalProjectsModel.instance.setCurrentGlobalGitAuth(projectId);

      const git = new Git(mergeProject);
      await git.openRepository(projectDirectory);

      // Stash any uncommitted changes
      const changes = await git.status();
      const needsStash = changes.length > 0;

      if (needsStash) {
        console.log('[useGitSyncStatus] Stashing local changes...');
        await git.stashPushChanges();
      }

      // Fetch and merge
      console.log('[useGitSyncStatus] Fetching from remote...');
      await git.fetch({ onProgress: () => {} });

      // Get current branch
      const branchName = await git.getCurrentBranchName();
      const remoteBranch = `origin/${branchName}`;

      console.log('[useGitSyncStatus] Merging', remoteBranch, 'into', branchName);
      await git.mergeToCurrentBranch(remoteBranch, false);

      // Pop stash if we stashed
      if (needsStash) {
        console.log('[useGitSyncStatus] Restoring stashed changes...');
        await git.stashPopChanges();
      }

      console.log('[useGitSyncStatus] Pull successful');

      // Refresh status
      await fetchStatus();

      // Notify project to reload
      ProjectModel.instance?.notifyListeners('projectMightNeedRefresh');
    } catch (error) {
      console.error('[useGitSyncStatus] Pull error:', error);
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Pull failed'
      }));
      throw error;
    }
  }, [fetchStatus]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh on project changes
  useEffect(() => {
    const handleProjectChange = () => {
      fetchStatus();
    };

    ProjectModel.instance?.on('projectSaved', handleProjectChange);
    ProjectModel.instance?.on('remoteChanged', handleProjectChange);

    return () => {
      ProjectModel.instance?.off(handleProjectChange);
    };
  }, [fetchStatus]);

  return {
    ...status,
    push,
    pull,
    refresh: fetchStatus
  };
}
