/**
 * Types for `@nodegx/render-measure`.
 *
 * ⚠️ **Hand-written, and that is the cost of the F22 decision.** The source is
 * plain CJS because `scripts/devtools/measure-from-disk.js` is run by bare
 * `node`, which cannot `require` a `.ts` file — so unlike the repo's other
 * no-build packages (`@noodl/types`, `@noodl/platform`, …) this one cannot point
 * `main` at TypeScript. These declarations are therefore a *claim* about
 * `index.js` rather than a derivation from it, and `tsc` cannot check them
 * against it.
 *
 * The mitigation is that the shapes below are narrow on purpose: only what the
 * editor client actually consumes is typed precisely, and the two structures
 * that come back from a browser (`ViewportMeasurement`) or off disk
 * (`BlankDiagnosis`) are declared with index signatures rather than
 * enumerated. A wrong field name in a precisely-typed member is a compile
 * error; an over-specified guess about a measurement blob would just be a lie
 * with better syntax highlighting.
 */

/** A viewport the report knows how to ask for. */
export interface ViewportSpec {
  name: string;
  width: number;
  height: number;
  /** Device emulation — Chrome will not open a real window under ~500px. */
  mobile: boolean;
}

export declare const DEFAULT_VIEWPORTS: ViewportSpec[];

/**
 * Every viewport with a name — `desktop`, `tablet`, `phone`.
 *
 * ⚠️ A superset of {@link DEFAULT_VIEWPORTS}: a **vocabulary**, not a default.
 * `tablet` is selectable by name everywhere but is not measured unless asked
 * for, so adding it did not change what `render_report` costs.
 */
export declare const NAMED_VIEWPORTS: ViewportSpec[];

/** A viewport at least this wide is expected to lay content out in more than one column. */
export declare const DESKTOP_WIDTH: number;

/**
 * Render-finding codes. Deliberately **not** `DiagnosticCode` values — those
 * name what is wrong with a graph, these name what is wrong with a picture.
 */
export declare const RenderFinding: {
  readonly BlankRender: 'blank-render';
  readonly EmptyList: 'empty-list';
  readonly DeadPlaceholderText: 'dead-placeholder-text';
  readonly BrokenImage: 'broken-image';
  readonly ContentNotVisible: 'content-not-visible';
  readonly ClippedPage: 'clipped-page';
  readonly ElementsOverflowing: 'elements-overflowing';
  readonly SingleColumnGrid: 'single-column-grid';
  readonly MinimumLayoutWidth: 'minimum-layout-width';
  readonly HorizontalOverflow: 'horizontal-overflow';
  readonly FlatTypeScale: 'flat-type-scale';
  readonly EmptyDecoratedBox: 'empty-decorated-box';
  readonly ConsoleError: 'console-error';
  /**
   * VIB-007 M3 — the poverty family. Every code above detects excess or
   * breakage; these three detect a page that is whole and is a default
   * template, which is what all nine VIB-001 baseline pages were. They are
   * `warning`, never `error`: `error` is what the render verdict blocks "done"
   * on, and app-chrome pages are exempt from the marketing tells they encode.
   */
  readonly SingleGround: 'single-ground';
  readonly NoImagery: 'no-imagery';
  readonly NoDisplayType: 'no-display-type';
};

export type RenderFindingCode = (typeof RenderFinding)[keyof typeof RenderFinding];

export type RenderSeverity = 'error' | 'warning' | 'info';

export declare const SEVERITY_ORDER: Record<RenderSeverity, number>;

export declare const CLIPPED_CONTENT_SLACK: number;

/** VIB-007 M3 — README §2's *"headline under ~48px on desktop"*, as a number. */
export declare const DISPLAY_TYPE_MIN_PX: number;

/**
 * VIB-007 M3 — the codes that mean *the page is whole and is a default
 * template*, as one list. A consumer grouping these apart from the twelve
 * defect detectors must read this rather than restate it.
 */
export declare const POVERTY_FINDINGS: readonly RenderFindingCode[];

/** Is this finding about the page being poor rather than broken? */
export declare function isPovertyFinding(finding: { code?: string } | null | undefined): boolean;

export interface RenderFindingResult {
  code: RenderFindingCode;
  severity: RenderSeverity;
  /** Which viewport it was measured at. */
  viewport: string;
  /** What was measured, in words an agent can act on. Never a list of guesses. */
  message: string;
  /**
   * LAS-007 — set when this finding describes, from the picture's side, a defect
   * the graph validator also names. Keys the example table on one vocabulary
   * rather than two.
   */
  relatedDiagnostic?: string;
  [field: string]: unknown;
}

/**
 * Raw numbers back from one viewport. Index-signature by design — see the
 * module note: this is produced by `measureExpression` inside a page, and
 * enumerating it here would be a guess `tsc` cannot check.
 */
export interface ViewportMeasurement {
  requested: { width: number; height: number };
  error?: string;
  [field: string]: unknown;
}

/** AWP-003's off-disk answer to "why is nothing on screen". Optional everywhere. */
export interface BlankDiagnosis {
  ok: boolean;
  [field: string]: unknown;
}

/**
 * One expression, evaluated in the page. Returns raw numbers only — every
 * judgement about what they mean lives in {@link summarise}.
 *
 * The editor's client evaluates this with `webview.executeJavaScript(...)`;
 * the CLI evaluates it over CDP. **Same string, same numbers, same findings** —
 * which is the point of the package.
 */
export declare function measureExpression(placeholders: string[], probes?: unknown[]): string;

/**
 * Turn raw per-viewport measurements into findings and a one-line summary.
 * Pure: measurements in, report out.
 */
export declare function summarise(
  viewports: Record<string, ViewportMeasurement>,
  diagnosis?: BlankDiagnosis | null,
  overridden?: Record<string, unknown>
): { findings: RenderFindingResult[]; summary: string };

/** One sentence an agent can act on without reading the JSON. */
export declare function summaryLine(
  viewports: Record<string, ViewportMeasurement>,
  findings: RenderFindingResult[]
): string;

export declare function plural(n: number, one: string, many: string): string;
export declare function widestOffender(v: ViewportMeasurement): string | null;
export declare function describeSites(entry: { sites?: { port: string; component: string }[] }): string;

/** Port names whose value is what the user reads on the page. */
export declare const TEXT_BEARING_PORTS: RegExp;

/**
 * The strings a visual node shows when nobody told it what to say, derived from
 * a catalog **object** rather than a path — which is what lets the editor, which
 * bundles `node-catalog.json` and has no `fs`, apply the identical rule the CLI
 * does instead of hardcoding a paraphrase of it.
 */
export declare function placeholderStringsFromCatalog(catalog: unknown): string[];
