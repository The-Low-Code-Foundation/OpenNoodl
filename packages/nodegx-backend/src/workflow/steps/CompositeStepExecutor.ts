/**
 * CompositeStepExecutor — one StepExecutor that dispatches to the per-kind
 * executor.
 *
 * The engine is handed exactly one executor and never learns that there is more
 * than one kind of step; the dispatch table lives here. That is what keeps
 * WF-001's seam intact: adding a kind touches this file and `kinds.ts`, and
 * nothing in `WorkflowEngine` at all.
 *
 * An unknown kind reaching here is a bug (write-time validation rejects unknown
 * kinds, and the registry refuses to load a definition containing one), so it
 * throws a step failure that names the kind rather than silently resolving.
 *
 * @module nodegx-backend/workflow/steps/CompositeStepExecutor
 */

import type { StepExecContext, StepExecutor, StepExecReturn } from '../StepExecutor';
import { FunctionStepExecutor, StepExecutionError } from '../StepExecutor';
import type { WorkflowRunner } from '../WorkflowRunner';
import type { StepKind } from '../types';
import { StopStepExecutor } from './errors';
import { STEP_KINDS } from './kinds';
import { BranchStepExecutor, ForEachStepExecutor, MergeStepExecutor, SwitchStepExecutor } from './logic';
import { ReturnStepExecutor } from './returns';
import { WaitStepExecutor, WaitUntilStepExecutor } from './timing';

export interface CompositeStepExecutorDeps {
  getRunner: () => WorkflowRunner | null;
  /** Test hook: override individual kinds (used to stub function invocation). */
  overrides?: Partial<Record<StepKind, StepExecutor>>;
}

export class CompositeStepExecutor implements StepExecutor {
  private readonly byKind: Record<StepKind, StepExecutor>;

  constructor(deps: CompositeStepExecutorDeps) {
    const getRunner = deps.getRunner;
    this.byKind = {
      'call-function': new FunctionStepExecutor(getRunner),
      branch: new BranchStepExecutor(),
      switch: new SwitchStepExecutor(),
      'for-each': new ForEachStepExecutor({ getRunner }),
      merge: new MergeStepExecutor(),
      stop: new StopStepExecutor(),
      wait: new WaitStepExecutor(),
      'wait-until': new WaitUntilStepExecutor(),
      return: new ReturnStepExecutor(),
      ...(deps.overrides || {})
    } as Record<StepKind, StepExecutor>;
  }

  /** The kinds this executor can run — asserted against the catalog in tests. */
  kinds(): StepKind[] {
    return Object.keys(this.byKind) as StepKind[];
  }

  execute(ctx: StepExecContext): Promise<StepExecReturn> {
    const executor = this.byKind[ctx.step.kind];
    if (!executor) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": no executor for kind "${String(ctx.step.kind)}" (known: ${STEP_KINDS.join(', ')})`
      );
    }
    return executor.execute(ctx);
  }
}
