/**
 * MCP-001 — the project verdict the settings section gates its Copy button on.
 *
 * `noodl-mcp` refuses to start on anything but a v2 directory, and it refuses *differently* for a
 * legacy project (there is a migration to point at) than for a directory that is not a project at
 * all. The button has to make the same three distinctions, from the same two files on disk, or it
 * hands out a command that dies at spawn time with a message the user never sees.
 *
 * The wording is asserted, not just the verdict: it is duplicated from `ProjectStore`'s
 * constructor on purpose (the editor cannot import `@noodl/mcp`), and duplicated strings drift.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { describeProject, describeMcpFrontDoor } = require('../../src/main/src/mcp/mcpFrontDoor');

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-front-door-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('describeProject', () => {
  it('answers null when nothing is open — which is not the same as a bad project', () => {
    expect(describeProject(null)).toBeNull();
    expect(describeProject(undefined)).toBeNull();
    expect(describeProject('')).toBeNull();
  });

  it('accepts a directory holding nodegx.project.json', () => {
    fs.writeFileSync(path.join(tmp, 'nodegx.project.json'), '{}');
    expect(describeProject(tmp)).toEqual({ dir: path.resolve(tmp), format: 'v2' });
  });

  it('accepts a directory holding only components/_registry.json', () => {
    // Both files are checked because `ProjectStore` checks both — a project written by an older
    // v2 editor has the registry and no project file.
    fs.mkdirSync(path.join(tmp, 'components'));
    fs.writeFileSync(path.join(tmp, 'components', '_registry.json'), '{}');
    expect(describeProject(tmp).format).toBe('v2');
  });

  it('sends a legacy project to the migration, in the server’s own words', () => {
    fs.writeFileSync(path.join(tmp, 'project.json'), '{}');
    const verdict = describeProject(tmp);
    expect(verdict.format).toBe('legacy');
    expect(verdict.message).toContain('legacy monolithic project.json');
    expect(verdict.message).toContain('Migrate it to the v2 format');
    expect(verdict.message).toContain('project settings → migrate');
  });

  it('says what is missing when the directory is not a project at all', () => {
    const verdict = describeProject(tmp);
    expect(verdict.format).toBe('not-a-project');
    expect(verdict.message).toContain('nodegx.project.json or components/_registry.json');
  });

  it('reports a directory that is gone rather than pretending it is not a project', () => {
    const missing = path.join(tmp, 'nope');
    expect(describeProject(missing)).toEqual({
      dir: missing,
      format: 'missing',
      message: `Project directory does not exist: ${missing}`
    });
  });

  it('reports a file as missing rather than opening it', () => {
    const file = path.join(tmp, 'a-file');
    fs.writeFileSync(file, '');
    expect(describeProject(file).format).toBe('missing');
  });
});

describe('describeMcpFrontDoor', () => {
  it('answers both servers and the project in one round trip', () => {
    fs.writeFileSync(path.join(tmp, 'nodegx.project.json'), '{}');
    const answer = describeMcpFrontDoor(tmp, { packagesRoots: [path.join(tmp, 'nowhere')] });

    expect(Object.keys(answer.servers).sort()).toEqual(['nodegx-observe', 'noodl-mcp']);
    expect(answer.project.format).toBe('v2');
    expect(typeof answer.isPackaged).toBe('boolean');
  });

  it('passes a miss through as a miss, with the paths it tried', () => {
    // The section turns this into "run the build", not into a command pointing at nothing.
    const answer = describeMcpFrontDoor(null, { packagesRoots: [path.join(tmp, 'nowhere')] });
    expect(answer.servers['noodl-mcp'].entry).toBeNull();
    expect(answer.servers['noodl-mcp'].probed.length).toBeGreaterThan(0);
    expect(answer.project).toBeNull();
  });
});
