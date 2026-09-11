/**
 * HLS-013 — the cloud-function deploy decision, with nothing of the editor in it.
 *
 * ## Why this is a separate file from `cloudDeploy.ts`
 *
 * Both doors must run the same decision, and one of the doors is a plain Node
 * process. Reaching `ProjectModel` from there costs more than it looks: the
 * import chain pulls `NodeGraphNode`, `NodeLibrary`, `WarningsModel` and —
 * measured, not guessed — `views/panels/propertyeditor/models/modelProxy.ts`,
 * a **renderer view module**, into whatever program imports it. In the MCP
 * server that meant 201 type errors from files that typecheck perfectly well in
 * the editor's own program, and editor view code inside a server bundle.
 *
 * So the model-shaped half (building the bundle from a `ProjectModel`) stays
 * where the models are, and runs in a child process for a headless caller. This
 * file is everything that is left: types, the fingerprint, the bundle name, and
 * the decision about what to push and what to report. It imports nothing.
 *
 * 🔴 **Keep it that way.** A single import from `@noodl-models` here would put
 * the editor's model graph back into every program that reads a deploy result.
 *
 * @module noodl-editor/utils/exporter/cloudDeployCore
 */

/** One cloud function that could not be exported, and why. */
export interface CloudExportFailure {
  /** The component name, exactly as the author sees it. */
  name: string;
  reason: string;
}

/** The bundle, plus the components that did not make it into it. */
export interface CloudBundleParts {
  bundle: Record<string, unknown> | null;
  /** Component names the bundle carries. */
  shipped: string[];
  failures: CloudExportFailure[];
}

/** What happened to one cloud function in one deploy. */
export interface CloudFunctionOutcome {
  /** The component name, exactly as the author sees it. */
  name: string;
  /**
   * `deployed` — it is on the backend because of this run.
   * `unchanged` — the backend already served this exact bundle (AC3).
   * `failed` — it did not ship, and `reason` says why.
   */
  status: 'deployed' | 'unchanged' | 'failed';
  reason?: string;
}

export interface CloudDeployResult {
  /**
   * 🔴 **`ok` means every function the project holds is on the backend.**
   *
   * A run that shipped three of four is NOT ok, even though the push succeeded —
   * an agent that reads `ok: true` and moves on would ship an app with a missing
   * endpoint. The three that made it are still deployed, and `functions` says
   * which one did not.
   */
  ok: boolean;
  /** The bundle's file name on the backend — one per project. */
  bundleName: string;
  /** Fingerprint of what was pushed (or of what the backend already had). */
  hash: string;
  /**
   * False when the backend was already serving this exact bundle. AC3's
   * "the second run says so rather than reporting a fresh success".
   */
  changed: boolean;
  /** Every cloud function in the project, with its outcome. */
  functions: CloudFunctionOutcome[];
  /** Set when the push itself failed — as opposed to individual functions failing to build. */
  error?: string;
}

/**
 * The one request a deploy makes, behind an interface.
 *
 * Implemented twice: over IPC in the editor, over `fetch` in a headless caller.
 * Both end at `PUT /admin/workflows/<name>`.
 */
export interface CloudDeployTransport {
  /** Push the bundle. Resolve on success; throw with a readable message on failure. */
  putBundle(bundleName: string, bundle: Record<string, unknown>): Promise<void>;

  /**
   * The fingerprint the backend is already serving for this bundle, or `null`
   * when it is serving none / cannot say.
   *
   * 🔴 **Optional, and its absence is not "nothing is deployed".** A transport
   * that cannot ask leaves `changed: true` — claiming "unchanged" without having
   * asked would be a fresh success wearing AC3's clothes.
   */
  readServingHash?(bundleName: string): Promise<string | null>;
}

export interface CloudDeployOptions {
  /**
   * Push even when the backend already serves this fingerprint.
   *
   * The manual action and a freshly started backend both set it: the first
   * because a person asked, the second because the backend's state is unknown
   * rather than known to match.
   */
  force?: boolean;

  /**
   * 🔴 Push an EMPTY bundle when the project has no cloud functions left.
   *
   * `WorkflowRunner` keys by file name and replaces wholesale, so an empty
   * bundle is how *"I deleted my last function"* reaches a backend — there is no
   * delete call. Without this, deleting the last function would leave it serving
   * forever.
   *
   * It is opt-in because the opposite mistake is worse: pushing an empty bundle
   * to a backend that has never seen this project creates a bundle file
   * advertising nothing, on a backend that was fine. Set it only when the
   * backend is known to have served this project before.
   */
  deleteWhenEmpty?: boolean;
}

/**
 * A stable fingerprint of the pushed bundle.
 *
 * The push happens on every project save, and a save fires ~1s after *any*
 * model change — so without this, editing a browser component would redeploy
 * every function in the project. Content-based rather than time-based so an
 * edit-and-undo is correctly a no-op.
 */
export function hashCloudExport(exportJson: Record<string, unknown> | null): string {
  if (!exportJson) return 'empty';
  const serialised = JSON.stringify(exportJson);
  // FNV-1a. Not cryptographic — this only has to distinguish two graphs the
  // same user produced seconds apart.
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialised.length; i++) {
    hash ^= serialised.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16) + '-' + serialised.length;
}

/**
 * The workflow-bundle file name for a project: `<name>.workflow.json` in the
 * backend's `workflows/` directory.
 *
 * One bundle per project, because `WorkflowRunner` keys by file name and
 * replaces wholesale — so a re-push without a component is what removes it, and
 * no `deleteWorkflow` call is needed.
 *
 * Keyed on the project **directory**, not an id: `ProjectModel.id` is not in
 * `toJSON()`, so it is regenerated on every open. One backend can serve more
 * than one project, so a constant name would let two projects clobber each
 * other's functions.
 */
export function cloudBundleNameFrom(projectName: string | undefined, projectDirectory: string | undefined): string {
  const directory = projectDirectory || '';
  const safeName = (projectName || 'project').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'project';

  if (!directory) return safeName;

  // FNV-1a again; 8 hex chars is plenty to separate the handful of project
  // folders one backend ever sees, and it keeps the file name readable.
  let hash = 0x811c9dc5;
  for (let i = 0; i < directory.length; i++) {
    hash ^= directory.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${safeName}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Push an already-built bundle to one backend, and say what happened to every
 * function in it.
 *
 * Never throws for a reason the caller could act on — a failure comes back as a
 * result with `ok: false` and a named cause. That is deliberate: the editor's
 * save-triggered push swallows rejections wholesale
 * (`CloudFunctionDeployer.start`'s `.catch(() => undefined)`), so anything that
 * throws out of here is a failure nobody ever sees.
 */
export async function deployCloudBundle(
  parts: CloudBundleParts,
  bundleName: string,
  transport: CloudDeployTransport,
  options: CloudDeployOptions = {}
): Promise<CloudDeployResult> {
  const failures: CloudFunctionOutcome[] = parts.failures.map((failure) => ({
    name: failure.name,
    status: 'failed' as const,
    reason: failure.reason
  }));

  // Nothing exported at all. Three very different cases, and they must not share
  // an answer: a project with no cloud functions is a success with nothing to
  // do, a project that just lost its last one has a deletion to push, and a
  // project whose every function failed to build is a failure.
  if (!parts.bundle) {
    if (failures.length === 0) {
      if (!options.deleteWhenEmpty) {
        return { ok: true, bundleName, hash: 'empty', changed: false, functions: [] };
      }
      try {
        await transport.putBundle(bundleName, { components: [], settings: {}, metadata: {} });
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return { ok: false, bundleName, hash: 'empty', changed: false, functions: [], error: reason };
      }
      return { ok: true, bundleName, hash: 'empty', changed: true, functions: [] };
    }

    return {
      ok: false,
      bundleName,
      hash: 'empty',
      changed: false,
      functions: failures,
      error: `None of this project's ${failures.length} cloud function(s) could be exported.`
    };
  }

  const hash = hashCloudExport(parts.bundle);

  if (!options.force && transport.readServingHash) {
    let serving: string | null = null;
    try {
      serving = await transport.readServingHash(bundleName);
    } catch {
      // Could not ask. Fall through and push: a deploy that skipped because it
      // failed to read the backend would be the worst of both answers.
      serving = null;
    }

    if (serving && serving === hash) {
      return {
        ok: failures.length === 0,
        bundleName,
        hash,
        changed: false,
        functions: [...parts.shipped.map((name) => ({ name, status: 'unchanged' as const })), ...failures]
      };
    }
  }

  try {
    // 🔴 The fingerprint travels WITH the bundle, and is deliberately not part of
    // what was fingerprinted: `hashCloudExport` ran over the bundle as built, and
    // a hash of an object containing its own hash cannot be recomputed by the
    // next run. The backend echoes this field back on `GET /admin/workflows`,
    // which is how a fresh process — with no memory of its own last push — can
    // tell "already deployed" from "deployed just now" (AC3).
    await transport.putBundle(bundleName, { ...parts.bundle, deployFingerprint: hash });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    // 🔴 The bundle is all-or-nothing on the backend (`WorkflowRunner.loadWorkflow`
    // builds a candidate runner and only swaps it in on a complete success), so a
    // failed push means NONE of these functions deployed — including the ones
    // that built cleanly. Saying otherwise would be the "deploy returned true"
    // lie this task exists to remove.
    return {
      ok: false,
      bundleName,
      hash,
      changed: false,
      functions: [...parts.shipped.map((name) => ({ name, status: 'failed' as const, reason })), ...failures],
      error: reason
    };
  }

  return {
    ok: failures.length === 0,
    bundleName,
    hash,
    changed: true,
    functions: [...parts.shipped.map((name) => ({ name, status: 'deployed' as const })), ...failures]
  };
}

/**
 * The failed functions, named — HLS-013 AC2.
 *
 * `Could not export 3 cloud function(s)` was what the deploy said before, and a
 * count is the one thing neither an agent nor a person can act on: it does not
 * say which function to look at.
 */
export function namedFailure(result: Pick<CloudDeployResult, 'functions'>): string {
  const failed = result.functions.filter((f) => f.status === 'failed');
  if (!failed.length) return 'The deploy did not complete.';
  const named = failed.map((f) => `"${f.name}"${f.reason ? ` (${f.reason})` : ''}`).join(', ');
  return `${failed.length} cloud function(s) did not deploy: ${named}`;
}
