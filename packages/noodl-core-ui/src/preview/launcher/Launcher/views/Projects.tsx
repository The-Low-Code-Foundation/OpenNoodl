import React, { useRef, useState } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select, SelectColorTheme, SelectOption } from '@noodl-core-ui/components/inputs/Select';
import { TextInput, TextInputVariant } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Columns } from '@noodl-core-ui/components/layout/Columns';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';
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
import { MOCK_PROJECTS } from '@noodl-core-ui/preview/launcher/Launcher/Launcher';
import { useLauncherContext, ViewMode } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

export interface ProjectsViewProps {}

export function Projects({}: ProjectsViewProps) {
  const {
    viewMode,
    setViewMode,
    projects: allProjects,
    onCreateProject,
    onOpenProject,
    onLaunchProject,
    onOpenProjectFolder,
    onDeleteProject
  } = useLauncherContext();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const uniqueTypes = [...new Set(allProjects.map((item) => item.cloudSyncMeta.type))];
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
    allItems: allProjects,
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

  function onImportProjectClick() {
    onOpenProject?.();
  }

  function onNewProjectClick() {
    onCreateProject?.();
  }

  return (
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
    </LauncherPage>
  );
}
