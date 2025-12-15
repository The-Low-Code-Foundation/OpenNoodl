/**
 * ConfirmStep
 *
 * Step 1 of the migration wizard: Confirm source and target paths.
 *
 * @module noodl-editor/views/migration/steps
 * @since 1.2.0
 */

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextInput } from '@noodl-core-ui/components/inputs/TextInput';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import { filesystem } from '@noodl/platform';

import css from './ConfirmStep.module.scss';

export interface ConfirmStepProps {
  /** Path to the source project */
  sourcePath: string;
  /** Name of the project */
  projectName: string;
  /** Current target path */
  targetPath: string;
  /** Called when target path changes */
  onUpdateTargetPath: (path: string) => void;
  /** Called when user proceeds to next step */
  onNext: () => void;
  /** Called when user cancels the wizard */
  onCancel: () => void;
  /** Whether the wizard is loading */
  loading?: boolean;
}

export function ConfirmStep({
  sourcePath,
  projectName,
  targetPath,
  onUpdateTargetPath,
  onNext,
  onCancel,
  loading = false
}: ConfirmStepProps) {
  const [targetExists, setTargetExists] = useState(false);
  const [checkingPath, setCheckingPath] = useState(false);

  // Check if target path exists
  const checkTargetPath = useCallback(async (path: string) => {
    if (!path) {
      setTargetExists(false);
      return;
    }

    setCheckingPath(true);
    try {
      const exists = await filesystem.exists(path);
      setTargetExists(exists);
    } catch {
      setTargetExists(false);
    } finally {
      setCheckingPath(false);
    }
  }, []);

  useEffect(() => {
    checkTargetPath(targetPath);
  }, [targetPath, checkTargetPath]);

  const handleTargetChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onUpdateTargetPath(e.target.value);
    },
    [onUpdateTargetPath]
  );

  const handleUseUniqueName = useCallback(() => {
    const timestamp = Date.now();
    const uniquePath = `${sourcePath}-react19-${timestamp}`;
    onUpdateTargetPath(uniquePath);
  }, [sourcePath, onUpdateTargetPath]);

  const canProceed = targetPath && !targetExists && !loading && !checkingPath;

  return (
    <div className={css['Root']}>
      <VStack hasSpacing>
        <Box hasBottomSpacing>
          <Text>
            We&apos;ll create a safe copy of your project before making any changes.
            Your original project will remain untouched.
          </Text>
        </Box>

        {/* Source Project (Read-only) */}
        <div className={css['PathSection']}>
          <div className={css['PathHeader']}>
            <svg
              viewBox="0 0 16 16"
              className={css['LockIcon']}
              width={16}
              height={16}
            >
              <path
                d="M4 6V4a4 4 0 118 0v2h1a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1h1zm2 0h4V4a2 2 0 10-4 0v2zm3 4a1 1 0 10-2 0v2a1 1 0 102 0v-2z"
                fill="currentColor"
              />
            </svg>
            <Title size={TitleSize.Small}>Original Project (will not be modified)</Title>
          </div>
          <div className={css['PathDisplay']}>
            <Text className={css['PathText']}>{sourcePath}</Text>
            <Text className={css['ProjectName']}>{projectName}</Text>
          </div>
        </div>

        {/* Arrow */}
        <div className={css['Arrow']}>
          <svg viewBox="0 0 16 16" width={20} height={20}>
            <path
              d="M8 2a.75.75 0 01.75.75v8.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V2.75A.75.75 0 018 2z"
              fill="currentColor"
            />
          </svg>
          <Text size={TextSize.Small}>Creates copy</Text>
        </div>

        {/* Target Path (Editable) */}
        <div className={css['PathSection']}>
          <div className={css['PathHeader']}>
            <svg
              viewBox="0 0 16 16"
              className={css['FolderIcon']}
              width={16}
              height={16}
            >
              <path
                d="M1.75 2A1.75 1.75 0 000 3.75v8.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0016 12.25v-6.5A1.75 1.75 0 0014.25 4H7.5a.25.25 0 01-.2-.1l-.9-1.2a1.75 1.75 0 00-1.4-.7h-3.25z"
                fill="currentColor"
              />
            </svg>
            <Title size={TitleSize.Small}>Migrated Copy Location</Title>
          </div>
          <TextInput
            value={targetPath}
            onChange={handleTargetChange}
            UNSAFE_className={css['PathInput']}
          />
          {targetExists && (
            <div className={css['PathError']}>
              <Text textType={FeedbackType.Danger}>
                A folder already exists at this location.
              </Text>
              <PrimaryButton
                label="Use Different Name"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                onClick={handleUseUniqueName}
              />
            </div>
          )}
        </div>

        {/* What happens next */}
        <Box hasTopSpacing>
          <div className={css['InfoBox']}>
            <Title size={TitleSize.Small}>What happens next:</Title>
            <ol className={css['StepsList']}>
              <li>Your project will be copied to the new location</li>
              <li>We&apos;ll scan for compatibility issues</li>
              <li>You&apos;ll see a report of what needs to change</li>
              <li>Automatic fixes will be applied</li>
            </ol>
          </div>
        </Box>
      </VStack>

      {/* Actions */}
      <div className={css['Actions']}>
        <HStack hasSpacing>
          <PrimaryButton
            label="Cancel"
            variant={PrimaryButtonVariant.Muted}
            onClick={onCancel}
            isDisabled={loading}
          />
          <PrimaryButton
            label={loading ? 'Starting...' : 'Start Migration'}
            onClick={onNext}
            isDisabled={!canProceed}
          />
        </HStack>
      </div>
    </div>
  );
}

export default ConfirmStep;
