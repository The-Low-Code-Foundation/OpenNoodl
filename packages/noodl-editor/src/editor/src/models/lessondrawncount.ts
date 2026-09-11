/**
 * UNI-007 — "did it draw", as one rule with one implementation.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * Engine 2 of the grading runner has **two adapters**, and it has to: the
 * sidecar's (`noodl-mcp/lessons/wholeSolutionGrader.ts`) spawns the render CLI
 * over a project on disk, the editor's (`models/lessonwholesolution.ts`) drives
 * a hidden Electron window over the running viewer. Different machinery, same
 * question — *"one port, one adapter per process that owns the machinery"*.
 *
 * The **counting rule** is not machinery. It is the safety property engine 2
 * exists for, and a rule enforced in two adapters is a rule that will be broken
 * in the second one. So it lives here, in a module with no imports, and both
 * adapters call it.
 *
 * 🔴 THE RULE, AND WHY IT IS `min` RATHER THAN `sum`
 * -------------------------------------------------
 * The render harness (`@nodegx/render-measure`'s `summarise`) decides a viewport
 * is blank with, per viewport:
 *
 * ```js
 * v.text.elements === 0 && v.images.total === 0
 * ```
 *
 * so "drawn" is `text.elements + images.total` — the same two numbers, hitting
 * zero exactly when the harness would call that viewport blank. A broader count
 * (every DOM node, say) would let this disagree with the `blank-render` finding
 * shipped beside it, and the day two measures of one thing disagree is the day
 * the report stops being evidence.
 *
 * **The aggregate across viewports is the minimum**, because the harness raises
 * `blank-render` if *any* viewport is blank. A page that draws on desktop and
 * nothing on a phone has not rendered, and summing would hide exactly that.
 *
 * ⚠️ **`undefined` is not zero.** A viewport that failed to measure is skipped,
 * matching `summarise`'s own `if (!v || v.error) continue`; when every viewport
 * is skipped there is no measurement at all, and the caller must turn that into
 * `unavailable` rather than into a zero. `normaliseWholeSolutionResult` refuses
 * to invent a count an adapter omitted, so the distinction is load-bearing on
 * both sides of it.
 *
 * @module noodl-editor/models/lessondrawncount
 */

/**
 * One viewport as both producers report it — the CLI's `RenderReportPayload`
 * entries and the CDP capture's reply entries are the same measured object,
 * because both come from the one `measureExpression` in `@nodegx/render-measure`.
 * Typed structurally so neither producer's payload type has to be imported here.
 */
export interface MeasuredViewportLike {
  /** Set when this viewport could not be measured. Skipped, never counted as zero. */
  error?: unknown;
  text?: { elements?: number };
  images?: { total?: number };
  [field: string]: unknown;
}

/**
 * One finding, in the render's own vocabulary. Only the code and the severity
 * are read here.
 *
 * ⚠️ No index signature, unlike {@link MeasuredViewportLike}. Both producers'
 * finding types are plain interfaces without one, and TypeScript will not assign
 * an interface to a type that declares an index signature — so adding "and
 * whatever else" here would reject exactly the two payloads this exists to
 * accept.
 */
export interface RenderFindingLike {
  code?: string;
  /** `'error' | 'warning' | 'info'` as both producers spell it. Typed wide so neither has to be imported. */
  severity?: string;
}

/** The finding that says the page drew nothing. Its own code, not a guess at one. */
export const BLANK_RENDER = 'blank-render';

/**
 * How many elements the render actually drew, or `undefined` when nothing could
 * be measured at all. See the module note — this is the rule, and it has one
 * implementation on purpose.
 */
export function countDrawnElements(viewports: Record<string, MeasuredViewportLike> | undefined): number | undefined {
  const counts: number[] = [];

  for (const viewport of Object.values(viewports ?? {})) {
    if (!viewport || viewport.error) continue;
    const texts = viewport.text?.elements;
    const images = viewport.images?.total;
    // A viewport missing either number was not measured, whatever else it holds.
    if (typeof texts !== 'number' || typeof images !== 'number') continue;
    counts.push(texts + images);
  }

  return counts.length === 0 ? undefined : Math.min(...counts);
}

/**
 * True when the harness itself concluded the page drew nothing.
 *
 * The second of engine 2's two independent reads of one question. The
 * conservative one wins if they ever disagree.
 */
export function reportsBlankRender(findings: readonly RenderFindingLike[] | undefined): boolean {
  return (findings ?? []).some((finding) => finding?.code === BLANK_RENDER);
}

/**
 * The codes of every finding by which the render itself said the picture is
 * **broken**, deduplicated and in the harness's own order.
 *
 * 🔴 WHY THIS EXISTS — UNI-010 criterion 3, §8.1
 * ----------------------------------------------
 * A drawn count answers *"did anything appear?"* and nothing else. The
 * five-lesson run produced the case where that is not enough: a lesson whose
 * Repeater stamped three rows of the literal word `"Text"` — because its row
 * component declared `dynamicports` instead of `ports`, so it had no interface
 * and the items reached nothing — drew **four** elements, one real heading and
 * three dead placeholders. `drawnElementCount > 0` was true, the harness's own
 * `dead-placeholder-text` error was collected into the result's human-readable
 * `findings` and read by nobody, and the broken bundle's scorecard came back
 * **character-for-character identical** to the fixed one's.
 *
 * That is one level above the "clean can mean EMPTY" trap this module was built
 * against: the drawn count is a **project-level** number, so one working
 * element vouches for every broken one beside it.
 *
 * ⚠️ **Severity, not a list of codes.** Naming `dead-placeholder-text` alone
 * would leave `empty-list`, `broken-image` and `content-not-visible` — all
 * `error` in the harness today — in exactly the hole this closes, and would
 * silently exclude any error the harness grows next. The harness's severity is
 * its own verdict on its own finding; this reads it rather than re-deriving it,
 * for the same reason {@link countDrawnElements} counts the two numbers
 * `summarise` counts.
 *
 * ⚠️ **`blank-render` is deliberately excluded.** It is the one error already
 * answered — by `rendered`, via {@link reportsBlankRender} — and a caller that
 * reported it here too would accuse the same page twice for one defect.
 *
 * ⚠️ **A finding with no severity is dropped**, and that errs in the *lenient*
 * direction — the same direction §8.1 did. It is still the right call: reading
 * an absent severity as `error` would fail a sound lesson on a `clipped-page`
 * warning from a recording made before severities existed, and a gate that
 * rejects the correct answer is worse than one that misses a case no live
 * producer can reach. Both producers derive their findings from one
 * `summarise`, which always sets it.
 */
export function renderDefectCodes(findings: readonly RenderFindingLike[] | undefined): string[] {
  const codes: string[] = [];
  for (const finding of findings ?? []) {
    if (!finding || finding.severity !== 'error') continue;
    if (typeof finding.code !== 'string' || finding.code === BLANK_RENDER) continue;
    if (!codes.includes(finding.code)) codes.push(finding.code);
  }
  return codes;
}
