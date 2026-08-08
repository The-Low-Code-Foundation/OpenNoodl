import React, { useEffect, useMemo, useState } from 'react';

import { Checkbox, CheckboxVariant } from '@noodl-core-ui/components/inputs/Checkbox';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Select } from '@noodl-core-ui/components/inputs/Select';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { formatBytes, formatRemaining, UpdateState, UpdateVersion } from './useUpdateState';

const DIALOG_STYLE: React.CSSProperties = {
  width: '520px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const NOTES_STYLE: React.CSSProperties = {
  overflowY: 'auto',
  minHeight: 0,
  flex: '1 1 auto',
  whiteSpace: 'pre-wrap',
  // The notes are release markdown. Rendering them as markdown would mean
  // shipping a renderer into a dialog for one string; monospace-free preformatted
  // text reads acceptably and cannot execute anything from a release body.
  fontSize: '12px',
  lineHeight: 1.6
};

const PROGRESS_TRACK: React.CSSProperties = {
  height: '6px',
  borderRadius: 'var(--radius-full)',
  backgroundColor: 'var(--muted)',
  overflow: 'hidden'
};

function progressFill(percent: number): React.CSSProperties {
  return {
    height: '100%',
    width: `${Math.max(2, Math.min(100, percent))}%`,
    backgroundColor: 'var(--primary)',
    transition: 'width 200ms linear'
  };
}

export interface UpdateDialogProps {
  state: UpdateState;
  onDownload: (version?: string) => void;
  onInstall: () => void;
  onDismiss: () => void;
  onSetIncludePrereleases: (include: boolean) => void;
  onClose: () => void;
}

/**
 * What an update is and what it would change, before anything is downloaded.
 *
 * The previous dialog appeared *after* a silent 169MB download and said only
 * "a new version has been downloaded". Everything here follows from that being
 * the wrong shape: the release notes are the point (an update can carry
 * breaking changes and the user is entitled to know before consenting), the
 * version is a choice rather than an assumption, and the progress is visible so
 * nobody quits halfway through believing nothing is happening.
 */
export function UpdateDialog({
  state,
  onDownload,
  onInstall,
  onDismiss,
  onSetIncludePrereleases,
  onClose
}: UpdateDialogProps) {
  const offerable = useMemo(
    () => state.versions.filter((v) => state.includePrereleases || !v.prerelease),
    [state.versions, state.includePrereleases]
  );

  const [selected, setSelected] = useState<string | undefined>(undefined);

  // Follow the main process's target until the user picks something, then stop:
  // a background re-check that moves `targetVersion` must not silently change
  // what the user is about to install.
  useEffect(() => {
    if (selected === undefined && state.targetVersion) setSelected(state.targetVersion);
  }, [state.targetVersion, selected]);

  const chosen: UpdateVersion | undefined = offerable.find((v) => v.version === selected);
  const notes = chosen?.notes || state.releaseNotes || '';
  const isBusy = state.status === 'downloading';
  const isReady = state.status === 'downloaded';

  const options = offerable.map((v) => ({
    label: `${v.version}${v.prerelease ? ' (pre-release)' : ''}${v === offerable[0] ? ' — latest' : ''}`,
    value: v.version
  }));

  // The picker is only meaningful once the list has arrived; until then the
  // dialog still works, offering the one version the updater found.
  const hasChoice = options.length > 1;

  return (
    <CoreBaseDialog
      title={isReady ? 'Ready to install' : 'Update available'}
      isVisible
      hasBackdrop
      onClose={isBusy ? undefined : onClose}
    >
      <div style={DIALOG_STYLE}>
        <Box hasXSpacing hasTopSpacing>
          <VStack>
            <Text>
              You are on {state.currentVersion}
              {selected ? `. This will install ${selected}.` : '.'}
            </Text>

            {hasChoice && (
              <Box hasTopSpacing hasBottomSpacing>
                <Select
                  label="Version"
                  options={options}
                  value={selected}
                  isDisabled={isBusy || isReady}
                  onChange={(value) => setSelected(String(value))}
                />
              </Box>
            )}

            {state.versions.some((v) => v.prerelease) && (
              <Checkbox
                label="Include pre-releases"
                variant={CheckboxVariant.Sidebar}
                isChecked={state.includePrereleases}
                isDisabled={isBusy || isReady}
                onChange={(event) => onSetIncludePrereleases(event.target.checked)}
              />
            )}
          </VStack>
        </Box>

        <Box hasXSpacing hasTopSpacing UNSAFE_style={{ minHeight: 0, flex: '1 1 auto', display: 'flex' }}>
          {notes ? (
            <div style={NOTES_STYLE}>
              <Text textType={TextType.Secondary}>{notes}</Text>
            </div>
          ) : (
            <Text textType={TextType.Secondary}>No release notes were published for this version.</Text>
          )}
        </Box>

        {(isBusy || isReady) && (
          <Box hasXSpacing hasTopSpacing>
            <VStack>
              <div style={PROGRESS_TRACK}>
                <div style={progressFill(isReady ? 100 : state.percent)} />
              </div>
              <Box hasTopSpacing>
                <Text textType={TextType.Secondary}>
                  {isReady
                    ? 'Downloaded. NodeGX will restart to finish installing.'
                    : `Downloading ${formatBytes(state.transferred)} of ${formatBytes(state.total)}` +
                      `${formatRemaining(state) ? ` — ${formatRemaining(state)}` : ''}`}
                </Text>
              </Box>
              {isBusy && (
                <Text textType={TextType.Secondary}>Keep NodeGX open until this finishes.</Text>
              )}
            </VStack>
          </Box>
        )}

        {state.status === 'error' && state.error && (
          <Box hasXSpacing hasTopSpacing>
            <Text textType={TextType.Danger}>The update could not be downloaded: {state.error}</Text>
          </Box>
        )}

        <Box hasXSpacing hasYSpacing UNSAFE_style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {!isBusy && !isReady && (
            <>
              <PrimaryButton
                label="Not now"
                variant={PrimaryButtonVariant.Muted}
                size={PrimaryButtonSize.Small}
                isFitContent
                onClick={onDismiss}
                testId="update-dismiss"
              />
              <PrimaryButton
                label={state.status === 'error' ? 'Try again' : 'Download and install'}
                size={PrimaryButtonSize.Small}
                isFitContent
                onClick={() => onDownload(selected)}
                testId="update-download"
              />
            </>
          )}

          {isReady && (
            <>
              <PrimaryButton
                label="Later"
                variant={PrimaryButtonVariant.Muted}
                size={PrimaryButtonSize.Small}
                isFitContent
                onClick={onClose}
                testId="update-later"
              />
              <PrimaryButton
                label="Restart now"
                size={PrimaryButtonSize.Small}
                isFitContent
                onClick={onInstall}
                testId="update-install"
              />
            </>
          )}
        </Box>
      </div>
    </CoreBaseDialog>
  );
}
