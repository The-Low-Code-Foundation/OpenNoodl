/**
 * GitHubRepos View
 *
 * Browse and clone Noodl projects from GitHub repositories.
 * Only shows repos that contain project.json or nodegx.project.json.
 *
 * @module noodl-core-ui/preview/launcher/Launcher/views
 */

import React, { useState, useMemo } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
import { NoodlGitHubRepo, GitHubOrgWithRepos } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useGitHubRepos';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

/**
 * GitHub repo card for display in clone list
 */
interface GitHubRepoCardProps {
  repo: NoodlGitHubRepo;
  onClone: (repo: NoodlGitHubRepo) => void;
  isCloning: boolean;
}

function GitHubRepoCard({ repo, onClone, isCloning }: GitHubRepoCardProps) {
  const updatedAt = new Date(repo.updated_at).toLocaleDateString();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-4)',
        padding: 'var(--spacing-3) var(--spacing-4)',
        backgroundColor: 'var(--theme-color-bg-3)',
        borderRadius: 'var(--radius-default)',
        border: '1px solid var(--theme-color-border-default)'
      }}
    >
      {/* Avatar */}
      <img
        src={repo.owner.avatar_url}
        alt={repo.owner.login}
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-default)'
        }}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 600, color: 'var(--theme-color-fg-default)' }}>{repo.name}</span>
          {repo.private && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: 'var(--theme-color-secondary-highlight)',
                borderRadius: 'var(--radius-small)',
                color: 'var(--theme-color-fg-default)'
              }}
            >
              Private
            </span>
          )}
          {repo.isNoodlProject && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: 'var(--theme-color-primary)',
                borderRadius: 'var(--radius-small)',
                color: 'white'
              }}
            >
              Noodl Project
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--theme-color-fg-default-shy)' }}>
          {repo.full_name} • Updated {updatedAt}
        </div>
        {repo.description && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--theme-color-fg-default-shy)',
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {repo.description}
          </div>
        )}
      </div>

      {/* Clone button */}
      <PrimaryButton
        label={isCloning ? 'Cloning...' : 'Clone'}
        size={PrimaryButtonSize.Small}
        variant={PrimaryButtonVariant.Muted}
        isDisabled={isCloning || repo.isCheckingNoodl}
        onClick={() => onClone(repo)}
      />
    </div>
  );
}

/**
 * Section header for organization
 */
function OrgSection({ org, children }: { org: GitHubOrgWithRepos; children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const noodlProjectCount = org.repos.filter((r) => r.isNoodlProject === true).length;

  return (
    <Box hasBottomSpacing={4}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--theme-color-fg-default)'
        }}
      >
        <img src={org.avatar_url} alt={org.login} style={{ width: 24, height: 24, borderRadius: '4px' }} />
        <span style={{ fontWeight: 600, flex: 1, textAlign: 'left' }}>{org.login}</span>
        <span style={{ fontSize: '12px', color: 'var(--theme-color-fg-default-shy)' }}>
          {noodlProjectCount} {noodlProjectCount === 1 ? 'project' : 'projects'}
        </span>
        <Icon icon={isExpanded ? IconName.CaretDown : IconName.CaretRight} />
      </button>
      {isExpanded && <div style={{ paddingLeft: '16px' }}>{children}</div>}
    </Box>
  );
}

/**
 * Empty state when no Noodl projects found
 */
function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px',
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: '48px' }}>
        <Icon icon={IconName.FolderOpen} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--theme-color-fg-default)', marginTop: '16px' }}>
        No Noodl Projects Found
      </h3>
      <p
        style={{
          color: 'var(--theme-color-fg-default-shy)',
          marginTop: '8px',
          maxWidth: '400px',
          lineHeight: 1.5
        }}
      >
        No repositories with project.json were found in your GitHub account. Noodl projects contain a project.json file
        in the root directory.
      </p>
    </div>
  );
}

/**
 * Connect GitHub prompt when not authenticated
 */
function ConnectGitHubPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px',
        textAlign: 'center'
      }}
    >
      <div style={{ fontSize: '48px' }}>
        <Icon icon={IconName.CloudFunction} />
      </div>
      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--theme-color-fg-default)', marginTop: '16px' }}>
        Connect GitHub
      </h3>
      <p
        style={{
          color: 'var(--theme-color-fg-default-shy)',
          marginTop: '8px',
          maxWidth: '400px',
          lineHeight: 1.5
        }}
      >
        Connect your GitHub account to browse and clone your Noodl projects.
      </p>
      <Box hasTopSpacing={4}>
        <PrimaryButton label="Connect GitHub" onClick={onConnect} />
      </Box>
    </div>
  );
}

/**
 * Loading spinner
 */
function LoadingState() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px',
        gap: '12px'
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: '2px solid var(--theme-color-border-default)',
          borderTopColor: 'var(--theme-color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      />
      <span style={{ color: 'var(--theme-color-fg-default-shy)' }}>Loading repositories...</span>
    </div>
  );
}

export interface GitHubReposProps {}

export function GitHubRepos({}: GitHubReposProps) {
  const { githubIsAuthenticated, onGitHubConnect, githubRepos, onCloneRepo } = useLauncherContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [cloningRepoId, setCloningRepoId] = useState<number | null>(null);

  // Get repos from context
  const { noodlProjects, allRepos, organizations, isLoading, error, refresh } = githubRepos || {
    noodlProjects: [],
    allRepos: [],
    organizations: [],
    personalRepos: [],
    isLoading: false,
    error: null,
    refresh: async () => {}
  };

  // Count how many repos are still being checked
  const checkingCount = allRepos.filter((r) => r.isNoodlProject === null).length;
  const isChecking = checkingCount > 0;

  // Only show Noodl projects
  const reposToShow = noodlProjects;

  // Filter by search term
  const filteredRepos = useMemo(() => {
    if (!searchTerm) return reposToShow;
    const term = searchTerm.toLowerCase();
    return reposToShow.filter(
      (repo) =>
        repo.name.toLowerCase().includes(term) ||
        repo.full_name.toLowerCase().includes(term) ||
        repo.description?.toLowerCase().includes(term)
    );
  }, [reposToShow, searchTerm]);

  // Group by source (personal vs org)
  const personalFilteredRepos = filteredRepos.filter((r) => r.source === 'personal');
  const orgFilteredRepos = filteredRepos.filter((r) => r.source !== 'personal');

  // Group org projects by org
  const projectsByOrg = useMemo(() => {
    const grouped = new Map<string, NoodlGitHubRepo[]>();
    for (const repo of orgFilteredRepos) {
      const existing = grouped.get(repo.source) || [];
      grouped.set(repo.source, [...existing, repo]);
    }
    return grouped;
  }, [orgFilteredRepos]);

  const handleClone = async (repo: NoodlGitHubRepo) => {
    if (!onCloneRepo) return;

    setCloningRepoId(repo.id);
    try {
      await onCloneRepo(repo);
    } finally {
      setCloningRepoId(null);
    }
  };

  // Not authenticated
  if (!githubIsAuthenticated) {
    return (
      <LauncherPage title="GitHub">
        <ConnectGitHubPrompt onConnect={() => onGitHubConnect?.()} />
      </LauncherPage>
    );
  }

  return (
    <LauncherPage
      title="GitHub Projects"
      headerSlot={
        <HStack hasSpacing>
          <PrimaryButton
            label="Refresh"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={refresh}
            isDisabled={isLoading}
          />
        </HStack>
      }
    >
      {/* Search bar */}
      <Box hasBottomSpacing={4}>
        <TextInput
          variant={TextInputVariant.InModal}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search Noodl projects..."
        />
      </Box>

      {/* Error state */}
      {error && (
        <Box hasBottomSpacing={4}>
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--theme-color-danger-10)',
              borderRadius: 'var(--radius-default)',
              color: 'var(--theme-color-danger)'
            }}
          >
            {error}
          </div>
        </Box>
      )}

      {/* Loading state */}
      {isLoading && <LoadingState />}

      {/* Checking progress indicator */}
      {!isLoading && isChecking && (
        <Box hasBottomSpacing={4}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'var(--theme-color-bg-2)',
              borderRadius: 'var(--radius-default)',
              fontSize: '12px',
              color: 'var(--theme-color-fg-default-shy)'
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                border: '2px solid var(--theme-color-border-default)',
                borderTopColor: 'var(--theme-color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            Scanning {checkingCount} repositories for project.json...
          </div>
        </Box>
      )}

      {/* Content */}
      {!isLoading && !isChecking && filteredRepos.length === 0 && <EmptyState />}

      {!isLoading && filteredRepos.length > 0 && (
        <VStack hasSpacing>
          {/* Personal repos */}
          {personalFilteredRepos.length > 0 && (
            <Box hasBottomSpacing={4}>
              <Label size={LabelSize.Default}>Personal Repositories ({personalFilteredRepos.length})</Label>
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {personalFilteredRepos.map((repo) => (
                  <GitHubRepoCard
                    key={repo.id}
                    repo={repo}
                    onClone={handleClone}
                    isCloning={cloningRepoId === repo.id}
                  />
                ))}
              </div>
            </Box>
          )}

          {/* Organization repos */}
          {Array.from(projectsByOrg.entries()).map(([orgLogin, repos]) => {
            const org = organizations.find((o) => o.login === orgLogin);
            if (!org) return null;

            return (
              <OrgSection key={orgLogin} org={org}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {repos.map((repo) => (
                    <GitHubRepoCard
                      key={repo.id}
                      repo={repo}
                      onClone={handleClone}
                      isCloning={cloningRepoId === repo.id}
                    />
                  ))}
                </div>
              </OrgSection>
            );
          })}
        </VStack>
      )}
    </LauncherPage>
  );
}
