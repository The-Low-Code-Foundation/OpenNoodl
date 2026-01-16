/**
 * LocalBackendCard
 *
 * Card component for displaying and managing a local SQLite backend.
 * Shows status, start/stop controls, and endpoint information.
 *
 * @module BackendServicesPanel/LocalBackendCard
 * @since 1.2.0
 */

import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { DataBrowser } from '../../databrowser';
import { SchemaPanel } from '../../schemamanager';
import { LocalBackendInfo } from '../hooks/useLocalBackends';
import css from './LocalBackendCard.module.scss';

export interface LocalBackendCardProps {
  /** Backend information */
  backend: LocalBackendInfo;
  /** Called when start is requested */
  onStart: () => Promise<void> | Promise<boolean>;
  /** Called when stop is requested */
  onStop: () => Promise<void> | Promise<boolean>;
  /** Called when delete is requested */
  onDelete: () => void;
  /** Called when export is requested */
  onExport?: () => void;
}

/**
 * Get status icon and color based on running status
 */
function getStatusDisplay(running: boolean): { icon: IconName; color: string; text: string } {
  if (running) {
    return { icon: IconName.Check, color: 'var(--theme-color-success)', text: 'Running' };
  }
  return { icon: IconName.CircleOpen, color: 'var(--theme-color-fg-default-shy)', text: 'Stopped' };
}

export function LocalBackendCard({ backend, onStart, onStop, onDelete, onExport }: LocalBackendCardProps) {
  const [isOperating, setIsOperating] = useState(false);
  const [showSchemaPanel, setShowSchemaPanel] = useState(false);
  const [showDataBrowser, setShowDataBrowser] = useState(false);
  const statusDisplay = getStatusDisplay(backend.running);

  // Format date
  const createdDate = new Date(backend.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Handle start/stop
  const handleToggle = useCallback(async () => {
    setIsOperating(true);
    try {
      if (backend.running) {
        await onStop();
      } else {
        await onStart();
      }
    } finally {
      setIsOperating(false);
    }
  }, [backend.running, onStart, onStop]);

  // Copy endpoint to clipboard
  const handleCopyEndpoint = useCallback(() => {
    if (backend.endpoint) {
      navigator.clipboard.writeText(backend.endpoint);
    }
  }, [backend.endpoint]);

  return (
    <div className={css.Root} data-test={`local-backend-card-${backend.id}`}>
      {/* Header */}
      <div className={css.Header}>
        <HStack hasSpacing>
          <div className={css.TypeIcon}>
            <Text textType={TextType.Proud}>L</Text>
          </div>
          <VStack>
            <Text textType={TextType.DefaultContrast}>{backend.name}</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              Local SQLite • Port {backend.port}
            </Text>
          </VStack>
        </HStack>

        <div className={css.StatusBadge} style={{ color: statusDisplay.color }}>
          <Icon icon={statusDisplay.icon} size={IconSize.Tiny} UNSAFE_style={{ color: statusDisplay.color }} />
          <Text textType={TextType.Shy} style={{ fontSize: '10px', marginLeft: '4px' }}>
            {statusDisplay.text}
          </Text>
        </div>
      </div>

      {/* Endpoint (when running) */}
      {backend.running && backend.endpoint && (
        <div className={css.Endpoint} onClick={handleCopyEndpoint}>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
            {backend.endpoint}
          </Text>
          <Text textType={TextType.Shy} style={{ fontSize: '10px', marginLeft: '8px' }}>
            (click to copy)
          </Text>
        </div>
      )}

      {/* Info */}
      <div className={css.Info}>
        <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
          Created {createdDate}
        </Text>
      </div>

      {/* Actions */}
      <div className={css.Actions}>
        <HStack hasSpacing>
          <PrimaryButton
            label={isOperating ? 'Processing...' : backend.running ? 'Stop' : 'Start'}
            size={PrimaryButtonSize.Small}
            variant={backend.running ? PrimaryButtonVariant.Muted : PrimaryButtonVariant.Muted}
            onClick={handleToggle}
            isDisabled={isOperating}
          />
          {backend.running && (
            <>
              <PrimaryButton
                label="Data"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setShowDataBrowser(true)}
              />
              <PrimaryButton
                label="Schema"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setShowSchemaPanel(true)}
              />
            </>
          )}
          {onExport && backend.running && (
            <PrimaryButton
              label="Export"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={onExport}
            />
          )}
          <IconButton
            icon={IconName.Trash}
            size={IconSize.Small}
            onClick={onDelete}
            isDisabled={backend.running}
            testId={`delete-local-backend-${backend.id}`}
          />
        </HStack>
      </div>

      {/* Schema Panel (rendered via portal for full-screen overlay) */}
      {showSchemaPanel &&
        createPortal(
          <div className={css.SchemaPanelOverlay}>
            <SchemaPanel
              backendId={backend.id}
              backendName={backend.name}
              isRunning={backend.running}
              onClose={() => setShowSchemaPanel(false)}
            />
          </div>,
          document.body
        )}

      {/* Data Browser (rendered via portal for full-screen overlay) */}
      {showDataBrowser &&
        createPortal(
          <div className={css.SchemaPanelOverlay}>
            <DataBrowser backendId={backend.id} backendName={backend.name} onClose={() => setShowDataBrowser(false)} />
          </div>,
          document.body
        )}
    </div>
  );
}
