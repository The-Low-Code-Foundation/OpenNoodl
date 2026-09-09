/**
 * HLS-013 — the headless half of the cloud-function deploy.
 *
 * This file is a **transport and a spawn, and nothing else**. Every decision —
 * what the bundle contains, what it is called, whether the push is needed, and
 * what the verdict is — is made by code in noodl-editor that the editor's own
 * Deploy button runs: `bundleEntry.js` builds with `buildCloudBundlePartsWithKits`,
 * and this module decides with `deployCloudBundle`. A second implementation of
 * either is how SB-017 happened.
 *
 * 🔴 **Nothing here may statically import a `ProjectModel`.** That import chain
 * costs this package's typecheck 201 errors and puts editor view code in the
 * server bundle — which is why the build half is a child process at all. The one
 * editor import below is `cloudDeployCore`, which imports nothing.
 *
 * @module noodl-mcp/cloud/deploy
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  cloudBundleNameFrom,
  deployCloudBundle,
  type CloudBundleParts,
  type CloudDeployResult,
  type CloudDeployTransport
} from '../../../noodl-editor/src/editor/src/utils/exporter/cloudDeployCore';
import type { BackendClient } from '../backend/client';
import { ToolError } from '../errors';

/** A big graph is a big bundle; the site-builder's is comfortably over a megabyte. */
const BUNDLE_MAX_BUFFER = 64 * 1024 * 1024;
const BUNDLE_TIMEOUT_MS = 120_000;

/** The shape `GET /admin/workflows` answers with (HLS-013 added `bundles`). */
interface WorkflowStatusBody {
  bundles?: { name: string; deployFingerprint: string | null }[];
}

/**
 * Where the bundled child lives.
 *
 * Two candidates, the same shape as `resolveKitExtractEntry`: beside
 * `noodl-mcp.cjs` in the shipped package, and one level up from `src/` when this
 * module is loaded from source (ts-jest, `npx tsx`).
 */
export function resolveCloudBundleEntry(): { entry: string | null; probed: string[] } {
  const probed: string[] = [];
  const push = (p: string): string | null => {
    probed.push(p);
    return fs.existsSync(p) ? p : null;
  };

  const override = process.env.NODEGX_CLOUD_BUNDLE;
  if (override) {
    const found = push(override);
    return { entry: found, probed };
  }

  const candidates = [
    path.resolve(__dirname, 'cloud-bundle.cjs'),
    path.resolve(__dirname, '..', '..', 'dist', 'cloud-bundle.cjs')
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, probed };
  }
  return { entry: null, probed };
}

/** Build the bundle for one project directory, in a child process. */
export function buildBundleInChild(projectDir: string): { bundleName: string; parts: CloudBundleParts } {
  const { entry, probed } = resolveCloudBundleEntry();
  if (!entry) {
    throw new ToolError(
      'io-error',
      'The cloud-function bundler is not present in this installation, so nothing could be deployed. ' +
        'Run `npm run build` in packages/noodl-mcp, or set NODEGX_CLOUD_BUNDLE to a built cloud-bundle.cjs.',
      { probed }
    );
  }

  const result = spawnSync(process.execPath, [entry, projectDir], {
    encoding: 'utf8',
    maxBuffer: BUNDLE_MAX_BUFFER,
    timeout: BUNDLE_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) {
    throw new ToolError('io-error', `The cloud-function bundler failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    // 🔴 The child's stderr, verbatim. A build failure here is about the
    // project's graph, and a summary of it is exactly the count-instead-of-a-name
    // that AC2 exists to remove.
    throw new ToolError(
      'validation-failed',
      `Could not build this project's cloud functions:\n${(result.stderr || '').trim() || 'no output'}`
    );
  }

  try {
    return JSON.parse(result.stdout) as { bundleName: string; parts: CloudBundleParts };
  } catch {
    throw new ToolError('io-error', 'The cloud-function bundler produced output that was not JSON.');
  }
}

/**
 * The editor reaches its backends over an IPC proxy; this one has a socket and
 * an admin token. Both end at `PUT /admin/workflows/<name>`.
 */
export function backendTransport(client: BackendClient): CloudDeployTransport {
  return {
    putBundle: async (name, bundle) => {
      const res = await client.request('PUT', `/admin/workflows/${encodeURIComponent(name)}`, bundle);
      const body = res.json as { success?: boolean; error?: string } | null;
      if (body && body.success === false) {
        throw new Error(body.error || 'The backend rejected the function bundle.');
      }
    },

    /**
     * 🔴 Ask the BACKEND, not a memory of our own.
     *
     * The editor can answer this from `pushedHashes` because it is the process
     * that pushed. A headless deploy is a new process every run and has no such
     * memory — so without asking, every run would report a fresh success, which
     * is exactly what AC3 forbids. A backend that cannot answer returns `null`
     * and the deploy pushes: "I did not ask" must never read as "unchanged".
     */
    readServingHash: async (name) => {
      const res = await client.request('GET', '/admin/workflows');
      const body = res.json as WorkflowStatusBody | null;
      return body?.bundles?.find((b) => b.name === name)?.deployFingerprint ?? null;
    }
  };
}

/** Deploy one project's cloud functions to one backend, with no editor running. */
export async function deployProjectCloudFunctions(
  projectDir: string,
  client: BackendClient,
  options: { force?: boolean } = {}
): Promise<CloudDeployResult> {
  const { bundleName, parts } = buildBundleInChild(projectDir);
  const transport = backendTransport(client);

  // 🔴 "Has this backend served this project before?" — asked, not assumed.
  //
  // An empty bundle is how a deleted last cloud function reaches a backend, and
  // pushing one to a backend that has NEVER served this project would create a
  // bundle file advertising nothing on a backend that was fine. The editor
  // answers this from its own memory of what it pushed; a headless run has no
  // memory, so it asks. Both doors compute the same predicate from the only
  // source each of them has.
  let alreadyServed = false;
  try {
    alreadyServed = (await transport.readServingHash!(bundleName)) !== null;
  } catch {
    // Could not ask. Treat as "never served": being wrong that way delays a
    // deletion until the next deploy, which is recoverable. The other way
    // creates state on a backend nobody asked to change.
    alreadyServed = false;
  }

  return deployCloudBundle(parts, bundleName, transport, {
    force: options.force,
    deleteWhenEmpty: alreadyServed
  });
}

export { cloudBundleNameFrom };
