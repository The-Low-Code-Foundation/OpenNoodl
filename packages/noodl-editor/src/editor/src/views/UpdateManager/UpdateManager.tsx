import React, { useEffect, useState } from 'react';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { UpdateDialog } from './UpdateDialog';
import { formatRemaining, useUpdateState } from './useUpdateState';

const PILL_STYLE: React.CSSProperties = {
  position: 'fixed',
  right: '16px',
  bottom: '16px',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 14px',
  borderRadius: 'var(--radius-lg)',
  backgroundColor: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-lg)',
  cursor: 'pointer',
  maxWidth: '320px'
};

const PILL_TRACK: React.CSSProperties = {
  height: '4px',
  width: '100%',
  borderRadius: 'var(--radius-full)',
  backgroundColor: 'var(--muted)',
  overflow: 'hidden',
  marginTop: '6px'
};

export interface UpdateManagerProps {
  /**
   * Open the dialog from outside — the editor's title bar already has an
   * "update available" affordance and this is what it now opens.
   */
  isDialogRequested?: boolean;
  onDialogRequestHandled?: () => void;
  /** Told whenever an update is on offer, so a host can light up its own indicator. */
  onAvailabilityChange?: (isAvailable: boolean) => void;
}

/**
 * The whole update surface: the dialog, and a progress pill that outlives it.
 *
 * Mounted in both the launcher and the editor. The pill exists because the
 * dialog is dismissible and the download is not: closing the window that was
 * showing progress used to leave a 169MB transfer running with nothing on
 * screen to say so, which is precisely how someone quits mid-update believing
 * the app is idle.
 */
export function UpdateManager({
  isDialogRequested,
  onDialogRequestHandled,
  onAvailabilityChange
}: UpdateManagerProps) {
  const { state, download, install, dismiss, setIncludePrereleases, listVersions } = useUpdateState();
  const [isOpen, setIsOpen] = useState(false);

  const isAvailable = state.status === 'available' || state.status === 'downloaded';

  // Offer it once, unprompted, when one appears. `dismissed` is what stops it
  // coming back for the rest of the session after "Not now".
  useEffect(() => {
    if (state.status === 'available' && !state.dismissed) setIsOpen(true);
    if (state.status === 'downloaded') setIsOpen(true);
  }, [state.status, state.dismissed]);

  // The version list is only worth fetching once there is something to choose
  // between, and only once.
  useEffect(() => {
    if (isOpen && state.versions.length === 0) listVersions();
  }, [isOpen, state.versions.length, listVersions]);

  useEffect(() => {
    if (isDialogRequested) {
      setIsOpen(true);
      onDialogRequestHandled?.();
    }
  }, [isDialogRequested, onDialogRequestHandled]);

  useEffect(() => {
    onAvailabilityChange?.(isAvailable);
  }, [isAvailable, onAvailabilityChange]);

  const isDownloading = state.status === 'downloading';
  const showPill = !isOpen && (isDownloading || state.status === 'downloaded');

  return (
    <>
      {isOpen && (
        <UpdateDialog
          state={state}
          onDownload={(version) => download(version)}
          onInstall={install}
          onSetIncludePrereleases={setIncludePrereleases}
          onDismiss={() => {
            dismiss();
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}

      {showPill && (
        <div
          style={PILL_STYLE}
          onClick={() => setIsOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') setIsOpen(true);
          }}
          data-test="update-progress-pill"
        >
          <div style={{ flex: 1 }}>
            <Text textType={TextType.Default}>
              {isDownloading ? `Downloading ${state.targetVersion ?? 'update'}… ${state.percent}%` : 'Update ready'}
            </Text>
            {isDownloading ? (
              <>
                <div style={PILL_TRACK}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(2, state.percent)}%`,
                      backgroundColor: 'var(--primary)',
                      transition: 'width 200ms linear'
                    }}
                  />
                </div>
                <Text textType={TextType.Secondary}>{formatRemaining(state) ?? 'Keep NodeGX open'}</Text>
              </>
            ) : (
              <Text textType={TextType.Secondary}>Click to restart and finish</Text>
            )}
          </div>
        </div>
      )}
    </>
  );
}
