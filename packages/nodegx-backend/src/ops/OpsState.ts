/**
 * OpsState — ops.json wired to disk (BAK-009).
 *
 * Same shape as SecurityState/SearchState: a JSON policy file in the data dir,
 * strictly validated on load (an invalid file refuses to start rather than
 * running with a config that silently isn't what's on disk), atomic writes,
 * written on first run so an operator has something to edit.
 *
 * Unlike those two, every section here has a working default, so the file is a
 * convenience rather than a prerequisite — a data dir whose ops.json was
 * deleted comes back up with the same behaviour it had before.
 *
 * @module nodegx-backend/ops/OpsState
 */

import * as fs from 'fs';
import * as path from 'path';

import { OpsConfig, mergeOpsConfig, mergeOpsOver, validateOpsConfig } from './model';

export class OpsStartupError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'OpsStartupError';
    this.code = code;
  }
}

const OPS_FILE = 'ops.json';

function atomicWriteJSON(filePath: string, value: unknown): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, filePath);
}

export class OpsState {
  readonly config: OpsConfig;
  /** True when the default config was just written (first-run notice). */
  readonly migratedThisStart: boolean;
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    const configPath = path.join(dataDir, OPS_FILE);

    if (fs.existsSync(configPath)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        throw new OpsStartupError(
          'OPS_CONFIG_INVALID',
          `${configPath} is not valid JSON: ${e instanceof Error ? e.message : e}`
        );
      }
      const errors = validateOpsConfig(parsed);
      if (errors.length > 0) {
        throw new OpsStartupError(
          'OPS_CONFIG_INVALID',
          `${configPath} is invalid — refusing to start with an ops config that would not be fully honored:\n` +
            errors.map((e) => `  - ${e}`).join('\n')
        );
      }
      this.config = mergeOpsConfig(parsed);
      this.migratedThisStart = false;
    } else {
      this.config = mergeOpsConfig({});
      fs.mkdirSync(dataDir, { recursive: true });
      atomicWriteJSON(configPath, this.config);
      this.migratedThisStart = true;
    }
  }

  save(): void {
    atomicWriteJSON(path.join(this.dataDir, OPS_FILE), this.config);
  }

  /**
   * Apply a partial update (the admin/MCP surface's write path). Validates the
   * MERGED document, so a patch that would produce an invalid whole is refused
   * before anything is persisted.
   */
  update(patch: unknown): OpsConfig {
    const candidate = mergeOpsOver(this.config, patch);
    // Re-validate the merged result under the same strict rules as a file on
    // disk — one validator, one set of answers.
    const errors = validateOpsConfig(candidate);
    if (errors.length > 0) {
      throw new Error(`Invalid ops config:\n${errors.map((e) => `- ${e}`).join('\n')}`);
    }
    Object.assign(this.config, candidate);
    this.save();
    return this.config;
  }
}
