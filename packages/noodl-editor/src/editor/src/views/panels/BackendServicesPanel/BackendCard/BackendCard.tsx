/**
 * Backend Card Component
 *
 * Displays a single backend configuration with status and actions.
 *
 * @module BackendServicesPanel
 * @since 1.2.0
 */

import React, { useCallback } from 'react';

import { BackendConfig, ConnectionStatus, dataBrowserAvailability, securityFor } from '@noodl-models/BackendServices';
import { getPreset } from '@noodl-models/BackendServices/presets';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { MenuDialogItem, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { showContextMenuInPopup } from '../../../ShowContextMenuInPopup';
import { SecurityDisclosure } from '../SecurityDisclosure/SecurityDisclosure';
import css from './BackendCard.module.scss';

export interface BackendCardProps {
  backend: BackendConfig;
  isActive: boolean;
  /**
   * The sentence for a legacy project that is still bound to this backend from
   * the Data nodes while something else is the project's active backend.
   *
   * BCN-009 step 2 converged the selection, but it refuses to converge the one
   * case where either answer would silently repoint a family of nodes. This is
   * how that case is said out loud instead of shown as a second ACTIVE badge.
   */
  conflictNote?: string;
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
  conflictNote,
  onSetActive,
  onDelete,
  onTestConnection,
  onFetchSchema
}: BackendCardProps) {
  const preset = getPreset(backend.type);
  const statusDisplay = getStatusDisplay(backend.status);

  // BCN-009: the record grid is offered on every card now, and where it cannot
  // be opened it says why rather than being absent — an absent button reads as
  // "this backend has no data", which is the opposite of true. See
  // `dataBrowserAvailability` for the two gates and why the transport one is
  // still the binding constraint for anything but a locally-run backend.
  const dataBrowser = dataBrowserAvailability(backend.type, 'external');

  // PNL-004: destructive actions belong behind the menu, not one mis-click away
  // from "Sync schema" in a row that used to scroll sideways.
  const handleShowMore = useCallback(() => {
    const items: (MenuDialogItem | 'divider')[] = [
      // BCN-009: the record grid appears on every backend's menu, and where it
      // cannot be opened it says why. Absent would read as "this backend has no
      // records to browse", which is the opposite of true — the constraint is
      // ours, not the backend's, and the sentence says so.
      {
        label: 'Browse records',
        icon: IconName.Database,
        isDisabled: !dataBrowser.isAvailable,
        tooltip: dataBrowser.reason,
        onClick: () => undefined,
        testId: `open-data-${backend.id}`
      },
      'divider',
      {
        label: 'Delete backend',
        icon: IconName.Trash,
        isDangerous: true,
        onClick: onDelete,
        testId: `delete-backend-${backend.id}`
      }
    ];

    showContextMenuInPopup({ items, width: MenuDialogWidth.Default });
  }, [backend.id, dataBrowser.isAvailable, dataBrowser.reason, onDelete]);

  return (
    <div className={`${css.Root} ${isActive ? css.Active : ''}`} data-test={`backend-card-${backend.id}`}>
      {/* Header */}
      <div className={css.Header}>
        <div className={css.Identity}>
          <div className={css.TypeIcon}>
            <Text textType={TextType.Proud}>{preset.displayName.charAt(0).toUpperCase()}</Text>
          </div>
          <div className={css.IdentityText} title={`${backend.name}\n${backend.url}`}>
            <Text textType={TextType.DefaultContrast}>{backend.name}</Text>
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              {preset.displayName} • {backend.url}
            </Text>
          </div>
        </div>

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
        <div className={css.StatusLine}>
          <Icon icon={statusDisplay.icon} size={IconSize.Tiny} UNSAFE_style={{ color: statusDisplay.color }} />
          <Text textType={TextType.Shy}>{statusDisplay.text}</Text>
          {backend.lastSynced && (
            <Text textType={TextType.Shy} style={{ fontSize: '10px' }}>
              • Last sync: {new Date(backend.lastSynced).toLocaleTimeString()}
            </Text>
          )}
        </div>
        {backend.lastError && (
          <Text
            className={css.StatusError}
            textType={TextType.Shy}
            style={{ fontSize: '11px', color: 'var(--theme-color-danger)' }}
          >
            {backend.lastError}
          </Text>
        )}
        {/* Not red and not a banner: nothing is broken, the project is in a state
            a previous build allowed, and the fix is the `Set active` button that
            is already on this card. */}
        {conflictNote && (
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }} testId={`backend-conflict-${backend.id}`}>
            {conflictNote}
          </Text>
        )}
      </div>

      {/* BCN-009: what choosing this backend publishes. Every card carries one,
          including the ones that publish nothing a visitor can use — an absent
          disclosure would read as a claim, and it is not the same claim. */}
      <SecurityDisclosure disclosure={securityFor(backend.type)} testId={`backend-security-${backend.id}`} />

      {/* Schema Info */}
      {backend.schema && backend.schema.collections.length > 0 && (
        <div className={css.SchemaInfo}>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }} testId={`backend-schema-info-${backend.id}`}>
            {backend.schema.collections.length} collection{backend.schema.collections.length !== 1 ? 's' : ''}
            {/* BCN-005 schema sync: relations are read here or nowhere. Relation metadata
                is admin-only on every REST backend, so this line is the only feedback a
                user gets that the privileged half of the sync succeeded — a backend whose
                token can read `/fields` but not `/relations` syncs collections and no
                relations, and without this the two outcomes look identical. Shown only
                when there are some: "0 relations" on a backend that has none would read
                as a failure. */}
            {backend.schema.relations && backend.schema.relations.length > 0
              ? `, ${backend.schema.relations.length} relation${backend.schema.relations.length !== 1 ? 's' : ''}`
              : ''}
          </Text>
        </div>
      )}

      {/* Actions — the primary action owns its own row; the two inspection
          actions wrap beneath it; delete is destructive and lives behind `⋯`. */}
      <div className={css.Actions}>
        {!isActive && (
          <div className={css.PrimaryAction}>
            <PrimaryButton
              label="Set active"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={onSetActive}
              testId={`set-active-${backend.id}`}
              isGrowing
            />
          </div>
        )}
        <div className={css.SecondaryAction}>
          <PrimaryButton
            label="Test"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onTestConnection}
            isGrowing
          />
        </div>
        <div className={css.SecondaryAction}>
          <PrimaryButton
            label="Sync schema"
            size={PrimaryButtonSize.Small}
            variant={PrimaryButtonVariant.Muted}
            onClick={onFetchSchema}
            isGrowing
          />
        </div>
        <div className={css.MoreAction}>
          <IconButton
            icon={IconName.DotsThreeHorizontal}
            size={IconSize.Small}
            onClick={handleShowMore}
            testId={`backend-more-${backend.id}`}
          />
        </div>
      </div>
    </div>
  );
}
