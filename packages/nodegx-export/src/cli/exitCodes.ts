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
   * HLS-006 — `serve` could not start: the folder is not a built site, or the port is taken.
   * HLS-014 widened it to `live`, where the same sentence — *nothing is answering* — is a URL that
   * refused the connection, timed out, or came back non-200. It
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
   * `render` and `deploy`: there is no harness or engine here. Distinct from every code above
   * because it is a statement about **this installation**, not about the project or the arguments:
   * nothing the caller changes about either will fix it, and a pipeline that retries is wasting
   * its time. See `renderHarness.ts` and `deployEngine.ts` for why the published package carries
   * neither.
   *
   * 🔴 HLS-015 widened this from "render only" to both commands rather than minting a ninth code
   * for the same sentence. The two refusals differ in what is missing and are identical in what a
   * pipeline should do about it, and an exit code exists to be branched on — a second number
   * meaning "stop retrying, this box cannot do that" would be a distinction with no consumer.
   */
  harness: 8,
  /**
   * HLS-015 — `deploy` only: the folder that was written would render nothing. Not one deployed
   * component carries a root node, or the component the app starts at does not.
   *
   * 🔴 Its own code, and the reason it exists is register row **C67**: this failure is invisible to
   * every reading upstream of the browser. The deploy resolves, writes all eight files, reports
   * the same copy count as a good run, and keeps **93 of 93 connections** — the field that empties
   * is `roots`. A pipeline that gates on `deployToFolder` resolving gates on nothing, and the
   * person gets a blank page under a success message. Distinct from {@link EXIT.render} because
   * that one is measured by a browser and this one is measured by reading the artefact, so they
   * are available at different moments and a pipeline may well have only one of them.
   */
  deploy: 9,
  /**
   * HLS-014 — `live` only: the URL answered, and what it is serving is not the build it was
   * compared against (or is not a NodeGX deploy at all, or names an export the server does not
   * hold).
   *
   * 🔴 Its own code because it is the only one in this table that is a statement about **a
   * machine that is not this one**. Every other failure here is fixed by changing an argument, a
   * project or an installation; this one is fixed by uploading, or by waiting for a cache, or by
   * discovering that the deploy went somewhere else — and a pipeline that treats it like
   * {@link EXIT.deploy} would refuse to ship a build that is perfectly good.
   *
   * ⚠️ Distinct from {@link EXIT.serve}, which stays "nothing answered". A 404 from the host and a
   * 200 serving last week's app are opposite situations: one is a deploy that has not landed, the
   * other is a deploy that has landed somewhere nobody is looking.
   */
  stale: 10
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
