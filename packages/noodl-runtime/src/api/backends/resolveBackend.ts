/**
 * Backend resolution against the **running runtime**.
 *
 * ⚠️ Importing this module pulls `noodl-runtime.ts` into a webpack bundle, and
 * therefore the whole standard library — see `resolveBackend.pure.ts` for the
 * measurement and for why the rules were split out. A consumer outside the
 * runtime's own bundle wants that file, not this one.
 *
 * Every pure export is re-exported here unchanged, so no existing import moved.
 *
 * @module noodl-runtime
 */

import { resolveBackendTarget, type BackendMetaDataSources, type ResolvedBackendTarget } from './resolveBackend.pure';

export * from './resolveBackend.pure';

/**
 * Read the metadata off the running runtime.
 *
 * Separated from the pure functions above so every rule is unit-testable without a
 * `NoodlRuntime` singleton, and required lazily for the reason `queryutils.ts` records:
 * translating a filter (or resolving a backend) must never be the thing that constructs
 * a singleton or throws for want of ambient state.
 */
export function runtimeMetaDataSources(): BackendMetaDataSources {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const NoodlRuntime = require('../../../noodl-runtime');
    const instance = NoodlRuntime && NoodlRuntime.instance;
    if (!instance) return {};
    return {
      backendServices: instance.getMetaData('backendServices'),
      cloudservices: instance.getMetaData('cloudservices')
    };
  } catch (e) {
    return {};
  }
}

/** {@link resolveBackendTarget} against the running runtime's metadata. */
export function resolveBackendFromRuntime(backendId: string | undefined): ResolvedBackendTarget | undefined {
  return resolveBackendTarget(backendId, runtimeMetaDataSources());
}
