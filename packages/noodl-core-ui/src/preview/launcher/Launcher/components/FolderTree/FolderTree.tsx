/**
 * FolderTree - Project organization folder tree
 *
 * Displays virtual folders (All Projects, Uncategorized) and user-created folders
 * with expand/collapse functionality and folder management actions.
 *
 * @module noodl-core-ui/preview/launcher
 */

import React, { useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { FolderTreeItem } from '@noodl-core-ui/preview/launcher/Launcher/components/FolderTreeItem';
import { Folder, useProjectOrganization } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useProjectOrganization';

import css from './FolderTree.module.scss';

export interface FolderTreeProps {
  /** Currently selected folder ID (null for "All Projects", 'uncategorized' for uncategorized) */
  selectedFolderId: string | null;
  /** Called when a folder is selected */
  onFolderSelect: (folderId: string | null) => void;
  /** Total number of projects */
  totalProjectCount: number;
  /** Number of projects without a folder */
  uncategorizedProjectCount: number;
}

/**
 * FolderTree displays the project organization structure:
 * - Virtual folders ("All Projects", "Uncategorized")
 * - User-created folders with expand/collapse
 * - "+ New Folder" button
 */
export function FolderTree({
  selectedFolderId,
  onFolderSelect,
  totalProjectCount,
  uncategorizedProjectCount
}: FolderTreeProps) {
  const { folders, createFolder, renameFolder, deleteFolder, getProjectCountInFolder } = useProjectOrganization();

  // Track expanded folders (folder IDs that are expanded)
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  // Track folder being renamed
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Track new folder creation
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Track folder deletion confirmation
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

  const toggleExpand = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName('');
  };

  const handleCreateFolderSubmit = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
    }
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const handleCreateFolderCancel = () => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const handleRenameFolder = (folder: Folder) => {
    setRenamingFolderId(folder.id);
    setRenameValue(folder.name);
  };

  const handleRenameSubmit = (folderId: string) => {
    if (renameValue.trim()) {
      renameFolder(folderId, renameValue.trim());
    }
    setRenamingFolderId(null);
    setRenameValue('');
  };

  const handleRenameCancel = () => {
    setRenamingFolderId(null);
    setRenameValue('');
  };

  const handleDeleteFolder = (folder: Folder) => {
    setDeletingFolder(folder);
  };

  const handleDeleteFolderConfirm = () => {
    if (deletingFolder) {
      deleteFolder(deletingFolder.id);
      // If deleted folder was selected, reset to "All Projects"
      if (selectedFolderId === deletingFolder.id) {
        onFolderSelect(null);
      }
      setDeletingFolder(null);
    }
  };

  const handleDeleteFolderCancel = () => {
    setDeletingFolder(null);
  };

  // Organize folders into root and nested
  const rootFolders = folders.filter((f) => f.parentId === null);
  const getFolderChildren = (parentId: string) => {
    return folders.filter((f) => f.parentId === parentId);
  };

  return (
    <div className={css['Root']}>
      {/* Virtual Folders */}
      <div className={css['VirtualFolders']}>
        {/* All Projects */}
        <FolderTreeItem
          folder={{ id: 'all', name: 'All Projects', parentId: null, order: 0, createdAt: '' }}
          projectCount={totalProjectCount}
          isSelected={selectedFolderId === null}
          onClick={() => onFolderSelect(null)}
        />

        {/* Uncategorized */}
        <FolderTreeItem
          folder={{
            id: 'uncategorized',
            name: 'Uncategorized',
            parentId: null,
            order: 1,
            createdAt: ''
          }}
          projectCount={uncategorizedProjectCount}
          isSelected={selectedFolderId === 'uncategorized'}
          onClick={() => onFolderSelect('uncategorized')}
        />
      </div>

      {/* Divider */}
      {rootFolders.length > 0 && <div className={css['Divider']} />}

      {/* User Folders */}
      <div className={css['UserFolders']}>
        {rootFolders.map((folder) => {
          const children = getFolderChildren(folder.id);
          const isExpanded = expandedFolderIds.has(folder.id);
          const projectCount = getProjectCountInFolder(folder.id);

          return (
            <div key={folder.id}>
              {renamingFolderId === folder.id ? (
                <div className={css['RenameInput']}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameSubmit(folder.id);
                      } else if (e.key === 'Escape') {
                        handleRenameCancel();
                      }
                    }}
                    onBlur={() => handleRenameSubmit(folder.id)}
                    autoFocus
                    className={css['RenameInputField']}
                  />
                </div>
              ) : (
                <FolderTreeItem
                  folder={folder}
                  projectCount={projectCount}
                  isSelected={selectedFolderId === folder.id}
                  hasChildren={children.length > 0}
                  isExpanded={isExpanded}
                  onClick={() => onFolderSelect(folder.id)}
                  onToggleExpand={() => toggleExpand(folder.id)}
                  onRename={() => handleRenameFolder(folder)}
                  onDelete={() => handleDeleteFolder(folder)}
                />
              )}

              {/* Render children if expanded */}
              {isExpanded &&
                children.map((childFolder) => {
                  const childProjectCount = getProjectCountInFolder(childFolder.id);
                  return (
                    <FolderTreeItem
                      key={childFolder.id}
                      folder={childFolder}
                      projectCount={childProjectCount}
                      isSelected={selectedFolderId === childFolder.id}
                      level={1}
                      onClick={() => onFolderSelect(childFolder.id)}
                      onRename={() => handleRenameFolder(childFolder)}
                      onDelete={() => handleDeleteFolder(childFolder)}
                    />
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* New Folder Button */}
      {isCreatingFolder ? (
        <div className={css['CreateFolderInput']}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolderSubmit();
              } else if (e.key === 'Escape') {
                handleCreateFolderCancel();
              }
            }}
            onBlur={handleCreateFolderSubmit}
            placeholder="Folder name..."
            autoFocus
            className={css['CreateFolderInputField']}
          />
        </div>
      ) : (
        <button className={css['NewFolderButton']} onClick={handleCreateFolder}>
          <Icon icon={IconName.Plus} size={IconSize.Small} UNSAFE_className={css['NewFolderIcon']} />
          <span className={css['NewFolderLabel']}>New Folder</span>
        </button>
      )}

      {/* Delete Confirmation Overlay */}
      {deletingFolder && (
        <div className={css['DeleteConfirmation']}>
          <div className={css['DeleteConfirmationBackdrop']} onClick={handleDeleteFolderCancel} />
          <div className={css['DeleteConfirmationDialog']}>
            <div className={css['DeleteConfirmationTitle']}>Delete Folder</div>
            <div className={css['DeleteConfirmationMessage']}>
              {getProjectCountInFolder(deletingFolder.id) > 0
                ? `Delete "${deletingFolder.name}"? ${getProjectCountInFolder(
                    deletingFolder.id
                  )} project(s) will be moved to Uncategorized.`
                : `Delete "${deletingFolder.name}"?`}
            </div>
            <div className={css['DeleteConfirmationButtons']}>
              <button className={css['DeleteConfirmationCancelButton']} onClick={handleDeleteFolderCancel}>
                Cancel
              </button>
              <button className={css['DeleteConfirmationDeleteButton']} onClick={handleDeleteFolderConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
