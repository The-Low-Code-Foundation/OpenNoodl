/**
 * Budget Controller for AI Migration
 *
 * Manages spending limits and approval flow for AI-assisted migrations.
 * Enforces hard limits and pause-and-approve at configurable increments.
 *
 * @module migration/BudgetController
 */

export interface BudgetState {
  maxPerSession: number;
  spent: number;
  pauseIncrement: number;
  nextPauseAt: number;
  paused: boolean;
}

export interface BudgetCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  currentSpent: number;
  estimatedNext: number;
  wouldExceedMax: boolean;
}

export class BudgetController {
  private state: BudgetState;
  private onPauseRequired: (state: BudgetState) => Promise<boolean>;

  constructor(
    config: { maxPerSession: number; pauseIncrement: number },
    onPauseRequired: (state: BudgetState) => Promise<boolean>
  ) {
    this.state = {
      maxPerSession: config.maxPerSession,
      spent: 0,
      pauseIncrement: config.pauseIncrement,
      nextPauseAt: config.pauseIncrement,
      paused: false
    };
    this.onPauseRequired = onPauseRequired;
  }

  checkBudget(estimatedCost: number): BudgetCheckResult {
    const wouldExceedMax = this.state.spent + estimatedCost > this.state.maxPerSession;
    const wouldExceedPause = this.state.spent + estimatedCost > this.state.nextPauseAt;

    return {
      allowed: !wouldExceedMax,
      requiresApproval: wouldExceedPause && !this.state.paused,
      currentSpent: this.state.spent,
      estimatedNext: estimatedCost,
      wouldExceedMax
    };
  }

  async requestApproval(estimatedCost: number): Promise<boolean> {
    const check = this.checkBudget(estimatedCost);

    if (check.wouldExceedMax) {
      return false; // Hard limit, can't approve
    }

    if (check.requiresApproval) {
      const approved = await this.onPauseRequired(this.state);
      if (approved) {
        this.state.nextPauseAt += this.state.pauseIncrement;
      }
      return approved;
    }

    return true;
  }

  recordSpend(amount: number): void {
    this.state.spent += amount;
  }

  getState(): BudgetState {
    return { ...this.state };
  }

  getRemainingBudget(): number {
    return Math.max(0, this.state.maxPerSession - this.state.spent);
  }
}
