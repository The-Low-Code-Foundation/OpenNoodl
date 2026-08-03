import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Git } from '@noodl/git';
import { platform } from '@noodl/platform';

import { AppRegistry } from '@noodl-models/app_registry';
import { ProjectModel } from '@noodl-models/projectmodel';
import { WarningsModel } from '@noodl-models/warningsmodel';
import { LocalProjectsModel } from '@noodl-utils/LocalProjectsModel';
import { MERGE_CONFLICTS_KEY, mergeProject, mergeV2ComponentFiles, readMergeConflicts } from '@noodl-versioning';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Container, ContainerDirection } from '@noodl-core-ui/components/layout/Container';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Tabs, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Text } from '@noodl-core-ui/components/typography/Text';

import { VersionControlPanel_ID } from '.';
import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { ComponentDiffDocumentProvider } from '../../documents/ComponentDiffDocument';
import { EditorDocumentProvider } from '../../documents/EditorDocument';
import PopupLayer from '../../popuplayer';
import { useIsActivePanel } from '../useIsActivePanel';
import { BranchMerge } from './components/BranchMerge';
import { BranchStatusButton } from './components/BranchStatusButton';
import { ConnectToGitHubView } from './components/github/ConnectToGitHub';
import { GitHubSection } from './components/github/GitHubSection';
import { GitProviderPopout } from './components/GitProviderPopout/GitProviderPopout';
import { GitStatusButton } from './components/GitStatusButton';
import { History } from './components/History';
import { LocalChanges } from './components/LocalChanges';
import { MergeConflicts } from './components/MergeConflicts';
import { RepositorySection } from './components/RepositorySection';
import { useVersionControlContext, VersionControlProvider } from './context';
import { useGitHubRepository } from './hooks/useGitHubRepository';

enum ViewState {
  Default,
  Branches,
  BranchMerge
}

function convertGitRemoteUrlToRepoUrl(gitRemoteUrl) {
  // Remove the .git extension if present
  gitRemoteUrl = gitRemoteUrl.replace(/\.git$/, '');

  // Extract the repository name and owner from the URL
  const regex = /^(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)$/;
  const match = gitRemoteUrl.match(regex);

  if (match) {
    const owner = match[1];
    const repo = match[2];
    // Construct the GitHub repository URL
    const repoUrl = `https://github.com/${owner}/${repo}`;
    return repoUrl;
  } else {
    throw new Error('Invalid GitHub Git remote URL');
  }
}

function BaseVersionControlPanel() {
  const { git, activeTabId, setActiveTabId, localChangesCount, branchStatus, fetch, updateLocalDiff } =
    useVersionControlContext();
  const historyCount = fetch.localCommitCount + fetch.remoteCommitCount;

  const isActivePanel = useIsActivePanel(VersionControlPanel_ID);
  const shouldUpdateDiff = useRef(true);

  // AIB-008 — what the remote IS, for the Repository and GitHub sections.
  // Held here rather than inside either of them because both need the same
  // answer and two callers would be two `useGitHubRepository` instances, which
  // is the duplication this merge exists to remove one level up.
  const { gitState, remoteUrl, owner, repo, provider, refetch: refetchRepo } = useGitHubRepository();
  const [isConnectingRemote, setIsConnectingRemote] = useState(false);

  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const eventGroup = {};

    if (!isActivePanel) {
      //if we're switching to another panel make sure we close any open diff documents
      if (AppRegistry.instance.CurrentDocumentId === ComponentDiffDocumentProvider.ID) {
        AppRegistry.instance.openDocument(EditorDocumentProvider.ID);
      }

      //check if project is saved while we're inactive, and if so, diff next time we're active
      EventDispatcher.instance.on(
        ['ProjectModel.projectSavedToDisk', 'ProjectModel.instanceHasChanged'],
        () => {
          shouldUpdateDiff.current = true;
        },
        eventGroup
      );
    } else {
      //we're now the active panel, fetch local changes and update diff if needed
      fetch.fetchLocal().then(() => {
        if (shouldUpdateDiff.current === true) {
          shouldUpdateDiff.current = false;
          updateLocalDiff();
        }
      });

      //if project is saved and we're active, update the diff
      EventDispatcher.instance.on(
        ['ProjectModel.projectSavedToDisk', 'ProjectModel.instanceHasChanged'],
        () => {
          updateLocalDiff();
        },
        eventGroup
      );
    }

    return () => {
      EventDispatcher.instance.off(eventGroup);
    };
  }, [isActivePanel]);

  const hasConflictsInProject = useHasConflictsInProject();

  // NOTE: The keep alive stuff here is a little confusing,
  //       but are designed in a way to be performant.
  let viewState = ViewState.Default;

  if (branchStatus) {
    switch (branchStatus.kind) {
      case 'merge':
        viewState = ViewState.BranchMerge;
        break;
    }
  }

  function openGitSettingsPopout() {
    const popoutDiv = document.createElement('div');
    const root = createRoot(popoutDiv);
    root.render(React.createElement(GitProviderPopout, { git }));

    //the timeout is needed to solve a bug when the popout us opened from the git status button
    //it causes timing issues between native events and react where the popout is instantly closed
    setTimeout(() => {
      PopupLayer.instance.showPopout({
        content: { el: popoutDiv },
        attachTo: settingsButtonRef.current,
        position: 'right',
        disableDynamicPositioning: true,
        onClose: () => {
          root.unmount();
          fetch.fetchRemote();
        }
      });
    }, 1);
  }

  return (
    <BasePanel
      isFill
      title="Version Control"
      headerSlot={
        <HStack hasSpacing={1}>
          {git.Provider === 'github' && (
            <IconButton
              icon={IconName.ExternalLink}
              size={IconSize.Small}
              variant={IconButtonVariant.OpaqueOnHover}
              onClick={() => {
                const githubLink = convertGitRemoteUrlToRepoUrl(git.OriginUrl);
                platform.openExternal(githubLink);
                // TODO: Toast
              }}
            />
          )}
          {git.Provider && (
            <IconButton
              ref={settingsButtonRef}
              icon={IconName.Setting}
              size={IconSize.Small}
              variant={IconButtonVariant.OpaqueOnHover}
              onClick={(ev) => {
                ev.stopPropagation();

                openGitSettingsPopout();
              }}
            />
          )}
        </HStack>
      }
    >
      <Container direction={ContainerDirection.Vertical} UNSAFE_style={{ height: '100%', isolation: 'isolate' }}>
        {hasConflictsInProject ? (
          <MergeConflicts />
        ) : (
          <>
            {/*
              AIB-008 — Repository, above the sync button rather than in a
              second panel. This is the section that only exists once the two
              panels are one: it carries the ahead/behind figure, which was
              previously computed twice (here in context, and again in
              `useGitSyncStatus`) and rendered beside the branch in neither.
            */}
            <RepositorySection
              gitState={gitState}
              remoteUrl={remoteUrl}
              owner={owner}
              repo={repo}
              onConnect={() => setIsConnectingRemote(true)}
            />
            <GitStatusButton openGitSettingsPopout={openGitSettingsPopout} />
            <BranchStatusButton />
            {viewState === ViewState.BranchMerge && <BranchMerge />}
            {/*
              AIB-008 slice 3 — the flow Richard actually ran, in the panel that
              shows his history rather than in one he had to know to look in.
              `ConnectToGitHubView` is the GitHub panel's own component, moved
              rather than rewritten: it creates the repo, sets the remote and
              pushes, and rewriting 300 lines of working OAuth flow to relocate
              it is how a consolidation becomes a regression.
            */}
            {isConnectingRemote && (
              <Box hasXSpacing hasBottomSpacing>
                <ConnectToGitHubView
                  gitState={gitState}
                  remoteUrl={remoteUrl}
                  provider={provider}
                  onConnected={() => {
                    setIsConnectingRemote(false);
                    refetchRepo();
                    // The remote is what `fetch` reads ahead/behind from, and it
                    // has just come into existence. Without this the Repository
                    // section keeps saying "No remote" until the panel is
                    // switched away from and back.
                    fetch.fetchRemote();
                  }}
                />
              </Box>
            )}
            {/* AIB-008 — Issues and pull requests. Only for a GitHub remote. */}
            {gitState === 'github-connected' && <GitHubSection owner={owner} repo={repo} />}
          </>
        )}

        {viewState !== ViewState.BranchMerge && (
          <Tabs
            variant={TabsVariant.Sidebar}
            keepTabsAlive
            activeTab={activeTabId}
            onChange={(activeTab) => setActiveTabId(activeTab)}
            tabs={[
              {
                id: 'changes',
                label: localChangesCount ? `Local Changes (${localChangesCount})` : 'Local Changes',
                content: <LocalChanges hasConflictsInProject={hasConflictsInProject} />
              },
              {
                id: 'history',
                label: historyCount > 0 ? `History (${historyCount})` : 'History',
                content: <History />
              }
            ]}
          />
        )}
      </Container>
    </BasePanel>
  );
}

export function VersionControlPanel() {
  const [git, setGit] = useState<Git>(null);
  const [state, setState] = useState<'loading' | 'loaded' | 'not-git'>('loading');

  async function createGit() {
    const gitClient = new Git(mergeProject, mergeV2ComponentFiles);
    await gitClient.openRepository(ProjectModel.instance._retainedProjectDirectory);
    setGit(gitClient);
  }

  useEffect(() => {
    LocalProjectsModel.instance
      .isGitProject(ProjectModel.instance)
      .then(async (isGitProject) => {
        if (isGitProject) {
          await createGit();
          setState('loaded');
        } else {
          setState('not-git');
        }
      });
  }, []);

  async function setupGit() {
    const gitClient = new Git(mergeProject, mergeV2ComponentFiles);
    await gitClient.initNewRepo(ProjectModel.instance._retainedProjectDirectory);
    await gitClient.commit('Initial commit');
    setGit(gitClient);
  }

  if (git === null && state === 'not-git') {
    return (
      <BasePanel isFill title="Version Control">
        <Box hasXSpacing hasYSpacing>
          <Text hasBottomSpacing>This project is missing a git setup.</Text>
          <PrimaryButton label="Initialize Version Control (git)" isGrowing onClick={setupGit} />
        </Box>
      </BasePanel>
    );
  }

  // PNL-005: this used to be `return null` — a registered panel rendering
  // *nothing*: no header, no content, a blank column. It is reached whenever
  // `git` has not been set yet, and the "should be really quick though" above is
  // only true on the happy path: the `isGitProject` promise below carries no
  // `.catch()`, so a rejection leaves the panel blank permanently rather than
  // briefly. PNL-005's live gate caught exactly this state and reported the panel
  // as never migrated.
  //
  // The chrome is not conditional on the content being ready. It renders, with
  // the activity blocker `BasePanel` already has, and the panel says what it is
  // while it works.
  if (git === null) {
    return <BasePanel isFill title="Version Control" hasActivityBlocker />;
  }

  return (
    <VersionControlProvider git={git}>
      <BaseVersionControlPanel />
    </VersionControlProvider>
  );
}

export function useHasConflictsInProject() {
  const [hasConflicts, setHasConflicts] = useState<boolean>(false);

  // Listen for changes to conflicts
  useEffect(() => {
    const check = () => {
      const warningConflicts = WarningsModel.instance.getTotalNumberOfWarningsMatching(
        (_key, _ref, warning) => warning.warning.type === 'conflict' || warning.warning.type === 'conflict-source-code'
      );

      // Warnings only exist for the seven conflict kinds the legacy merger
      // stamped onto nodes. SUB-007 raises twelve more — delete-vs-edit,
      // reparents, rewiring against a deleted node, component renames, project
      // settings — which have no node to hang a warning on. Those arrive in
      // the project's own metadata, so a merge producing only structural
      // conflicts still puts the panel into conflict mode.
      const structuralConflicts = ProjectModel.instance
        ? readMergeConflicts({ metadata: { [MERGE_CONFLICTS_KEY]: ProjectModel.instance.getMetaData(MERGE_CONFLICTS_KEY) } })
            .length
        : 0;

      setHasConflicts(warningConflicts > 0 || structuralConflicts > 0);
    };

    const eventGroup = {};

    WarningsModel.instance.on('warningsChanged', check, eventGroup);
    EventDispatcher.instance.on(
      ['ProjectModel.metadataChanged', 'ProjectModel.instanceHasChanged', 'projectChangedOnDisk'],
      check,
      eventGroup
    );

    check();

    return () => {
      WarningsModel.instance.off(eventGroup);
      EventDispatcher.instance.off(eventGroup);
    };
  }, []);

  return hasConflicts;
}
