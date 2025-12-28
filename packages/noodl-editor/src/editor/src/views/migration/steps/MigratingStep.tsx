/**
 * MigratingStep
 *
 * Step 4 of the migration wizard: Shows real-time migration progress with AI.
 * Displays budget tracking, component progress, and AI decision panels.
 *
 * @module noodl-editor/views/migration/steps
 * @since 1.2.0
 */

import React from 'react';

import { ActivityIndicator } from '@noodl-core-ui/components/common/ActivityIndicator';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

import { BudgetState } from '../../../models/migration/BudgetController';
import { MigrationProgress, AIBudget, AIDecisionRequest } from '../../../models/migration/types';
import { BudgetApprovalDialog } from '../BudgetApprovalDialog';
import { DecisionDialog } from '../DecisionDialog';
import css from './MigratingStep.module.scss';

export interface AiDecisionRequest {
  componentId: string;
  componentName: string;
  attempts: number;
  attemptHistory: Array<{ description: string }>;
  costSpent: number;
  retryCost: number;
}

export interface AiDecision {
  componentId: string;
  action: 'retry' | 'skip' | 'getHelp';
}

export interface MigratingStepProps {
  /** Progress information */
  progress: MigrationProgress;
  /** Whether AI is being used */
  useAi: boolean;
  /** AI budget info (if using AI) */
  budget?: AIBudget;
  /** AI decision request (if awaiting user decision) */
  awaitingDecision?: AiDecisionRequest | null;
  /** Called when user makes an AI decision */
  onAiDecision?: (decision: AiDecision) => void;
  /** Called when user pauses migration */
  onPause?: () => void;
  /** Budget approval request from orchestrator */
  budgetApprovalRequest?: BudgetState | null;
  /** Called when user approves/denies budget */
  onBudgetApproval?: (approved: boolean) => void;
  /** Decision request from orchestrator */
  decisionRequest?: AIDecisionRequest | null;
  /** Called when user makes a decision */
  onDecision?: (action: 'retry' | 'skip' | 'manual' | 'getHelp') => void;
}

export function MigratingStep({
  progress,
  useAi,
  budget,
  awaitingDecision,
  onAiDecision,
  onPause,
  budgetApprovalRequest,
  onBudgetApproval,
  decisionRequest,
  onDecision
}: MigratingStepProps) {
  const progressPercent = Math.round((progress.current / progress.total) * 100);
  const budgetPercent = budget ? (budget.spent / budget.maxPerSession) * 100 : 0;

  return (
    <div className={css['Root']}>
      <VStack hasSpacing>
        <div className={css['Header']}>
          <ActivityIndicator />
          <Title size={TitleSize.Medium}>{useAi ? 'AI Migration in Progress' : 'Migrating Project...'}</Title>
        </div>

        <Text textType={TextType.Secondary}>Phase: {getPhaseLabel(progress.phase)}</Text>

        {/* Budget Display (if using AI) */}
        {useAi && budget && (
          <div className={css['BudgetSection']}>
            <div className={css['BudgetHeader']}>
              <Text size={TextSize.Small} textType={TextType.Proud}>
                AI Budget
              </Text>
              <Text size={TextSize.Small}>
                ${budget.spent.toFixed(2)} / ${budget.maxPerSession.toFixed(2)}
              </Text>
            </div>
            <div className={css['BudgetBar']}>
              <div
                className={`${css['BudgetFill']} ${budgetPercent > 80 ? css['is-warning'] : ''}`}
                style={{ width: `${Math.min(budgetPercent, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Overall Progress */}
        <div className={css['ProgressSection']}>
          <div className={css['ProgressBar']}>
            <div className={css['ProgressFill']} style={{ width: `${progressPercent}%` }} />
          </div>
          <Text size={TextSize.Small} textType={TextType.Shy}>
            {progress.current} / {progress.total} components
          </Text>
        </div>

        {/* Current Component */}
        {progress.currentComponent && !awaitingDecision && (
          <div className={css['CurrentComponent']}>
            <ActivityIndicator />
            <Text size={TextSize.Small}>{progress.currentComponent}</Text>
          </div>
        )}

        {/* Activity Log */}
        {progress.log && progress.log.length > 0 && (
          <div className={css['LogSection']}>
            <div className={css['LogEntries']}>
              {progress.log.slice(-6).map((entry, index) => (
                <div key={index} className={`${css['LogEntry']} ${css[`is-${entry.level}`]}`}>
                  <LogIcon level={entry.level} />
                  <div className={css['LogContent']}>
                    {entry.component && (
                      <Text size={TextSize.Small} textType={TextType.Proud} isSpan>
                        {entry.component}:{' '}
                      </Text>
                    )}
                    <Text size={TextSize.Small} isSpan>
                      {entry.message}
                    </Text>
                  </div>
                  {entry.cost !== undefined && (
                    <Text size={TextSize.Small} textType={TextType.Shy}>
                      ${entry.cost.toFixed(2)}
                    </Text>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Decision Panel (legacy) */}
        {awaitingDecision && onAiDecision && <AiDecisionPanel request={awaitingDecision} onDecision={onAiDecision} />}

        {/* Budget Approval Dialog */}
        {budgetApprovalRequest && onBudgetApproval && (
          <div className={css['DialogOverlay']}>
            <BudgetApprovalDialog
              state={budgetApprovalRequest}
              onApprove={() => onBudgetApproval(true)}
              onDeny={() => onBudgetApproval(false)}
            />
          </div>
        )}

        {/* Decision Dialog */}
        {decisionRequest && onDecision && (
          <div className={css['DialogOverlay']}>
            <DecisionDialog request={decisionRequest} onDecision={onDecision} />
          </div>
        )}
      </VStack>

      {/* Actions */}
      <div className={css['Actions']}>
        <PrimaryButton
          label="Pause Migration"
          variant={PrimaryButtonVariant.Muted}
          onClick={onPause}
          isDisabled={!!awaitingDecision}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

interface AiDecisionPanelProps {
  request: AiDecisionRequest;
  onDecision: (decision: AiDecision) => void;
}

function AiDecisionPanel({ request, onDecision }: AiDecisionPanelProps) {
  return (
    <div className={css['DecisionPanel']}>
      <div className={css['DecisionHeader']}>
        <ToolIcon />
        <Title size={TitleSize.Small}>{request.componentName} - Needs Your Input</Title>
      </div>

      <Text size={TextSize.Small}>
        Claude attempted {request.attempts} migrations but the component still has issues. Here&apos;s what happened:
      </Text>

      <div className={css['AttemptHistory']}>
        {request.attemptHistory.map((attempt, i) => (
          <div key={i} className={css['AttemptEntry']}>
            <Text size={TextSize.Small} textType={TextType.Proud} isSpan>
              Attempt {i + 1}:
            </Text>{' '}
            <Text size={TextSize.Small} isSpan>
              {attempt.description}
            </Text>
          </div>
        ))}
      </div>

      <Text size={TextSize.Small} textType={TextType.Shy}>
        Cost so far: ${request.costSpent.toFixed(2)}
      </Text>

      <div className={css['DecisionOptions']}>
        <HStack hasSpacing>
          <PrimaryButton
            label={`Try Again (~$${request.retryCost.toFixed(2)})`}
            onClick={() => onDecision({ componentId: request.componentId, action: 'retry' })}
          />
          <PrimaryButton
            label="Skip Component"
            variant={PrimaryButtonVariant.Muted}
            onClick={() => onDecision({ componentId: request.componentId, action: 'skip' })}
          />
          <PrimaryButton
            label="Get Suggestions (~$0.02)"
            variant={PrimaryButtonVariant.Muted}
            onClick={() => onDecision({ componentId: request.componentId, action: 'getHelp' })}
          />
        </HStack>
      </div>
    </div>
  );
}

// =============================================================================
// Helper Functions & Icons
// =============================================================================

function getPhaseLabel(phase?: string): string {
  const labels: Record<string, string> = {
    copying: 'Copying files',
    automatic: 'Applying automatic fixes',
    'ai-assisted': 'AI-assisted migration',
    finalizing: 'Finalizing'
  };
  return labels[phase || ''] || 'Starting';
}

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

function ToolIcon() {
  return (
    <svg viewBox="0 0 16 16" width={20} height={20}>
      <path
        d="M5.433 2.304A4.492 4.492 0 003.5 6c0 1.598.832 3.002 2.09 3.802.518.328.929.923.902 1.64l-.086 2.27a.75.75 0 01-.75.72h-1.3a.75.75 0 01-.75-.72l-.086-2.27c-.027-.717.384-1.312.902-1.64A4.495 4.495 0 003.5 6a5.99 5.99 0 012.433-4.864.75.75 0 011.134.64v3.046l.5.865.5-.865V1.776a.75.75 0 011.134-.64A5.99 5.99 0 0111.5 6a4.495 4.495 0 01-.922 3.802c-.518.328-.929.923-.902 1.64l.086 2.27a.75.75 0 01-.75.72h-1.3a.75.75 0 01-.75-.72l-.086-2.27c-.027-.717.384-1.312.902-1.64A4.495 4.495 0 007.5 6c0-.54-.185-1.061-.433-1.548"
        fill="currentColor"
      />
    </svg>
  );
}

export default MigratingStep;
