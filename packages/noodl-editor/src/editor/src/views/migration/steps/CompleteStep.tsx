/**
 * CompleteStep
 *
 * Step 5 of the migration wizard: Shows final summary.
 *
 * @module noodl-editor/views/migration/steps
 * @since 1.2.0
 */

import React from 'react';

import { PrimaryButton } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import { MigrationResult } from '../../../models/migration/types';

import css from './CompleteStep.module.scss';

export interface CompleteStepProps {
  /** Migration result */
  result: MigrationResult;
  /** Path to the source project */
  sourcePath: string;
  /** Path to the migrated project */
  targetPath: string;
  /** Called when user wants to open the migrated project */
  onOpenProject: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export function CompleteStep({
  result,
  sourcePath,
  targetPath,
  onOpenProject
}: CompleteStepProps) {
  const hasIssues = result.needsReview > 0;

  return (
    <div className={css['Root']}>
      <VStack hasSpacing>
        {/* Header */}
        <div className={css['Header']}>
          {hasIssues ? <CheckWarningIcon /> : <CheckCircleIcon />}
          <Title size={TitleSize.Medium}>
            {hasIssues ? 'Migration Complete (With Notes)' : 'Migration Complete!'}
          </Title>
        </div>

        <Text textType={TextType.Secondary}>
          Your project has been migrated to React 19. The original project remains untouched.
        </Text>

        {/* Stats */}
        <div className={css['Stats']}>
          <StatCard
            icon={<CheckIcon />}
            value={result.migrated}
            label="Migrated"
            variant="success"
          />
          {result.needsReview > 0 && (
            <StatCard
              icon={<WarningIcon />}
              value={result.needsReview}
              label="Needs Review"
              variant="warning"
            />
          )}
          {result.failed > 0 && (
            <StatCard
              icon={<ErrorIcon />}
              value={result.failed}
              label="Failed"
              variant="error"
            />
          )}
        </div>

        {/* Duration and Cost */}
        <div className={css['MetaInfo']}>
          <div className={css['MetaItem']}>
            <ClockIcon />
            <Text size={TextSize.Small}>Time: {formatDuration(result.duration)}</Text>
          </div>
          {result.totalCost > 0 && (
            <div className={css['MetaItem']}>
              <RobotIcon />
              <Text size={TextSize.Small}>AI cost: ${result.totalCost.toFixed(2)}</Text>
            </div>
          )}
        </div>

        {/* Project Paths */}
        <div className={css['Paths']}>
          <Title size={TitleSize.Small}>Project Locations</Title>

          <div className={css['PathItem']}>
            <LockIcon />
            <div className={css['PathContent']}>
              <Text size={TextSize.Small} textType={TextType.Shy}>Original (untouched)</Text>
              <Text size={TextSize.Small}>{sourcePath}</Text>
            </div>
          </div>

          <div className={css['PathItem']}>
            <FolderIcon />
            <div className={css['PathContent']}>
              <Text size={TextSize.Small} textType={TextType.Shy}>Migrated copy</Text>
              <Text size={TextSize.Small}>{targetPath}</Text>
            </div>
          </div>
        </div>

        {/* What's Next */}
        <div className={css['NextSteps']}>
          <Title size={TitleSize.Small}>What&apos;s Next?</Title>
          <ol className={css['StepsList']}>
            {result.needsReview > 0 && (
              <li>
                <WarningIcon />
                <Text size={TextSize.Small}>
                  Components marked with ⚠️ have notes in the component panel - 
                  click to see migration details
                </Text>
              </li>
            )}
            <li>
              <CheckIcon />
              <Text size={TextSize.Small}>
                Test your app thoroughly before deploying
              </Text>
            </li>
            <li>
              <TrashIcon />
              <Text size={TextSize.Small}>
                Once confirmed working, you can archive or delete the original folder
              </Text>
            </li>
          </ol>
        </div>
      </VStack>

      {/* Actions */}
      <div className={css['Actions']}>
        <HStack hasSpacing>
          <PrimaryButton
            label="Open Migrated Project"
            onClick={onOpenProject}
          />
        </HStack>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  variant: 'success' | 'warning' | 'error';
}

function StatCard({ icon, value, label, variant }: StatCardProps) {
  return (
    <div className={`${css['StatCard']} ${css[`is-${variant}`]}`}>
      <div className={css['StatCardIcon']}>{icon}</div>
      <div className={css['StatCardValue']}>{value}</div>
      <div className={css['StatCardLabel']}>{label}</div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 16 16" width={32} height={32}>
      <path
        d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckWarningIcon() {
  return (
    <svg viewBox="0 0 16 16" width={32} height={32}>
      <path
        d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l4.5-4.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
        fill="currentColor"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M8.863 1.035c-.39-.678-1.336-.678-1.726 0L.187 12.78c-.403.7.096 1.57.863 1.57h13.9c.767 0 1.266-.87.863-1.57L8.863 1.035zM8 5a.75.75 0 01.75.75v2.5a.75.75 0 11-1.5 0v-2.5A.75.75 0 018 5zm0 7a1 1 0 100-2 1 1 0 000 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"
        fill="currentColor"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M8 0a8 8 0 108 8A8 8 0 008 0zm0 14.5A6.5 6.5 0 1114.5 8 6.5 6.5 0 018 14.5zM8 3.5a.75.75 0 01.75.75V8h2.5a.75.75 0 110 1.5H8a.75.75 0 01-.75-.75V4.25A.75.75 0 018 3.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M8 0a1 1 0 011 1v1.5h2A2.5 2.5 0 0113.5 5v6a2.5 2.5 0 01-2.5 2.5h-6A2.5 2.5 0 012.5 11V5A2.5 2.5 0 015 2.5h2V1a1 1 0 011-1zM5 4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V5a1 1 0 00-1-1H5zm1.5 2a1 1 0 110 2 1 1 0 010-2zm3 0a1 1 0 110 2 1 1 0 010-2zM6 8.5a.5.5 0 000 1h4a.5.5 0 000-1H6z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M4 6V4a4 4 0 118 0v2h1a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1h1zm2 0h4V4a2 2 0 10-4 0v2zm3 4a1 1 0 10-2 0v2a1 1 0 102 0v-2z"
        fill="currentColor"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M1.75 2A1.75 1.75 0 000 3.75v8.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0016 12.25v-6.5A1.75 1.75 0 0014.25 4H7.5a.25.25 0 01-.2-.1l-.9-1.2a1.75 1.75 0 00-1.4-.7h-3.25z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"
        fill="currentColor"
      />
    </svg>
  );
}

export default CompleteStep;
