import React, { useMemo, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { SelectOption } from '@noodl-core-ui/components/inputs/Select';
import {
  CommunityAccountCard,
  CommunityAccountVariant
} from '@noodl-core-ui/preview/launcher/Launcher/components/CommunityAccountCard';
import {
  ConnectAgentCard,
  ConnectAgentVariant
} from '@noodl-core-ui/preview/launcher/Launcher/components/ConnectAgentCard';
import { FolderTree } from '@noodl-core-ui/preview/launcher/Launcher/components/FolderTree';
import {
  LauncherButton,
  LauncherButtonVariant
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherButton';
import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
import {
  LauncherProjectCard,
  LauncherProjectData
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherProjectCard';
import {
  LauncherSearchBar,
  useLauncherSearchBar
} from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherSearchBar';
import { ProjectSettingsModal } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectSettingsModal';
import { useProjectOrganization } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useProjectOrganization';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

import css from './Projects.module.scss';

/** Mock "New project" plus glyph: 14px, stroke 1.8. */
const PlusGlyph = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

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
    onOpenReadOnly,
    connectAgent,
    community
  } = useLauncherContext();

  const { getProjectMeta, getProjectsInFolder, folders, moveProjectToFolder } = useProjectOrganization();

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [movingProject, setMovingProject] = useState<LauncherProjectData | null>(null);

  // Filter projects based on selected folder
  const filteredByFolder = useMemo(() => {
    if (selectedFolderId === null) {
      // "All projects" - show everything
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
    <div className={css['Root']}>
      {/* Folder Tree Sidebar (mock: 224px, bg-1, padding 16px 10px) */}
      <aside className={css['Sidebar']}>
        <FolderTree
          selectedFolderId={selectedFolderId}
          onFolderSelect={setSelectedFolderId}
          totalProjectCount={allProjects.length}
          uncategorizedProjectCount={uncategorizedCount}
        />
      </aside>

      {/* Main Content */}
      <div className={css['Main']}>
        <LauncherPage
          title="Recent projects"
          headerSlot={
            <>
              <LauncherButton
                label="Open project…"
                variant={LauncherButtonVariant.Ghost}
                onClick={onImportProjectClick}
                testId="launcher-open-project"
              />
              <LauncherButton
                label="New project"
                icon={PlusGlyph}
                onClick={onNewProjectClick}
                testId="launcher-new-project"
              />
            </>
          }
        >
          {/* D5's Learning section used to render here, above the grid. Moved
              to its own tab (`views/Learning.tsx`) — it filled the top of the
              launcher, and the first thing you should see on opening it is your
              projects. D5's "visible, because visible progress motivates" is
              still met by a permanent tab in the header; what it does not
              survive is being the launcher's opening screen. */}

          {allProjects.length === 0 ? (
            /* First-launch welcome — the actual first impression. */
            <div className={css['Welcome']}>
              <h2 className={css['WelcomeTitle']}>Welcome to NodeGX</h2>
              <p className={css['WelcomeBody']}>
                Build full-stack apps visually. Create your first project to get started — or start from a template.
              </p>
              <div className={css['WelcomeActions']}>
                <LauncherButton label="New project" icon={PlusGlyph} onClick={onNewProjectClick} />
                {/* POL-002: was "Browse lessons" → the removed Learn tab. On the
                    empty-state screen this is the literal first thing a new user
                    sees, so it could not be left pointing at a tab that is gone. */}
                <LauncherButton
                  label="Browse templates"
                  variant={LauncherButtonVariant.Ghost}
                  onClick={() => setActivePageId('templates')}
                />
              </div>

              {/* BST-003 — visible with **zero projects**, which is the whole point: the bootstrap
                  server's command has no project path in it, so the objection that kept this offer
                  buried in Settings no longer applies. */}
              {connectAgent && <ConnectAgentCard variant={ConnectAgentVariant.Prominent} {...connectAgent} />}

              {/* UNI-001 AC2 — the account, offered where a brand-new user actually looks. The
                  card says in its own body that the editor works without one; see
                  `COMMUNITY_GATES_NOTHING`. */}
              {community && <CommunityAccountCard variant={CommunityAccountVariant.Prominent} {...community} />}
            </div>
          ) : (
            <>
              {/* ⚠️ The card does not disappear once projects exist. Someone with one project who
                  has never connected an agent is the same user, just further along — so the offer
                  stays and only its prominence changes. */}
              {connectAgent && <ConnectAgentCard variant={ConnectAgentVariant.Row} {...connectAgent} />}

              {/* ⚠️ Stays once there are projects, for the same reason the card above it does —
                  and because this is where the signed-in chip and the sign-out live. */}
              {community && <CommunityAccountCard variant={CommunityAccountVariant.Row} {...community} />}

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

              {projects.length === 0 ? (
                /* No-results empty state (search or empty folder). */
                <div className={css['NoResults']}>
                  {searchTerm ? `No projects match “${searchTerm}”.` : 'No projects here yet.'}
                </div>
              ) : (
                <div className={css['Grid']}>
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
            </>
          )}

          {/* Folder Picker Modal */}
          {movingProject && (
            <div className={css['FolderPicker']}>
              <div className={css['FolderPickerBackdrop']} onClick={onCloseFolderPicker} />
              <div className={css['FolderPickerDialog']}>
                <h3 className={css['FolderPickerTitle']}>Move "{movingProject.title}" to folder</h3>
                <div className={css['FolderPickerList']}>
                  <button className={css['FolderPickerItem']} onClick={() => handleMoveToFolder(null)}>
                    Uncategorized
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      className={css['FolderPickerItem']}
                      onClick={() => handleMoveToFolder(folder.id)}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>
                <div className={css['FolderPickerFooter']}>
                  <LauncherButton
                    label="Cancel"
                    variant={LauncherButtonVariant.Secondary}
                    onClick={onCloseFolderPicker}
                  />
                </div>
              </div>
            </div>
          )}
        </LauncherPage>
      </div>
    </div>
  );
}
