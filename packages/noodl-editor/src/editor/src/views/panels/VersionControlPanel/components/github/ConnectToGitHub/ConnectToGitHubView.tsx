/**
 * ConnectToGitHubView
 *
 * Displays appropriate UI based on project's git state:
 * - no-git: Offer to initialize git and create/connect repo
 * - git-no-remote: Offer to create or connect to existing repo
 * - remote-not-github: Show info that it's not a GitHub repo
 */

import React, { useState, useCallback } from 'react';
import { Git } from '@noodl/git';

import { ProjectModel } from '@noodl-models/projectmodel';
import { LocalProjectsModel } from '@noodl-utils/LocalProjectsModel';
import { mergeProject, mergeV2ComponentFiles } from '@noodl-versioning';

import { GitHubClient, GitHubOAuthService } from '../../../../../../services/github';
import type { ProjectGitState } from '../../../hooks/useGitHubRepository';
import styles from './ConnectToGitHub.module.scss';
import { CreateRepoModal } from './CreateRepoModal';
import { SelectRepoModal } from './SelectRepoModal';

interface ConnectToGitHubViewProps {
  gitState: ProjectGitState;
  remoteUrl?: string | null;
  provider?: string | null;
  onConnected: () => void;
}

export function ConnectToGitHubView({ gitState, remoteUrl, provider, onConnected }: ConnectToGitHubViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGitHubConnected = GitHubOAuthService.instance.isAuthenticated();

  const handleConnectGitHub = async () => {
    try {
      await GitHubOAuthService.instance.initiateOAuth();
    } catch (err) {
      console.error('Failed to initiate GitHub OAuth:', err);
      setError('Failed to connect to GitHub. Please try again.');
    }
  };

  const handleCreateRepo = useCallback(
    async (options: { name: string; description?: string; private?: boolean; org?: string }) => {
      setIsConnecting(true);
      setError(null);

      try {
        const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;
        if (!projectDirectory) {
          throw new Error('No project directory found');
        }

        console.log('🔧 [ConnectToGitHub] Creating repository:', options);

        // 1. Create repo on GitHub
        const client = GitHubClient.instance;
        const result = await client.createRepository({
          name: options.name,
          description: options.description,
          private: options.private ?? true,
          org: options.org
        });

        const repoUrl = result.data.html_url + '.git';
        console.log('✅ [ConnectToGitHub] Repository created:', repoUrl);

        // 2. Set up git auth before any git operations
        const projectId = ProjectModel.instance?.id || 'temp';
        console.log('🔧 [ConnectToGitHub] Setting up git auth for project:', projectId);
        LocalProjectsModel.instance.setCurrentGlobalGitAuth(projectId);

        // 3. Initialize git if needed
        const git = new Git(mergeProject, mergeV2ComponentFiles);

        if (gitState === 'no-git') {
          console.log('🔧 [ConnectToGitHub] Initializing git repository...');
          await git.initNewRepo(projectDirectory);
        } else {
          await git.openRepository(projectDirectory);
        }

        // 3. Add remote
        console.log('🔧 [ConnectToGitHub] Adding remote origin:', repoUrl);
        await git.setRemoteURL(repoUrl);

        // 4. Make initial commit if there are changes
        const status = await git.status();
        if (status.length > 0 || gitState === 'no-git') {
          console.log('🔧 [ConnectToGitHub] Creating initial commit...');
          await git.commit('Initial commit');
        }

        // 5. Push to remote
        console.log('🔧 [ConnectToGitHub] Pushing to remote...');
        await git.push();

        console.log('✅ [ConnectToGitHub] Successfully connected to GitHub!');

        // Notify parent
        setShowCreateModal(false);
        onConnected();
      } catch (err) {
        console.error('❌ [ConnectToGitHub] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to create repository');
      } finally {
        setIsConnecting(false);
      }
    },
    [gitState, onConnected]
  );

  const handleSelectRepo = useCallback(
    async (repoUrl: string) => {
      setIsConnecting(true);
      setError(null);

      try {
        const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;
        if (!projectDirectory) {
          throw new Error('No project directory found');
        }

        console.log('🔧 [ConnectToGitHub] Connecting to existing repo:', repoUrl);

        // Set up git auth before any git operations
        const projectId = ProjectModel.instance?.id || 'temp';
        console.log('🔧 [ConnectToGitHub] Setting up git auth for project:', projectId);
        LocalProjectsModel.instance.setCurrentGlobalGitAuth(projectId);

        // Initialize git if needed
        const git = new Git(mergeProject, mergeV2ComponentFiles);

        if (gitState === 'no-git') {
          console.log('🔧 [ConnectToGitHub] Initializing git repository...');
          await git.initNewRepo(projectDirectory);
        } else {
          await git.openRepository(projectDirectory);
        }

        // Add remote
        console.log('🔧 [ConnectToGitHub] Setting remote URL:', repoUrl);
        await git.setRemoteURL(repoUrl);

        // Fetch from remote to see if there are existing commits
        try {
          console.log('🔧 [ConnectToGitHub] Fetching from remote...');
          await git.fetch({ onProgress: () => {} });

          // Check if remote has commits
          const hasRemote = await git.hasRemoteCommits();
          if (hasRemote) {
            console.log('🔧 [ConnectToGitHub] Remote has commits, attempting to merge...');
            // Pull changes
            await git.mergeToCurrentBranch('origin/main', false);
          }
        } catch (fetchErr) {
          // Remote might be empty, that's okay
          console.log('⚠️ [ConnectToGitHub] Fetch warning (might be empty repo):', fetchErr);
        }

        console.log('✅ [ConnectToGitHub] Successfully connected to GitHub!');

        setShowSelectModal(false);
        onConnected();
      } catch (err) {
        console.error('❌ [ConnectToGitHub] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to repository');
      } finally {
        setIsConnecting(false);
      }
    },
    [gitState, onConnected]
  );

  // If not connected to GitHub, show connect button
  if (!isGitHubConnected) {
    return (
      <div className={styles.ConnectView}>
        <div className={styles.Icon}>
          <GitHubIcon />
        </div>
        <h3>Connect to GitHub</h3>
        <p>Connect your GitHub account to create or link repositories.</p>
        <button className={styles.PrimaryButton} onClick={handleConnectGitHub}>
          Connect GitHub Account
        </button>
      </div>
    );
  }

  // Show state-specific UI
  return (
    <div className={styles.ConnectView}>
      {gitState === 'no-git' && (
        <>
          <div className={styles.Icon}>
            <FolderIcon />
          </div>
          <h3>Initialize Git Repository</h3>
          <p>This project is not under version control. Initialize git and connect to GitHub.</p>
        </>
      )}

      {gitState === 'git-no-remote' && (
        <>
          <div className={styles.Icon}>
            <GitIcon />
          </div>
          <h3>Connect to GitHub</h3>
          <p>This project has git initialized but no remote. Connect it to a GitHub repository.</p>
        </>
      )}

      {gitState === 'remote-not-github' && (
        <>
          <div className={styles.Icon}>
            <CloudIcon />
          </div>
          <h3>Not a GitHub Repository</h3>
          <p>
            This project is connected to a different git provider:
            <br />
            <code className={styles.RemoteUrl}>{remoteUrl || provider}</code>
          </p>
          <p className={styles.HintText}>
            To use GitHub features, you will need to change the remote or create a new GitHub repository.
          </p>
        </>
      )}

      {error && <div className={styles.ErrorMessage}>{error}</div>}

      {gitState !== 'remote-not-github' && (
        <div className={styles.Actions}>
          <button className={styles.PrimaryButton} onClick={() => setShowCreateModal(true)} disabled={isConnecting}>
            Create New Repository
          </button>
          <button className={styles.SecondaryButton} onClick={() => setShowSelectModal(true)} disabled={isConnecting}>
            Connect Existing Repository
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreateRepoModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRepo}
          isCreating={isConnecting}
        />
      )}

      {showSelectModal && (
        <SelectRepoModal
          onClose={() => setShowSelectModal(false)}
          onSelect={handleSelectRepo}
          isConnecting={isConnecting}
        />
      )}
    </div>
  );
}

// Simple icon components
function GitHubIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function GitIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.546 10.93L13.067.452c-.604-.603-1.582-.603-2.188 0L8.708 2.627l2.76 2.76c.645-.215 1.379-.07 1.889.441.516.515.658 1.258.438 1.9l2.658 2.66c.645-.223 1.387-.078 1.9.435.721.72.721 1.884 0 2.604-.719.719-1.881.719-2.6 0-.539-.541-.674-1.337-.404-1.996L12.86 8.955v6.525c.176.086.342.203.488.348.713.721.713 1.883 0 2.6-.719.721-1.889.721-2.609 0-.719-.719-.719-1.879 0-2.598.182-.18.387-.316.605-.406V8.835c-.217-.091-.424-.222-.6-.401-.545-.545-.676-1.342-.396-2.009L7.636 3.7.45 10.881c-.6.605-.6 1.584 0 2.189l10.48 10.477c.604.604 1.582.604 2.186 0l10.43-10.43c.605-.603.605-1.582 0-2.187" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
}
