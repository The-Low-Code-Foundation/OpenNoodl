/**
 * FailedStep
 *
 * Step shown when migration fails. Allows user to retry or cancel.
 *
 * @module noodl-editor/views/migration/steps
 * @since 1.2.0
 */

import React from 'react';

import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import css from './FailedStep.module.scss';

export interface FailedStepProps {
  /** The error that caused the failure */
  error: Error | null;
  /** Called when user wants to retry */
  onRetry: () => void;
  /** Called when user wants to cancel */
  onCancel: () => void;
}

export function FailedStep({
  error,
  onRetry,
  onCancel
}: FailedStepProps) {
  const errorMessage = error?.message || 'An unknown error occurred during migration.';
  const isNetworkError = errorMessage.toLowerCase().includes('network') || 
                          errorMessage.toLowerCase().includes('timeout');
  const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                             errorMessage.toLowerCase().includes('access');

  return (
    <div className={css['Root']}>
      <VStack hasSpacing>
        {/* Header */}
        <div className={css['Header']}>
          <ErrorCircleIcon />
          <Title size={TitleSize.Medium}>
            Migration Failed
          </Title>
        </div>

        <Text className={css['DescriptionText']}>
          Something went wrong during the migration process. Your original project is safe and unchanged.
        </Text>

        {/* Error Details */}
        <div className={css['ErrorBox']}>
          <div className={css['ErrorHeader']}>
            <ErrorIcon />
            <Text className={css['ErrorText']}>Error Details</Text>
          </div>
          <div className={css['ErrorMessage']}>
            <Text size={TextSize.Small}>{errorMessage}</Text>
          </div>
        </div>

        {/* Suggestions */}
        <div className={css['Suggestions']}>
          <Title size={TitleSize.Small}>What you can try:</Title>
          <ul className={css['SuggestionList']}>
            {isNetworkError && (
              <li>
                <WifiIcon />
                <Text size={TextSize.Small}>Check your internet connection and try again</Text>
              </li>
            )}
            {isPermissionError && (
              <li>
                <LockIcon />
                <Text size={TextSize.Small}>Make sure you have write access to the target directory</Text>
              </li>
            )}
            <li>
              <RefreshIcon />
              <Text size={TextSize.Small}>Click &quot;Try Again&quot; to restart the migration</Text>
            </li>
            <li>
              <FolderIcon />
              <Text size={TextSize.Small}>Try choosing a different target directory</Text>
            </li>
            <li>
              <HelpIcon />
              <Text size={TextSize.Small}>
                If the problem persists, check the{' '}
                <a 
                  href="https://github.com/The-Low-Code-Foundation/OpenNoodl/issues" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={css['Link']}
                >
                  GitHub Issues
                </a>
              </Text>
            </li>
          </ul>
        </div>

        {/* Safety Notice */}
        <div className={css['SafetyNotice']}>
          <ShieldIcon />
          <Text size={TextSize.Small} className={css['SafetyText']}>
            Your original project remains untouched. Any partial migration files have been cleaned up.
          </Text>
        </div>
      </VStack>

      {/* Actions */}
      <div className={css['Actions']}>
        <HStack hasSpacing>
          <PrimaryButton
            label="Cancel"
            variant={PrimaryButtonVariant.Muted}
            onClick={onCancel}
          />
          <PrimaryButton
            label="Try Again"
            onClick={onRetry}
          />
        </HStack>
      </div>
    </div>
  );
}

// =============================================================================
// Icons
// =============================================================================

function ErrorCircleIcon() {
  return (
    <svg viewBox="0 0 16 16" width={32} height={32} className={css['ErrorCircleIcon']}>
      <path
        d="M8 16A8 8 0 108 0a8 8 0 000 16zm0-11.5a.75.75 0 01.75.75v3.5a.75.75 0 11-1.5 0v-3.5A.75.75 0 018 4.5zm0 8a1 1 0 100-2 1 1 0 000 2z"
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

function WifiIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M8 12a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM1.332 5.084a.75.75 0 10.97 1.142 9.5 9.5 0 0113.396 0 .75.75 0 00.97-1.142 11 11 0 00-15.336 0zm2.91 2.908a.75.75 0 10.97 1.142 5.5 5.5 0 017.576 0 .75.75 0 00.97-1.142 7 7 0 00-9.516 0z"
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

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M8 3a5 5 0 00-4.546 2.914.5.5 0 01-.908-.414A6 6 0 0113.944 5H12.5a.5.5 0 010-1h3a.5.5 0 01.5.5v3a.5.5 0 11-1 0V6.057A5.956 5.956 0 018 3zM0 8a.5.5 0 01.5-.5h1a.5.5 0 010 1H.5A.5.5 0 010 8zm1.5 2.5a.5.5 0 01.5.5v1.443A5.956 5.956 0 008 13a5 5 0 004.546-2.914.5.5 0 01.908.414A6 6 0 012.056 11H3.5a.5.5 0 010 1h-3a.5.5 0 01-.5-.5v-3a.5.5 0 01.5-.5z"
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

function HelpIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M8 0a8 8 0 108 8A8 8 0 008 0zm0 14.5A6.5 6.5 0 1114.5 8 6.5 6.5 0 018 14.5zm0-10.25a2.25 2.25 0 00-2.25 2.25.75.75 0 001.5 0 .75.75 0 111.5 0c0 .52-.3.866-.658 1.075-.368.216-.842.425-.842 1.175a.75.75 0 001.5 0c0-.15.099-.282.282-.394.187-.114.486-.291.727-.524A2.25 2.25 0 008 4.25zM8 13a1 1 0 100-2 1 1 0 000 2z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14}>
      <path
        d="M7.467.133a1.75 1.75 0 011.066 0l5.25 1.68A1.75 1.75 0 0115 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.7 1.7 0 01-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 011.217-1.667l5.25-1.68zm.61 1.429a.25.25 0 00-.153 0l-5.25 1.68a.25.25 0 00-.174.238V7c0 1.358.275 2.666 1.057 3.86.784 1.194 2.121 2.34 4.366 3.297a.2.2 0 00.154 0c2.245-.956 3.582-2.103 4.366-3.298C13.225 9.666 13.5 8.358 13.5 7V3.48a.25.25 0 00-.174-.238l-5.25-1.68zM11.28 6.28a.75.75 0 00-1.06-1.06L7.25 8.19 5.78 6.72a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.06 0l3.5-3.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export default FailedStep;
