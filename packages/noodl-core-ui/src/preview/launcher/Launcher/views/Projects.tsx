import React, { useMemo, useRef, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select, SelectColorTheme, SelectOption } from '@noodl-core-ui/components/inputs/Select';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { FolderTree } from '@noodl-core-ui/preview/launcher/Launcher/components/FolderTree';
import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
import {
  CloudSyncType,
  LauncherProjectCard,
  LauncherProjectData
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherProjectCard';
import {
  LauncherSearchBar,
  useLauncherSearchBar
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherSearchBar';
import { ProjectSettingsModal } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectSettingsModal';
import { useProjectOrganization } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useProjectOrganization';
import { MOCK_PROJECTS } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

export interface ProjectsViewProps {}

export function Projects({}: ProjectsViewProps) {
  const {
    projects: allProjects,
    selectedFolderId,
    setSelectedFolderId,
    setActivePageId,
    onCreateProject,
    onOpenProject,
    onLaunchProject,
    onOpenProjectFolder,
    onDeleteProject,
    onMigrateProject,
    onOpenReadOnly
  } = useLauncherContext();

  const { getProjectMeta, getProjectsInFolder, folders, moveProjectToFolder } = useProjectOrganization();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [movingProject, setMovingProject] = useState<LauncherProjectData | null>(null);

  // Filter projects based on selected folder
  const filteredByFolder = useMemo(() => {
    if (selectedFolderId === null) {
      // "All Projects" - show everything
      return allProjects;
    } else if (selectedFolderId === 'uncategorized') {
      // "Uncategorized" - show projects without a folder
      return allProjects.filter((project) => {
        const meta = getProjectMeta(project.localPath);
        return !meta || meta.folderId === null;
      });
    } else {
      // Specific folder - show projects in that folder
      const projectPathsInFolder = getProjectsInFolder(selectedFolderId);
      return allProjects.filter((project) => projectPathsInFolder.includes(project.localPath));
    }
  }, [allProjects, selectedFolderId, getProjectMeta, getProjectsInFolder]);

  // Calculate counts for folder tree
  const uncategorizedCount = useMemo(() => {
    return allProjects.filter((project) => {
      const meta = getProjectMeta(project.localPath);
      return !meta || meta.folderId === null;
    }).length;
  }, [allProjects, getProjectMeta]);

  const uniqueTypes = [...new Set(filteredByFolder.map((item) => item.cloudSyncMeta.type))];
  const visibleTypesDropdownItems: SelectOption[] = [
    { label: 'All projects', value: 'all' },
    ...uniqueTypes.map((type) => ({ label: `Only ${type.toLowerCase()} projects`, value: type }))
  ];

  const {
    items: projects,
    filterValue,
    setFilterValue,
    searchTerm,
    setSearchTerm
  } = useLauncherSearchBar({
    allItems: filteredByFolder,
    filterDropdownItems: visibleTypesDropdownItems,
    propertyNameToFilter: 'cloudSyncMeta.type'
  });

  function onOpenProjectSettings(projectDataId: LauncherProjectData['id']) {
    setSelectedProjectId(projectDataId);
  }

  function onCloseProjectSettings() {
    setSelectedProjectId(null);
  }

  function onMoveToFolder(project: LauncherProjectData) {
    setMovingProject(project);
  }

  function onCloseFolderPicker() {
    setMovingProject(null);
  }

  function handleMoveToFolder(folderId: string | null) {
    if (movingProject) {
      moveProjectToFolder(movingProject.localPath, folderId);
      setMovingProject(null);
    }
  }

  function onImportProjectClick() {
    onOpenProject?.();
  }

  function onNewProjectClick() {
    onCreateProject?.();
  }

  function buildMenuItems(project: LauncherProjectData) {
    const items: any[] = [
      { label: 'Launch project', onClick: () => onLaunchProject?.(project.id) },
      { label: 'Open project folder', onClick: () => onOpenProjectFolder?.(project.id) },
      { label: 'Move to folder...', onClick: () => onMoveToFolder(project) },
      { label: 'Open project settings', onClick: () => onOpenProjectSettings(project.id) }
    ];

    // React 17 projects keep the migrate / read-only capability the old expandable
    // runtime banner used to offer — moved into the kebab so the card stays compact.
    if (project.runtimeInfo?.version === 'react17') {
      items.push('divider');
      items.push({ label: 'Assisted migration…', onClick: () => onMigrateProject?.(project.id) });
      items.push({ label: 'Open read-only', onClick: () => onOpenReadOnly?.(project.id) });
    }

    items.push('divider');
    items.push({
      label: 'Delete project',
      onClick: () => onDeleteProject?.(project.id),
      icon: IconName.Trash,
      isDangerous: true
    });

    return items;
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Folder Tree Sidebar */}
      <div style={{ width: '240px', borderRight: '1px solid var(--theme-color-border-default)', flexShrink: 0 }}>
        <FolderTree
          selectedFolderId={selectedFolderId}
          onFolderSelect={setSelectedFolderId}
          totalProjectCount={allProjects.length}
          uncategorizedProjectCount={uncategorizedCount}
        />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <LauncherPage
          title="Recent Projects"
          headerSlot={
            <HStack hasSpacing>
              <PrimaryButton
                label="Open project…"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Ghost}
                onClick={onImportProjectClick}
              />
              <PrimaryButton label="New project" size={PrimaryButtonSize.Small} onClick={onNewProjectClick} />
            </HStack>
          }
        >
          {allProjects.length === 0 ? (
            /* First-launch welcome — the actual first impression. */
            <div
              style={{
                maxWidth: 520,
                margin: '48px auto 0',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--spacing-4)'
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-family-display)',
                  fontSize: 26,
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: 'var(--theme-color-fg-highlight)',
                  margin: 0
                }}
              >
                Welcome to NodeGX
              </h2>
              <p style={{ color: 'var(--theme-color-fg-muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                Build full-stack apps visually. Create your first project to get started — or open a guided lesson to
                learn the ropes.
              </p>
              <HStack hasSpacing>
                <PrimaryButton label="New project" size={PrimaryButtonSize.Small} onClick={onNewProjectClick} />
                <PrimaryButton
                  label="Browse lessons"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Ghost}
                  onClick={() => setActivePageId('learn')}
                />
              </HStack>
            </div>
          ) : (
            <>
              <ProjectSettingsModal
                isVisible={selectedProjectId !== null}
                onClose={onCloseProjectSettings}
                projectData={projects.find((project) => project.id === selectedProjectId)}
              />

              <LauncherSearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterValue={filterValue}
                setFilterValue={setFilterValue}
                filterDropdownItems={visibleTypesDropdownItems}
              />

              <Box hasTopSpacing={4}>
                {projects.length === 0 ? (
                  /* No-results empty state (search or empty folder). */
                  <div
                    style={{
                      textAlign: 'center',
                      color: 'var(--theme-color-fg-muted)',
                      padding: '48px 0',
                      fontSize: 13
                    }}
                  >
                    {searchTerm
                      ? `No projects match “${searchTerm}”.`
                      : 'No projects here yet.'}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '18px'
                    }}
                  >
                    {projects.map((project) => (
                      <LauncherProjectCard
                        key={project.id}
                        {...project}
                        onClick={() => onLaunchProject?.(project.id)}
                        onMigrateProject={() => onMigrateProject?.(project.id)}
                        onOpenReadOnly={() => onOpenReadOnly?.(project.id)}
                        contextMenuItems={buildMenuItems(project)}
                      />
                    ))}
                  </div>
                )}
              </Box>
            </>
          )}

          {/* Folder Picker Modal */}
          {movingProject && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)'
                }}
                onClick={onCloseFolderPicker}
              />
              <div
                style={{
                  position: 'relative',
                  backgroundColor: 'var(--theme-color-bg-2)',
                  border: '1px solid var(--theme-color-border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-6)',
                  minWidth: '400px',
                  maxWidth: '500px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  zIndex: 1001
                }}
              >
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: 'var(--theme-color-fg-default)',
                    margin: '0 0 var(--spacing-3) 0',
                    lineHeight: 1.3
                  }}
                >
                  Move "{movingProject.title}" to folder
                </h3>
                <div
                  style={{
                    marginBottom: 'var(--spacing-6)',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}
                >
                  <button
                    onClick={() => handleMoveToFolder(null)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: 'var(--spacing-2) var(--spacing-3)',
                      marginBottom: 'var(--spacing-1)',
                      backgroundColor: 'var(--theme-color-bg-3)',
                      border: '1px solid var(--theme-color-border-default)',
                      borderRadius: 'var(--radius-default)',
                      color: 'var(--theme-color-fg-default)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--theme-color-bg-4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--theme-color-bg-3)';
                    }}
                  >
                    Uncategorized
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleMoveToFolder(folder.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        marginBottom: 'var(--spacing-1)',
                        backgroundColor: 'var(--theme-color-bg-3)',
                        border: '1px solid var(--theme-color-border-default)',
                        borderRadius: 'var(--radius-default)',
                        color: 'var(--theme-color-fg-default)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--theme-color-bg-4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--theme-color-bg-3)';
                      }}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={onCloseFolderPicker}
                    style={{
                      padding: 'var(--spacing-2) var(--spacing-4)',
                      backgroundColor: 'var(--theme-color-bg-3)',
                      border: '1px solid var(--theme-color-border-default)',
                      borderRadius: 'var(--radius-default)',
                      color: 'var(--theme-color-fg-default)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--theme-color-bg-4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--theme-color-bg-3)';
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </LauncherPage>
      </div>
    </div>
  );
}
