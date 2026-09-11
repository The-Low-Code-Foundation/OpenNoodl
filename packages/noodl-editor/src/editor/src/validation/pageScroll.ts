/**
 * REL-002a — a page in an app that cannot scroll.
 *
 * ## What was measured, and what the row it comes from got wrong
 *
 * The task this belongs to names three "ambush defaults" — a `Group` with no `sizeMode`, a
 * missing `scrollEnabled`, and `clip: true` — and says they are why the members-area template's
 * setup form was unreachable below the fold. **The symptom is real and none of the three causes
 * it.** Six arms were built as real projects, one parameter apart, and rendered on the product's
 * own host CSS at 988x313 with a 20-row page:
 *
 * ```
 *   ground parameters                                   last row reachable?
 *   (nothing but flexDirection)                                no
 *   clip: true                                                 no
 *   sizeMode explicit, width/height 100%                       no
 *   sizeMode explicit + clip                                   no
 *   sizeMode contentHeight                                     no
 *   sizeMode explicit + clip + scrollEnabled: true             no      <- the row's own fix
 *   settings.bodyScroll: true                                  YES
 * ```
 *
 * The cause is one project setting. With `bodyScroll` falsy, `viewer.jsx` wraps the whole app in
 * a `width/height: 100%` div at `overflow: clip` — its own comment reads *"this div is pinned to
 * the viewport and routinely holds taller content"* — and `clip`, unlike `hidden`, creates no
 * scroll container at all (NDA-008, deliberately: it was the fix for a focus-scroll jump the user
 * could not scroll back from). So there is nothing for the user *or* the browser to scroll, and
 * `scrollEnabled` on a node inside it cannot help: that node grows to its own content, so it has
 * nothing to scroll, and the clip is two ancestors above it.
 *
 * ## Why this fires on "unset" and not on "false"
 *
 * Because `false` has never once been chosen. Over the two project corpora — **187 projects, 143
 * of them carrying a `Page`** — 76 set `bodyScroll: true`, **67 leave it unset, and zero set it
 * to `false`**. There is no population of authors who wanted a fixed viewport and said so; there
 * is a population who never met the setting, and their apps ship content nobody can reach. So the
 * three states are kept distinct all the way down (see {@link CheckPageScrollOptions.bodyScroll}):
 * a caller that cannot read project settings is silent, a project that decided is silent, and a
 * project that has not decided gets one sentence per page.
 *
 * ## What this deliberately does not claim
 *
 * It does not claim the page IS too tall — that depends on the viewport, the data and the fonts,
 * and no static read of a graph can know it. It claims the app has no way to scroll *if* it ever
 * is, which is a property of the project and true whatever the page contains. That is why the
 * message talks about the app rather than about this page's height, and why one diagnostic per
 * page component is the right cardinality: the page is where an author is standing when they can
 * still act on it.
 *
 * Pure: the caller supplies nodes and the setting's three-state value.
 *
 * @module noodl-editor/validation/pageScroll
 */
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';
// The one spelling of the page node's type, imported rather than restated: two constants that
// agree are still two constants, and this file's whole predicate hangs off it.
import { PAGE_NODE_TYPE } from './navigation';

/** A node as this check reads it — the type is the whole predicate on the graph side. */
export interface PageScrollNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
}

export interface CheckPageScrollOptions {
  /** Component identifier for the diagnostic's location. */
  component: string;
  /**
   * The project's `settings.bodyScroll`, in three states that must stay distinct:
   *
   * - `undefined` — **do not check.** The caller could not read project settings. Guessing here
   *   would report every project whose root this layer cannot see, which is the false positive
   *   that gets a rule switched off. Same convention as `backend`, `urlPaths` and `security`.
   * - `null` — the project file was read and the setting is **absent**. This is the finding.
   * - `true` / `false` — the project decided. Silent either way; a fixed-viewport app is a real
   *   choice even though the corpus contains none.
   */
  bodyScroll?: boolean | null;
  /** Severity for this finding. Defaults to `warning`; see {@link DiagnosticCode.PageCannotScroll}. */
  severity?: Severity;
}

/**
 * Report a page whose app has no way to scroll.
 *
 * One diagnostic per component, not per `Page` node: a component holds at most one page in
 * practice, and the decision the author has to make is a single project-wide one. Reporting it
 * once per node would invite answering it once per node, which is not a thing the setting can do.
 */
export function checkPageScroll(
  nodes: readonly PageScrollNode[],
  options: CheckPageScrollOptions
): Diagnostic[] {
  const { component, bodyScroll, severity = 'warning' } = options;
  // `undefined` is "the caller cannot say"; only an explicit `null` is "the project has not set it".
  if (bodyScroll !== null) return [];

  const page = nodes.find((node) => node.type === PAGE_NODE_TYPE);
  if (!page) return [];

  return [
    {
      code: DiagnosticCode.PageCannotScroll,
      severity,
      message:
        'This project does not set `bodyScroll`, so the app cannot scroll: the viewer pins the ' +
        'whole app to the viewport with `overflow: clip`, which creates no scroll container at ' +
        'all. Anything on this page below the fold — the rest of a form, its submit button, the ' +
        'end of a list — is unreachable, for the user and for the browser alike.',
      location: {
        component,
        nodeId: page.id,
        nodeType: page.type,
        nodeLabel: page.label
      },
      suggestion:
        'Set `bodyScroll: true` in the project settings; the page then grows with its content and ' +
        'the body scrolls, which is what every app in the corpus that decided this chose. Note ' +
        'that `scrollEnabled` on a Group is NOT the same fix and does not work here — it makes ' +
        'that one Group scroll its own overflow, and a Group sized by its content has none. If ' +
        'this app really is a fixed viewport that must never scroll, set `bodyScroll: false` and ' +
        'this stops being reported.'
    }
  ];
}
