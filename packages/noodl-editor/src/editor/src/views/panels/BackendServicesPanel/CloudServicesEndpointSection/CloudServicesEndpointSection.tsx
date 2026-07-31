/**
 * Cloud Services Endpoint — the card for a backend reached by endpoint and app id.
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
 * - Local backends started from the same list auto-fill this (see `onStart` in
 *   BackendServicesPanel.tsx) when nothing is configured yet.
 * - This card is for the other case: pointing at a deployed `nodegx-backend` or
 *   a Parse server somebody else runs. No master key field — nothing left in the
 *   app reads one (see migration note in CHANGELOG for what happened to
 *   previously-stored master keys).
 *
 * ## BCN-009: it is a card, not a section
 *
 * It used to be its own `<Section>` above a "Local Backends" section and an
 * "External Backends" section — one panel, three headings, three unrelated
 * mechanisms, which is exactly why the duplication read as intentional to a
 * user. It is now one entry in one list of backends, and it carries the same
 * security disclosure every other entry does. What it *writes* is unchanged:
 * converging the two metadata keys is BCN-009 step 2 and deliberately separate,
 * because it reaches into the runtime's resolver and the exporter's injection.
 *
 * @module BackendServicesPanel/CloudServicesEndpointSection
 */

import React, { useCallback, useEffect, useState } from 'react';

import { securityFor } from '@noodl-models/BackendServices';
import { endpointBackendType } from '@noodl-models/BackendServices/backendList';
import { getPreset } from '@noodl-models/BackendServices/presets';
import { ProjectModel } from '@noodl-models/projectmodel';
import { getCloudServices, setCloudServices } from '@noodl-models/projectmodel.editor';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Checkbox } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { SecurityDisclosure } from '../SecurityDisclosure/SecurityDisclosure';
import css from './CloudServicesEndpointSection.module.scss';

export interface CloudServicesEndpointSectionProps {
  /**
   * Open straight into the form.
   *
   * The card is only rendered once something is configured, so the add flow
   * needs a way to bring it into existence with its form already showing —
   * otherwise "add a Parse Server" lands on a list with nothing new in it.
   */
  isEditingRequested?: boolean;
  /** Raised when the form closes, so the panel can drop its request. */
  onEditingClosed?: () => void;
}

function readCurrentEndpoint() {
  const project = ProjectModel.instance;
  if (!project)
    return {
      id: undefined as string | undefined,
      endpoint: undefined as string | undefined,
      appId: undefined as string | undefined
    };
  return getCloudServices(project);
}

export function CloudServicesEndpointSection({
  isEditingRequested,
  onEditingClosed
}: CloudServicesEndpointSectionProps) {
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

  // The add flow asks for the form; opening it here rather than lifting the
  // whole form's state keeps this card the only thing that knows how a
  // `cloudservices` pointer is written.
  useEffect(() => {
    if (isEditingRequested) startEditing();
  }, [isEditingRequested, startEditing]);

  const closeEditing = useCallback(() => {
    setIsEditing(false);
    onEditingClosed?.();
  }, [onEditingClosed]);

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
    closeEditing();
  }, [endpointInput, appIdInput, isNodeGxInput, closeEditing]);

  const handleDisconnect = useCallback(() => {
    const project = ProjectModel.instance;
    if (!project) return;

    setCloudServices(project, { id: undefined, endpoint: undefined, appId: undefined, type: undefined });
    setCurrent(readCurrentEndpoint());
  }, []);

  const isConnected = Boolean(current.endpoint);

  // Nothing configured and nobody asking for the form: no card. An empty card
  // saying "no backend connected" in a list that also has backends in it is the
  // duplication this task is removing, one level down.
  if (!isConnected && !isEditing) return null;

  // WF-007 stores 'nodegx' | 'external'; the contract's word for the latter is
  // `parse`, and the disclosure is keyed on the contract's union.
  const type = endpointBackendType(current.type);
  const preset = getPreset(type);

  return (
    <div className={css.Root} data-test="cloud-services-endpoint-card">
      {!isEditing ? (
        <>
          <div className={css.Header}>
            <div className={css.Identity}>
              <div className={css.TypeIcon}>
                <Text textType={TextType.Proud}>{preset.displayName.charAt(0).toUpperCase()}</Text>
              </div>
              <div className={css.IdentityText} title={`${current.appId || ''}\n${current.endpoint}`}>
                <Text textType={TextType.DefaultContrast}>{current.appId || current.endpoint}</Text>
                <Text className={css.EndpointMeta} textType={TextType.Shy} style={{ fontSize: '11px' }}>
                  {preset.displayName} • {current.endpoint}
                </Text>
              </div>
            </div>
            <div className={css.ActiveBadge}>
              <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
                ACTIVE
              </Text>
            </div>
          </div>

          <div className={css.Status}>
            <div className={css.EndpointLine}>
              <Icon
                icon={IconName.Check}
                size={IconSize.Tiny}
                UNSAFE_style={{ color: 'var(--theme-color-success)' }}
              />
              <Text textType={TextType.Shy}>
                {current.type === 'nodegx'
                  ? 'Deployed built-in backend — supports realtime'
                  : current.type === 'external'
                  ? 'Parse-compatible server'
                  : 'Type unknown — treated as a Parse server'}
              </Text>
            </div>
          </div>

          <SecurityDisclosure disclosure={securityFor(type)} testId="backend-security-endpoint" />

          <div className={css.Actions}>
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
          </div>
        </>
      ) : (
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
            label="This is a deployed built-in backend — enables realtime"
            testId="cloud-services-is-nodegx-checkbox"
          />

          <SecurityDisclosure
            disclosure={securityFor(isNodeGxInput ? 'nodegx' : 'parse')}
            testId="backend-security-endpoint-form"
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
                onClick={closeEditing}
                isGrowing
              />
            </div>
          </Box>
        </VStack>
      )}
    </div>
  );
}
