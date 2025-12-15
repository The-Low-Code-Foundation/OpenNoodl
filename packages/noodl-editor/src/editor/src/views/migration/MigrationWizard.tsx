/**
 * MigrationWizard
 *
 * Main container component for the React 19 migration wizard.
 * Manages step navigation and integrates with MigrationSessionManager.
 *
 * @module noodl-editor/views/migration
 * @since 1.2.0
 */

import React, { useCallback, useEffect, useReducer, useState } from 'react';

import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize, TitleVariant } from '@noodl-core-ui/components/typography/Title';
import { IconName } from '@noodl-core-ui/components/common/Icon';

import { MigrationSession, MigrationScan, MigrationResult } from '../../models/migration/types';
import { migrationSessionManager, getStepLabel, getStepNumber, getTotalSteps } from '../../models/migration/MigrationSession';

import { WizardProgress } from './components/WizardProgress';
import { ConfirmStep } from './steps/ConfirmStep';
import { ScanningStep } from './steps/ScanningStep';
import { ReportStep } from './steps/ReportStep';
import { CompleteStep } from './steps/CompleteStep';
import { FailedStep } from './steps/FailedStep';

import css from './MigrationWizard.module.scss';

// =============================================================================
// Types
// =============================================================================

export interface MigrationWizardProps {
  /** Path to the source project */
  sourcePath: string;
  /** Name of the project */
  projectName: string;
  /** Called when migration completes successfully */
  onComplete: (targetPath: string) => void;
  /** Called when wizard is cancelled */
  onCancel: () => void;
}

type WizardAction =
  | { type: 'SET_SESSION'; session: MigrationSession }
  | { type: 'SET_TARGET_PATH'; path: string }
  | { type: 'START_SCAN' }
  | { type: 'SCAN_COMPLETE'; scan: MigrationScan }
  | { type: 'ERROR'; error: Error }
  | { type: 'START_MIGRATE'; useAi: boolean }
  | { type: 'MIGRATION_PROGRESS'; progress: number; currentComponent?: string }
  | { type: 'COMPLETE'; result: MigrationResult }
  | { type: 'RETRY' };

interface WizardState {
  session: MigrationSession | null;
  loading: boolean;
  error: Error | null;
}

// =============================================================================
// Reducer
// =============================================================================

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        session: action.session
      };

    case 'SET_TARGET_PATH':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          target: { ...state.session.target, path: action.path }
        }
      };

    case 'START_SCAN':
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, step: 'scanning' },
        loading: true
      };

    case 'SCAN_COMPLETE':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          step: 'report',
          scan: action.scan
        },
        loading: false
      };

    case 'ERROR':
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, step: 'failed' },
        loading: false,
        error: action.error
      };

    case 'START_MIGRATE':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          step: 'migrating',
          ai: action.useAi ? state.session.ai : undefined
        },
        loading: true
      };

    case 'MIGRATION_PROGRESS':
      if (!state.session?.progress) return state;
      return {
        ...state,
        session: {
          ...state.session,
          progress: {
            ...state.session.progress,
            current: action.progress,
            currentComponent: action.currentComponent
          }
        }
      };

    case 'COMPLETE':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          step: 'complete',
          result: action.result
        },
        loading: false
      };

    case 'RETRY':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          step: 'confirm',
          scan: undefined,
          progress: undefined,
          result: undefined
        },
        loading: false,
        error: null
      };

    default:
      return state;
  }
}

// =============================================================================
// Component
// =============================================================================

export function MigrationWizard({
  sourcePath,
  projectName,
  onComplete,
  onCancel
}: MigrationWizardProps) {
  // Initialize session on mount
  const [state, dispatch] = useReducer(wizardReducer, {
    session: null,
    loading: false,
    error: null
  });

  const [isInitialized, setIsInitialized] = useState(false);

  // Create session on mount
  useEffect(() => {
    async function initSession() {
      try {
        // Create session in manager (stores it internally)
        await migrationSessionManager.createSession(sourcePath, projectName);
        // Set default target path
        const defaultTargetPath = `${sourcePath}-react19`;
        migrationSessionManager.setTargetPath(defaultTargetPath);
        
        // Update session with new target path
        const updatedSession = migrationSessionManager.getSession();
        if (updatedSession) {
          // Initialize reducer state with the session
          dispatch({ type: 'SET_SESSION', session: updatedSession });
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to create migration session:', error);
        dispatch({ type: 'ERROR', error: error as Error });
      }
    }
    initSession();

    // Cleanup on unmount
    return () => {
      migrationSessionManager.cancelSession();
    };
  }, [sourcePath, projectName]);

  // Sync local state with session manager
  useEffect(() => {
    if (!isInitialized) return;

    const currentSession = migrationSessionManager.getSession();
    if (currentSession) {
      // Initialize local state from session manager
      dispatch({ type: 'SET_TARGET_PATH', path: currentSession.target.path });
    }
  }, [isInitialized]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleUpdateTargetPath = useCallback((path: string) => {
    migrationSessionManager.setTargetPath(path);
    dispatch({ type: 'SET_TARGET_PATH', path });
  }, []);

  const handleStartScan = useCallback(async () => {
    dispatch({ type: 'START_SCAN' });
    try {
      const scan = await migrationSessionManager.startScanning();
      dispatch({ type: 'SCAN_COMPLETE', scan });
    } catch (error) {
      dispatch({ type: 'ERROR', error: error as Error });
    }
  }, []);

  const handleStartMigration = useCallback(async (useAi: boolean) => {
    dispatch({ type: 'START_MIGRATE', useAi });
    try {
      const result = await migrationSessionManager.startMigration();
      dispatch({ type: 'COMPLETE', result });
    } catch (error) {
      dispatch({ type: 'ERROR', error: error as Error });
    }
  }, []);

  const handleRetry = useCallback(async () => {
    try {
      await migrationSessionManager.resetForRetry();
      dispatch({ type: 'RETRY' });
    } catch (error) {
      console.error('Failed to reset session:', error);
    }
  }, []);

  const handleOpenProject = useCallback(() => {
    const currentSession = migrationSessionManager.getSession();
    if (currentSession?.target.path) {
      onComplete(currentSession.target.path);
    }
  }, [onComplete]);

  // ==========================================================================
  // Render
  // ==========================================================================

  // Get current session from manager (source of truth)
  const session = migrationSessionManager.getSession();

  if (!session) {
    return null; // Session not initialized yet
  }

  const currentStep = session.step;
  const stepIndex = getStepNumber(currentStep);
  const totalSteps = getTotalSteps(false); // No AI for now

  const renderStep = () => {
    switch (currentStep) {
      case 'confirm':
        return (
          <ConfirmStep
            sourcePath={sourcePath}
            projectName={projectName}
            targetPath={session.target.path}
            onUpdateTargetPath={handleUpdateTargetPath}
            onNext={handleStartScan}
            onCancel={onCancel}
            loading={state.loading}
          />
        );

      case 'scanning':
        return (
          <ScanningStep
            sourcePath={sourcePath}
            targetPath={session.target.path}
          />
        );

      case 'report':
        return (
          <ReportStep
            scan={session.scan!}
            onMigrateWithoutAi={() => handleStartMigration(false)}
            onMigrateWithAi={() => handleStartMigration(true)}
            onCancel={onCancel}
          />
        );

      case 'migrating':
        return (
          <ScanningStep
            sourcePath={sourcePath}
            targetPath={session.target.path}
            isMigrating
            progress={session.progress}
          />
        );

      case 'complete':
        return (
          <CompleteStep
            result={session.result!}
            sourcePath={sourcePath}
            targetPath={session.target.path}
            onOpenProject={handleOpenProject}
          />
        );

      case 'failed':
        return (
          <FailedStep
            error={state.error}
            onRetry={handleRetry}
            onCancel={onCancel}
          />
        );

      default:
        return null;
    }
  };

  return (
    <CoreBaseDialog isVisible hasBackdrop onClose={onCancel}>
      <div className={css['WizardContainer']}>
        {/* Close Button */}
        <div className={css['CloseButton']}>
          <IconButton 
            icon={IconName.Close} 
            onClick={onCancel} 
            variant={IconButtonVariant.Transparent} 
          />
        </div>

        {/* Header */}
        <div className={css['WizardHeader']}>
          <Title size={TitleSize.Large} variant={TitleVariant.Highlighted}>
            Migrate Project to React 19
          </Title>
          <Text textType={TextType.Secondary}>{getStepLabel(currentStep)}</Text>
        </div>

        {/* Content */}
        <div className={css['WizardContent']}>
          <WizardProgress
            currentStep={stepIndex}
            totalSteps={totalSteps}
            stepLabels={['Confirm', 'Scan', 'Report', 'Migrate', 'Complete']}
          />
          <div className={css['StepContainer']}>
            {renderStep()}
          </div>
        </div>
      </div>
    </CoreBaseDialog>
  );
}

export default MigrationWizard;
