#!/usr/bin/env ts-node
/**
 * DSG F43 — every `var(--token)` we ship must resolve.
 *
 * There are four places a token name gets written and, until this gate, the
 * repo checked one of them:
 *
 *   - `ElementConfigRegistry` defaults/sizes/variants — guarded by
 *     `tests/models/StyleTokenCoverage.test.ts` (jasmine, `test:ci` only).
 *   - the **design doctrine and its siblings** in `AiAssistant/authoring/prompts/*.ts`
 *     — unguarded.
 *   - the **authored catalog examples** in `docs/node-catalog/examples/*.json`
 *     — unguarded. `catalog:examples` validates types and connectivity and has
 *     never looked at a token name.
 *   - the **style presets** — unguarded in the other direction: a preset key
 *     that no default token declares is dead weight nothing will ever read.
 *
 * That is how `--border-control` came to be prescribed by the doctrine at 3:1,
 * emitted by a model in a real drive, and shipped in `ui-split-hero.json`,
 * while being defined in no token set at all — so `border-color` fell back to
 * `currentColor`, which is the exact defect the doctrine sentence exists to
 * prevent. Every gate in the repo was green throughout.
 *
 * This is deliberately a **script and not a spec**: `tests/` runs only under
 * `test:ci`, which needs Electron and the whole checkout, so a spec cannot be
 * proved red by a session working beside another one. This can.
 *
 * Usage:
 *   npm run catalog:tokens
 *   ts-node -P ./scripts/tsconfig.json ./scripts/validate-token-references.ts [--json]
 *
 * Exit codes: 0 = every reference resolves, 1 = unresolved references, 2 = IO error.
 *
 * @module scripts/validate-token-references
 */

import * as fs from 'fs';
import * as path from 'path';

import { buildDefaultTokenMap } from '../packages/noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens';
import { EnterprisePreset } from '../packages/noodl-editor/src/editor/src/models/StylePresets/presets/EnterprisePreset';
import { MinimalPreset } from '../packages/noodl-editor/src/editor/src/models/StylePresets/presets/MinimalPreset';
import { PlayfulPreset } from '../packages/noodl-editor/src/editor/src/models/StylePresets/presets/PlayfulPreset';
import { SoftPreset } from '../packages/noodl-editor/src/editor/src/models/StylePresets/presets/SoftPreset';

const REPO_ROOT = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts');
const EXAMPLES_DIR = path.join(REPO_ROOT, 'docs/node-catalog/examples');

/** `var(--x)` and `var(--x, fallback)` alike — the name is all we check. */
const VAR_REFERENCE = /var\(\s*(--[\w-]+)/g;

/**
 * The doctrine teaches the *shape* `var(--token)`, so these are patterns being
 * quoted rather than tokens being referenced. Listed by name rather than
 * matched by a heuristic, so that a real token ever called `--token` would
 * still have to be declared here deliberately.
 */
const PROSE_PLACEHOLDERS = new Set(['--token', '--token-name']);

const PRESETS = [
  { name: 'MinimalPreset', preset: MinimalPreset },
  { name: 'PlayfulPreset', preset: PlayfulPreset },
  { name: 'EnterprisePreset', preset: EnterprisePreset },
  { name: 'SoftPreset', preset: SoftPreset }
];

interface Unresolved {
  token: string;
  file: string;
  line: number;
}

function listFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(dir, f))
    .sort();
}

/** Every `var(--token)` in a file, with the line it sits on. */
function referencesIn(file: string): Array<{ token: string; line: number }> {
  const out: Array<{ token: string; line: number }> = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    for (const match of text.matchAll(VAR_REFERENCE)) {
      out.push({ token: match[1], line: i + 1 });
    }
  });
  return out;
}

function main(): void {
  const asJson = process.argv.includes('--json');
  const defined = buildDefaultTokenMap();

  const sources = [...listFiles(PROMPTS_DIR, '.ts'), ...listFiles(EXAMPLES_DIR, '.json')];
  const unresolved: Unresolved[] = [];
  let total = 0;

  for (const file of sources) {
    for (const ref of referencesIn(file)) {
      if (PROSE_PLACEHOLDERS.has(ref.token)) continue;
      total += 1;
      if (!defined.has(ref.token)) {
        unresolved.push({ token: ref.token, file: path.relative(REPO_ROOT, file), line: ref.line });
      }
    }
  }

  // The other direction: a preset key the default set never declares is dead —
  // nothing reads it, and it silently suggests the token exists.
  const orphanPresetKeys: Array<{ preset: string; token: string }> = [];
  for (const { name, preset } of PRESETS) {
    for (const token of Object.keys(preset.tokens || {})) {
      if (!defined.has(token)) orphanPresetKeys.push({ preset: name, token });
    }
  }

  // A gate that finds nothing because it *read* nothing is the failure mode
  // this repo has paid for more than once. Prove the scan was not vacuous.
  if (total < 50) {
    process.stderr.write(
      `Only ${total} token references found across ${sources.length} files — the scan is not reaching the sources it claims to. Refusing to report a pass.\n`
    );
    process.exit(2);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify({ total, sources: sources.length, unresolved, orphanPresetKeys }, null, 2)}\n`);
  } else if (unresolved.length === 0 && orphanPresetKeys.length === 0) {
    process.stdout.write(
      `${total} token references across ${sources.length} files all resolve against DEFAULT_TOKENS (${defined.size} tokens).\n`
    );
  } else {
    for (const u of unresolved) {
      process.stdout.write(`✗ ${u.file}:${u.line} references ${u.token}, which no token set defines\n`);
    }
    for (const o of orphanPresetKeys) {
      process.stdout.write(`✗ ${o.preset} defines ${o.token}, which DEFAULT_TOKENS does not declare\n`);
    }
    process.stdout.write(
      `\n${unresolved.length} unresolved reference(s), ${orphanPresetKeys.length} orphan preset key(s), of ${total} references checked.\n`
    );
  }

  process.exit(unresolved.length === 0 && orphanPresetKeys.length === 0 ? 0 : 1);
}

main();
