/**
 * CreateRepoModal
 *
 * Modal for creating a new GitHub repository
 */

import React, { useState, useEffect } from 'react';

import { GitHubClient } from '../../../../../../services/github';
import type { GitHubOrganization } from '../../../../../../services/github/GitHubTypes';
import styles from './ConnectToGitHub.module.scss';

interface CreateRepoModalProps {
  onClose: () => void;
  onCreate: (options: { name: string; description?: string; private?: boolean; org?: string }) => void;
  isCreating: boolean;
}

export function CreateRepoModal({ onClose, onCreate, isCreating }: CreateRepoModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [orgs, setOrgs] = useState<GitHubOrganization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load organizations
  useEffect(() => {
    async function loadOrgs() {
      try {
        const client = GitHubClient.instance;
        const result = await client.listOrganizations();
        setOrgs(result.data);
      } catch (err) {
        console.error('Failed to load organizations:', err);
      } finally {
        setLoadingOrgs(false);
      }
    }
    loadOrgs();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Repository name is required');
      return;
    }

    // Validate repo name (GitHub rules)
    const nameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!nameRegex.test(name)) {
      setError('Repository name can only contain letters, numbers, hyphens, underscores, and dots');
      return;
    }

    setError(null);
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      private: isPrivate,
      org: selectedOrg || undefined
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isCreating) {
      onClose();
    }
  };

  return (
    <div className={styles.ModalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.Modal}>
        <div className={styles.ModalHeader}>
          <h2>Create New Repository</h2>
          <button className={styles.CloseButton} onClick={onClose} disabled={isCreating}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.ModalBody}>
            <div className={styles.FormGroup}>
              <label htmlFor="owner">Owner</label>
              <select
                id="owner"
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                disabled={loadingOrgs || isCreating}
                className={styles.Select}
              >
                <option value="">Personal Account</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.login}>
                    {org.login}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.FormGroup}>
              <label htmlFor="name">Repository name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-noodl-project"
                disabled={isCreating}
                className={styles.Input}
                autoFocus
              />
            </div>

            <div className={styles.FormGroup}>
              <label htmlFor="description">Description</label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your project"
                disabled={isCreating}
                className={styles.Input}
              />
            </div>

            <div className={styles.FormGroup}>
              <label>Visibility</label>
              <div className={styles.RadioGroup}>
                <label className={styles.RadioLabel}>
                  <input
                    type="radio"
                    name="visibility"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(true)}
                    disabled={isCreating}
                  />
                  <span className={styles.RadioIcon}>🔒</span>
                  <span>Private</span>
                </label>
                <label className={styles.RadioLabel}>
                  <input
                    type="radio"
                    name="visibility"
                    checked={!isPrivate}
                    onChange={() => setIsPrivate(false)}
                    disabled={isCreating}
                  />
                  <span className={styles.RadioIcon}>🌐</span>
                  <span>Public</span>
                </label>
              </div>
            </div>

            {error && <div className={styles.ErrorMessage}>{error}</div>}
          </div>

          <div className={styles.ModalFooter}>
            <button type="button" className={styles.SecondaryButton} onClick={onClose} disabled={isCreating}>
              Cancel
            </button>
            <button type="submit" className={styles.PrimaryButton} disabled={isCreating || !name.trim()}>
              {isCreating ? 'Creating...' : 'Create Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
