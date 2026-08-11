/**
 * BST-005 — the two files a new project ships with.
 *
 * The properties worth pinning are the ones a reviewer cannot see by reading the
 * template: the registration name is per-project (because user scope silently
 * shadows project scope), neither file is ever overwritten, `.gitignore` is
 * appended to rather than replaced, and `CLAUDE.md` does not restate a single
 * sentence of the server's `instructions`.
 *
 * That last one is the assertion that earns its keep. Two copies of a paragraph
 * that exists because a measured model failed without it is how one of them
 * silently stops matching the product, and a copy-paste is the most likely way
 * this file ever changes.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { AgentConfigHost, AgentServerRegistration } from '../src/editor-deps';
import { AGENT_CONFIG_PATHS, authoringServerName, installAgentConfig, renderClaudeMd } from '../src/editor-deps';
import { BOOTSTRAP_INSTRUCTIONS, projectInstructions } from '../src/instructions';
import { nodeHost, selfRegistration, writeAgentConfig } from '../src/project/agentConfig';

const REGISTRATION: AgentServerRegistration = {
  type: 'stdio',
  command: '/Applications/NodeGX.app/Contents/MacOS/NodeGX',
  args: ['/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs', '/tmp/proj', '--allow-writes'],
  env: { ELECTRON_RUN_AS_NODE: '1' }
};

/** An in-memory host, so the shared rules are asserted without a filesystem. */
function memoryHost(seed: Record<string, string> = {}): AgentConfigHost & { files: Record<string, string> } {
  const files = { ...seed };
  return {
    files,
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
    read: (p) => files[p],
    write: (p, content) => {
      files[p] = content;
    }
  };
}

const OPTIONS = {
  projectName: 'Reading List',
  serverName: 'nodegx-reading-list',
  registration: REGISTRATION,
  summary: 'A private reading list: add books and mark them finished.',
  hasDocs: true
};

describe('BST-005 the project configures the next agent', () => {
  it('writes both files, and the pair is the deliverable', async () => {
    const host = memoryHost();
    const report = await installAgentConfig(host, OPTIONS);

    expect(report.written).toEqual(
      expect.arrayContaining([AGENT_CONFIG_PATHS.mcp, AGENT_CONFIG_PATHS.claude, AGENT_CONFIG_PATHS.gitignore])
    );
    expect(host.files[AGENT_CONFIG_PATHS.mcp]).toBeDefined();
    expect(host.files[AGENT_CONFIG_PATHS.claude]).toBeDefined();
  });

  it('writes the key shape the client writes for itself', async () => {
    // Measured 2026-08-11 off `claude mcp add --scope project`. See
    // dev-docs/tasks/phase-62-cold-start/MEASUREMENTS-CLIENT-CONTRACT.md §2.
    const host = memoryHost();
    await installAgentConfig(host, OPTIONS);

    expect(JSON.parse(host.files[AGENT_CONFIG_PATHS.mcp])).toEqual({
      mcpServers: {
        'nodegx-reading-list': {
          type: 'stdio',
          command: REGISTRATION.command,
          args: REGISTRATION.args,
          env: { ELECTRON_RUN_AS_NODE: '1' }
        }
      }
    });
  });

  it('🔴 F94 — never the bare name `nodegx`, which user scope silently shadows', () => {
    // The launcher card registers `nodegx` at user scope, and a user-scope entry
    // makes a project-scope one of the same name invisible — not a conflict, not
    // a warning, simply absent. A project written with the bare name would hand
    // a card user the UNBOUND bootstrap server inside their own project.
    expect(authoringServerName('/Users/someone/Documents/Reading List')).toBe('nodegx-reading-list');
    expect(authoringServerName('/Users/someone/Documents/Reading List')).not.toBe('nodegx');
  });

  it('never overwrites either file, and says which it kept', async () => {
    const host = memoryHost({
      [AGENT_CONFIG_PATHS.mcp]: '{"mcpServers":{"mine":{}}}',
      [AGENT_CONFIG_PATHS.claude]: '# my own notes\n'
    });
    const report = await installAgentConfig(host, OPTIONS);

    expect(host.files[AGENT_CONFIG_PATHS.mcp]).toBe('{"mcpServers":{"mine":{}}}');
    expect(host.files[AGENT_CONFIG_PATHS.claude]).toBe('# my own notes\n');
    expect(report.written).toEqual([]);
    expect(report.files.every((f) => f.outcome === 'kept-existing')).toBe(true);
    // ⚠️ "already there" and "we wrote it" must not look the same from outside.
    expect(report.files.every((f) => typeof f.reason === 'string' && f.reason.length > 0)).toBe(true);
  });

  it('appends to an existing .gitignore instead of replacing it', async () => {
    const host = memoryHost({ [AGENT_CONFIG_PATHS.gitignore]: 'node_modules\n.DS_Store\n' });
    await installAgentConfig(host, OPTIONS);

    const ignore = host.files[AGENT_CONFIG_PATHS.gitignore];
    expect(ignore).toContain('node_modules');
    expect(ignore).toContain('.DS_Store');
    expect(ignore.split(/\r?\n/)).toContain('.mcp.json');
  });

  it('does not add a second ignore line when one is already there', async () => {
    const host = memoryHost({ [AGENT_CONFIG_PATHS.gitignore]: 'node_modules\n.mcp.json\n' });
    const report = await installAgentConfig(host, OPTIONS);

    const occurrences = host.files[AGENT_CONFIG_PATHS.gitignore]
      .split(/\r?\n/)
      .filter((line) => line.trim() === '.mcp.json').length;
    expect(occurrences).toBe(1);
    expect(report.files.find((f) => f.path === AGENT_CONFIG_PATHS.gitignore)?.outcome).toBe('kept-existing');
  });

  it('writes CLAUDE.md but no .mcp.json when no server could be resolved', async () => {
    // ⚠️ Half the pair is still worth having, but the half that is missing must
    // be named — otherwise the reader gets a prohibition and no alternative.
    const host = memoryHost();
    const report = await installAgentConfig(host, { ...OPTIONS, registration: null });

    expect(host.files[AGENT_CONFIG_PATHS.mcp]).toBeUndefined();
    expect(host.files[AGENT_CONFIG_PATHS.claude]).toBeDefined();
    expect(report.files.find((f) => f.path === AGENT_CONFIG_PATHS.mcp)?.outcome).toBe('skipped');
    expect(host.files[AGENT_CONFIG_PATHS.claude]).toContain('Connect an AI agent');
  });

  it('says the highest-value thing in the file: do not hand-edit the graphs', async () => {
    const claude = renderClaudeMd(OPTIONS);
    expect(claude).toContain('components/');
    expect(claude.toLowerCase()).toContain('by hand');
    expect(claude).toContain('nodegx-reading-list');
  });

  it('says why .mcp.json is git-ignored, rather than ignoring it silently', () => {
    expect(renderClaudeMd(OPTIONS)).toContain('.gitignore');
  });

  it('points at docs/ only when there are docs', () => {
    expect(renderClaudeMd(OPTIONS)).toContain('docs/CONVENTIONS.md');
    expect(renderClaudeMd({ ...OPTIONS, hasDocs: false })).not.toContain('docs/CONVENTIONS.md');
  });
});

describe('BST-005 CLAUDE.md does not restate the server briefing', () => {
  /**
   * Sentences long enough to be a real duplication rather than a coincidence
   * like "Start with get_project_info." would be if it were short — 40
   * characters is comfortably past any phrase two authors would independently
   * produce, and every paragraph the briefings care about is far longer.
   */
  function sentencesOf(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 40);
  }

  const briefings = [
    BOOTSTRAP_INSTRUCTIONS,
    projectInstructions({ projectDir: '/tmp/proj', allowWrites: true, deferTools: true }),
    projectInstructions({ projectDir: '/tmp/proj', allowWrites: true, deferTools: false })
  ];

  it('shares no sentence with either briefing', () => {
    const claude = renderClaudeMd(OPTIONS).replace(/\s+/g, ' ');
    const duplicated = briefings.flatMap(sentencesOf).filter((sentence) => claude.includes(sentence));
    expect(duplicated).toEqual([]);
  });

  it('and the check would catch a copy-paste', () => {
    // The assertion above is only worth having if it can fail. This proves it
    // does, rather than passing because the matcher never matches anything.
    const pasted = renderClaudeMd(OPTIONS) + '\n' + BOOTSTRAP_INSTRUCTIONS;
    const duplicated = briefings.flatMap(sentencesOf).filter((sentence) => pasted.replace(/\s+/g, ' ').includes(sentence));
    expect(duplicated.length).toBeGreaterThan(0);
  });
});

describe('BST-005 the server registers itself, by construction', () => {
  it('names the launch that is currently working', () => {
    const registration = selfRegistration('/tmp/some-project');
    expect(registration).not.toBeNull();
    expect(registration!.command).toBe(process.execPath);
    expect(registration!.args.slice(1)).toEqual(['/tmp/some-project', '--allow-writes']);
    expect(path.isAbsolute(registration!.args[0])).toBe(true);
  });

  it('carries ELECTRON_RUN_AS_NODE only when it is an Electron binary', () => {
    // 🔴 BST-004/F80: without the flag the binary boots a GUI app and serves
    // stdio anyway, so a registration that dropped it would look correct.
    const registration = selfRegistration('/tmp/some-project');
    const isElectron = Boolean((process.versions as Record<string, string | undefined>).electron);
    expect(Object.prototype.hasOwnProperty.call(registration!.env, 'ELECTRON_RUN_AS_NODE')).toBe(isElectron);
  });
});

describe('BST-005 on a real filesystem', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes both files where an agent opening the folder will find them', async () => {
    const report = await writeAgentConfig({
      projectDir: dir,
      projectName: 'Reading List',
      hasDocs: true,
      registration: REGISTRATION
    });

    expect(report.written).toContain('.mcp.json');
    expect(fs.existsSync(path.join(dir, '.mcp.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'CLAUDE.md'))).toBe(true);
    expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toContain('.mcp.json');
  });

  it('reports rather than throws when the directory cannot be written', async () => {
    // A project without a CLAUDE.md is still a project — but a failure that
    // vanishes is indistinguishable from a folder that is configured.
    const report = await writeAgentConfig({
      projectDir: path.join(dir, 'no', 'such', '\0bad'),
      projectName: 'Reading List',
      hasDocs: false,
      registration: REGISTRATION
    });
    expect(report.written).toEqual([]);
    expect(report.files.some((f) => f.outcome === 'skipped')).toBe(true);
  });

  it('the node host resolves project-relative paths under the project', () => {
    const host = nodeHost(dir);
    host.write('CLAUDE.md', '# hi\n');
    expect(fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')).toBe('# hi\n');
    expect(host.exists('CLAUDE.md')).toBe(true);
    expect(host.exists('.mcp.json')).toBe(false);
  });
});
