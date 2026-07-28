/**
 * WFA-002: the cross-step facts a single step row cannot know about itself.
 *
 * The engine records a failed step's error as its *output*, and the step reached
 * by `onError` receives that same object as `inputData.previous.error` — with a
 * `step` field naming where it came from (`WorkflowEngine.ts`, the CF11-002
 * design). Making that link visible is most of the value of a run inspector:
 * "the charge step failed, and THIS is the step that caught it" is the question
 * a user actually has, and reading it out of two collapsed JSON blobs is not an
 * answer.
 *
 * @module ExecutionHistoryPanel/ExecutionDetail/stepAnnotations
 */

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

/** The error object the engine puts on a failed step's output. */
export interface StepError {
  message?: string;
  name?: string;
  statusCode?: number;
  /** The id of the step that failed. */
  step?: string;
}

export interface StepAnnotation {
  /** This step was reached by an `onError` edge; here is what it received. */
  receivedError?: { fromNodeId: string; fromLabel: string; error: StepError };
  /** This step failed and these steps received its error. */
  handledBy?: string[];
  /** This step failed and nothing caught it — the run halted here. */
  unhandled?: boolean;
  /** Attempts a `retry` step made, when the record says so. */
  attempts?: number;
}

export function stepLabel(step: ExecutionStep): string {
  return step.nodeName || step.nodeId;
}

function readPreviousError(step: ExecutionStep): StepError | null {
  const previous = step.inputData?.previous as Record<string, unknown> | undefined;
  const error = previous && (previous.error as StepError | undefined);
  return error && typeof error === 'object' ? error : null;
}

/**
 * Attempts made by a `retry` step.
 *
 * On success the executor reports `attempts` in its output. On failure there is
 * no output — the count lives in the engine's own error message ("failed after
 * N attempt(s)"), which the step-kind spec documents as deliberate. Matching
 * that message is narrow and it is our own string; when it does not match we
 * show nothing rather than inferring the count from `maxAttempts`, which would
 * be wrong whenever `retryOnStatus` short-circuits.
 */
function readAttempts(step: ExecutionStep): number | undefined {
  const fromOutput = step.outputData?.attempts;
  if (typeof fromOutput === 'number') return fromOutput;

  const match = /failed after (\d+) attempt/.exec(step.errorMessage || '');
  return match ? Number(match[1]) : undefined;
}

/** One annotation per step, keyed by step id. */
export function annotateSteps(steps: ExecutionStep[]): Map<string, StepAnnotation> {
  const labels = new Map<string, string>();
  for (const step of steps) labels.set(step.nodeId, stepLabel(step));

  const annotations = new Map<string, StepAnnotation>();
  const handledBy = new Map<string, string[]>();

  for (const step of steps) {
    const annotation: StepAnnotation = {};

    const error = readPreviousError(step);
    if (error) {
      const fromNodeId = error.step || '';
      annotation.receivedError = {
        fromNodeId,
        fromLabel: labels.get(fromNodeId) || fromNodeId || 'an upstream step',
        error
      };
      if (fromNodeId) {
        const list = handledBy.get(fromNodeId) || [];
        list.push(stepLabel(step));
        handledBy.set(fromNodeId, list);
      }
    }

    const attempts = readAttempts(step);
    if (attempts !== undefined) annotation.attempts = attempts;

    annotations.set(step.id, annotation);
  }

  for (const step of steps) {
    if (step.status !== 'error') continue;
    const annotation = annotations.get(step.id);
    if (!annotation) continue;
    const handlers = handledBy.get(step.nodeId);
    if (handlers && handlers.length > 0) annotation.handledBy = handlers;
    else annotation.unhandled = true;
  }

  return annotations;
}
