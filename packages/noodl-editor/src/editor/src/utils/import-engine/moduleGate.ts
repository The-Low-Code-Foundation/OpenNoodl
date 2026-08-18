/**
 * ✅ **CN-017 AC2 — the module copy gate, as a pure module.**
 *
 * 🔴 **Extracted from `apply.ts` so it can be graded without Electron.** The
 * decision is the whole feature: whether a folder of somebody else's JavaScript
 * is written into a user's project. `apply.ts` reaches `ProjectModel`, the undo
 * queue and the renderer's `FileSystem`, so a spec that imported it would need a
 * renderer to run — and a guard that can only be tested inside the app is a guard
 * whose behaviour nobody checks. This file imports Node's `fs` (through the
 * shared scanner) and nothing else.
 *
 * 🔴 **The loop is here too, not just the verdict.** An earlier shape of this file
 * exported only the decision and left `apply()` to act on it — which put the one
 * thing CN-017 must guarantee (*an unconsented module is not written*) back in the
 * untestable half, where a spec could confirm the verdict while the copy happened
 * anyway. `copyPlannedModules` owns the loop and takes the copy itself as a
 * parameter, so the refusal is graded by watching what the copy function is *not*
 * asked to do.
 *
 * @module noodl-editor/utils/import-engine/moduleGate
 */

import {
  moduleDeclaresExecutableCode,
  scanModuleManifests,
  type KitProvenance
} from '../../../../shared/utils/projectmodules';

import type { ImportOrigin } from './types';

/**
 * Which of these modules would execute JavaScript in the app's page.
 *
 * ⚠️ **Read from the SOURCE directory's manifests, never from the plan.** The
 * plan carries module names; whether a folder contributes code is a fact about
 * what is on disk, and asking the manifest is the only way to tell a kit or an
 * ERG-002 library (both inject a `<script>`) from an icon set or a font, which
 * inject none. An unreadable manifest counts as executable: the fail-closed
 * direction, since "we could not tell" must not read as "harmless".
 */
export async function executableModuleNames(sourceDir: string, names: string[]): Promise<Set<string>> {
  const wanted = new Set(names);
  const executable = new Set<string>();
  try {
    const scanned = await scanModuleManifests(sourceDir);
    const seen = new Set<string>();
    for (const entry of scanned) {
      if (!wanted.has(entry.name)) continue;
      seen.add(entry.name);
      if (moduleDeclaresExecutableCode(entry.manifest)) executable.add(entry.name);
    }
    // A planned module the scan did not describe: unknown, therefore gated.
    for (const name of wanted) if (!seen.has(name)) executable.add(name);
  } catch {
    return wanted;
  }
  return executable;
}

/** What the copy loop is allowed to do with one module, and what to record if it does. */
export interface ModuleCopyDecision {
  allowed: boolean;
  /** Present only when `allowed` is false — names the module and why. */
  reason?: string;
  /** Present only when there is something true to record. */
  provenance?: (at: string) => KitProvenance;
}

/**
 * ✅ **CN-017 AC1 lives in the first branch of this function.**
 *
 * A local-project origin copies without a gate, a prompt or a verification step,
 * because D6's first part says local code is not gated — and the scaffold route
 * never reaches here at all: `createNodeKit` writes straight into the open
 * project and is not an import.
 *
 * An export's staging project copies freely too, and records nothing — see
 * {@link ImportOrigin}'s `export-staging` arm for why those are different facts.
 *
 * ⚠️ **A non-executable module from a downloaded origin is still copied.** An
 * icon set contributes no code, and gating it would make an install fail for a
 * reason the consent copy could not honestly state.
 */
export function moduleCopyDecision(origin: ImportOrigin, name: string, executes: boolean): ModuleCopyDecision {
  if (origin.kind === 'local-project') {
    return {
      allowed: true,
      provenance: (at) => ({ module: name, origin: 'imported', fromProject: 'a project on this computer', importedAt: at })
    };
  }

  // ⚠️ Copied, and deliberately NOT recorded — the staging directory becomes a
  // zip somebody else downloads, and a record written here would travel with it.
  if (origin.kind === 'export-staging') return { allowed: true };

  if (!executes) return { allowed: true };

  const consent = origin.consents.find((c) => c.module === name);
  if (!consent) {
    return {
      allowed: false,
      reason:
        `"${name}" runs JavaScript in your app, and it was not part of what you agreed to install — it was not copied. ` +
        'Install it again and accept it at the "code from the internet" step if you want it.'
    };
  }

  return {
    allowed: true,
    provenance: (at) => ({
      module: name,
      origin: 'installed',
      url: origin.url,
      installedAt: at,
      verification: consent.verification,
      consentedAt: consent.consentedAt
    })
  };
}


/** What one pass of the copy loop did, for the caller to fold into its result. */
export interface ModuleCopyOutcome {
  /** Folder names actually written into the target. */
  copied: string[];
  /** Records for what landed — never for what was refused or what threw. */
  provenance: KitProvenance[];
  /** One line per module that was refused or failed, naming it. */
  warnings: string[];
}

/**
 * ✅ **CN-017 AC2 — copy the planned modules, and only the ones that may be copied.**
 *
 * 🔴 **`sourceDir` must be the directory `copy` reads from.** The gate's answer is
 * about the manifests in that folder; scanning one directory and copying from
 * another would grade a kit that is not the kit being written.
 *
 * ⚠️ **A copy that throws produces no provenance record.** A record describing a
 * module whose copy failed would be a file vouching for a folder that is not there.
 */
export async function copyPlannedModules(input: {
  sourceDir: string;
  moduleNames: string[];
  origin: ImportOrigin;
  /** ISO timestamp stamped on every record from this pass. */
  at: string;
  /** Performs the copy, or throws. Injected so the loop is gradeable off-renderer. */
  copy: (name: string) => void;
}): Promise<ModuleCopyOutcome> {
  const executable = await executableModuleNames(input.sourceDir, input.moduleNames);
  const outcome: ModuleCopyOutcome = { copied: [], provenance: [], warnings: [] };

  for (const name of input.moduleNames) {
    const decision = moduleCopyDecision(input.origin, name, executable.has(name));
    if (!decision.allowed) {
      outcome.warnings.push(decision.reason!);
      continue;
    }

    try {
      input.copy(name);
      outcome.copied.push(name);
      if (decision.provenance) outcome.provenance.push(decision.provenance(input.at));
    } catch (err) {
      outcome.warnings.push(`Failed to copy module "${name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return outcome;
}
