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

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Container } from '@noodl-core-ui/components/layout/Container';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { useConfirmationDialog } from '@noodl-core-ui/components/popups/ConfirmationDialog/ConfirmationDialog.hooks';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { AddBackendDialog } from './AddBackendDialog/AddBackendDialog';
import { BackendCard } from './BackendCard/BackendCard';
import { useLocalBackends } from './hooks/useLocalBackends';
import { LocalBackendCard } from './LocalBackendCard/LocalBackendCard';

export function BackendServicesPanel() {
  const [backends, setBackends] = useState(BackendServices.instance.backends);
  const [activeBackendId, setActiveBackendId] = useState<string | null>(BackendServices.instance.activeBackendId);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddDialogVisible, setIsAddDialogVisible] = useState(false);
  const [hasActivity, setHasActivity] = useState(false);

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

  // Delete confirmation dialog
  const [DeleteDialog, confirmDelete] = useConfirmationDialog({
    title: 'Delete Backend',
    message: 'Are you sure you want to delete this backend configuration? This cannot be undone.',
    isDangerousAction: true
  });

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

      {isLoading || isLoadingLocal ? (
        <Container hasLeftSpacing hasTopSpacing>
          <ActivityIndicator />
        </Container>
      ) : (
        <>
          {/* Local Backends Section */}
          <Section
            title="Local Backends"
            variant={SectionVariant.Panel}
            actions={
              <IconButton
                icon={IconName.Plus}
                size={IconSize.Small}
                onClick={async () => {
                  const name = prompt('Enter backend name:');
                  if (name) {
                    await createLocalBackend(name);
                  }
                }}
                testId="add-local-backend-button"
              />
            }
          >
            {localBackends.length > 0 ? (
              <VStack>
                {localBackends.map((backend) => (
                  <LocalBackendCard
                    key={backend.id}
                    backend={backend}
                    onStart={async () => startLocalBackend(backend.id)}
                    onStop={async () => stopLocalBackend(backend.id)}
                    onDelete={() => {
                      if (confirm('Delete this local backend? All data will be lost.')) {
                        deleteLocalBackend(backend.id);
                      }
                    }}
                  />
                ))}
              </VStack>
            ) : (
              <Container hasLeftSpacing hasTopSpacing hasBottomSpacing>
                <Text>No local backends</Text>
                <Box hasTopSpacing>
                  <Text textType={TextType.Shy}>
                    Create a local SQLite backend for zero-config database development.
                  </Text>
                </Box>
              </Container>
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
