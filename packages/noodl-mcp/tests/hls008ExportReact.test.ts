/**
 * HLS-008 — `export_react` over MCP.
 *
 * ## What these gates are for, and the one they deliberately do not attempt
 *
 * AC2 asks that the pre-flight this tool returns be **byte-identical** to the one
 * `nodegx export --dry-run` prints. The tool achieves that structurally, by calling the CLI's own
 * `runCli` — so the obvious spec, comparing the tool's text with `runCli`'s text, would be
 * comparing a function with itself and could be green on an empty string.
 *
 * 🔴 **So the comparison is arranged to be able to fail, and is checked that it can.** The tool's
 * half goes through the **MCP client** — registration, the argument schema, the deferred-group
 * reveal and the JSON payload are all driven, and a change to any of them shows up here. The CLI's
 * half is a direct `runCli` call. Between them sits everything this task actually wrote. A presence
 * control asserts the compared text is real content rather than two empty strings, and a mutant
 * arm asserts the assertion fires when the text is re-wrapped the way a re-implementation would
 * re-wrap it.
 *
 * ⚠️ **What it cannot see:** both doors moving together. If `renderPreflight` changes wording, both
 * halves change and this stays green — which is correct, because that is one behaviour changing
 * once, and is the whole reason the tool calls `runCli` instead of assembling the sequence again.
 *
 * ⚠️ **And what is not gated here at all:** the built binary. Comparing against a subprocess
 * running `dist/cli.mjs` would cross a real process boundary, and it would also grade whatever
 * `npm run build` last produced in a sibling package — the stale-`dist` reading this task's own
 * resolvers exist to avoid. It was run by hand instead; see HLS-008-WHAT-WAS-BUILT.md §5.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { EXIT, catalogPath, runCli } from '@nodegx/export';

import type { ToolErrorPayload } from '../src/tools/responses';
import type { ExportReactResponse } from '../src/tools/exportReact';
import { call, connect, copyFixture, reveal, type TestSession } from './helpers';

/** A fresh empty directory outside any project, for the exports that are meant to succeed. */
function tempDir(tag: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `hls008-${tag}-`));
}

/**
 * Every file under `dir`, with its size and mtime to nanosecond resolution.
 *
 * 🔴 **Recursive, and `mtimeNs` rather than `mtimeMs`.** A dry run that wrote and restored a file
 * inside the same millisecond would be invisible to `mtimeMs`, and a dry run that wrote a file of
 * the same length into a directory whose own mtime happened not to move would be invisible to a
 * check on the top-level directory alone. Neither is likely; both are cheap to exclude, and the
 * claim being made — *nothing was written* — is exactly the kind that gets believed later.
 */
function snapshot(dir: string): Record<string, string> {
  const seen: Record<string, string> = {};
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const stat = fs.statSync(full, { bigint: true });
      seen[path.relative(dir, full)] = `${stat.size}@${stat.mtimeNs}`;
    }
  };
  walk(dir);
  return seen;
}

/** The CLI's own answer for the same request, captured rather than printed. */
function cliDryRun(projectDir: string): { out: string; err: string; code: number } {
  let out = '';
  let err = '';
  const code = runCli(['export', '--dry-run', projectDir], {
    out: (text) => (out += text),
    err: (text) => (err += text)
  });
  return { out, err, code };
}

describe('HLS-008 — export_react', () => {
  let session: TestSession;
  let projectDir: string;

  beforeEach(async () => {
    projectDir = copyFixture();
    session = await connect(projectDir);
    // The tool is deferred. Reaching it through `find_tools` rather than `--all-tools` is what
    // makes every assertion below also an assertion that the placement chosen in `toolGroups.ts`
    // is reachable — see AC4's own spec for the keyword door.
    await reveal(session, 'project');
  });

  afterEach(async () => {
    await session.close();
  });

  describe('AC2 — dry_run writes nothing, and says what the CLI says', () => {
    it('returns the pre-flight byte-for-byte as the CLI prints it', async () => {
      const cli = cliDryRun(projectDir);
      const res = await call<ExportReactResponse>(session, 'export_react', { dry_run: true });

      expect(res.isError).toBe(false);
      // 🔴 The presence control, read BEFORE the comparison. Two empty strings are equal, and an
      // equality assertion that would pass on nothing is not evidence of anything. This fixture
      // has a known shape, so the control names it rather than testing for a non-empty string.
      expect(cli.out.length).toBeGreaterThan(500);
      expect(cli.out).toContain('# Before you export');
      expect(cli.out).toContain('## What will not translate');

      expect(res.data.preflight).toBe(cli.out);
    });

    it('the comparison fails when the text is re-wrapped, which is how a second implementation would differ', async () => {
      const cli = cliDryRun(projectDir);
      const res = await call<ExportReactResponse>(session, 'export_react', { dry_run: true });

      // The three shapes a re-implementation reaches for, none of which change a word: trimming
      // the trailing newline, collapsing blank lines, and re-serialising through JSON. Each one is
      // "the same text" to a reader and a different payload on the wire.
      expect(res.data.preflight).not.toBe(cli.out.trim());
      expect(res.data.preflight).not.toBe(cli.out.replace(/\n\n+/g, '\n'));
      expect(cli.out.endsWith('\n')).toBe(true);
    });

    it('writes nothing anywhere in the project', async () => {
      const before = snapshot(projectDir);
      const res = await call<ExportReactResponse>(session, 'export_react', { dry_run: true });
      expect(res.isError).toBe(false);
      expect(snapshot(projectDir)).toEqual(before);
    });

    it('carries the CLI exit code, and separates "it ran" from "everything translated"', async () => {
      const cli = cliDryRun(projectDir);
      const res = await call<ExportReactResponse>(session, 'export_react', { dry_run: true });

      // The fixture leaves two things out, so this is the interesting half of the distinction
      // rather than the trivial one: a non-zero exit that is not a failure.
      expect(cli.code).toBe(EXIT.refusals);
      expect(res.isError).toBe(false);
      expect(res.data).toMatchObject({ ok: true, exit: EXIT.refusals, outcome: 'refusals', everythingTranslates: false });
    });

    it('refuses an out_dir alongside dry_run rather than silently ignoring it', async () => {
      const out = tempDir('ignored');
      const res = await call<ToolErrorPayload>(session, 'export_react', { dry_run: true, out_dir: out });
      expect(res.isError).toBe(true);
      expect(res.data.error.message).toContain('dry_run writes nothing');
      expect(fs.readdirSync(out)).toEqual([]);
    });
  });

  describe('AC3 — a target inside the project is refused', () => {
    it('refuses, gives the reason, and writes nothing', async () => {
      const before = snapshot(projectDir);
      const inside = path.join(projectDir, 'dist');
      const res = await call<ToolErrorPayload>(session, 'export_react', { out_dir: inside });

      expect(res.isError).toBe(true);
      expect(res.data.error.code).toBe('invalid-argument');
      // The reason is the exporter's, not this tool's — `checkTarget` decided it and the words are
      // its own. Asserted on the substance rather than the sentence so a reworded refusal is not a
      // failing test, but a *missing* one is.
      expect(res.data.error.message.toLowerCase()).toContain('inside');
      expect(res.data.error.details).toMatchObject({ exit: EXIT.target, outcome: 'target' });
      expect(snapshot(projectDir)).toEqual(before);
      expect(fs.existsSync(inside)).toBe(false);
    });
  });

  describe('a real export, and the second one', () => {
    it('writes an app, and the report the description points at', async () => {
      const out = tempDir('real');
      const res = await call<ExportReactResponse>(session, 'export_react', { out_dir: out });

      expect(res.isError).toBe(false);
      expect(res.data.exit).toBe(EXIT.ok);
      expect(fs.existsSync(path.join(out, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(out, 'src', 'App.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(out, 'EXPORT-REPORT.md'))).toBe(true);
      expect(res.data.written).toContain('files');
    });

    it('refuses to write into an occupied folder, and names the argument THIS door has', async () => {
      const out = tempDir('twice');
      const first = await call<ExportReactResponse>(session, 'export_react', { out_dir: out });
      expect(first.isError).toBe(false);

      const second = await call<ToolErrorPayload>(session, 'export_react', { out_dir: out });
      expect(second.isError).toBe(true);
      // 🔴 Both halves, and this is the point of the assertion. The CLI's own sentence is returned
      // verbatim — including the `--force` a caller here cannot type — and the translation is
      // appended. A refusal that named only the flag would be correct prose and a dead end.
      expect(second.data.error.message).toContain('--force');
      expect(second.data.error.message).toContain('`force: true`');

      const forced = await call<ExportReactResponse>(session, 'export_react', { out_dir: out, force: true });
      expect(forced.isError).toBe(false);
      expect(forced.data.exit).toBe(EXIT.ok);
    });

    it('needs an out_dir, and says which argument would answer the question instead', async () => {
      const res = await call<ToolErrorPayload>(session, 'export_react', {});
      expect(res.isError).toBe(true);
      expect(res.data.error.message).toContain('dry_run: true');
    });
  });

  describe('AC4 — the tool is reachable, and its description says what an export cannot do', () => {
    it('is advertised once the project group is revealed, and callable', async () => {
      const names = (await session.client.listTools()).tools.map((t) => t.name);
      expect(names).toContain('export_react');
    });

    it('is NOT advertised before the reveal — so the assertion above is about disclosure, not about registration', async () => {
      // A second session, deliberately un-revealed. Without this, the test above passes on a
      // server that never deferred anything, and would keep passing if the placement were lost.
      const other = await connect(projectDir);
      try {
        const names = (await other.client.listTools()).tools.map((t) => t.name);
        expect(names).not.toContain('export_react');
      } finally {
        await other.close();
      }
    });

    it('is reachable by the words somebody asking for an export would type', async () => {
      // DEF-006 (b)'s door. The `project` group's `purpose` does not mention exporting — stated as
      // a cost in the manifest — so these keywords are the only thing that leads a model here from
      // a browse. Each one is asserted because each one was chosen.
      for (const query of ['export', 'react', 'ship', 'deploy', 'host']) {
        const other = await connect(projectDir);
        try {
          const found = await call<{ revealed?: string[] }>(other, 'find_tools', { query });
          expect(found.isError).toBe(false);
          const names = (await other.client.listTools()).tools.map((t) => t.name);
          expect({ query, reached: names.includes('export_react') }).toEqual({ query, reached: true });
        } finally {
          await other.close();
        }
      }
    });

    it('points at the export report rather than restating what it contains', async () => {
      const tool = (await session.client.listTools()).tools.find((t) => t.name === 'export_react');
      const description = tool?.description ?? '';
      // The requirement is a *pointer*: the ledger of what translates is 127 rows and moves every
      // phase, so a description that listed any of it would be a second copy going stale.
      expect(description).toContain('EXPORT-REPORT.md');
      expect(description).toContain('dry_run');
      expect(description.toLowerCase()).toContain('not everything');
      // And the thing a caller cannot discover any other way: what the export reads.
      expect(description).toContain('read from disk');
    });
  });

  describe('the catalog reaches the shipped app', () => {
    /**
     * 🔴 **This was measured, not reasoned, and it failed the first way.** `@nodegx/export`'s
     * `loadCatalog()` reads `node-catalog.json` from disk beside `__dirname`, falling back to the
     * in-repo `packages/noodl-types/src/` copy. Bundled into `dist/noodl-mcp.cjs`, `__dirname` is
     * this package's `dist/` — and the in-repo fallback resolves **by coincidence**, because
     * `packages/noodl-mcp/dist` sits at the same depth as `packages/nodegx-export/src`. Every
     * in-repo gate is therefore blind to the thing that breaks.
     *
     * Driving the built bundle from a directory with no `packages/` above it is what showed it:
     * `export_react` returned `not-found` and *"The node catalog could not be found"*, naming two
     * absolute paths that mean nothing to the person reading them. With the file copied in beside
     * the bundle, the identical call returned the pre-flight. Both arms are in
     * HLS-008-WHAT-WAS-BUILT.md §5.
     *
     * ⚠️ **What this spec can and cannot see.** It asserts the two halves of the fix agree — the
     * build puts the file in `dist/`, and the packaging manifest ships it into the same directory
     * as the bundle it has to sit beside. It does **not** run electron-builder, so it cannot see a
     * manifest that is correct and a build that is broken for some other reason. The arm that saw
     * the real consequence is the one above, and it is a hand drive.
     */
    const editorPackageJson = path.join(__dirname, '..', '..', 'noodl-editor', 'package.json');

    it('the packaging manifest ships the catalog into the same directory as the bundle', () => {
      const manifest = JSON.parse(fs.readFileSync(editorPackageJson, 'utf8')) as {
        build: { extraResources: Array<{ from: string; to: string }> };
      };
      const resources = manifest.build.extraResources;
      const bundle = resources.find((r) => r.from.endsWith('noodl-mcp/dist/noodl-mcp.cjs'));
      expect(bundle).toBeDefined();

      // Derived from what `catalogPath()` actually looks for rather than typed as a literal: if
      // the catalog is ever renamed, this expectation moves with it instead of pinning the old
      // name and going quietly green on a file nothing reads.
      const wanted = path.basename(catalogPath());
      const catalog = resources.find((r) => r.to === path.posix.join(path.posix.dirname(bundle!.to), wanted));

      expect({ shipped: catalog !== undefined, wanted }).toEqual({ shipped: true, wanted });
      expect(catalog!.from).toBe(`../noodl-mcp/dist/${wanted}`);
    });

    it('the build puts it where the manifest reads it from', () => {
      const build = fs.readFileSync(path.join(__dirname, '..', 'build.mjs'), 'utf8');
      const wanted = path.basename(catalogPath());
      // The build step and the manifest are two files that have to agree and are edited by
      // different people for different reasons; nothing else in this repo notices when they stop.
      expect(build).toContain(`'dist/${wanted}'`);
    });
  });

  describe('the read-only posture', () => {
    it('exports from a --read-only server, because the flag protects the project and this writes elsewhere', async () => {
      const readOnly = await connect(projectDir, false);
      try {
        await reveal(readOnly, 'project');
        const out = tempDir('readonly');
        const res = await call<ExportReactResponse>(readOnly, 'export_react', { out_dir: out });
        expect(res.isError).toBe(false);
        expect(fs.existsSync(path.join(out, 'package.json'))).toBe(true);
      } finally {
        await readOnly.close();
      }
    });
  });
});
