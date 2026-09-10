/**
 * HLS-002 — the exit codes `nodegx` answers with, and the reason they are a table rather than
 * `0` and `1`.
 *
 * 🔴 **This whole phase is about removing the human from the loop.** In a terminal, a wrong exit
 * code is a cosmetic complaint: the person reads the sentence above it. In a GitHub Action there
 * is no person, the sentence scrolls past in a log nobody opens, and the only thing the pipeline
 * can branch on is this number. A CLI that returns `1` for "you pointed me at a folder inside the
 * project" and `1` for "this project is in the legacy format" has told the pipeline nothing.
 *
 * Each code below is produced by exactly one cause and is asserted against that cause in
 * `tests/hls002-cli.test.ts` — a spec per row, provoked for real, never by inspecting a branch.
 */
export const EXIT = {
  /** The export ran, or `--dry-run` found nothing that will not translate. */
  ok: 0,
  /** The arguments do not name a command this binary has. Nothing was read. */
  usage: 1,
  /**
   * The project could not be read: the folder is not there, it holds a legacy `project.json`
   * rather than `nodegx.project.json`, or parsing threw. Distinct from {@link EXIT.target}
   * because "your project is the wrong format" and "your output folder is the wrong place" are
   * different things to fix and a pipeline should be able to say which happened.
   */
  project: 2,
  /** The output folder was refused — inside the project, a file, or not empty without `--force`. */
  target: 3,
  /**
   * `--dry-run` only: the export would leave something out. Not an error — the pre-flight ran and
   * printed — but a check mode that always exits 0 is not a check, and the thing a pipeline wants
   * to gate on is precisely "did anything fail to translate this time".
   *
   * ⚠️ A real export with refusals still exits {@link EXIT.ok}: it succeeded, and the refusals are
   * in `EXPORT-REPORT.md` where the author reads them. Failing the build on them is `--dry-run`'s
   * job, deliberately, so that a project with a known deferral can still ship.
   */
  refusals: 4,
  /**
   * A write failed part-way. The folder now holds part of an app, which builds nothing — so this
   * is louder than a failure before any write, and says so.
   */
  write: 5,
  /**
   * HLS-006 — `serve` could not start: the folder is not a built site, or the port is taken. It
   * is its own code rather than {@link EXIT.target} because a pipeline that gets this one has a
   * *running* problem (a port already in use, most often) rather than a wrong argument, and the
   * two want different retries.
   */
  serve: 6,
  /**
   * HLS-007 — `render` only: a routed page did not render. The router registers it and the sweep
   * has no row for it, or it was reached and came back blank, or its measurement errored, or the
   * image that was asked for was never written.
   *
   * 🔴 Its own code, and not {@link EXIT.refusals}, because the two mean opposite things to a
   * pipeline. A refusal is *the exporter knows it cannot translate this and said so*; this is
   * *the app was built, the page is routed, and there is nothing on it* — which nothing upstream
   * of the browser can see. The harness itself exits 0 whatever it finds (a finding is
   * `render_report`'s product, not a crash), so a pipeline gating on the harness's status gates on
   * nothing at all. This code is the whole reason the command exists rather than a shell alias.
   */
  render: 7,
  /**
   * HLS-007 — `render` only: there is no render harness here. Distinct from every code above
   * because it is a statement about **this installation**, not about the project or the arguments:
   * nothing the caller changes about either will fix it, and a pipeline that retries is wasting
   * its time. See `renderHarness.ts` for why the published package does not carry one.
   */
  harness: 8
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
