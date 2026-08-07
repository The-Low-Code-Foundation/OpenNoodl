/**
 * AI Migration Orchestrator
 *
 * Coordinates AI-assisted migration of multiple components with
 * retry logic, verification, and user decision points.
 *
 * @module migration/AIMigrationOrchestrator
 */

import { ClaudeClient, type AIPreferences } from '../../utils/migration/claudeClient';
import { BudgetController, type BudgetState } from './BudgetController';
import type { ComponentMigrationInfo } from './types';

export interface OrchestratorConfig {
  maxRetries: number;
  minConfidence: number;
  verifyMigration: boolean;
}

export interface ComponentMigrationResult {
  componentId: string;
  componentName: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  migratedCode?: string;
  changes: string[];
  warnings: string[];
  attempts: number;
  totalCost: number;
  error?: string;
  aiSuggestion?: string;
}

export interface ProgressUpdate {
  phase: string;
  component: string;
  attempt: number;
  message: string;
}

export interface DecisionRequest {
  componentId: string;
  componentName: string;
  attempts: number;
  attemptHistory: AttemptRecord[];
  costSpent: number;
  retryCost: number;
}

export interface Decision {
  action: 'retry' | 'skip' | 'getHelp' | 'manual';
}

interface AttemptRecord {
  code: string | null;
  error: string;
  cost: number;
}

export class AIMigrationOrchestrator {
  private client: ClaudeClient;
  private budget: BudgetController;
  private config: OrchestratorConfig;
  private aborted = false;

  constructor(
    apiKey: string,
    budgetConfig: { maxPerSession: number; pauseIncrement: number },
    config: OrchestratorConfig,
    onBudgetPause: (state: BudgetState) => Promise<boolean>
  ) {
    this.client = new ClaudeClient(apiKey);
    this.budget = new BudgetController(budgetConfig, onBudgetPause);
    this.config = config;
  }

  async migrateComponent(
    component: ComponentMigrationInfo,
    code: string,
    preferences: AIPreferences,
    onProgress: (update: ProgressUpdate) => void,
    onDecisionRequired: (request: DecisionRequest) => Promise<Decision>
  ): Promise<ComponentMigrationResult> {
    let attempts = 0;
    let totalCost = 0;
    let lastError: string | null = null;
    let lastCode: string | null = null;
    const attemptHistory: AttemptRecord[] = [];

    while (attempts < this.config.maxRetries && !this.aborted) {
      attempts++;

      // Check budget
      const estimatedCost = this.client.estimateCost(code.length);
      const budgetCheck = this.budget.checkBudget(estimatedCost);

      if (!budgetCheck.allowed) {
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'failed',
          changes: [],
          warnings: [],
          attempts,
          totalCost,
          error: 'Budget exceeded'
        };
      }

      if (budgetCheck.requiresApproval) {
        const approved = await this.budget.requestApproval(estimatedCost);
        if (!approved) {
          return {
            componentId: component.id,
            componentName: component.name,
            status: 'skipped',
            changes: [],
            warnings: ['Migration paused by user'],
            attempts,
            totalCost
          };
        }
      }

      // Attempt migration
      onProgress({
        phase: 'ai-migrating',
        component: component.name,
        attempt: attempts,
        message: attempts === 1 ? 'Analyzing code patterns...' : `Retry attempt ${attempts}...`
      });

      const response = await this.client.migrateComponent({
        code,
        issues: component.issues,
        componentName: component.name,
        preferences,
        previousAttempt: lastError ? { code: lastCode, error: lastError } : undefined
      });

      totalCost += response.cost;
      this.budget.recordSpend(response.cost);

      if (response.success && response.confidence >= this.config.minConfidence) {
        // Verify the migration if enabled
        if (this.config.verifyMigration && response.code) {
          const verification = await this.verifyMigration(response.code, component);

          if (!verification.valid) {
            lastError = verification.error || 'Verification failed';
            lastCode = response.code;
            attemptHistory.push({
              code: response.code,
              error: lastError,
              cost: response.cost
            });
            continue;
          }
        }

        return {
          componentId: component.id,
          componentName: component.name,
          status: 'success',
          migratedCode: response.code!,
          changes: response.changes,
          warnings: response.warnings,
          attempts,
          totalCost
        };
      }

      // Migration failed or low confidence
      lastError = response.reason || 'Low confidence migration';
      lastCode = response.code;
      attemptHistory.push({
        code: response.code,
        error: lastError,
        cost: response.cost
      });
    }

    // All retries exhausted - ask user what to do
    const decision = await onDecisionRequired({
      componentId: component.id,
      componentName: component.name,
      attempts,
      attemptHistory,
      costSpent: totalCost,
      retryCost: this.client.estimateCost(code.length)
    });

    switch (decision.action) {
      case 'retry':
        // Recursive retry with fresh attempts
        return this.migrateComponent(component, code, preferences, onProgress, onDecisionRequired);

      case 'skip':
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'skipped',
          changes: [],
          warnings: ['Skipped by user after failed attempts'],
          attempts,
          totalCost
        };

      case 'getHelp': {
        const help = await this.client.getHelp({
          originalCode: code,
          attempts,
          attemptHistory
        });
        totalCost += 0.02; // Approximate cost for help request

        return {
          componentId: component.id,
          componentName: component.name,
          status: 'failed',
          changes: [],
          warnings: attemptHistory.map((a) => a.error),
          attempts,
          totalCost,
          aiSuggestion: help
        };
      }

      case 'manual':
        return {
          componentId: component.id,
          componentName: component.name,
          status: 'partial',
          migratedCode: lastCode || undefined,
          changes: [],
          warnings: ['Marked for manual review'],
          attempts,
          totalCost
        };
    }
  }

  private async verifyMigration(
    code: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    component: ComponentMigrationInfo
  ): Promise<{ valid: boolean; error?: string }> {
    // Basic syntax check using Babel
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const babel = require('@babel/parser');
      babel.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
    } catch (syntaxError: unknown) {
      const err = syntaxError as { message?: string };
      return {
        valid: false,
        error: `Syntax error: ${err.message || 'Unknown syntax error'}`
      };
    }

    // Check that no forbidden patterns remain
    const forbiddenPatterns = [
      { regex: /componentWillMount\s*\(/, name: 'componentWillMount' },
      { regex: /componentWillReceiveProps\s*\(/, name: 'componentWillReceiveProps' },
      { regex: /componentWillUpdate\s*\(/, name: 'componentWillUpdate' },
      { regex: /ref\s*=\s*["'][^"']+["']/, name: 'string ref' },
      { regex: /contextTypes\s*=/, name: 'legacy contextTypes' }
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.regex.test(code)) {
        return {
          valid: false,
          error: `Code still contains ${pattern.name}`
        };
      }
    }

    return { valid: true };
  }

  abort(): void {
    this.aborted = true;
  }

  getBudgetState(): BudgetState {
    return this.budget.getState();
  }
}
