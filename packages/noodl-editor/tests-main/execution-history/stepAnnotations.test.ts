/**
 * WFA-002: the run inspector's error-routing link.
 *
 * The engine records a failed step's error as that step's OUTPUT and delivers
 * the same object to whatever `onError` reached as `inputData.previous.error`,
 * with a `step` field naming the origin. Turning that into "this failed, THIS
 * caught it" is what makes a run readable, so the derivation is tested rather
 * than eyeballed — the shapes here are copied from a live run recorded on
 * 2026-07-28 (`exec_ms49quko96gxp7yc`).
 */

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import { annotateSteps } from '../../src/editor/src/views/panels/ExecutionHistoryPanel/components/ExecutionDetail/stepAnnotations';

function step(partial: Partial<ExecutionStep> & Pick<ExecutionStep, 'nodeId' | 'status'>): ExecutionStep {
  return {
    id: `step_${partial.nodeId}`,
    executionId: 'exec_1',
    nodeType: 'wait',
    stepIndex: 0,
    startedAt: 0,
    ...partial
  } as ExecutionStep;
}

const CHARGE_ERROR = {
  message: 'Step "charge" failed after 2 attempt(s): Step target function "chargeCard" not found on this backend',
  name: 'StepExecutionError',
  statusCode: 404,
  step: 'charge'
};

describe('annotateSteps (WFA-002)', () => {
  it('links a failed step to the step that received its error, in both directions', () => {
    const steps = [
      step({
        nodeId: 'charge',
        nodeName: 'Charge card',
        nodeType: 'retry:chargeCard',
        status: 'error',
        errorMessage: CHARGE_ERROR.message
      }),
      step({
        nodeId: 'logfail',
        nodeName: 'Log failure',
        status: 'success',
        inputData: { previous: { error: CHARGE_ERROR } }
      })
    ];

    const annotations = annotateSteps(steps);

    // The handler knows where the error came from, by label not by id.
    expect(annotations.get('step_logfail')!.receivedError!.fromNodeId).toBe('charge');
    expect(annotations.get('step_logfail')!.receivedError!.fromLabel).toBe('Charge card');
    expect(annotations.get('step_logfail')!.receivedError!.error).toEqual(CHARGE_ERROR);

    // And the failure knows it was caught, so it does not read as fatal.
    expect(annotations.get('step_charge')!.handledBy).toEqual(['Log failure']);
    expect(annotations.get('step_charge')!.unhandled).toBeUndefined();
  });

  it('marks an unrouted failure unhandled — the run halted there', () => {
    const steps = [step({ nodeId: 'charge', status: 'error', errorMessage: 'boom' })];
    const annotations = annotateSteps(steps);
    expect(annotations.get('step_charge')!.unhandled).toBe(true);
    expect(annotations.get('step_charge')!.handledBy).toBeUndefined();
  });

  it('reads retry attempts from a successful step output', () => {
    const steps = [step({ nodeId: 'charge', nodeType: 'retry:chargeCard', status: 'success', outputData: { attempts: 3, retried: true } })];
    expect(annotateSteps(steps).get('step_charge')!.attempts).toBe(3);
  });

  it("reads retry attempts from a failed step's error message, which is the only place they exist", () => {
    const steps = [
      step({ nodeId: 'charge', nodeType: 'retry:chargeCard', status: 'error', errorMessage: CHARGE_ERROR.message })
    ];
    expect(annotateSteps(steps).get('step_charge')!.attempts).toBe(2);
  });

  it('does not invent an attempt count from maxAttempts', () => {
    // `retryOnStatus` can fail a retry step on its FIRST attempt, so maxAttempts
    // is not the number of attempts made. Showing nothing beats showing a guess.
    const steps = [
      step({
        nodeId: 'charge',
        nodeType: 'retry:chargeCard',
        status: 'error',
        errorMessage: 'Step "charge" failed: 400 Bad Request',
        inputData: { maxAttempts: 5 }
      })
    ];
    expect(annotateSteps(steps).get('step_charge')!.attempts).toBeUndefined();
  });

  it('names an unknown origin rather than rendering an empty label', () => {
    const steps = [step({ nodeId: 'handler', status: 'success', inputData: { previous: { error: { message: 'x' } } } })];
    expect(annotateSteps(steps).get('step_handler')!.receivedError!.fromLabel).toBe('an upstream step');
  });

  it('leaves an ordinary step unannotated', () => {
    const steps = [step({ nodeId: 'start', status: 'success', inputData: { previous: { waitedMs: 6 } } })];
    expect(annotateSteps(steps).get('step_start')).toEqual({});
  });
});
