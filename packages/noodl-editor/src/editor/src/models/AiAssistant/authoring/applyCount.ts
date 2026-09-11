/**
 * BLD-014 Rule 7 — how many times this editor session has changed the project.
 *
 * ## Why a counter and not a timestamp
 *
 * A capture of your own app is true for about one turn, and the question a
 * stale check has to answer is *"has the thing in this picture changed since?"*
 * — not *"how old is it?"*. A screenshot taken twenty minutes ago is perfectly
 * current if nothing was applied in between, and one taken four seconds ago is
 * worthless if an Accept landed three seconds ago. A clock answers the wrong
 * question in both directions.
 *
 * The counter is also what makes `isStale` a pure function of two numbers,
 * which is why the whole staleness rule could be written and specced in
 * BLD-011 with nothing on screen to produce a capture yet.
 *
 * ⚠️ **Session-scoped, and deliberately not persisted.** It counts applies in
 * *this* editor run. A capture cannot outlive the run that took it — nothing
 * writes reference bytes to disk, by `TurnReference`'s design — so a count that
 * survived a restart would be comparing against captures that no longer exist.
 *
 * @module AiAssistant/authoring/applyCount
 */

let applies = 0;
const listeners = new Set<() => void>();

/**
 * Record that something the agent produced reached the project.
 *
 * Called from the accept path, not from `ProjectModel`'s own change events: the
 * question is whether the *agent* changed the app under a capture the user is
 * about to send back to it. A user dragging a node on the canvas also
 * invalidates a screenshot, but greying every capture whenever anyone touches
 * anything would make the signal meaningless within a minute.
 */
export function noteApply(): void {
  applies += 1;
  for (const listener of Array.from(listeners)) listener();
}

export function applyCount(): number {
  return applies;
}

/** Subscribe; returns the unsubscribe. */
export function onApplyCountChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Specs only — the counter is module state and a spec must not inherit another's. */
export function resetApplyCountForTests(): void {
  applies = 0;
  listeners.clear();
}
