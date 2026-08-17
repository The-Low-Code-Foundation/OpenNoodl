/**
 * CN-003 slice 2b — reading one project's kit node types, as catalog entries.
 *
 * Slice 2a shipped the extractor (`entry.js` → `dist/kit-extract.cjs`) and slice
 * 1 shipped the mapping (`@nodegx/kit-catalog`). This module is the caller that
 * joins them: spawn the extractor for a project directory, hand its node-library
 * payload to `catalogNodesFromNodeLibrary`, and return the overlay.
 *
 * 🔴 **It knows nothing about any catalog, deliberately.** There are two
 * consumers with two different catalogs — the MCP server's *enriched* one
 * (`../kitOverlay.ts` installs into it) and `scripts/validate-project.ts`'s
 * `defaultCatalog()`, which is the only pipeline that can validate a legacy
 * monolithic project and therefore the only one that can read CN-003's
 * acceptance number on the cashflow kit. A module that merged into one of them
 * would have forced the other to grow a second extractor.
 *
 * ## Why spawning, and why synchronously
 *
 * Spawning is the containment: a kit's `index.js` is project code that runs at
 * import time and can throw, spin or mutate a register. `entry.js`'s header
 * carries that argument in full.
 *
 * Synchronously, because `catalogIndex()` is synchronous and is called from
 * inside every validation rule. Making it async would mean making the validator
 * async, which is a change to shared editor code for no gain: this runs **once
 * per server session**, at bind, off the request path entirely.
 *
 * ## ⚠️ Once per session is a real staleness, and it is deliberate
 *
 * A kit edited while the server is running is not re-read. ✅ **D3** forbids an
 * on-disk cache and sanctions an in-memory one keyed on module mtime *if speed
 * demands it*; slice 1 measured extraction at ~135 ms, so speed demands nothing
 * and a cache with no second caller would be untested machinery. What is left is
 * the staleness above, which belongs to **CN-014** (the dev loop) along with the
 * preview watcher and the editor's node library — all three go stale together,
 * and fixing one of them alone would be a partial answer that reads like a whole
 * one.
 *
 * ## 🔴 Absent is not the same as empty
 *
 * Three different things produce "this project contributes no kit node types":
 * the project has no `noodl_modules` directory, it has one and no kit registered
 * anything, or **the extractor could not be run at all**. The third is not an
 * answer about the project and must never be reported as one — that is CN-002's
 * whole lesson, one layer down. {@link ProjectKitOverlay} keeps them apart with
 * `skipped` / `unavailable`, and `get_project_info` surfaces the difference.
 *
 * @module noodl-mcp/kitExtract/extract
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { catalogNodesFromNodeLibrary } = require('@nodegx/kit-catalog');
import type { NodeLibraryPayload, OverlayCatalogNode, OverlayCollision } from '@nodegx/kit-catalog';

/** A kit the extractor found and loaded. */
export interface KitSummary {
  kitModule: string;
  dirPath: string;
}

/** A kit that threw at import time or failed to register. CN-015 owns showing it. */
export interface KitFailure {
  kitModule: string;
  dirPath: string;
  message: string;
}

export interface ProjectKitOverlay {
  projectDir: string;
  /** Catalog-shaped entries for the project's kit node types. */
  nodes: OverlayCatalogNode[];
  /**
   * Kit types that shadow a shipped type name. Built-ins keep priority in the
   * catalog; ⚠️ **at runtime the kit wins instead** — see `kitDiagnostics`.
   */
  collisions: OverlayCollision[];
  kits: KitSummary[];
  /** Malformed or unreadable `manifest.json` files, from the shared scanner. */
  warnings: string[];
  failures: KitFailure[];
  /**
   * Set when extraction was not attempted because there was nothing to extract:
   * the project has no `noodl_modules` directory. A real answer, cheaply.
   */
  skipped?: 'no-modules-directory';
  /**
   * 🔴 Set when extraction **could not run or did not succeed**. The node list is
   * then empty because we do not know, not because there is nothing — never
   * report it as the latter.
   */
  unavailable?: { reason: string; probed?: string[] };
  /** Wall-clock of the child process, when one ran. */
  extractionMs?: number;
}

/**
 * Bound because a kit's `index.js` is arbitrary project code: it can loop.
 * Generous enough that a slow machine loading five kits is never cut off —
 * slice 1 measured the cashflow kit at ~135 ms end to end.
 */
const EXTRACT_TIMEOUT_MS = 30_000;

/** The payload is JSON on stdout; 25 KB for the cashflow kit. Headroom, not a target. */
const EXTRACT_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * The extractor bundle, or null with every path probed.
 *
 * Two candidates, the same shape as `resolveRenderCli` and
 * `resolveServiceEntry`: `dist/kit-extract.cjs` sits beside `dist/noodl-mcp.cjs`
 * in the shipped package, and one level up from `src/` when this module is
 * loaded from source (ts-jest, `npx tsx`).
 *
 * ⚠️ Unlike the render CLI, a missing bundle here is **not** an error the caller
 * must handle loudly at the tool boundary — the server starts and works, minus
 * the overlay. It is reported instead, because a server silently answering "no
 * kit types" when it simply was not built is the failure this phase exists to
 * stop.
 */
export function resolveKitExtractEntry(): { entry: string | null; probed: string[]; overrideMissing?: string } {
  const probed: string[] = [];
  const push = (p: string): string | null => {
    probed.push(p);
    return fs.existsSync(p) ? p : null;
  };

  const override = process.env.NODEGX_KIT_EXTRACT;
  if (override) {
    const found = push(override);
    return found ? { entry: found, probed } : { entry: null, probed, overrideMissing: override };
  }
  const candidates = [
    path.resolve(__dirname, 'kit-extract.cjs'), // bundled: beside noodl-mcp.cjs in dist/
    path.resolve(__dirname, '..', '..', 'dist', 'kit-extract.cjs') // from src/kitExtract/
  ];
  for (const candidate of candidates) {
    const found = push(candidate);
    if (found) return { entry: found, probed };
  }
  return { entry: null, probed };
}

interface ExtractPayload extends NodeLibraryPayload {
  kits?: KitSummary[];
  moduleRuntimes?: Record<string, string[]>;
  builtinTypeNames?: string[];
  warnings?: string[];
  failures?: KitFailure[];
}

function empty(projectDir: string): ProjectKitOverlay {
  return { projectDir, nodes: [], collisions: [], kits: [], warnings: [], failures: [] };
}

/**
 * Build the overlay for one project. Never throws: every failure comes back as
 * `unavailable` on an otherwise-empty overlay, because a server that refuses to
 * start over a broken kit is worse than one that says the kit is unread.
 */
export function extractProjectOverlay(projectDir: string): ProjectKitOverlay {
  const base = empty(projectDir);

  // The cheap answer first. Most projects have no kits at all, and paying a
  // child process per session to be told so is a cost with no reader.
  if (!fs.existsSync(path.join(projectDir, 'noodl_modules'))) {
    return { ...base, skipped: 'no-modules-directory' };
  }

  const { entry, probed, overrideMissing } = resolveKitExtractEntry();
  if (overrideMissing) {
    return {
      ...base,
      unavailable: {
        reason: `NODEGX_KIT_EXTRACT points at "${overrideMissing}", which does not exist.`,
        probed
      }
    };
  }
  if (!entry) {
    return {
      ...base,
      unavailable: {
        reason:
          'The kit extractor bundle is not present in this installation, so this project\'s own node types ' +
          'could not be read. Run `npm run build` in packages/noodl-mcp, or set NODEGX_KIT_EXTRACT to a ' +
          'built kit-extract.cjs.',
        probed
      }
    };
  }

  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [entry, projectDir], {
    encoding: 'utf8',
    maxBuffer: EXTRACT_MAX_BUFFER,
    timeout: EXTRACT_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const extractionMs = Date.now() - startedAt;

  if (result.error) {
    return { ...base, extractionMs, unavailable: { reason: `Kit extraction failed to start: ${result.error.message}` } };
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim().split('\n').slice(-4).join('\n');
    return {
      ...base,
      extractionMs,
      unavailable: {
        reason:
          result.signal === 'SIGTERM'
            ? `Kit extraction did not finish within ${EXTRACT_TIMEOUT_MS / 1000}s and was killed.`
            : `Kit extraction exited ${result.status}.${detail ? ` ${detail}` : ''}`
      }
    };
  }

  let payload: ExtractPayload;
  try {
    payload = JSON.parse(result.stdout) as ExtractPayload;
  } catch (err) {
    return {
      ...base,
      extractionMs,
      unavailable: { reason: `Kit extraction produced output that is not JSON: ${(err as Error).message}` }
    };
  }

  // 🔴 The built-in names come from the extractor's own register, not from the
  // shipped catalog. They are what a kit would actually shadow at runtime, and
  // the shipped catalog is a filtered view of that register — using the catalog
  // here would let a kit quietly take over a type the catalog happens to omit.
  const overlay = catalogNodesFromNodeLibrary(payload, {
    builtinTypeNames: payload.builtinTypeNames ?? [],
    moduleRuntimes: payload.moduleRuntimes ?? {}
  }) as { nodes: OverlayCatalogNode[]; collisions: OverlayCollision[] };

  return {
    projectDir,
    nodes: overlay.nodes,
    collisions: overlay.collisions,
    kits: payload.kits ?? [],
    warnings: payload.warnings ?? [],
    failures: payload.failures ?? [],
    extractionMs
  };
}
