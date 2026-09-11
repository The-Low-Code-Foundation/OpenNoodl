/**
 * FIX-025 — do not let a learner quietly delete the thing the lesson is grading.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE ASK (Richard, 2026-08-20):
 *
 * *"It's also easy to accidentally delete bits of the tutorial app that are needed to complete
 * the session, and you might not remember what you deleted, so we need more protection against
 * users accidentally messing up the whole tutorial."*
 *
 * ⚠️ **"You might not remember what you deleted" is the load-bearing half.** Undo already
 * exists; what does not is any way to *notice*. A lesson project looks like an ordinary project
 * — the welcome step explicitly says *"Edit it freely — that **is** the lesson"* — so deleting
 * the Text the next step grades is an ordinary, encouraged-looking action with a consequence
 * that only shows up as a step that will not tick, minutes later, with no way to connect the
 * two. That distance is the defect.
 *
 * So this is a **confirm, not a refusal.** A lesson project is the learner's to break, and a
 * lesson that forbids editing is not a lesson. What they need is to be told *at the moment of
 * the action* that this particular node is one a step is looking for, and which step.
 *
 * ## Why the conditions, and not a hand-listed set of protected nodes
 *
 * The nodes worth protecting are exactly the nodes some step names in its `completeWhen`. That
 * list already exists, it is what grading reads, and deriving from it means a lesson author
 * cannot forget to maintain it — the same argument as `lessonconditioncopy.ts` one file over.
 * A separate `protected: [...]` array in the lesson format would be a second statement of the
 * same fact and would drift on the first edit.
 *
 * ⚠️ **Matched on LABEL and TYPE, never on node id.** A learner who deletes the Caption text
 * and drags a fresh one in has satisfied the step; ids do not survive that and are not what the
 * conditions address. This is the same grammar `findNodeWithPath` resolves.
 *
 * ⚠️ **Deliberately conservative about types.** A bare `%Text` condition names a *type*, and a
 * lesson project can contain several Texts of which only one matters. Warning on every Text
 * would fire on the learner's own scratch nodes and would train them to click through the
 * dialog — which costs more than the protection buys. So a type-only condition protects a node
 * **only when it is the last one of that type in the component**, which is precisely when
 * deleting it makes the step ungradeable.
 *
 * @module models/lessonprotection
 */

/** A node as this module needs to see it. Structural, so tests need no editor. */
export interface ProtectedNodeView {
  id: string;
  label?: string;
  typeName?: string;
}

/** One step, as this module needs to see it. `conditions` are the compiled `completeWhen`. */
export interface LessonStepView {
  title?: string;
  conditions?: readonly Record<string, unknown>[];
}

export interface ProtectionFinding {
  /** What to call the node in the dialog. */
  nodeName: string;
  /** The step that would stop being completable. */
  stepTitle: string;
}

function conditionPaths(condition: Record<string, unknown>): string[] {
  const paths: string[] = [];
  for (const key of ['path', 'from', 'to']) {
    const value = condition[key];
    if (typeof value === 'string' && value.length) paths.push(value);
  }
  return paths;
}

/** `#Caption` → `{ label: 'Caption' }`, `%Text` → `{ type: 'Text' }`, for every segment. */
function addressedBy(path: string): { labels: string[]; types: string[] } {
  const labels: string[] = [];
  const types: string[] = [];
  const segments = path.split(':');
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsWith('#')) labels.push(segment.substring(1).toLowerCase());
    else if (segment.startsWith('%')) types.push(segment.substring(1).toLowerCase());
  }
  return { labels, types };
}

/**
 * Which of the nodes about to be deleted a lesson step is grading.
 *
 * @param deleting   the nodes the learner selected
 * @param steps      every step of the running lesson, in order
 * @param remaining  every node that will still exist afterwards, used for the last-of-its-type
 *                   rule described in the module note. Pass the whole component's nodes.
 */
export function protectedByLesson(
  deleting: readonly ProtectedNodeView[],
  steps: readonly LessonStepView[],
  remaining: readonly ProtectedNodeView[] = []
): ProtectionFinding[] {
  const deletingIds = new Set(deleting.map((n) => n.id));
  const survivors = remaining.filter((n) => !deletingIds.has(n.id));

  /** The first step grading this node, or `null`. One finding per node is enough to stop and ask. */
  function stepNeeding(node: ProtectedNodeView): string | null {
    const label = node.label?.toLowerCase();
    const type = node.typeName?.toLowerCase();

    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      for (const condition of step.conditions ?? []) {
        for (const path of conditionPaths(condition)) {
          const { labels, types } = addressedBy(path);

          const byLabel = Boolean(label && labels.includes(label));
          // See the module note: a type-only match protects only the last of its type.
          const byType =
            Boolean(type && types.includes(type)) &&
            labels.length === 0 &&
            !survivors.some((s) => s.typeName?.toLowerCase() === type);

          if (byLabel || byType) return step.title || `Step ${index + 1}`;
        }
      }
    }
    return null;
  }

  const findings: ProtectionFinding[] = [];
  for (const node of deleting) {
    const stepTitle = stepNeeding(node);
    if (stepTitle) findings.push({ nodeName: node.label || node.typeName || 'this node', stepTitle });
  }
  return findings;
}

/**
 * The sentence the confirm dialog shows. `null` when there is nothing to warn about, which is
 * the caller's signal to delete without asking.
 */
export function protectionMessage(findings: readonly ProtectionFinding[]): string | null {
  if (!findings.length) return null;
  if (findings.length === 1) {
    return (
      `“${findings[0].nodeName}” is one of the nodes this lesson is looking for — the step ` +
      `“${findings[0].stepTitle}” checks for it. Delete it anyway?`
    );
  }
  const names = findings.map((f) => `“${f.nodeName}”`).join(', ');
  return `${names} are nodes this lesson is looking for, and deleting them will stop steps completing. Delete them anyway?`;
}

// ───────────────────────────────────────────────────────────────────────────────
// The registry
//
// ⚠️ A registry rather than an import, for the same reason `blocklyResize.ts` uses one: the
// delete path (`EditorClipboard`) is in the eager bundle and must not reach into the lesson
// layer, and the lesson layer is the only thing that knows whether a lesson is running. The
// lesson layer publishes its steps while it is mounted and withdraws them when it is not, so
// the guard is inert in every ordinary project by construction.
// ───────────────────────────────────────────────────────────────────────────────

let runningLesson: readonly LessonStepView[] | null = null;

/** Called by the lesson layer on mount. Returns the withdraw function for its teardown. */
export function publishRunningLesson(steps: readonly LessonStepView[]): () => void {
  runningLesson = steps;
  return () => {
    runningLesson = null;
  };
}

/** The running lesson's steps, or `null` when this is an ordinary project. */
export function peekRunningLesson(): readonly LessonStepView[] | null {
  return runningLesson;
}
