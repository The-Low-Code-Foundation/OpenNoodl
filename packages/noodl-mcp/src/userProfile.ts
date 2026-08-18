/**
 * FIX-021 slice B, the MCP half — the person, for an agent that is not the editor.
 *
 * The editor's authoring loop reads `<userData>/PREFERENCES.md` and appends it to
 * every authoring turn. Claude Code, talking to this server, had no way to know
 * the file existed: it runs in its own process, against a project directory, and
 * everything else this server reads lives inside that directory. This module is
 * the one exception, and the exception is the whole reason the module has its own
 * file rather than three lines in `read.ts`.
 *
 * ## 🔴 The containment rule this deliberately breaks, and what replaces it
 *
 * Every other path this server touches is inside `projectDir`, and that invariant
 * is enforced (`assertInsideDocs`, `normalizeDocPath`, the store's own resolver).
 * The profile is a *global* file by definition — it is about the person, not the
 * project — so it cannot satisfy that rule, and pretending otherwise by copying it
 * into the project would be worse: it would put "what I know, and what I don't"
 * into a folder that gets committed.
 *
 * Three narrower rules replace the one it cannot keep:
 *
 * 1. **The path is given, never derived.** It arrives in `NODEGX_USER_PREFERENCES`,
 *    baked into the registration's `env` at the moment the registration is written,
 *    by the process that actually knows where `userData` is. This server does not
 *    compute a `userData` path, does not read `HOME`, and does not fall back to a
 *    guess — BST-004's "front door, never guess" applied to a second fact. Absent
 *    variable means absent feature, silently and correctly: an older editor's
 *    registration simply does not have it.
 * 2. **Read-only, and one file.** Nothing here writes, creates, or seeds. The
 *    editor's `ensureUserProfileSeeded` is the only writer of this file anywhere in
 *    the product, and it writes only when there is none. A tool argument can never
 *    reach this path — no tool takes one — so the variable is not a traversal
 *    surface: it is set by the same install that launched the process.
 * 3. **It is never echoed as a path.** Only the rendered *content* goes into a
 *    response. The absolute location contains a home directory, and a response
 *    that named it would put the user's account name into a transcript for no gain.
 *
 * ## Why the empty-file rule matters more here than in the editor
 *
 * Same mechanism, higher stakes: an agent's context is not ours to spend. The
 * render returns `undefined` for a file that says nothing — seeded-but-unanswered
 * included, because the seed is entirely HTML comments — and the caller omits the
 * field. A user who has never opened the file gets a `get_project_info` response
 * byte-identical to the one before this existed.
 *
 * @module noodl-mcp/userProfile
 */

import * as fs from 'fs';

import { renderProfileForPrompt } from './editor-deps';

/**
 * The variable carrying the absolute path of `<userData>/PREFERENCES.md`.
 *
 * 🔴 The name is part of the wire contract between the editor and this server:
 * it is written into `.mcp.json` (and `~/.claude.json`) on one side and read here
 * on the other, so changing it silently turns the feature off for every
 * registration already on disk. `packages/noodl-editor`'s `mcpCommands.ts` and
 * this package's `project/agentConfig.ts` are the two writers.
 */
export const USER_PROFILE_ENV = 'NODEGX_USER_PREFERENCES';

/**
 * The user's standing preferences as the model should see them, or `undefined`
 * when there is nothing to say — no variable, no file, an unreadable file, or a
 * file whose every heading is still unanswered.
 *
 * ⚠️ Read on each call rather than cached. The editor polls the same file every
 * two seconds precisely so that editing it in another editor changes the next
 * build; a value cached at server start would make this server the one place in
 * the product where that promise is false. The cost is one `readFileSync` of at
 * most a couple of kilobytes, on a tool that is already reading the registry.
 *
 * An unreadable file is treated as absent rather than as an error: a preference
 * file is never the reason a project-orientation call should fail.
 */
export function userProfileForPrompt(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const profilePath = env[USER_PROFILE_ENV];
  if (!profilePath) return undefined;

  let source: string;
  try {
    source = fs.readFileSync(profilePath, 'utf8');
  } catch {
    return undefined;
  }

  return renderProfileForPrompt(source);
}
