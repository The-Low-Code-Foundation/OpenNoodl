/**
 * Cloud Services Endpoint Section
 *
 * WF-007: this is the relocated "where does this project's Parse-wire
 * traffic go" control, previously owned by the deleted CloudServicePanel
 * (`models/CloudServices` + `views/panels/CloudServicePanel`). That panel
 * stored a named list of external Parse environments — each with a master
 * key — in local `JSONStorage('externalBrokers')`, used for CRUD, the
 * (deleted) master-key deploy pass, and the (deleted) Parse Dashboard
 * launcher.
 *
 * None of that survives. What a project actually needs is one pointer:
 * `{endpoint, appId}`, stored in the project's own `cloudservices` metadata
 * (`getCloudServices`/`setCloudServices` — unchanged, still read directly by
 * the runtime clients and injected into exports by `utils/exporter/json.ts`).
 *
 * - Local backends started from the "Local Backends" section above
 *   auto-fill this (see `onStart` in BackendServicesPanel.tsx) when nothing
 *   is configured yet.
 * - This section is for the other case: pointing at a deployed
 *   `nodegx-backend` or a legacy external Parse-compatible server. No master
 *   key field — nothing left in the app reads one (see migration note in
 *   CHANGELOG for what happened to previously-stored master keys).
 *
 * @module BackendServicesPanel/CloudServicesEndpointSection
 */

import React, { useCallback, useEffect, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices, setCloudServices } from '@noodl-models/projectmodel.editor';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Container } from '@noodl-core-ui/components/layout/Container';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './CloudServicesEndpointSection.module.scss';

function readCurrentEndpoint() {
  const project = ProjectModel.instance;
  if (!project) return { id: undefined as string | undefined, endpoint: undefined as string | undefined, appId: undefined as string | undefined };
  return getCloudServices(project);
}

export function CloudServicesEndpointSection() {
  const [current, setCurrent] = useState(readCurrentEndpoint);
  const [isEditing, setIsEditing] = useState(false);
  const [endpointInput, setEndpointInput] = useState('');
  const [appIdInput, setAppIdInput] = useState('');
  const [isNodeGxInput, setIsNodeGxInput] = useState(false);

  // Stay in sync when a local backend auto-sets this (or it changes elsewhere).
  useEffect(() => {
    const project = ProjectModel.instance;
    if (!project) return;

    const group = {};
    const update = () => setCurrent(readCurrentEndpoint());
    project.on('cloudServicesChanged', update, group);
    return () => {
      project.off(group);
    };
  }, []);

  const startEditing = useCallback(() => {
    setEndpointInput(current.endpoint || '');
    setAppIdInput(current.appId || '');
    setIsNodeGxInput(current.type === 'nodegx');
    setIsEditing(true);
  }, [current.endpoint, current.appId, current.type]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(() => {
    const project = ProjectModel.instance;
    if (!project) return;

    const endpoint = endpointInput.trim();
    const appId = appIdInput.trim();

    setCloudServices(project, {
      id: undefined,
      endpoint: endpoint || undefined,
      appId: appId || undefined,
      // WF-007: only set when the user tells us — we cannot infer it from a
      // manually-entered endpoint. Drives realtime/SSE transport selection.
      type: endpoint ? (isNodeGxInput ? 'nodegx' : 'external') : undefined
    });

    setCurrent(readCurrentEndpoint());
    setIsEditing(false);
  }, [endpointInput, appIdInput, isNodeGxInput]);

  const handleDisconnect = useCallback(() => {
    const project = ProjectModel.instance;
    if (!project) return;

    setCloudServices(project, { id: undefined, endpoint: undefined, appId: undefined, type: undefined });
    setCurrent(readCurrentEndpoint());
  }, []);

  const isConnected = Boolean(current.endpoint);

  return (
    <Section title="Cloud Services Endpoint" variant={SectionVariant.Panel}>
      {!isEditing ? (
        <Container hasLeftSpacing hasRightSpacing hasTopSpacing hasBottomSpacing>
          {isConnected ? (
            <VStack hasSpacing>
              <div className={css.EndpointLine} title={current.endpoint}>
                <Icon icon={IconName.Check} size={IconSize.Small} UNSAFE_style={{ color: 'var(--theme-color-success)' }} />
                <Text className={css.EndpointUrl} textType={TextType.DefaultContrast}>
                  {current.endpoint}
                </Text>
              </div>
              {current.appId && (
                <Text className={css.EndpointMeta} textType={TextType.Shy}>
                  App ID: {current.appId}
                </Text>
              )}
              <Text className={css.EndpointMeta} textType={TextType.Shy}>
                {current.type === 'nodegx'
                  ? 'NodeGX backend — supports realtime/Live'
                  : current.type === 'external'
                  ? 'External Parse-compatible server'
                  : 'Type unknown'}
              </Text>
              <Box hasTopSpacing>
                <div className={css.ButtonRow}>
                  <PrimaryButton
                    label="Edit"
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    onClick={startEditing}
                    isGrowing
                  />
                  <PrimaryButton
                    label="Disconnect"
                    size={PrimaryButtonSize.Small}
                    variant={PrimaryButtonVariant.Muted}
                    onClick={handleDisconnect}
                    isGrowing
                  />
                </div>
              </Box>
            </VStack>
          ) : (
            <VStack hasSpacing>
              <Text>No backend connected</Text>
              <Text textType={TextType.Shy}>
                Start a local backend above, or connect to a deployed nodegx-backend / legacy external Parse-compatible
                server here.
              </Text>
              <Box hasTopSpacing>
                <PrimaryButton
                  label="Connect external endpoint"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={startEditing}
                  testId="connect-external-endpoint-button"
                />
              </Box>
            </VStack>
          )}
        </Container>
      ) : (
        <Container hasLeftSpacing hasRightSpacing hasTopSpacing hasBottomSpacing>
          <VStack hasSpacing>
            <TextInput
              value={endpointInput}
              onChange={(e) => setEndpointInput(e.target.value)}
              placeholder="https://your-backend.example.com"
              label="Endpoint"
              testId="cloud-services-endpoint-input"
            />
            <TextInput
              value={appIdInput}
              onChange={(e) => setAppIdInput(e.target.value)}
              placeholder="app id"
              label="App ID"
              testId="cloud-services-appid-input"
            />
            <Checkbox
              isChecked={isNodeGxInput}
              onChange={(e) => setIsNodeGxInput(e.target.checked)}
              label="This is a NodeGX backend (deployed nodegx-backend) — enables realtime/Live"
              testId="cloud-services-is-nodegx-checkbox"
            />
            <Text textType={TextType.Shy}>
              No master key here — the master-key admin surface was retired along with the Parse management panel.
            </Text>
            <Box hasTopSpacing>
              <div className={css.ButtonRow}>
                <PrimaryButton
                  label="Save"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={handleSave}
                  isDisabled={!endpointInput.trim() || !appIdInput.trim()}
                  testId="save-cloud-services-endpoint-button"
                  isGrowing
                />
                <PrimaryButton
                  label="Cancel"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={cancelEditing}
                  isGrowing
                />
              </div>
            </Box>
          </VStack>
        </Container>
      )}
    </Section>
  );
}
