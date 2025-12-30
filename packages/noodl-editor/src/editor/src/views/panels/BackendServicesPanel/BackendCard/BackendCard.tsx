/**
 * Backend Card Component
 *
 * Displays a single backend configuration with status and actions.
 *
 * @module BackendServicesPanel
 * @since 1.2.0
 */

import React from 'react';

import { BackendConfig, ConnectionStatus } from '@noodl-models/BackendServices';
import { getPreset } from '@noodl-models/BackendServices/presets';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './BackendCard.module.scss';

export interface BackendCardProps {
  backend: BackendConfig;
  isActive: boolean;
  onSetActive: () => void;
  onDelete: () => void;
  onTestConnection: () => void;
  onFetchSchema: () => void;
}

/**
 * Get status icon and color based on connection status
 */
function getStatusDisplay(status: ConnectionStatus): { icon: IconName; color: string; text: string } {
  switch (status) {
    case 'connected':
      return { icon: IconName.Check, color: 'var(--theme-color-success)', text: 'Connected' };
    case 'disconnected':
      return { icon: IconName.CircleOpen, color: 'var(--theme-color-fg-default-shy)', text: 'Disconnected' };
    case 'error':
      return { icon: IconName.WarningTriangle, color: 'var(--theme-color-danger)', text: 'Error' };
    case 'checking':
      return { icon: IconName.Refresh, color: 'var(--theme-color-primary)', text: 'Checking...' };
    default:
      return { icon: IconName.CircleOpen, color: 'var(--theme-color-fg-default-shy)', text: 'Unknown' };
  }
}

export function BackendCard({
  backend,
  isActive,
  onSetActive,
  onDelete,
  onTestConnection,
  onFetchSchema
}: BackendCardProps) {
  const preset = getPreset(backend.type);
  const statusDisplay = getStatusDisplay(backend.status);

  return (
    <div className={`${css.Root} ${isActive ? css.Active : ''}`} data-test={`backend-card-${backend.id}`}>
      {/* Header */}
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.TypeIcon}>
            <Text textType={TextType.Proud}>{preset.displayName.charAt(0).toUpperCase()}</Text>
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>{backend.name}</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              {preset.displayName} • {backend.url}
            </Text>
          </VStack>
        </HStack>

        {isActive && (
          <div className={css.ActiveBadge}>
            <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
              ACTIVE
            </Text>
          </div>
        )}
      </div>

      {/* Status */}
      <div className={css.Status}>
        <HStack hasSpacing>
          <Icon icon={statusDisplay.icon} size={IconSize.Tiny} UNSAFE_style={{ color: statusDisplay.color }} />
          <Text textType={TextType.Shy}>{statusDisplay.text}</Text>
          {backend.lastSynced && (
            <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
              • Last sync: {new Date(backend.lastSynced).toLocaleTimeString()}
            </Text>
          )}
        </HStack>
        {backend.lastError && (
          <Text textType={TextType.Shy} style={{ fontSize: '11px', color: 'var(--theme-color-danger)' }}>
            {backend.lastError}
          </Text>
        )}
      </div>

      {/* Schema Info */}
      {backend.schema && backend.schema.collections.length > 0 && (
        <div className={css.SchemaInfo}>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
            {backend.schema.collections.length} collection{backend.schema.collections.length !== 1 ? 's' : ''}
          </Text>
        </div>
      )}

      {/* Actions */}
      <div className={css.Actions}>
        <HStack hasSpacing>
          {!isActive && (
            <PrimaryButton
              label="Set Active"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={onSetActive}
            />
          )}
          <PrimaryButton
            label="Test"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onTestConnection}
          />
          <PrimaryButton
            label="Sync Schema"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onFetchSchema}
          />
          <IconButton
            icon={IconName.Trash}
            size={IconSize.Small}
            onClick={onDelete}
            testId={`delete-backend-${backend.id}`}
          />
        </HStack>
      </div>
    </div>
  );
}
