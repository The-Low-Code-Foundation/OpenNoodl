/**
 * Backend Services Panel
 *
 * One list of the backends this project can see, whichever of the three
 * mechanisms configured them.
 *
 * ## BCN-009: one list, one add flow, one disclosure
 *
 * It used to be three sections — "Cloud Services Endpoint", "Local Backends",
 * "External Backends" — stacked in one panel, with two unrelated add buttons and
 * no shared vocabulary. Two of the six backends the product supports had no name
 * anywhere in it. A user reading that panel had no reason to think the three
 * sections were alternatives rather than layers, which is exactly the confusion
 * the phase exists to remove.
 *
 * It is one `Backends` section now, one `+`, and every card carries the same
 * statement of what choosing that backend publishes into the app.
 *
 * ## BCN-009 step 2: one selection, and this file owns it
 *
 * The list was one; the *selection* was not. `cloudservices` bound the record,
 * auth and file nodes and `backendServices.activeBackendId` bound the BYOB ones,
 * independently, so **two cards could say ACTIVE at once** — one of them for a
 * backend that was stopped — and a user had no way to tell which backend their
 * app would use.
 *
 * There is one id now, `BackendServices.activeBackendId`, it may name the
 * endpoint (`ENDPOINT_BACKEND_ID`), and this panel is the single place that hands
 * it to a card. No card decides for itself that it is active; that is how there
 * came to be two. The endpoint's *configuration* still lives in `cloudservices` —
 * see `models/BackendServices/activeBackend.ts` for what converged, what did not,
 * and why.
 *
 * @module BackendServicesPanel
 * @since 1.2.0
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useCallback, useEffect, useState } from 'react';

import {
  BackendServices,
  BackendServicesEvent,
  BackendSwitchDisclosure,
  ENDPOINT_BACKEND_ID,
  describeBackendSwitch,
  describeSelectionConflict
} from '@noodl-models/BackendServices';
import {
  endpointBackendType,
  endpointDisplayName,
  matchEndpointToManaged
} from '@noodl-models/BackendServices/backendList';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices, setCloudServices } from '@noodl-models/projectmodel.editor';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonVariant, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Container } from '@noodl-core-ui/components/layout/Container';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { useConfirmationDialog } from '@noodl-core-ui/components/popups/ConfirmationDialog/ConfirmationDialog.hooks';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AddBackendDialog } from './AddBackendDialog/AddBackendDialog';
import css from './BackendServicesPanel.module.scss';
import { BackendCard } from './BackendCard/BackendCard';
import { CloudServicesEndpointSection } from './CloudServicesEndpointSection/CloudServicesEndpointSection';
import { useLocalBackends } from './hooks/useLocalBackends';
import { LocalBackendCard } from './LocalBackendCard/LocalBackendCard';
import { BackendSwitchDialog } from './SecurityDisclosure/BackendSwitchDialog';

export function BackendServicesPanel() {
  const [backends, setBackends] = useState(BackendServices.instance.backends);
  /**
   * The project's one active backend id. May be {@link ENDPOINT_BACKEND_ID}.
   *
   * Held here rather than read per-card so that every card in the list is drawn
   * from the same answer — the defect this step fixes was two cards each deciding
   * for itself.
   */
  const [activeBackendId, setActiveBackendId] = useState<string | undefined>(
    BackendServices.instance.activeBackendId
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);

  // Local backend creation state
  const [isAddLocalVisible, setIsAddLocalVisible] = useState(false);
  const [newLocalBackendName, setNewLocalBackendName] = useState('');

  // BCN-009: the add flow can ask the endpoint card to open its form, which is
  // how "add a Parse Server" reaches the one place that writes a `cloudservices`
  // pointer instead of a second form that writes it differently.
  const [isEndpointEditRequested, setIsEndpointEditRequested] = useState(false);

  // BCN-009: the switch a user is about to make, and what it changes about what
  // their app publishes. Null when nothing is pending.
  const [pendingSwitch, setPendingSwitch] = useState<{ id: string; disclosure: BackendSwitchDisclosure } | null>(null);

  // Local backends hook
  const {
    backends: localBackends,
    isLoading: isLoadingLocal,
    createBackend: createLocalBackend,
    deleteBackend: deleteLocalBackend,
    startBackend: startLocalBackend,
    stopBackend: stopLocalBackend,
    deployCloudFunctions
  } = useLocalBackends();

  // Initialize backends on mount
  useEffect(() => {
    setIsLoading(true);
    BackendServices.instance.initialize().finally(() => {
      setBackends(BackendServices.instance.backends);
      setActiveBackendId(BackendServices.instance.activeBackendId);
      setIsLoading(false);
    });
  }, []);

  // Listen for backend changes
  useEventListener(BackendServices.instance, BackendServicesEvent.BackendsChanged, () => {
    setBackends([...BackendServices.instance.backends]);
  });

  // Raised both by `setActiveBackend` and by the project's endpoint changing,
  // because the endpoint is half of what the selection can name — starting a
  // local backend in a project with none moves the badge without any card here
  // being told.
  useEventListener(BackendServices.instance, BackendServicesEvent.ActiveBackendChanged, () => {
    setActiveBackendId(BackendServices.instance.activeBackendId);
  });

  // Delete confirmation dialog for external backends
  const [DeleteDialog, confirmDelete] = useConfirmationDialog({
    title: 'Delete Backend',
    message: 'Are you sure you want to delete this backend configuration? This cannot be undone.',
    isDangerousAction: true
  });

  // Delete confirmation dialog for local backends
  const [DeleteLocalDialog, confirmDeleteLocal] = useConfirmationDialog({
    title: 'Delete Local Backend',
    message: 'Delete this local backend? All data will be permanently lost.',
    isDangerousAction: true
  });

  // Handle delete local backend
  const handleDeleteLocalBackend = useCallback(
    async (id: string) => {
      try {
        await confirmDeleteLocal();
        await deleteLocalBackend(id);
      } catch {
        // User cancelled
      }
    },
    [confirmDeleteLocal, deleteLocalBackend]
  );

  // Handle create local backend
  const handleCreateLocalBackend = useCallback(async () => {
    if (newLocalBackendName.trim()) {
      await createLocalBackend(newLocalBackendName.trim());
      setNewLocalBackendName('');
      setIsAddLocalVisible(false);
    }
  }, [newLocalBackendName, createLocalBackend]);

  // Handle delete backend
  const handleDeleteBackend = useCallback(
    async (id: string) => {
      try {
        await confirmDelete();
        // If we get here, user confirmed
        setHasActivity(true);
        try {
          await BackendServices.instance.deleteBackend(id);
        } finally {
          setHasActivity(false);
        }
      } catch {
        // User cancelled - do nothing
      }
    },
    [confirmDelete]
  );

  /**
   * BCN-009: this is the moment the task exists for.
   *
   * Making a different backend active can change whether the published app
   * carries a key any visitor can copy, and changes which product's admin screen
   * decides what that visitor may do. Neither is visible anywhere else — by the
   * time it is, the app is deployed. So the comparison is shown first, once,
   * with the two facts side by side.
   *
   * It only appears when something is already active and the two are of
   * different types. Confirming a switch between two Directus backends is a
   * dialog that says nothing, and a dialog that says nothing is how people learn
   * to click through the ones that do.
   *
   * **BCN-009 step 2 widened it to the endpoint on both sides.** Before, the
   * endpoint was not a thing you could switch *to* or *from* — it was active by
   * existing — so the largest switch in the product, built-in-to-Directus and
   * back, was the one switch with no comparison in front of it.
   */
  const handleSetActive = useCallback((id: string) => {
    const from = describeSelectableBackend(BackendServices.instance.activeBackendId);
    const to = describeSelectableBackend(id);

    if (from && to && from.id !== to.id && from.type !== to.type) {
      setPendingSwitch({
        id,
        disclosure: describeBackendSwitch(from.type, to.type, { from: from.name, to: to.name })
      });
      return;
    }

    BackendServices.instance.setActiveBackend(id);
  }, []);

  const handleConfirmSwitch = useCallback(() => {
    if (pendingSwitch) BackendServices.instance.setActiveBackend(pendingSwitch.id);
    setPendingSwitch(null);
  }, [pendingSwitch]);

  // Handle test connection
  const handleTestConnection = useCallback(async (id: string) => {
    setHasActivity(true);
    try {
      const backend = BackendServices.instance.getBackend(id);
      if (backend) {
        await BackendServices.instance.testConnection(backend);
        setBackends([...BackendServices.instance.backends]);
      }
    } finally {
      setHasActivity(false);
    }
  }, []);

  // Handle fetch schema
  const handleFetchSchema = useCallback(async (id: string) => {
    setHasActivity(true);
    try {
      await BackendServices.instance.fetchSchema(id);
      setBackends([...BackendServices.instance.backends]);
    } finally {
      setHasActivity(false);
    }
  }, []);

  const isEmpty =
    localBackends.length === 0 &&
    backends.length === 0 &&
    !getCloudServicesEndpoint() &&
    !isAddLocalVisible &&
    !isEndpointEditRequested;

  // BCN-009 step 2: the one case the migration will not resolve on the project's
  // behalf, because either answer silently repoints a family of nodes. Said out
  // loud on both cards, with the resolution one click away, rather than shown as
  // a second ACTIVE badge.
  const conflictingBackendId = BackendServices.instance.conflictingBackendId;
  const conflictNote = (() => {
    if (!conflictingBackendId) return undefined;
    const active = describeSelectableBackend(activeBackendId);
    const conflict = BackendServices.instance.getBackend(conflictingBackendId);
    if (!active || !conflict) return undefined;
    return describeSelectionConflict(active.name, conflict.name);
  })();

  /**
   * AAQ-002 — the managed backend the project's endpoint points at, when it
   * points at one of ours.
   *
   * This pair is the "one backend, two identities" defect: the endpoint card
   * wore ACTIVE and offered nothing but Edit and Disconnect, while the card that
   * could open the same backend's schema and data sat underneath it looking like
   * a different server. Matched by `instanceId` first — the provisioner writes
   * it — and by localhost port second, for the bindings that predate it.
   */
  const boundLocalBackend = (() => {
    const project = ProjectModel.instance;
    if (!project) return undefined;
    return matchEndpointToManaged(getCloudServices(project), localBackends);
  })();

  /**
   * Is the project's endpoint a backend this editor runs, and is it up?
   *
   * Live-QA 3.2: without this the card draws a green tick for a port with
   * nothing listening on it. Only reachable now for an endpoint that is NOT one
   * of ours — see the render, where a bound one has no endpoint card at all —
   * so in practice it stays for the case a match cannot be made.
   */
  const endpointLocalStatus = (() => {
    const endpoint = getCloudServicesEndpoint();
    if (!endpoint) return undefined;
    const match = localBackends.find((b) => endpoint.includes(`:${b.port}`));
    if (!match) return undefined;
    return match.running ? ('running' as const) : ('stopped' as const);
  })();

  /**
   * AAQ-002 slice 2 — disconnecting says what actually happens.
   *
   * "Disconnect" on the endpoint card removed the pointer and the card vanished,
   * which from the outside is indistinguishable from the backend being deleted:
   * Richard's *"disconnect just disappeared"*. The process and every row in it
   * survive. Now the card survives too — it is the managed one — and the
   * sentence says so before anything happens.
   */
  const [DisconnectDialog, confirmDisconnect] = useConfirmationDialog({
    title: 'Disconnect this backend',
    message:
      'This project stops using this backend. The backend keeps running on this computer and none of its ' +
      'data is deleted — it stays in this list, and you can connect the project to it again at any time.',
    confirmButtonLabel: 'Disconnect'
  });

  const handleDisconnectEndpoint = useCallback(async () => {
    const project = ProjectModel.instance;
    if (!project) return;
    try {
      await confirmDisconnect();
    } catch {
      return; // cancelled
    }
    setCloudServices(project, { id: undefined, endpoint: undefined, appId: undefined, type: undefined });
    BackendServices.instance.endpointRemoved();
  }, [confirmDisconnect]);

  return (
    <BasePanel title="Backend Services" hasActivityBlocker={hasActivity} hasContentScroll>
      <DeleteDialog />
      <DeleteLocalDialog />
      <DisconnectDialog />

      {isLoading || isLoadingLocal ? (
        <Container hasLeftSpacing hasTopSpacing>
          <ActivityIndicator />
        </Container>
      ) : (
        /* One section. Everything a project can point at is in it, in one card
           shape, whichever of the three mechanisms wrote it. */
        <Section
          title="Backends"
          variant={SectionVariant.Panel}
          actions={
            <IconButton
              icon={IconName.Plus}
              size={IconSize.Small}
              onClick={() => setIsAddDialogVisible(true)}
              testId="add-backend-button"
            />
          }
        >
          {/* Naming a new built-in backend. Inline rather than in the dialog
              because the dialog closed to get here — a name is one field, and a
              second modal for one field is a modal too many. */}
          {isAddLocalVisible && (
            <Container hasLeftSpacing hasRightSpacing hasTopSpacing hasBottomSpacing>
              <VStack>
                <Text textType={TextType.DefaultContrast}>Name this backend</Text>
                <Box hasTopSpacing>
                  <TextInput
                    value={newLocalBackendName}
                    onChange={(e) => setNewLocalBackendName(e.target.value)}
                    placeholder="Backend name"
                    testId="new-local-backend-name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateLocalBackend();
                      if (e.key === 'Escape') {
                        setIsAddLocalVisible(false);
                        setNewLocalBackendName('');
                      }
                    }}
                  />
                </Box>
                <Box hasTopSpacing>
                  <div className={css.ButtonRow}>
                    <PrimaryButton
                      label="Create"
                      size={PrimaryButtonSize.Small}
                      variant={PrimaryButtonVariant.Muted}
                      onClick={handleCreateLocalBackend}
                      isDisabled={!newLocalBackendName.trim()}
                      isGrowing
                      testId="create-local-backend"
                    />
                    <PrimaryButton
                      label="Cancel"
                      size={PrimaryButtonSize.Small}
                      variant={PrimaryButtonVariant.Muted}
                      onClick={() => {
                        setIsAddLocalVisible(false);
                        setNewLocalBackendName('');
                      }}
                      isGrowing
                    />
                  </div>
                </Box>
              </VStack>
            </Container>
          )}

          <Container hasLeftSpacing hasRightSpacing hasTopSpacing>
            <VStack>
              {/* The project's endpoint pointer — a deployed built-in backend, or
                  a Parse server. Renders nothing when there is neither.

                  AAQ-002: and nothing when the pointer names a backend this
                  editor runs. That pair is one backend, and its card is the
                  managed one below, which is the only one that can open its
                  schema and its data. */}
              {!boundLocalBackend && (
                <CloudServicesEndpointSection
                  isEditingRequested={isEndpointEditRequested}
                  onEditingClosed={() => setIsEndpointEditRequested(false)}
                  isActive={activeBackendId === ENDPOINT_BACKEND_ID}
                  onSetActive={() => handleSetActive(ENDPOINT_BACKEND_ID)}
                  onDisconnected={() => BackendServices.instance.endpointRemoved()}
                  conflictNote={activeBackendId === ENDPOINT_BACKEND_ID ? conflictNote : undefined}
                  localStatus={endpointLocalStatus}
                />
              )}

              {localBackends.map((backend) => (
                <LocalBackendCard
                  key={backend.id}
                  backend={backend}
                  // AAQ-002: the badge, and the endpoint's own actions, on the
                  // card that can actually do things with the backend.
                  isProjectEndpoint={boundLocalBackend?.id === backend.id}
                  isActive={boundLocalBackend?.id === backend.id && activeBackendId === ENDPOINT_BACKEND_ID}
                  conflictNote={
                    boundLocalBackend?.id === backend.id && activeBackendId === ENDPOINT_BACKEND_ID
                      ? conflictNote
                      : undefined
                  }
                  onSetActive={
                    boundLocalBackend?.id === backend.id && activeBackendId !== ENDPOINT_BACKEND_ID
                      ? () => handleSetActive(ENDPOINT_BACKEND_ID)
                      : undefined
                  }
                  onDisconnect={
                    boundLocalBackend?.id === backend.id ? () => void handleDisconnectEndpoint() : undefined
                  }
                  onDeployCloudFunctions={() => deployCloudFunctions(backend.id)}
                  onStart={async (options) => {
                    const ok = await startLocalBackend(backend.id, options);
                    // WF-004 convenience: a running local backend becomes the
                    // project's cloud services endpoint automatically — but
                    // only when none is configured, never clobbering a real
                    // external/deployed endpoint.
                    if (ok) {
                      const project = ProjectModel.instance;
                      const current = project ? getCloudServices(project) : null;
                      if (project && current && !current.endpoint) {
                        setCloudServices(project, {
                          id: backend.id,
                          endpoint: `http://localhost:${backend.port}`,
                          appId: backend.id,
                          // WF-007: this is always our own nodegx-backend
                          // instance — the canonical discriminant realtime/
                          // transport selection (BAK-001) keys off.
                          type: 'nodegx'
                        });
                        console.log(
                          `[BackendServices] Project cloud services set to local backend "${backend.name}" (http://localhost:${backend.port})`
                        );
                      }
                    }
                    return ok;
                  }}
                  onStop={async () => stopLocalBackend(backend.id)}
                  onDelete={() => handleDeleteLocalBackend(backend.id)}
                />
              ))}

              {backends.map((backend) => (
                <BackendCard
                  key={backend.id}
                  backend={backend}
                  isActive={backend.id === activeBackendId}
                  conflictNote={backend.id === conflictingBackendId ? conflictNote : undefined}
                  onSetActive={() => handleSetActive(backend.id)}
                  onDelete={() => handleDeleteBackend(backend.id)}
                  onTestConnection={() => handleTestConnection(backend.id)}
                  onFetchSchema={() => handleFetchSchema(backend.id)}
                />
              ))}
            </VStack>
          </Container>

          {isEmpty && (
            <Container hasLeftSpacing hasTopSpacing hasBottomSpacing>
              <Text>No backend yet</Text>
              <Box hasTopSpacing>
                <Text textType={TextType.Shy}>
                  Add one to store records, sign people in and keep files. The built-in backend needs nothing set up;
                  Parse, Directus, Supabase, PocketBase and your own API are all here too.
                </Text>
              </Box>
            </Container>
          )}
        </Section>
      )}

      <AddBackendDialog
        isVisible={isAddDialogVisible}
        onClose={() => setIsAddDialogVisible(false)}
        onCreated={() => {
          setIsAddDialogVisible(false);
          setBackends([...BackendServices.instance.backends]);
        }}
        onRequestManagedBackend={() => setIsAddLocalVisible(true)}
        onRequestEndpoint={() => setIsEndpointEditRequested(true)}
      />

      <BackendSwitchDialog
        isVisible={Boolean(pendingSwitch)}
        disclosure={pendingSwitch?.disclosure ?? null}
        onConfirm={handleConfirmSwitch}
        onCancel={() => setPendingSwitch(null)}
      />
    </BasePanel>
  );
}

/** The project's configured endpoint, or undefined. Read for the empty state only. */
function getCloudServicesEndpoint(): string | undefined {
  const project = ProjectModel.instance;
  if (!project) return undefined;
  return getCloudServices(project).endpoint;
}

/**
 * The three facts the switch disclosure needs about a selectable backend.
 *
 * One function for both kinds, because the whole point of step 2 is that "the
 * project's backend" is one question. `undefined` for an id that names nothing —
 * an empty project on the `from` side, which is the case with nothing to compare.
 */
function describeSelectableBackend(id: string | undefined) {
  if (!id) return undefined;

  if (id === ENDPOINT_BACKEND_ID) {
    const project = ProjectModel.instance;
    const endpoint = project ? getCloudServices(project) : undefined;
    if (!endpoint?.endpoint) return undefined;
    const type = endpointBackendType(endpoint.type);
    return { id, type, name: endpointDisplayName(type) };
  }

  const backend = BackendServices.instance.getBackend(id);
  return backend ? { id: backend.id, type: backend.type, name: backend.name } : undefined;
}
