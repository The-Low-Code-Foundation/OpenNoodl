/**
 * SelectRepoModal
 *
 * Modal for selecting an existing GitHub repository to connect
 */

import React, { useState, useEffect, useMemo } from 'react';

import { GitHubClient } from '../../../../../../services/github';
import type { GitHubRepository, GitHubOrganization } from '../../../../../../services/github/GitHubTypes';
import styles from './ConnectToGitHub.module.scss';

interface SelectRepoModalProps {
  onClose: () => void;
  onSelect: (repoUrl: string) => void;
  isConnecting: boolean;
}

interface RepoGroup {
  name: string;
  repos: GitHubRepository[];
}

export function SelectRepoModal({ onClose, onSelect, isConnecting }: SelectRepoModalProps) {
  const [repos, setRepos] = useState<GitHubRepository[]>([]);
  const [orgs, setOrgs] = useState<GitHubOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);

  // Load repositories and organizations
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const client = GitHubClient.instance;

        // Load in parallel
        const [reposResult, orgsResult] = await Promise.all([
          client.listRepositories({ per_page: 100, sort: 'updated' }),
          client.listOrganizations()
        ]);

        setRepos(reposResult.data);
        setOrgs(orgsResult.data);

        // Also load org repos
        const orgRepos = await Promise.all(
          orgsResult.data.map((org) =>
            client.listOrganizationRepositories(org.login, { per_page: 100, sort: 'updated' })
          )
        );

        // Combine all repos
        const allRepos = [...reposResult.data];
        orgRepos.forEach((result) => {
          result.data.forEach((repo) => {
            if (!allRepos.find((r) => r.id === repo.id)) {
              allRepos.push(repo);
            }
          });
        });

        setRepos(allRepos);
      } catch (err) {
        console.error('Failed to load repositories:', err);
        setError('Failed to load repositories. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Group and filter repos
  const groupedRepos = useMemo((): RepoGroup[] => {
    // Filter by search query
    const filtered = searchQuery
      ? repos.filter(
          (repo) =>
            repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : repos;

    // Group by owner
    const groups: Record<string, GitHubRepository[]> = {};

    filtered.forEach((repo) => {
      const ownerLogin = repo.owner.login;
      if (!groups[ownerLogin]) {
        groups[ownerLogin] = [];
      }
      groups[ownerLogin].push(repo);
    });

    // Sort groups: personal first, then orgs alphabetically
    const sortedGroups: RepoGroup[] = [];
    const personalRepos = Object.entries(groups).find(([name]) => !orgs.find((org) => org.login === name));

    if (personalRepos) {
      sortedGroups.push({ name: 'Personal', repos: personalRepos[1] });
    }

    Object.entries(groups)
      .filter(([name]) => orgs.find((org) => org.login === name))
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, repoList]) => {
        sortedGroups.push({ name, repos: repoList });
      });

    return sortedGroups;
  }, [repos, orgs, searchQuery]);

  const handleSelect = () => {
    if (selectedRepo) {
      onSelect(selectedRepo.html_url + '.git');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isConnecting) {
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className={styles.ModalBackdrop} onClick={handleBackdropClick}>
      <div className={`${styles.Modal} ${styles.ModalLarge}`}>
        <div className={styles.ModalHeader}>
          <h2>Connect to Existing Repository</h2>
          <button className={styles.CloseButton} onClick={onClose} disabled={isConnecting}>
            &times;
          </button>
        </div>

        <div className={styles.ModalBody}>
          <div className={styles.SearchContainer}>
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.SearchInput}
              autoFocus
            />
          </div>

          {loading && (
            <div className={styles.LoadingState}>
              <div className={styles.Spinner} />
              <p>Loading repositories...</p>
            </div>
          )}

          {error && <div className={styles.ErrorMessage}>{error}</div>}

          {!loading && !error && (
            <div className={styles.RepoList}>
              {groupedRepos.length === 0 ? (
                <div className={styles.EmptyState}>
                  <p>No repositories found</p>
                </div>
              ) : (
                groupedRepos.map((group) => (
                  <div key={group.name} className={styles.RepoGroup}>
                    <div className={styles.RepoGroupHeader}>{group.name}</div>
                    {group.repos.map((repo) => (
                      <div
                        key={repo.id}
                        className={`${styles.RepoItem} ${selectedRepo?.id === repo.id ? styles.RepoItemSelected : ''}`}
                        onClick={() => setSelectedRepo(repo)}
                      >
                        <div className={styles.RepoInfo}>
                          <div className={styles.RepoName}>
                            <span>{repo.name}</span>
                            {repo.private && <span className={styles.PrivateBadge}>Private</span>}
                          </div>
                          {repo.description && <div className={styles.RepoDescription}>{repo.description}</div>}
                          <div className={styles.RepoMeta}>Updated {formatDate(repo.updated_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className={styles.ModalFooter}>
          <button type="button" className={styles.SecondaryButton} onClick={onClose} disabled={isConnecting}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.PrimaryButton}
            onClick={handleSelect}
            disabled={isConnecting || !selectedRepo}
          >
            {isConnecting ? 'Connecting...' : 'Connect Repository'}
          </button>
        </div>
      </div>
    </div>
  );
}
