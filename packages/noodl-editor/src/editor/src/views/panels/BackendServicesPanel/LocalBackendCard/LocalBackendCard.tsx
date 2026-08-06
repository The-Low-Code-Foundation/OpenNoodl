/**
 * LocalBackendCard
 *
 * Card component for displaying and managing a local SQLite backend.
 * Shows status, start/stop controls, and endpoint information.
 *
 * @module BackendServicesPanel/LocalBackendCard
 * @since 1.2.0
 */

import classNames from 'classnames';
import React, { useCallback, useState } from 'react';

import { dataBrowserAvailability, securityFor } from '@noodl-models/BackendServices';
import { SidebarModel } from '@noodl-models/sidebar';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { MenuDialogItem, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { showContextMenuInPopup } from '../../../ShowContextMenuInPopup';
import { LocalBackendInfo } from '../hooks/useLocalBackends';
import { SecurityDisclosure } from '../SecurityDisclosure/SecurityDisclosure';
import { CloudFunctionsSection } from './CloudFunctionsSection';
import { BACKEND_SERVICES_PANEL_ID, BackendSurfaceKind, openBackendSurface } from './backendSurfaces';
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
  /** Called when a rename is requested. Absent means renaming is unavailable. */
  onRename?: () => void;
  /** Called when export is requested */
  onExport?: () => void;
  /** WFA-001: push the project's cloud functions to this backend now. */
  onDeployCloudFunctions: () => Promise<boolean>;
  /**
   * AAQ-002 — the project's `cloudservices` pointer names this backend.
   *
   * Before this, that fact lived on a *second* card (the endpoint one) which
   * wore the ACTIVE badge and offered nothing but Edit and Disconnect, while
   * this card — the one that can open the schema and the data — looked like an
   * unrelated server. One backend, two cards, and the crippled one on top.
   */
  isProjectEndpoint?: boolean;
  /** Is this backend the project's active selection? Only meaningful with {@link isProjectEndpoint}. */
  isActive?: boolean;
  /** Make this backend the project's active selection. Absent when it already is. */
  onSetActive?: () => void;
  /** Stop this project pointing at this backend. The backend and its data stay. */
  onDisconnect?: () => void;
  /** BCN-009's sentence for a project that still has a second bound backend. */
  conflictNote?: string;
  /**
   * Names of OTHER known local projects whose `cloudservices` also points at
   * this backend (the open project is never in this list — {@link
   * isProjectEndpoint} already says that). One backend shared across projects
   * is normal, not a mistake, but nothing on this card said so before — a
   * user deleting "an unused-looking backend" had no way to know.
   */
  otherProjectNames?: string[];
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

export function LocalBackendCard({
  backend,
  onStart,
  onStop,
  onDelete,
  onRename,
  onExport,
  onDeployCloudFunctions,
  isProjectEndpoint = false,
  isActive = false,
  onSetActive,
  onDisconnect,
  conflictNote,
  otherProjectNames
}: LocalBackendCardProps) {
  const [isOperating, setIsOperating] = useState(false);
  const statusDisplay = getStatusDisplay(backend);
  const dataBrowser = dataBrowserAvailability('nodegx', 'managed');

  /**
   * PNL-009: open a backend surface as a panel.
   *
   * This replaces seven `createPortal(…, document.body)` calls into a
   * `position: fixed` overlay with an 85%-black scrim. The surface is now a
   * registered (transient) panel, so it arrives with the rail still live, a
   * header, `Escape`, and a remembered width — see `backendSurfaces.tsx` for why
   * registration was chosen over an ad-hoc child of full mode.
   *
   * POL-005: this used to follow the open with `layout.openFull()`, which
   * stretched an 860px-designed layout across the whole editor. All seven
   * surfaces declare `defaultWidth: SURFACE_DEFAULT_WIDTH` (860) because that is
   * the width the 900px modals they came from were laid out at, and full mode
   * threw that away on every open.
   *
   * Richard reported it as "an extra X in the top right that just collapses the
   * view", and then diagnosed it correctly himself: "the collapsed version looks
   * perfect — maybe just make that the default and take away that weird
   * collapsing X." The X was never an extra button. It is PNL-009's
   * detached-panel bar, which renders only when `isDetached`, and it calls
   * `dock()` — i.e. it took the panel back to the 860px the surfaces were built
   * for. Dropping `openFull()` fixes both halves at once: the surfaces open at
   * their designed width, and the bar stops existing because nothing on this
   * path detaches any more.
   *
   * Float and full are still reachable from the panel header for a user who
   * chooses them, and that path still gets the detached bar. That is coherent —
   * what was wrong was arriving there without asking.
   */
  const openSurface = useCallback(
    (kind: BackendSurfaceKind) => {
      openBackendSurface(kind, {
        backendId: backend.id,
        backendName: backend.name,
        isRunning: backend.running,
        // No `dock()` here any more: this path never detaches, so docking on
        // close was returning the panel to the mode it was already in. A user
        // who chose full from the header keeps it, which is what they asked for.
        onClose: () => SidebarModel.instance.switch(BACKEND_SERVICES_PANEL_ID)
      });
    },
    [backend.id, backend.name, backend.running]
  );

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

    if (onRename) {
      items.push({
        label: 'Rename',
        icon: IconName.Pencil,
        onClick: onRename,
        testId: `rename-local-backend-${backend.id}`
      });
      items.push('divider');
    }

    if (backend.running) {
      items.push(
        { label: 'Triggers', icon: IconName.Lightning, onClick: () => openSurface('triggers') },
        { label: 'Email', icon: IconName.Chat, onClick: () => openSurface('email') },
        { label: 'Search', icon: IconName.Search, onClick: () => openSurface('search') },
        { label: 'Sign-in providers', icon: IconName.User, onClick: () => openSurface('auth') }
      );

      if (onExport) {
        items.push('divider');
        items.push({ label: 'Export data…', icon: IconName.CloudDownload, onClick: onExport });
      }
    }

    // AAQ-002: the endpoint card's own action, on the card that now stands for
    // the endpoint. Behind `⋯` with the other rarely-used ones, and never
    // labelled in a way that could read as deleting the backend — the dialog it
    // opens says what survives.
    if (onDisconnect) {
      if (items.length) items.push('divider');
      items.push({
        label: 'Disconnect from this project',
        icon: IconName.Link,
        onClick: onDisconnect,
        testId: `disconnect-local-backend-${backend.id}`
      });
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
  }, [backend.running, backend.id, onDelete, onRename, onDisconnect, onExport, openSurface]);

  return (
    <div
      className={classNames(css.Root, { [css.IsProjectEndpoint]: isProjectEndpoint })}
      data-test={`local-backend-card-${backend.id}`}
    >
      {/* Header */}
      <div className={css.Header}>
        <div className={css.Identity}>
          <div className={css.TypeIcon}>
            <Text textType={TextType.Proud}>L</Text>
          </div>
          <div className={css.IdentityText}>
            <Text textType={TextType.DefaultContrast}>{backend.name}</Text>
            {/* BCN-009: "Built-in", not "Local SQLite". The name that describes
                the technology dates the moment the technology changes, and this
                is the same backend the preset list now names — one word in two
                places is how a list stops reading as two products. */}
            <Text textType={TextType.Shy} style={{ fontSize: '11px' }}>
              Built-in • Port {backend.port}
            </Text>
          </div>
        </div>

        <div className={css.StatusBadge} style={{ color: statusDisplay.color }}>
          {/* AAQ-002: the ACTIVE badge belongs to the card that can open the
              backend it is a badge for. It used to sit on a second card that
              could only be edited or disconnected. */}
          {isActive && (
            <Text textType={TextType.Shy} style={{ fontSize: '10px', marginRight: '8px' }} testId="local-active-badge">
              ACTIVE
            </Text>
          )}
          <Icon icon={statusDisplay.icon} size={IconSize.Tiny} UNSAFE_style={{ color: statusDisplay.color }} />
          <Text textType={TextType.Shy} style={{ fontSize: '10px', marginLeft: '4px' }}>
            {statusDisplay.text}
          </Text>
        </div>
      </div>

      {/* AAQ-002: which project this backend is serving, said on the card
          itself — the fact that used to be the whole content of a second one.
          Bolded and colour-matched to the card's own highlighted border
          (above) rather than the same shy 11px as everything else, so it does
          not read as one more line of fine print. */}
      {isProjectEndpoint && (
        <div className={css.Endpoint} style={{ cursor: 'default' }}>
          <Text
            textType={TextType.DefaultContrast}
            style={{ fontSize: '11px', color: 'var(--theme-color-primary)' }}
            testId="local-backend-project-endpoint"
          >
            ● This project uses this backend
          </Text>
        </div>
      )}
      {/* A backend with no data of its own — it is a pointer other projects
          share. Named here so deleting it is an informed choice, not a
          surprise for whoever opens the other project next. */}
      {Boolean(otherProjectNames?.length) && (
        <div className={css.Endpoint} style={{ cursor: 'default' }}>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }} testId="local-backend-other-projects">
            {isProjectEndpoint ? 'Also used by: ' : 'Used by: '}
            {otherProjectNames.join(', ')}
          </Text>
        </div>
      )}
      {conflictNote && (
        <div className={css.Endpoint} style={{ cursor: 'default' }}>
          <Text textType={TextType.Shy} style={{ fontSize: '11px' }} testId="backend-selection-conflict">
            {conflictNote}
          </Text>
        </div>
      )}

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
          <Icon
            icon={IconName.WarningTriangle}
            size={IconSize.Tiny}
            UNSAFE_style={{ color: 'var(--theme-color-notice)' }}
          />
          <Text
            className={css.PersistenceNoticeText}
            textType={TextType.Shy}
            style={{ fontSize: '11px', marginLeft: '6px' }}
          >
            Ephemeral mode — data is kept in memory only and will be lost when the backend stops or the app restarts.
          </Text>
        </div>
      )}

      {/* Persistence failure — the native SQLite engine could not load */}
      {hasFailed && (
        <div className={css.PersistenceNotice} style={{ color: 'var(--theme-color-danger)' }}>
          <Icon
            icon={IconName.WarningTriangle}
            size={IconSize.Tiny}
            UNSAFE_style={{ color: 'var(--theme-color-danger)' }}
          />
          <Text
            className={css.PersistenceNoticeText}
            textType={TextType.Shy}
            style={{ fontSize: '11px', marginLeft: '6px' }}
          >
            {failureMessage
              ? `Cannot persist data: ${failureMessage}`
              : 'The local SQLite engine could not load, so this backend cannot persist data.'}
          </Text>
        </div>
      )}

      {/* BCN-009: what choosing this backend publishes. Same component, same
          words, on every card in the list. */}
      <SecurityDisclosure disclosure={securityFor('nodegx')} testId={`backend-security-${backend.id}`} />

      {/* WFA-001: what this backend is serving, and how to push again. */}
      <CloudFunctionsSection
        backendId={backend.id}
        isRunning={backend.running}
        onDeploy={onDeployCloudFunctions}
      />

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

        {/* AAQ-002: the affordance every other card has, on the card that now
            stands for the endpoint too. Present only when this backend IS the
            project's endpoint and something else holds the selection. */}
        {isProjectEndpoint && onSetActive && (
          <div className={css.PrimaryAction}>
            <PrimaryButton
              label="Set active"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              onClick={onSetActive}
              isGrowing
              testId={`set-active-local-backend-${backend.id}`}
            />
          </div>
        )}

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
            {/* BCN-009: the same gate the external cards ask, so the two
                cannot disagree about who may open a record grid. */}
            <div className={css.SecondaryAction} title={dataBrowser.reason}>
              <PrimaryButton
                label="Data"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => openSurface('data')}
                isDisabled={!dataBrowser.isAvailable}
                isGrowing
                testId={`open-data-${backend.id}`}
              />
            </div>
            <div className={css.SecondaryAction}>
              <PrimaryButton
                label="Schema"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => openSurface('schema')}
                isGrowing
                testId={`open-schema-${backend.id}`}
              />
            </div>
            <div className={css.SecondaryAction}>
              <PrimaryButton
                label="Access"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={() => openSurface('permissions')}
                isGrowing
                testId={`open-permissions-${backend.id}`}
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

      {/* PNL-009: the seven full-screen surfaces used to be rendered from here
          through `createPortal(…, document.body)` into a `position: fixed`
          overlay with a hardcoded 85%-black scrim. They are registered panels
          now and open in full mode — see `openSurface` above and
          `backendSurfaces.tsx` for the reasoning. Nothing renders here. */}
    </div>
  );
}
