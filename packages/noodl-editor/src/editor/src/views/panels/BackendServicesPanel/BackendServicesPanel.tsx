/**
 * Backend Services Panel
 *
 * Main panel for managing backend database connections (BYOB).
 * Similar in structure to CloudServicePanel.
 *
 * @module BackendServicesPanel
 * @since 1.2.0
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useCallback, useEffect, useState } from 'react';

import { BackendServices, BackendServicesEvent } from '@noodl-models/BackendServices';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices, setCloudServices } from '@noodl-models/projectmodel.editor';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonVariant, PrimaryButtonSize } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Container } from '@noodl-core-ui/components/layout/Container';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { useConfirmationDialog } from '@noodl-core-ui/components/popups/ConfirmationDialog/ConfirmationDialog.hooks';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AddBackendDialog } from './AddBackendDialog/AddBackendDialog';
import { BackendCard } from './BackendCard/BackendCard';
import { CloudServicesEndpointSection } from './CloudServicesEndpointSection/CloudServicesEndpointSection';
import { useLocalBackends } from './hooks/useLocalBackends';
import { LocalBackendCard } from './LocalBackendCard/LocalBackendCard';

export function BackendServicesPanel() {
  const [backends, setBackends] = useState(BackendServices.instance.backends);
  const [activeBackendId, setActiveBackendId] = useState<string | null>(BackendServices.instance.activeBackendId);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);

  // Local backend creation state
  const [isAddLocalVisible, setIsAddLocalVisible] = useState(false);
  const [newLocalBackendName, setNewLocalBackendName] = useState('');

  // Local backends hook
  const {
    backends: localBackends,
    isLoading: isLoadingLocal,
    createBackend: createLocalBackend,
    deleteBackend: deleteLocalBackend,
    startBackend: startLocalBackend,
    stopBackend: stopLocalBackend
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

  useEventListener(BackendServices.instance, BackendServicesEvent.ActiveBackendChanged, (id: string | null) => {
    setActiveBackendId(id);
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

  // Handle set active backend
  const handleSetActive = useCallback((id: string) => {
    BackendServices.instance.setActiveBackend(id);
  }, []);

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

  return (
    <BasePanel title="Backend Services" hasActivityBlocker={hasActivity} hasContentScroll>
      <DeleteDialog />
      <DeleteLocalDialog />

      {isLoading || isLoadingLocal ? (
        <Container hasLeftSpacing hasTopSpacing>
          <ActivityIndicator />
        </Container>
      ) : (
        <>
          {/* WF-007: relocated endpoint config — replaces the deleted CloudServicePanel */}
          <CloudServicesEndpointSection />

          {/* Local Backends Section */}
          <Section
            title="Local Backends"
            variant={SectionVariant.Panel}
            actions={
              !isAddLocalVisible && (
                <IconButton
                  icon={IconName.Plus}
                  size={IconSize.Small}
                  onClick={() => setIsAddLocalVisible(true)}
                  testId="add-local-backend-button"
                />
              )
            }
          >
            {/* Add Local Backend Form */}
            {isAddLocalVisible && (
              <Container hasLeftSpacing hasRightSpacing hasTopSpacing hasBottomSpacing>
                <VStack>
                  <Text textType={TextType.DefaultContrast}>Create Local Backend</Text>
                  <Box hasTopSpacing>
                    <TextInput
                      value={newLocalBackendName}
                      onChange={(e) => setNewLocalBackendName(e.target.value)}
                      placeholder="Backend name"
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
                    <HStack hasSpacing>
                      <PrimaryButton
                        label="Create"
                        size={PrimaryButtonSize.Small}
                        variant={PrimaryButtonVariant.Muted}
                        onClick={handleCreateLocalBackend}
                        isDisabled={!newLocalBackendName.trim()}
                      />
                      <PrimaryButton
                        label="Cancel"
                        size={PrimaryButtonSize.Small}
                        variant={PrimaryButtonVariant.Muted}
                        onClick={() => {
                          setIsAddLocalVisible(false);
                          setNewLocalBackendName('');
                        }}
                      />
                    </HStack>
                  </Box>
                </VStack>
              </Container>
            )}

            {localBackends.length > 0 ? (
              <VStack>
                {localBackends.map((backend) => (
                  <LocalBackendCard
                    key={backend.id}
                    backend={backend}
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
              </VStack>
            ) : (
              !isAddLocalVisible && (
                <Container hasLeftSpacing hasTopSpacing hasBottomSpacing>
                  <Text>No local backends</Text>
                  <Box hasTopSpacing>
                    <Text textType={TextType.Shy}>
                      Create a local SQLite backend for zero-config database development.
                    </Text>
                  </Box>
                </Container>
              )
            )}
          </Section>

          {/* External Backends Section */}
          <Section
            title="External Backends"
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
            {backends.length > 0 ? (
              <VStack>
                {backends.map((backend) => (
                  <BackendCard
                    key={backend.id}
                    backend={backend}
                    isActive={backend.id === activeBackendId}
                    onSetActive={() => handleSetActive(backend.id)}
                    onDelete={() => handleDeleteBackend(backend.id)}
                    onTestConnection={() => handleTestConnection(backend.id)}
                    onFetchSchema={() => handleFetchSchema(backend.id)}
                  />
                ))}
              </VStack>
            ) : (
              <Container hasLeftSpacing hasTopSpacing hasBottomSpacing>
                <Text>No external backends configured</Text>
                <Box hasTopSpacing>
                  <Text textType={TextType.Shy}>
                    Click the + button to add a Directus, Supabase, or custom REST backend.
                  </Text>
                </Box>
              </Container>
            )}
          </Section>
        </>
      )}

      <AddBackendDialog
        isVisible={isAddDialogVisible}
        onClose={() => setIsAddDialogVisible(false)}
        onCreated={() => {
          setIsAddDialogVisible(false);
          setBackends([...BackendServices.instance.backends]);
        }}
      />
    </BasePanel>
  );
}
