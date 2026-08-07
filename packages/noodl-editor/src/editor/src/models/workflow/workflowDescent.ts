/**
 * Where the canvas came from, when it came from a workflow step (WFA-006 §1).
 *
 * A cloud function's canvas is an ordinary project component's canvas — its
 * trail is a project path and always has been. The one thing that is different
 * about arriving there by double-clicking a `call-function` step is that there
 * is somewhere to go **back** to, and that somewhere is not a project component:
 * it is a workflow on a backend.
 *
 * This module is that one fact, and it is deliberately its own module rather
 * than a field on `WorkflowEditorService`: the trail renderer, the document and
 * the service would otherwise form an import cycle for the sake of a pointer.
 *
 * It is a POINTER, not a mode. `descentFor(componentName)` answers only for the
 * exact function that was descended into, so navigating anywhere else — a
 * sibling function, a browser component, the picker — simply stops matching and
 * the crumb disappears. Nothing has to be torn down at the right moment.
 *
 * @module models/workflow/workflowDescent
 */

import type { ComponentModel } from '@noodl-models/componentmodel';

export interface WorkflowDescent {
  /** The workflow's canvas adapter — what `switchToComponent` takes to go back. */
  workflowComponent: ComponentModel;
  /** What the crumb reads. */
  workflowName: string;
  backendId: string;
  backendName: string;
  /** The bare function name, as the step wrote it. */
  ref: string;
  /** `/#__cloud__/<ref>` — the component this descent landed on. */
  componentName: string;
}

let current: WorkflowDescent | null = null;

export function setDescent(descent: WorkflowDescent): void {
  current = descent;
}

export function clearDescent(): void {
  current = null;
}

/**
 * The descent that landed on this component, if this component is where a
 * descent landed. Any other component answers `null`, which is what makes the
 * crumb self-clearing.
 */
export function descentFor(componentName: string | undefined): WorkflowDescent | null {
  if (!current || !componentName) return null;
  return current.componentName === componentName ? current : null;
}

/** For tests and for the service, which clears it when the workflow closes. */
export function getDescent(): WorkflowDescent | null {
  return current;
}
