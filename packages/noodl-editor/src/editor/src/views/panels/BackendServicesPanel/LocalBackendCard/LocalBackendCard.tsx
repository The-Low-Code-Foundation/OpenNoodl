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
import { MenuDialogItem, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { showContextMenuInPopup } from '../../../ShowContextMenuInPopup';
import { AuthPanel } from '../../auth';
import { DataBrowser } from '../../databrowser';
import { EmailPanel } from '../../email';
import { PermissionsPanel } from '../../permissions';
import { SchemaPanel } from '../../schemamanager';
import { SearchPanel } from '../../search';
import { TriggersPanel } from '../../triggers';
import { LocalBackendInfo } from '../hooks/useLocalBackends';
import css from './LocalBackendCard.module.scss';

export interface LocalBackendCardProps {
  /** Backend information */
  backend: LocalBackendInfo;
  /** Called when start is requested. Pass `{ ephemeral: true }` for non-persisting mode. */
  onStart: (options?: { ephemeral?: boolean }) => Promise<void> | Promise<boolean>;
  /** Called when stop is requested */
  onStop: () => Promise<void> | Promise<boolean>;
  /** Called when delete is requested */
  onDelete: () => void;
  /** Called when export is requested */
  onExport?: () => void;
}

/**
 * Get status icon and color based on running status and persistence mode.
 *
 * Persistence mode is what makes silent data loss visible: a running backend in
 * ephemeral mode looks identical to a persistent one unless we say otherwise.
 */
function getStatusDisplay(backend: LocalBackendInfo): { icon: IconName; color: string; text: string } {
  const mode = backend.persistence?.mode;

  if (backend.running) {
    if (mode === 'ephemeral') {
      return { icon: IconName.WarningTriangle, color: 'var(--theme-color-notice)', text: 'Ephemeral' };
    }
    return { icon: IconName.Check, color: 'var(--theme-color-success)', text: 'Running' };
  }

  if (mode === 'failed') {
    return { icon: IconName.WarningTriangle, color: 'var(--theme-color-danger)', text: 'Persistence unavailable' };
  }
  return { icon: IconName.CircleOpen, color: 'var(--theme-color-fg-default-shy)', text: 'Stopped' };
}

export function LocalBackendCard({ backend, onStart, onStop, onDelete, onExport }: LocalBackendCardProps) {
  const [isOperating, setIsOperating] = useState(false);
  const [showSchemaPanel, setShowSchemaPanel] = useState(false);
  const [showDataBrowser, setShowDataBrowser] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const statusDisplay = getStatusDisplay(backend);

  const isEphemeral = backend.running && backend.persistence?.mode === 'ephemeral';
  const hasFailed = !backend.running && backend.persistence?.mode === 'failed';
  const failureMessage = backend.persistence?.error?.message;

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

  // Explicitly opt in to ephemeral (non-persisting) mode when the native engine
  // is unavailable. This is the only path to the in-memory mock — it is never
  // silently substituted.
  const handleStartEphemeral = useCallback(async () => {
    setIsOperating(true);
    try {
      await onStart({ ephemeral: true });
    } finally {
      setIsOperating(false);
    }
  }, [onStart]);

  // Copy endpoint to clipboard
  const handleCopyEndpoint = useCallback(() => {
    if (backend.endpoint) {
      navigator.clipboard.writeText(backend.endpoint);
    }
  }, [backend.endpoint]);

  // PNL-004: eleven actions cannot all be buttons in a column that is sometimes
  // 240px wide. The three you reach for while building stay on the card; the
  // rest — and everything destructive — move behind `⋯`, which is where a
  // destructive action belongs anyway.
  const handleShowMore = useCallback(() => {
    const items: (MenuDialogItem | 'divider')[] = [];

    if (backend.running) {
      items.push(
        { label: 'Triggers', icon: IconName.Lightning, onClick: () => setShowTriggers(true) },
        { label: 'Email', icon: IconName.Chat, onClick: () => setShowEmail(true) },
        { label: 'Search', icon: IconName.Search, onClick: () => setShowSearch(true) },
        { label: 'Sign-in providers', icon: IconName.User, onClick: () => setShowAuth(true) }
      );

      if (onExport) {
        items.push('divider');
        items.push({ label: 'Export data…', icon: IconName.CloudDownload, onClick: onExport });
      }
    }

    if (items.length) items.push('divider');
    items.push({
      label: 'Delete backend',
      icon: IconName.Trash,
      isDangerous: true,
      // Deleting a running backend would strand its process; stop it first.
      isDisabled: backend.running,
      tooltip: backend.running ? 'Stop the backend before deleting it' : undefined,
      onClick: onDelete,
      testId: `delete-local-backend-${backend.id}`
    });

    showContextMenuInPopup({ items, width: MenuDialogWidth.Default });
  }, [backend.running, backend.id, onDelete, onExport]);

  return (
    <div className={css.Root} data-test={`local-backend-card-${backend.id}`}>
      {/* Header */}
      <div className={css.Header}>
        <div className={css.Identity}>
          <div className={css.TypeIcon}>
            <Text textType={TextType.Proud}>L</Text>
          </div>
          <div className={css.IdentityText}>
            <Text textType={TextType.DefaultContrast}>{backend.name}</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              Local SQLite • Port {backend.port}
            </Text>
          </div>
        </div>

        <div className={css.StatusBadge} style={{ color: statusDisplay.color }}>
          <Icon icon={statusDisplay.icon} size={IconSize.Tiny} UNSAFE_style={{ color: statusDisplay.color }} />
          <Text textType={TextType.Shy} style={{ fontSize: '10px', marginLeft: '4px' }}>
            {statusDisplay.text}
          </Text>
        </div>
      </div>

      {/* Endpoint (when running) */}
      {backend.running && backend.endpoint && (
        <div className={css.Endpoint} onClick={handleCopyEndpoint} title={`${backend.endpoint} — click to copy`}>
          <Text className={css.EndpointUrl} textType={TextType.Shy} style={{ fontSize: '11px' }}>
            {backend.endpoint}
          </Text>
          <span className={css.EndpointHint}>
            <Icon icon={IconName.Copy} size={IconSize.Tiny} />
          </span>
        </div>
      )}

      {/* Ephemeral warning — data written now will NOT survive a restart */}
      {isEphemeral && (
        <div className={css.PersistenceNotice} style={{ color: 'var(--theme-color-notice)' }}>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Tiny} UNSAFE_style={{ color: 'var(--theme-color-notice)' }} />
          <Text className={css.PersistenceNoticeText} textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '6px' }}>
            Ephemeral mode — data is kept in memory only and will be lost when the backend stops or the app restarts.
          </Text>
        </div>
      )}

      {/* Persistence failure — the native SQLite engine could not load */}
      {hasFailed && (
        <div className={css.PersistenceNotice} style={{ color: 'var(--theme-color-danger)' }}>
          <Icon icon={IconName.WarningTriangle} size={IconSize.Tiny} UNSAFE_style={{ color: 'var(--theme-color-danger)' }} />
          <Text className={css.PersistenceNoticeText} textType={TextType.Shy} style={{ fontSize: '11px', marginLeft: '6px' }}>
            {failureMessage
              ? `Cannot persist data: ${failureMessage}`
              : 'The local SQLite engine could not load, so this backend cannot persist data.'}
          </Text>
        </div>
      )}

      {/* Info */}
      <div className={css.Info}>
        <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
          Created {createdDate}
        </Text>
      </div>

      {/* Actions — start/stop owns its own row; the inspection surfaces wrap
          beneath it; everything else is behind `⋯`. */}
      <div className={css.Actions}>
        <div className={css.PrimaryAction}>
          <PrimaryButton
            label={isOperating ? 'Processing…' : backend.running ? 'Stop backend' : 'Start backend'}
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={handleToggle}
            isDisabled={isOperating}
            isGrowing
            testId={`toggle-local-backend-${backend.id}`}
          />
        </div>

        {hasFailed && (
          <div className={css.PrimaryAction}>
            <PrimaryButton
              label="Start ephemeral (no persistence)"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={handleStartEphemeral}
              isDisabled={isOperating}
              isGrowing
            />
          </div>
        )}

        {backend.running && (
          <>
            <div className={css.SecondaryAction}>
              <PrimaryButton
                label="Data"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setShowDataBrowser(true)}
                isGrowing
              />
            </div>
            <div className={css.SecondaryAction}>
              <PrimaryButton
                label="Schema"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setShowSchemaPanel(true)}
                isGrowing
              />
            </div>
            <div className={css.SecondaryAction}>
              <PrimaryButton
                label="Access"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => setShowPermissions(true)}
                isGrowing
              />
            </div>
          </>
        )}

        <div className={css.MoreAction}>
          <IconButton
            icon={IconName.DotsThreeHorizontal}
            size={IconSize.Small}
            onClick={handleShowMore}
            testId={`local-backend-more-${backend.id}`}
          />
        </div>
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

      {/* Permissions (BAK-003) — rendered via portal for full-screen overlay */}
      {showPermissions &&
        createPortal(
          <div className={css.SchemaPanelOverlay}>
            <PermissionsPanel
              backendId={backend.id}
              backendName={backend.name}
              onClose={() => setShowPermissions(false)}
            />
          </div>,
          document.body
        )}

      {/* Triggers (WF-005) — rendered via portal for full-screen overlay */}
      {showTriggers &&
        createPortal(
          <div className={css.SchemaPanelOverlay}>
            <TriggersPanel backendId={backend.id} backendName={backend.name} onClose={() => setShowTriggers(false)} />
          </div>,
          document.body
        )}

      {/* Email (BAK-002) — rendered via portal for full-screen overlay */}
      {showEmail &&
        createPortal(
          <div className={css.SchemaPanelOverlay}>
            <EmailPanel backendId={backend.id} backendName={backend.name} onClose={() => setShowEmail(false)} />
          </div>,
          document.body
        )}

      {/* Sign-in providers (BAK-004) — rendered via portal for full-screen overlay */}
      {showAuth &&
        createPortal(
          <div className={css.SchemaPanelOverlay}>
            <AuthPanel backendId={backend.id} backendName={backend.name} onClose={() => setShowAuth(false)} />
          </div>,
          document.body
        )}

      {/* Search (BAK-008) — rendered via portal for full-screen overlay */}
      {showSearch &&
        createPortal(
          <div className={css.SchemaPanelOverlay}>
            <SearchPanel backendId={backend.id} backendName={backend.name} onClose={() => setShowSearch(false)} />
          </div>,
          document.body
        )}
    </div>
  );
}
