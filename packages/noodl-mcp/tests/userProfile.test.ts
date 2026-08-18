/**
 * FIX-021 slice B, the MCP half — the person, reaching an agent that is not the editor.
 *
 * Two properties, and the second is the one worth grading:
 *
 * 1. The variable is the only door. No variable, no file, an unreadable file — all
 *    the same answer, and that answer is silence rather than an error.
 * 2. **What comes out is what the user WROTE, not what the file contains.** The
 *    seeded template is ~1,200 bytes of HTML-comment guidance, and a server that
 *    forwarded it would put a page of prompts into every agent's context on every
 *    project, forever, in exchange for nothing. The empty-file rule is the whole
 *    reason a global always-doc is affordable, so it is asserted by *character
 *    count against a hand-computed number* rather than by "not empty" — a render
 *    that shipped the comments would be non-empty too.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { PROFILE_TEMPLATE } from '../src/editor-deps';
import type { ProjectInfoResponse } from '../src/tools/responses';
import { USER_PROFILE_ENV, userProfileForPrompt } from '../src/userProfile';
import { call, connect, copyFixture, TestSession } from './helpers';

let tmp: string;
let profilePath: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'user-profile-'));
  profilePath = path.join(tmp, 'PREFERENCES.md');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const envWith = (value?: string): NodeJS.ProcessEnv => (value ? { [USER_PROFILE_ENV]: value } : {});

describe('userProfileForPrompt — the reader', () => {
  it('says nothing when the registration carries no variable', () => {
    // An older editor's registration. Absent variable is absent feature, silently.
    fs.writeFileSync(profilePath, '## Tone\nPlain English.\n');
    expect(userProfileForPrompt(envWith(undefined))).toBeUndefined();
  });

  it('says nothing when the variable points at a file that is not there', () => {
    // The editor seeds this lazily, so a registration written before the user ever
    // opened the settings section names a path that does not exist yet.
    expect(userProfileForPrompt(envWith(profilePath))).toBeUndefined();
  });

  it('says nothing when the path cannot be read, rather than failing the call', () => {
    // A directory where a file should be — readFileSync throws EISDIR. A preference
    // file is never the reason a project-orientation call should fail.
    fs.mkdirSync(profilePath);
    expect(userProfileForPrompt(envWith(profilePath))).toBeUndefined();
  });

  it('says nothing for the seeded template, whose every word is a comment', () => {
    // 🔴 The load-bearing row. The seed is ~1,200 bytes and costs zero, which is the
    // mechanism the per-turn cost argument rests on.
    fs.writeFileSync(profilePath, PROFILE_TEMPLATE);
    expect(fs.statSync(profilePath).size).toBeGreaterThan(1_000);
    expect(userProfileForPrompt(envWith(profilePath))).toBeUndefined();
  });

  it('returns exactly what was written under a heading, and nothing else', () => {
    // Predicted before running: the heading line "## How I like to be talked to"
    // (29 chars) + "\n" + "Plain English, no jargon." (25) = 55. A render that
    // merely went non-zero could not tell stripping-works from stripping-skipped.
    fs.writeFileSync(profilePath, PROFILE_TEMPLATE.replace(
      '## How I like to be talked to\n',
      '## How I like to be talked to\nPlain English, no jargon.\n'
    ));
    const rendered = userProfileForPrompt(envWith(profilePath));
    expect(rendered).toBe('## How I like to be talked to\nPlain English, no jargon.');
    expect(rendered).toHaveLength(55);
  });

  it('is re-read on every call, so editing the file changes the next answer', () => {
    // The editor polls this file every two seconds precisely so that editing it in
    // another editor changes the next build. A value cached at server start would
    // make this server the one place in the product where that promise is false.
    fs.writeFileSync(profilePath, '## Tone\nTerse.\n');
    expect(userProfileForPrompt(envWith(profilePath))).toContain('Terse.');
    fs.writeFileSync(profilePath, '## Tone\nChatty.\n');
    expect(userProfileForPrompt(envWith(profilePath))).toContain('Chatty.');
  });
});

describe('get_project_info — the profile as an external agent receives it', () => {
  let session: TestSession;
  const previous = process.env[USER_PROFILE_ENV];

  afterEach(async () => {
    if (session) await session.close();
    if (previous === undefined) delete process.env[USER_PROFILE_ENV];
    else process.env[USER_PROFILE_ENV] = previous;
  });

  it('carries the preferences and the sentence that ranks them', async () => {
    fs.writeFileSync(profilePath, '## How I like things built\nPrefer built-in nodes.\n');
    process.env[USER_PROFILE_ENV] = profilePath;

    session = await connect(copyFixture());
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info');

    expect(data.userPreferences?.preferences).toContain('Prefer built-in nodes.');
    // 🔴 The precedence travels WITH the text. This response is the only place an
    // external agent meets these preferences, and a field arriving without its
    // ranking would read as outranking the project docs by virtue of being personal.
    expect(data.userPreferences?.note).toContain('CONVENTIONS.md');
    expect(data.userPreferences?.note).toContain('outrank your own habits and defaults');
  });

  it('omits the field entirely when the user has written nothing', async () => {
    // ⚠️ An absence assertion, meaningful only because the row above shows the same
    // field arriving on the same tool when there IS something to say. A user who
    // never opens the file gets the response they got before this feature existed.
    fs.writeFileSync(profilePath, PROFILE_TEMPLATE);
    process.env[USER_PROFILE_ENV] = profilePath;

    session = await connect(copyFixture());
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info');

    expect(data.userPreferences).toBeUndefined();
    // The control: the call itself worked, so the absence is the rule firing rather
    // than the tool failing.
    expect(data.mode).toBe('read-write');
  });
});
