/**
 * FIX-025 — what *"Check my work"* is about to check, in words the learner can act on.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE CONTROL WAS UNREADABLE, NOT BROKEN.
 *
 * Richard, 2026-08-20: *"'Check my work' button doesn't make sense, it seems to trigger all
 * the signals in the app but it's not clear when or why you should actually click it."*
 *
 * Two separate problems, and only one of them is copy:
 *
 *  1. **It was offered on every step**, including the ones with nothing to grade — a lesson's
 *     narrative steps have no `completeWhen` at all, so pressing it there runs a grading pass
 *     that can only ever say the same thing. A control that is present when it cannot do
 *     anything is what teaches people it does nothing.
 *  2. **It never said what it was looking for.** The summary appears *after* a run, so before
 *     the first press there was no sentence anywhere connecting the button to the step. The
 *     lesson asks for "a Text labelled Caption"; the button could have said so all along.
 *
 * This module is the second half. It turns a step's conditions — the *same* objects the
 * evaluator grades, never a re-description an author has to keep in sync — into one short
 * line. 🔴 **Derived from the conditions, deliberately.** A hand-written "what to check"
 * field in the lesson format would be a second statement of the same fact, and the two would
 * drift the first time somebody edited a condition; this cannot, because there is nothing to
 * edit. It is the `truth`-sentence argument from `LearnerPathSection`, one layer down.
 *
 * ⚠️ **Best-effort, and it must stay that way.** An unrecognised verb yields `null` and the
 * caller falls back to a generic line rather than printing a JSON blob at a beginner. Adding
 * a verb to the evaluator without adding it here degrades the copy; it cannot break grading.
 *
 * @module noodl-editor/views/lessons/lessonconditioncopy
 */

/**
 * The last **label** segment of a node path — `/#__page__/Home:#Caption` → `Caption`.
 *
 * 🔴 `#` only, never `%`. A `%Text` segment is the node's TYPE, and treating it as a name
 * produced *"a Text called “Text”"* — caught by this module's own spec, which is the whole
 * reason the two lookups are separate functions rather than one loop over both prefixes.
 */
function labelName(path: string | undefined): string | null {
  if (!path) return null;
  const segments = path.split(':');
  for (let i = segments.length - 1; i >= 1; i--) {
    if (segments[i].startsWith('#')) return segments[i].substring(1);
  }
  return null;
}

/** The last named segment of a node path, label or type — for verbs that just need something to point at. */
function nodeName(path: string | undefined): string | null {
  if (!path) return null;
  const segments = path.split(':');
  for (let i = segments.length - 1; i >= 1; i--) {
    const segment = segments[i];
    if (segment.startsWith('#') || segment.startsWith('%')) return segment.substring(1);
  }
  return null;
}

/** The component a path is rooted in — `/#__page__/Home:#Caption` → `Home`. */
function componentName(path: string | undefined): string | null {
  if (!path) return null;
  const head = path.split(':')[0];
  if (!head) return null;
  const leaf = head.split('/').filter(Boolean).pop();
  return leaf ?? null;
}

/** `on Home`, or nothing when the path names no component worth saying. */
function where(path: string | undefined): string {
  const component = componentName(path);
  return component ? ` on ${component}` : '';
}

/**
 * One condition, as a phrase. `null` for a verb with no copy yet — see the module note on why
 * that is a degradation and not a failure.
 */
export function describeCondition(condition: Record<string, unknown>): string | null {
  const path = typeof condition.path === 'string' ? condition.path : undefined;
  const name = nodeName(path);

  if ('hastype' in condition) {
    const type = String(condition.hastype);
    const label = labelName(path);
    return label ? `a ${type} called “${label}”${where(path)}` : `a ${type}${where(path)}`;
  }
  if ('haslabel' in condition) {
    return `a node labelled “${String(condition.haslabel)}”${where(path)}`;
  }
  if ('exists' in condition) {
    if (condition.exists === false) return name ? `“${name}” removed${where(path)}` : null;
    return name ? `“${name}”${where(path)}` : null;
  }
  if ('hasport' in condition) {
    return name ? `a “${String(condition.hasport)}” port on “${name}”` : null;
  }
  if ('hasparams' in condition) {
    const params = String(condition.hasparams)
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!params.length || !name) return null;
    return `${params.join(' and ')} set on “${name}”`;
  }
  if ('paramseq' in condition) {
    const values = condition.paramseq as Record<string, unknown>;
    const keys = Object.keys(values ?? {});
    if (!keys.length || !name) return null;
    return keys.length === 1
      ? `“${name}” with ${keys[0]} set to ${JSON.stringify(values[keys[0]])}`
      : `“${name}” with ${keys.join(', ')} set`;
  }
  if ('hasconnection' in condition) {
    const from = nodeName(condition.from as string);
    const to = nodeName(condition.to as string);
    const ports = String(condition.hasconnection).split(',');
    if (from && to) return `${from} wired to ${to}${ports.length === 2 ? ` (${ports[0].trim()} → ${ports[1].trim()})` : ''}`;
    return 'the two nodes wired together';
  }
  if ('isvisualroot' in condition) {
    return name ? `“${name}” as the top of the page` : null;
  }
  if ('routerlists' in condition) {
    const page = componentName(String(condition.routerlists));
    return page ? `${page} listed in a Router` : null;
  }
  if ('activecomponentnameeq' in condition) {
    const component = componentName(String(condition.activecomponentnameeq));
    return component ? `${component} open on the canvas` : null;
  }
  if ('viewerpatheq' in condition) {
    return `the preview showing ${String(condition.viewerpatheq)}`;
  }
  if ('collection' in condition || 'rowcountatleast' in condition || 'hascolumns' in condition) {
    const collection = typeof condition.collection === 'string' ? condition.collection : 'your data';
    return `records in ${collection}`;
  }
  return null;
}

/**
 * The line under the button: *"Looking for: a Text called “Caption” on Home."*
 *
 * `null` when the step has nothing to grade — the caller draws no control at all in that case,
 * which is problem 1 in the module note.
 *
 * ⚠️ **Capped at three phrases.** A step with eight conditions produces a paragraph, and the
 * control is 280px wide with the step strip beside it; past three the count is more useful
 * than the list.
 */
export function describeStepCheck(conditions: readonly Record<string, unknown>[] | undefined): string | null {
  if (!conditions || conditions.length === 0) return null;

  const phrases = conditions.map(describeCondition).filter((phrase): phrase is string => Boolean(phrase));
  if (!phrases.length) return 'Looking for the changes this step asks for.';

  if (phrases.length > 3) {
    return `Looking for ${phrases.slice(0, 3).join(', ')}, and ${phrases.length - 3} more.`;
  }
  if (phrases.length === 1) return `Looking for ${phrases[0]}.`;
  return `Looking for ${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}.`;
}
