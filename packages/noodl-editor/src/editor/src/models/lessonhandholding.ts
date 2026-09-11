/**
 * SYL-001 slice B — who decides whether a step's hand-holding is open.
 *
 * Slice A shipped `detail` as a native `<details>`, compiled **always open**, because nothing
 * knew any better and hiding the hand-holding from the beginner it was written for is the worse
 * failure. This is the "knows better" half.
 *
 * ## R3, and the boundary it draws
 *
 * Richard's ruling: the intake's `experience` answer *"change[s] the voice and level of hand
 * holding throughout the tutorial — don't need to explain to an intermediate user how to access
 * the node picker."* And the shape that ruling forces:
 *
 * > 🔴 **The editor holds the preference; the bundle carries both halves.**
 *
 * A bundle that carried one learner's answer would break D17 — a lesson stays installable from a
 * local directory with no origin. So the compiled HTML is identical for every learner and every
 * install, and the only thing that varies is one attribute, set here, at render time, from a
 * setting that lives in this editor.
 *
 * ## 🔴 Why the disclosure itself is the control
 *
 * Slice B's open question was how the editor *gets* the answer. Ruled: the editor asks once, and
 * the learner can change it whenever they like. This asks in the cheapest place there is — the
 * learner collapsing a `Show me how` **is** the answer, and expanding one is the answer changing
 * back. No modal in front of lesson 1, no settings row nobody finds.
 *
 * ⚠️ The alternative reading — an explicit question at first lesson start — is a one-line ruling
 * away, and would write the same key from a different place. Nothing below assumes which.
 *
 * ⚠️ **`experience` deliberately has no representation here.** Mapping none/some/fluent onto this
 * boolean is decided (*none* opens, *some* and *fluent* collapse — Richard's sentence names the
 * intermediate user as the one who does not need it), but the platform answer cannot reach the
 * editor yet, so writing that mapping now would add a second field nothing sets. This format has
 * already paid for one of those (`suggestedNodes`); it is recorded in prose in LESSON-FORMAT.md
 * instead, and seeds this one key on the day the answer can cross.
 */

/** The editor-settings key holding the learner's answer. Absent until they first say. */
export const LESSON_DETAIL_OPEN_KEY = 'lessons.detailOpenByDefault';

/** The slice of `EditorSettings` this needs — narrow, so a spec can hand it a plain object. */
export interface DetailPreferenceStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/**
 * The stored answer, resolved to a default open state.
 *
 * 🔴 **Anything that is not an explicit `false` reads as open.** Unset, corrupt, a string left by
 * some older shape — all of them mean *the learner has not told us*, and the safe direction for a
 * learner we know nothing about is the one slice A shipped.
 */
export function resolveDetailDefaultOpen(stored: unknown): boolean {
  return stored !== false;
}

/** Read the resolved default from a settings store. */
export function readDetailDefaultOpen(store: DetailPreferenceStore): boolean {
  return resolveDetailDefaultOpen(store.get(LESSON_DETAIL_OPEN_KEY));
}

/**
 * Set the open state of every hand-holding disclosure under `root`, and report how many it
 * touched.
 *
 * The count is returned because a call that found nothing and a call that opened everything are
 * otherwise indistinguishable from outside — and "the selector stopped matching" is exactly how
 * this would die silently after an unrelated change to the compiler's class name.
 */
export function applyDetailDefaultOpen(root: ParentNode, open: boolean): number {
  const disclosures = Array.from(root.querySelectorAll('details.lesson-detail'));
  for (const el of disclosures) {
    // Written as the content attribute because the popup is serialised back out through
    // `innerHTML` on its way to the screen, and the serialised form is what has to carry this.
    // ⚠️ `open` is a *reflected* IDL attribute, so `el.open = ...` would set the attribute too —
    // this is explicitness, not a workaround, and a spec proves the round trip either way.
    if (open) el.setAttribute('open', '');
    else el.removeAttribute('open');
  }
  return disclosures.length;
}

/**
 * Apply the learner's preference across every rendered step of a lesson, and let any one of them
 * change it for all the others.
 *
 * 🔴 **This takes the WHOLE lesson, not one step, and that is what the drive changed.** The first
 * version applied the preference per step at parse time, which is correct on a spec — each step is
 * rendered from the store and comes up right — and wrong in the app: a lesson's steps are all
 * parsed once, up front, so a learner who collapsed the hand-holding on step 3 still met step 4
 * expanded, and only saw their answer honoured after reopening the lesson. Driven, observed, fixed.
 *
 * 🔴 **The handler reads the store at event time rather than closing over the applied value.**
 * With a captured value, re-applying to the other steps below would leave every one of their
 * handlers comparing against a stale default. Reading the store means the comparison is always
 * against what the learner currently wants, which is also the honest question: *does this
 * disclosure disagree with the preference?*
 *
 * Only a disagreement is persisted. That is the right semantics — the learner deviating from what
 * we chose is the signal — and it is also what stops `toggle`, which fires **asynchronously**, from
 * feeding our own writes back as though a person had made them.
 */
export function applyDetailPreference(roots: ParentNode[], store: DetailPreferenceStore): number {
  const applyAll = (open: boolean) => roots.reduce((n, r) => n + applyDetailDefaultOpen(r, open), 0);

  const count = applyAll(readDetailDefaultOpen(store));

  for (const root of roots) {
    for (const el of Array.from(root.querySelectorAll('details.lesson-detail'))) {
      el.addEventListener('toggle', () => {
        const isOpen = (el as HTMLDetailsElement).open;
        if (isOpen === readDetailDefaultOpen(store)) return;
        store.set(LESSON_DETAIL_OPEN_KEY, isOpen);
        // Every other step of this lesson was parsed before this click. Without this they keep the
        // state they were built with until the lesson is reopened.
        applyAll(isOpen);
      });
    }
  }

  return count;
}
