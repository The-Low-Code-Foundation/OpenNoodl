/**
 * HLS-013 — deploying a `ProjectModel`'s cloud functions.
 *
 * ## Why this module exists
 *
 * Everything that *makes* a NodeGX app is headless. Everything that *ships* it
 * was behind a click, and cloud functions were the worst case: an agent could
 * already provision a backend over MCP (`provision_backend`) and had **no way
 * to put a function on it**. So any app with a backend — which is every app
 * worth deploying — could not be shipped without a person opening the editor.
 *
 * The fix is deliberately *not* a second deployer. `nodegx-backend`'s own suite
 * already builds bundles a second way (`tests/helpers/authored-bundle.ts`), and
 * SB-017 is the record of what that costs: two paths, the same graphs, opposite
 * outcomes, and **the path a person actually got was the one nobody measured**.
 *
 * ## The split
 *
 * This file is the half that needs a `ProjectModel`. The decision — the
 * fingerprint, the skip, the verdict — is in `cloudDeployCore.ts`, which imports
 * nothing, because the headless door cannot afford this file's import chain
 * (see that module's header). Both doors run `buildCloudBundlePartsWithKits` to
 * build and `deployCloudBundle` to decide, so a mutant in either reddens both.
 *
 * @module noodl-editor/utils/exporter/cloudDeploy
 */

import type { ProjectModel } from '@noodl-models/projectmodel';

import {
  deployCloudBundle,
  type CloudDeployOptions,
  type CloudDeployResult,
  type CloudDeployTransport
} from './cloudDeployCore';
import { buildCloudBundlePartsWithKits, cloudBundleName } from './cloudFunctions';

export {
  deployCloudBundle,
  namedFailure,
  type CloudBundleParts,
  type CloudDeployOptions,
  type CloudDeployResult,
  type CloudDeployTransport,
  type CloudFunctionOutcome
} from './cloudDeployCore';

/**
 * Build this project's cloud functions and push them to one backend.
 *
 * Never throws for a reason the caller could act on — see
 * {@link deployCloudBundle}.
 */
export async function deployCloudFunctions(
  project: ProjectModel,
  transport: CloudDeployTransport,
  options: CloudDeployOptions = {}
): Promise<CloudDeployResult> {
  const bundleName = cloudBundleName(project);

  let parts;
  try {
    parts = await buildCloudBundlePartsWithKits(project);
  } catch (e) {
    // The per-component isolation is inside `buildCloudBundleParts`, so reaching
    // here means the bundle's shared parts (settings, metadata) failed — nothing
    // that can be attributed to one function.
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, bundleName, hash: 'empty', changed: false, functions: [], error: reason };
  }

  return deployCloudBundle(parts, bundleName, transport, options);
}
