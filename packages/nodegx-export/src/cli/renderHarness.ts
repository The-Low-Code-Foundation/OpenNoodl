/**
 * HLS-007 — finding the render harness, and saying so when it is not there.
 *
 * ## 🔴 The published package cannot render, on purpose, and this file is where that is admitted
 *
 * `@nodegx/export` translates a project into React source. It has no browser, and rendering a
 * NodeGX app needs one plus the editor's 14MB viewer bundle, two node catalogs and a Chrome. None
 * of that is in the tarball `npm publish` uploads (`files: ["dist", "README.md"]`), and putting it
 * there would make this package's build depend on the editor's.
 *
 * So `nodegx render` is a **front door onto a harness that lives elsewhere**, and the honest
 * outcome of running it from a bare `npm i -g @nodegx/export` is a refusal that says where it
 * looked. That refusal is graded (`hls007-harness.test.ts`) rather than assumed, because
 * {@link https://github.com/The-Low-Code-Foundation/NodeGX/issues/36 C72} is exactly the failure
 * where a path resolves in a checkout by coincidence of directory depth and is absent in the
 * shipped artefact, with every in-repo gate green.
 *
 * ⚠️ **Both checkout candidates below are that coincidence, deliberately.** From `dist/` the repo
 * root is three levels up; from `src/cli/` it is four. Neither is a fact about an install — in
 * `node_modules/@nodegx/export/dist` three levels up is `node_modules`, which holds no `scripts/`,
 * which is why the refusal is the shipped behaviour and not an accident waiting to be found.
 *
 * ## Why this is not `noodl-mcp`'s resolver
 *
 * `noodl-mcp/src/render.ts` has a richer one: it also reads inside an `app.asar` and re-execs the
 * app's own Electron binary, because that sidecar runs *inside a packaged NodeGX install*. This
 * binary does not — it is installed from a registry, by a person or a CI job, next to a project.
 * Copying those two cases here would be a second copy of a rule with no caller to keep it honest,
 * and a second copy of a resolution rule drifts. The one thing the two DO share is the escape
 * hatch, `NODEGX_RENDER_CLI`, which is the same variable and means the same thing in both.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface ResolvedHarness {
  /** The harness entry point, or `null` when nothing was found. */
  entry: string | null;
  /** Every path tried, in order, whether or not it existed. Printed in the refusal. */
  probed: string[];
  /** Set when `NODEGX_RENDER_CLI` was given and pointed at nothing. */
  overrideMissing?: string;
}

/** The environment variable both doors read, named once. */
export const HARNESS_ENV = 'NODEGX_RENDER_CLI';

/**
 * Locate `measure-from-disk.js`.
 *
 * ⚠️ A `NODEGX_RENDER_CLI` that points at nothing is an **error**, never a fall-through to the
 * checkout candidates. Setting it is a deliberate act, so a typo in it must say so; falling back
 * silently is worse than useless in a repo checkout, where the fallback exists and would start a
 * real Chrome against a harness the caller had explicitly redirected away from.
 */
export function resolveHarness(fromDir: string = __dirname, env: NodeJS.ProcessEnv = process.env): ResolvedHarness {
  const probed: string[] = [];
  const push = (candidate: string): string | null => {
    probed.push(candidate);
    return fs.existsSync(candidate) ? candidate : null;
  };

  const override = env[HARNESS_ENV];
  if (override) {
    const found = push(override);
    return found ? { entry: found, probed } : { entry: null, probed, overrideMissing: override };
  }

  const relative = ['scripts', 'devtools', 'measure-from-disk.js'];
  const candidates = [
    // Loaded from `dist/` — the bundle, which is what the `nodegx` bin is.
    path.resolve(fromDir, '..', '..', '..', ...relative),
    // Loaded from `src/cli/` — ts-jest and `npx tsx`, which is what the specs are.
    path.resolve(fromDir, '..', '..', '..', '..', ...relative)
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, probed };
  }
  return { entry: null, probed };
}

/**
 * The sentence a caller with no harness gets. A refusal that cannot say where it looked sends the
 * reader to guess at a layout, and there are three layouts here.
 */
export function describeMissingHarness(resolved: ResolvedHarness): string {
  if (resolved.overrideMissing) {
    return (
      `${HARNESS_ENV} is set to ${resolved.overrideMissing}, and there is nothing there.\n` +
      `Point it at a checkout's scripts/devtools/measure-from-disk.js, or unset it.\n`
    );
  }
  return (
    'This build of nodegx cannot render.\n' +
    '\n' +
    'Rendering needs the NodeGX render harness — a browser, the viewer bundle and the node\n' +
    'catalogs — which is not part of the @nodegx/export package and is not installed with it.\n' +
    'Every other nodegx command works without it.\n' +
    '\n' +
    'To render, either run this from a NodeGX checkout, or set\n' +
    `  ${HARNESS_ENV}=/path/to/NodeGX/scripts/devtools/measure-from-disk.js\n` +
    '\n' +
    'Looked in:\n' +
    resolved.probed.map((p) => `  ${p}\n`).join('')
  );
}
