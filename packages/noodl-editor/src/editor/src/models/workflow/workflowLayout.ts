/**
 * Auto-layout for a workflow with no stored positions (WFA-004 §5).
 *
 * MCP- and AI-authored workflows arrive with no coordinates at all, and a
 * workflow whose steps are all stacked at the origin reads as broken rather
 * than as un-arranged. So a definition without `ui` is laid out on first open.
 *
 * DELIBERATELY DETERMINISTIC. The same definition lays out the same way every
 * time, so re-opening a workflow nobody has dragged produces the same picture,
 * and two people looking at the same workflow are looking at the same thing.
 * That is what makes it acceptable for a position to be *absent*.
 *
 * Longest-path layering: a step sits one column right of its furthest-back
 * predecessor, which puts every edge left-to-right and makes the entry step the
 * leftmost thing on the canvas. Within a column, steps keep the order their
 * predecessors imposed, so a branch's `ontrue` stays above its `onfalse` when
 * that is the order the routes were declared in.
 *
 * @module models/workflow/workflowLayout
 */

import type { WorkflowStep } from './types';

/** Column pitch: node width (150) plus room for a labelled wire between cards. */
export const LAYOUT_COLUMN_WIDTH = 260;
/** Row pitch: tall enough for a card that has grown several port rows. */
export const LAYOUT_ROW_HEIGHT = 130;
export const LAYOUT_ORIGIN = { x: 80, y: 80 };

export interface LayoutPosition {
  x: number;
  y: number;
}

/** Every step this one can reach, in declaration order: next, routes, onError. */
export function edgeTargets(step: WorkflowStep): string[] {
  const targets: string[] = [];
  for (const t of step.next || []) targets.push(t);
  for (const list of Object.values(step.routes || {})) {
    for (const t of list || []) targets.push(t);
  }
  for (const t of step.onError || []) targets.push(t);
  return targets;
}

/**
 * Assign a column to every step.
 *
 * The graph is a DAG (the engine rejects anything else at write time, and the
 * canvas refuses to draw a cycle), so a relaxation pass terminates. It is
 * bounded by the step count anyway, because a definition that somehow *did*
 * contain a cycle must not hang the editor — it must draw something and let the
 * validator say what is wrong.
 */
function assignColumns(steps: WorkflowStep[], entry: string | undefined): Map<string, number> {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const column = new Map<string, number>();
  for (const s of steps) column.set(s.id, 0);

  const incoming = new Map<string, number>();
  for (const s of steps) incoming.set(s.id, 0);
  for (const s of steps) {
    for (const t of edgeTargets(s)) {
      if (byId.has(t)) incoming.set(t, (incoming.get(t) || 0) + 1);
    }
  }

  // Roots first, entry always at column 0 even if something wires into it.
  const queue: string[] = steps.filter((s) => (incoming.get(s.id) || 0) === 0).map((s) => s.id);
  if (entry && byId.has(entry) && !queue.includes(entry)) queue.unshift(entry);
  if (queue.length === 0 && steps.length) queue.push(steps[0].id);

  let guard = steps.length * steps.length + steps.length;
  const pending = [...queue];
  while (pending.length && guard-- > 0) {
    const id = pending.shift() as string;
    const step = byId.get(id);
    if (!step) continue;
    const next = (column.get(id) || 0) + 1;
    for (const t of edgeTargets(step)) {
      if (!byId.has(t)) continue;
      if ((column.get(t) || 0) < next) {
        column.set(t, next);
        pending.push(t);
      }
    }
  }

  return column;
}

/**
 * Positions for every step, keyed by step id.
 *
 * `steps` order is the definition's own order, which is what breaks ties within
 * a column — so a re-ordered definition lays out differently, and an unchanged
 * one does not.
 */
export function layoutWorkflow(steps: WorkflowStep[], entry?: string): Map<string, LayoutPosition> {
  const column = assignColumns(steps, entry);

  const rowInColumn = new Map<number, number>();
  const positions = new Map<string, LayoutPosition>();

  // Walk in definition order so column membership is stable and predictable.
  for (const step of steps) {
    const col = column.get(step.id) || 0;
    const row = rowInColumn.get(col) || 0;
    rowInColumn.set(col, row + 1);
    positions.set(step.id, {
      x: LAYOUT_ORIGIN.x + col * LAYOUT_COLUMN_WIDTH,
      y: LAYOUT_ORIGIN.y + row * LAYOUT_ROW_HEIGHT
    });
  }

  return positions;
}

/**
 * Where to put a step being ADDED to a workflow that is already arranged.
 *
 * §5 requires that adding a step — by hand or by WFA-007 — does not disturb the
 * user's arrangement of everything else. So nothing already placed is moved:
 * the new step goes one column right of the step it hangs off, at the first row
 * in that column that is not already occupied by something within half a row.
 */
export function placeNewStep(
  existing: { x: number; y: number }[],
  after?: { x: number; y: number }
): LayoutPosition {
  const base = after
    ? { x: after.x + LAYOUT_COLUMN_WIDTH, y: after.y }
    : { x: LAYOUT_ORIGIN.x, y: LAYOUT_ORIGIN.y };

  const collides = (p: LayoutPosition) =>
    existing.some((e) => Math.abs(e.x - p.x) < LAYOUT_COLUMN_WIDTH / 2 && Math.abs(e.y - p.y) < LAYOUT_ROW_HEIGHT / 2);

  const candidate = { ...base };
  let guard = 200;
  while (collides(candidate) && guard-- > 0) {
    candidate.y += LAYOUT_ROW_HEIGHT;
  }
  return candidate;
}
