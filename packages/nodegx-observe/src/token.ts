/**
 * OBS-004 — finding the relay's launch token.
 *
 * The editor mints a token per launch, writes it to `<userData>/relay-token` at mode 0600,
 * and requires it in every `register` on port 8574. See
 * `packages/noodl-editor/src/main/src/relay-token.js`.
 *
 * ⚠️ **A token that cannot be found is not a warning, it is the whole story.** Every tool in
 * this server needs the relay, so a missing token means nothing works — and the failure looks
 * exactly like "the editor is not running", which sends the user off diagnosing the wrong
 * thing. The message this file produces is therefore the most important string in the package.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

/** Basename under the editor's user-data directory. Must match `relay-token.js`. */
const TOKEN_FILENAME = 'relay-token';

/**
 * Electron's `app.getPath('userData')`, reconstructed.
 *
 * ⚠️ The directory is named after Electron's `app.getName()`, which is `productName` from
 * `packages/noodl-editor/package.json` — **`NodeGX`**, not the npm `name` (`noodl-editor`).
 * Getting this wrong produces a "no token" error on a machine where the token is sitting right
 * there, so both the rebrand's before and after are searched: a user upgrading from an
 * OpenNoodl build has a live editor writing to the old directory.
 */
export function userDataCandidates(appNames: string[] = ['NodeGX', 'Noodl Editor', 'OpenNoodl']): string[] {
  const home = os.homedir();
  return appNames.map((name) => {
    if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', name);
    if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), name);
    return path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), name);
  });
}

export interface TokenLookup {
  token?: string;
  /** Where it came from, for the startup banner. Humans debug this by knowing which file. */
  source?: string;
  /** Everything that was tried, in order, when nothing was found. */
  searched: string[];
}

/**
 * Locate the token, most explicit source first.
 *
 * The order is deliberate: an explicit `--token` beats the environment, and the environment
 * beats the file, so a harness or a second editor build can always override what is on disk
 * without having to move a file that another process owns.
 */
export function findRelayToken(explicit?: string): TokenLookup {
  const searched: string[] = [];

  if (explicit) return { token: explicit, source: '--token', searched };

  searched.push('$NODEGX_RELAY_TOKEN', '$NOODL_RELAY_TOKEN');
  const fromEnv = process.env.NODEGX_RELAY_TOKEN || process.env.NOODL_RELAY_TOKEN;
  if (fromEnv) return { token: fromEnv, source: 'the environment', searched };

  for (const dir of userDataCandidates()) {
    const file = path.join(dir, TOKEN_FILENAME);
    searched.push(file);
    try {
      const token = fs.readFileSync(file, 'utf8').trim();
      if (token) return { token, source: file, searched };
    } catch (e) {
      /* not there, or not ours to read — keep looking */
    }
  }

  return { searched };
}

/** The failure message. Written to be actionable rather than accurate-and-useless. */
export function describeMissingToken(lookup: TokenLookup): string {
  return (
    'Could not find the NodeGX relay token, so there is nothing to connect to.\n\n' +
    'The token is written by the editor when it starts, and is deleted by nothing — so the\n' +
    'usual cause is simply that the editor is not running.\n\n' +
    'Looked in, in order:\n' +
    lookup.searched.map((s) => '  - ' + s).join('\n') +
    '\n\nIf the editor IS running, pass the token explicitly with --token, or set\n' +
    'NODEGX_RELAY_TOKEN. A build under a different product name writes to a different\n' +
    'directory from the ones above.'
  );
}
