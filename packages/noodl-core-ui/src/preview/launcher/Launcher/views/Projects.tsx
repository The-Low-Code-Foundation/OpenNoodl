import React, { useMemo, useRef, useState } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select, SelectColorTheme, SelectOption } from '@noodl-core-ui/components/inputs/Select';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Columns } from '@noodl-core-ui/components/layout/Columns';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';
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
import { ProjectList } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectList';
import { ProjectSettingsModal } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectSettingsModal';
import { ViewModeToggle } from '@noodl-core-ui/preview/launcher/Launcher/components/ViewModeToggle';
import { useProjectList } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useProjectList';
import { useProjectOrganization } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useProjectOrganization';
import { MOCK_PROJECTS } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';
import { useLauncherContext, ViewMode } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

export interface ProjectsViewProps {}

export function Projects({}: ProjectsViewProps) {
  const {
    viewMode,
    setViewMode,
    projects: allProjects,
    selectedFolderId,
    setSelectedFolderId,
    onCreateProject,
    onOpenProject,
    onLaunchProject,
    onOpenProjectFolder,
    onDeleteProject
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

  // Sorting for list view
  const { sortedProjects, sortField, sortDirection, setSorting } = useProjectList({
    projects,
    initialSortField: 'lastModified',
    initialSortDirection: 'desc'
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
                label="Open project"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={onImportProjectClick}
              />
              <PrimaryButton label="Create new project" size={PrimaryButtonSize.Small} onClick={onNewProjectClick} />
            </HStack>
          }
        >
          <ProjectSettingsModal
            isVisible={selectedProjectId !== null}
            onClose={onCloseProjectSettings}
            projectData={projects.find((project) => project.id === selectedProjectId)}
          />

          <HStack hasSpacing={4} UNSAFE_style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <LauncherSearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterValue={filterValue}
              setFilterValue={setFilterValue}
              filterDropdownItems={visibleTypesDropdownItems}
            />
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </HStack>

          <Box hasTopSpacing={4}>
            {viewMode === ViewMode.List ? (
              <ProjectList
                projects={sortedProjects}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={setSorting}
                onProjectClick={(project) => onLaunchProject?.(project.id)}
                onOpenFolder={(project) => onOpenProjectFolder?.(project.id)}
                onSettings={(project) => onOpenProjectSettings(project.id)}
                onDelete={(project) => onDeleteProject?.(project.id)}
              />
            ) : (
              <>
                {/* TODO: make project list legend and grid reusable */}
                <Box hasBottomSpacing={4}>
                  <HStack hasSpacing>
                    <div style={{ width: 100 }} />
                    <div style={{ width: '100%' }}>
                      <Columns layoutString={'1 1 1'}>
                        <Label variant={TextType.Shy} size={LabelSize.Small}>
                          Name
                        </Label>
                        <Label variant={TextType.Shy} size={LabelSize.Small}>
                          Version control
                        </Label>
                        <Label variant={TextType.Shy} size={LabelSize.Small}>
                          Contributors
                        </Label>
                      </Columns>
                    </div>
                  </HStack>
                </Box>
                <Columns layoutString="1" hasXGap hasYGap>
                  {projects.map((project) => (
                    <LauncherProjectCard
                      key={project.id}
                      {...project}
                      onClick={() => onLaunchProject?.(project.id)}
                      contextMenuItems={[
                        {
                          label: 'Launch project',
                          onClick: () => onLaunchProject?.(project.id)
                        },
                        {
                          label: 'Open project folder',
                          onClick: () => onOpenProjectFolder?.(project.id)
                        },
                        {
                          label: 'Move to folder...',
                          onClick: () => onMoveToFolder(project)
                        },
                        {
                          label: 'Open project settings',
                          onClick: () => onOpenProjectSettings(project.id)
                        },

                        'divider',
                        {
                          label: 'Delete project',
                          onClick: () => onDeleteProject?.(project.id),
                          icon: IconName.Trash,
                          isDangerous: true
                        }
                      ]}
                    />
                  ))}
                </Columns>
              </>
            )}
          </Box>

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
