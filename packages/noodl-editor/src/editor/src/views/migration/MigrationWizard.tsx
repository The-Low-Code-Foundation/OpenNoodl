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

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize, TitleVariant } from '@noodl-core-ui/components/typography/Title';

import { BudgetState } from '../../models/migration/BudgetController';
import {
  migrationSessionManager,
  getStepLabel,
  getStepNumber,
  getTotalSteps
} from '../../models/migration/MigrationSession';
import {
  MigrationSession,
  MigrationScan,
  MigrationResult,
  AIBudget,
  AIPreferences,
  AIDecisionRequest
} from '../../models/migration/types';
import { AIConfigPanel, AIConfig } from './AIConfigPanel';
import { BudgetApprovalDialog } from './BudgetApprovalDialog';
import { WizardProgress } from './components/WizardProgress';
import { DecisionDialog } from './DecisionDialog';
import css from './MigrationWizard.module.scss';
import { CompleteStep } from './steps/CompleteStep';
import { ConfirmStep } from './steps/ConfirmStep';
import { FailedStep } from './steps/FailedStep';
import { MigratingStep, AiDecision } from './steps/MigratingStep';
import { ReportStep } from './steps/ReportStep';
import { ScanningStep } from './steps/ScanningStep';

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
  | { type: 'CONFIGURE_AI' }
  | { type: 'AI_CONFIGURED' }
  | { type: 'BACK_TO_REPORT' }
  | { type: 'ERROR'; error: Error }
  | { type: 'START_MIGRATE'; useAi: boolean }
  | { type: 'AI_DECISION'; decision: AiDecision }
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

    case 'CONFIGURE_AI':
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, step: 'configureAi' }
      };

    case 'AI_CONFIGURED':
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, step: 'report' }
      };

    case 'BACK_TO_REPORT':
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, step: 'report' }
      };

    case 'AI_DECISION':
      // Handle AI decision - just continue migration
      return state;

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

export function MigrationWizard({ sourcePath, projectName, onComplete, onCancel }: MigrationWizardProps) {
  // Initialize session on mount
  const [state, dispatch] = useReducer(wizardReducer, {
    session: null,
    loading: false,
    error: null
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [budgetApprovalRequest, setBudgetApprovalRequest] = useState<BudgetState | null>(null);
  const [decisionRequest, setDecisionRequest] = useState<AIDecisionRequest | null>(null);
  const [budgetApprovalResolve, setBudgetApprovalResolve] = useState<((approved: boolean) => void) | null>(null);
  const [decisionResolve, setDecisionResolve] = useState<((action: string) => void) | null>(null);

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

  const handleConfigureAi = useCallback(async () => {
    try {
      await migrationSessionManager.transitionTo('configureAi');
      dispatch({ type: 'CONFIGURE_AI' });
    } catch (error) {
      console.error('Failed to transition to AI config:', error);
      dispatch({ type: 'ERROR', error: error as Error });
    }
  }, []);

  const handleAiConfigured = useCallback(async (config: AIConfig) => {
    try {
      // Transform AIConfig to match MigrationSessionManager expectations
      const aiConfig = {
        ...config,
        budget: {
          ...config.budget,
          spent: 0 // Initialize spent to 0 for new config
        }
      };
      migrationSessionManager.configureAI(aiConfig);
      await migrationSessionManager.transitionTo('report');
      dispatch({ type: 'AI_CONFIGURED' });
    } catch (error) {
      console.error('Failed to configure AI:', error);
      dispatch({ type: 'ERROR', error: error as Error });
    }
  }, []);

  const handleBackToReport = useCallback(async () => {
    try {
      await migrationSessionManager.transitionTo('report');
      dispatch({ type: 'BACK_TO_REPORT' });
    } catch (error) {
      console.error('Failed to go back to report:', error);
      dispatch({ type: 'ERROR', error: error as Error });
    }
  }, []);

  const handleAiDecision = useCallback((decision: AiDecision) => {
    // For now, just continue - full AI orchestration will be wired in Phase 3
    console.log('AI decision:', decision);
    dispatch({ type: 'AI_DECISION', decision });
  }, []);

  const handlePauseMigration = useCallback(() => {
    // Pause migration - will be implemented when orchestrator is wired up
    console.log('Pause migration requested');
  }, []);

  const handleBudgetApproval = useCallback(
    (approved: boolean) => {
      if (budgetApprovalResolve) {
        budgetApprovalResolve(approved);
        setBudgetApprovalResolve(null);
      }
      setBudgetApprovalRequest(null);
    },
    [budgetApprovalResolve]
  );

  const handleDecision = useCallback(
    (action: 'retry' | 'skip' | 'manual' | 'getHelp') => {
      if (decisionResolve) {
        decisionResolve(action);
        setDecisionResolve(null);
      }
      setDecisionRequest(null);
    },
    [decisionResolve]
  );

  // Callback for orchestrator to request budget approval
  const requestBudgetApproval = useCallback((state: BudgetState): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setBudgetApprovalRequest(state);
      setBudgetApprovalResolve(() => resolve);
    });
  }, []);

  // Callback for orchestrator to request decision
  const requestDecision = useCallback(
    (request: AIDecisionRequest): Promise<'retry' | 'skip' | 'manual' | 'getHelp'> => {
      return new Promise<'retry' | 'skip' | 'manual' | 'getHelp'>((resolve) => {
        setDecisionRequest(request);
        setDecisionResolve(() => resolve);
      });
    },
    []
  );

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
        return <ScanningStep sourcePath={sourcePath} targetPath={session.target.path} />;

      case 'configureAi':
        return (
          <AIConfigPanel
            existingConfig={
              session.ai
                ? {
                    apiKey: session.ai.apiKey || '',
                    enabled: session.ai.enabled,
                    budget: session.ai.budget,
                    preferences: session.ai.preferences
                  }
                : undefined
            }
            onSave={handleAiConfigured}
            onCancel={handleBackToReport}
          />
        );

      case 'report':
        return (
          <ReportStep
            scan={session.scan!}
            onConfigureAi={handleConfigureAi}
            onMigrateWithoutAi={() => handleStartMigration(false)}
            onMigrateWithAi={() => handleStartMigration(true)}
            onCancel={onCancel}
            aiEnabled={session.ai?.enabled || false}
          />
        );

      case 'migrating':
        return (
          <MigratingStep
            progress={session.progress || { phase: 'copying', current: 0, total: 0, log: [] }}
            useAi={!!session.ai}
            budget={session.ai?.budget}
            onAiDecision={handleAiDecision}
            onPause={handlePauseMigration}
            budgetApprovalRequest={budgetApprovalRequest}
            onBudgetApproval={handleBudgetApproval}
            decisionRequest={decisionRequest}
            onDecision={handleDecision}
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
        return <FailedStep error={state.error} onRetry={handleRetry} onCancel={onCancel} />;

      default:
        return null;
    }
  };

  return (
    <CoreBaseDialog isVisible hasBackdrop onClose={onCancel}>
      <div className={css['WizardContainer']}>
        {/* Close Button */}
        <div className={css['CloseButton']}>
          <IconButton icon={IconName.Close} onClick={onCancel} variant={IconButtonVariant.Transparent} />
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
          <div className={css['StepContainer']}>{renderStep()}</div>
        </div>
      </div>
    </CoreBaseDialog>
  );
}

export default MigrationWizard;
