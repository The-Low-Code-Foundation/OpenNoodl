/**
 * ScanningStep
 *
 * Step 2 of the migration wizard: Shows progress while copying and scanning.
 * Also used during the migration phase (step 4).
 *
 * @module noodl-editor/views/migration/steps
 * @since 1.2.0
 */

import React from 'react';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import { MigrationProgress } from '../../../models/migration/types';

import css from './ScanningStep.module.scss';

export interface ScanningStepProps {
  /** Path to the source project */
  sourcePath: string;
  /** Path to the target project */
  targetPath: string;
  /** Whether we're in migration phase (vs scanning phase) */
  isMigrating?: boolean;
  /** Progress information (for migration phase) */
  progress?: MigrationProgress;
}

export function ScanningStep({
  sourcePath: _sourcePath,
  targetPath: _targetPath,
  isMigrating = false,
  progress
}: ScanningStepProps) {
  // sourcePath and targetPath are available for future use (e.g., displaying paths)
  void _sourcePath;
  void _targetPath;
  const title = isMigrating ? 'Migrating Project...' : 'Analyzing Project...';
  const subtitle = isMigrating
    ? `Phase: ${getPhaseLabel(progress?.phase)}`
    : 'Creating a safe copy before making any changes';

  const progressPercent = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className={css['Root']}>
      <VStack hasSpacing>
        <div className={css['Header']}>
          <ActivityIndicator />
          <Title size={TitleSize.Medium}>{title}</Title>
        </div>

        <Text textType={TextType.Secondary}>{subtitle}</Text>

        {/* Progress Bar */}
        <div className={css['ProgressSection']}>
          <div className={css['ProgressBar']}>
            <div
              className={css['ProgressFill']}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress && (
            <Text size={TextSize.Small} textType={TextType.Shy}>
              {progress.current} / {progress.total} components
            </Text>
          )}
        </div>

        {/* Current Item */}
        {progress?.currentComponent && (
          <div className={css['CurrentItem']}>
            <svg viewBox="0 0 16 16" width={14} height={14}>
              <path
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                fill="currentColor"
              />
            </svg>
            <Text size={TextSize.Small}>{progress.currentComponent}</Text>
          </div>
        )}

        {/* Log Entries */}
        {progress?.log && progress.log.length > 0 && (
          <div className={css['LogSection']}>
            <Title size={TitleSize.Small}>Activity Log</Title>
            <div className={css['LogEntries']}>
              {progress.log.slice(-5).map((entry, index) => (
                <div
                  key={index}
                  className={`${css['LogEntry']} ${css[`is-${entry.level}`]}`}
                >
                  <LogIcon level={entry.level} />
                  <div className={css['LogContent']}>
                    {entry.component && (
                      <Text
                        size={TextSize.Small}
                        textType={TextType.Proud}
                        isSpan
                      >
                        {entry.component}:{' '}
                      </Text>
                    )}
                    <Text size={TextSize.Small} isSpan>
                      {entry.message}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <Box hasTopSpacing>
          <div className={css['InfoBox']}>
            <Text textType={TextType.Shy} size={TextSize.Small}>
              {isMigrating
                ? 'Please wait while we migrate your project. This may take a few minutes for larger projects.'
                : 'Scanning components for React 17 patterns that need updating...'}
            </Text>
          </div>
        </Box>
      </VStack>
    </div>
  );
}

// Helper Components
function LogIcon({ level }: { level: string }) {
  const icons: Record<string, JSX.Element> = {
    info: (
      <svg viewBox="0 0 16 16" width={12} height={12}>
        <path
          d="M8 16A8 8 0 108 0a8 8 0 000 16zm.93-9.412l-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287h.001zm-.043-3.33a.86.86 0 110 1.72.86.86 0 010-1.72z"
          fill="currentColor"
        />
      </svg>
    ),
    success: (
      <svg viewBox="0 0 16 16" width={12} height={12}>
        <path
          d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
          fill="currentColor"
        />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 16 16" width={12} height={12}>
        <path
          d="M8.863 1.035c-.39-.678-1.336-.678-1.726 0L.187 12.78c-.403.7.096 1.57.863 1.57h13.9c.767 0 1.266-.87.863-1.57L8.863 1.035zM8 5a.75.75 0 01.75.75v2.5a.75.75 0 11-1.5 0v-2.5A.75.75 0 018 5zm0 7a1 1 0 100-2 1 1 0 000 2z"
          fill="currentColor"
        />
      </svg>
    ),
    error: (
      <svg viewBox="0 0 16 16" width={12} height={12}>
        <path
          d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"
          fill="currentColor"
        />
      </svg>
    )
  };

  return icons[level] || icons.info;
}

function getPhaseLabel(phase?: string): string {
  const labels: Record<string, string> = {
    copying: 'Copying files',
    automatic: 'Applying automatic fixes',
    'ai-assisted': 'AI-assisted migration',
    finalizing: 'Finalizing'
  };
  return labels[phase || ''] || 'Starting';
}

export default ScanningStep;
