/**
 * FB-005 T5 — "Share as template", editor side.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 **THE ASSERTION THIS FILE EXISTS FOR IS THAT `.mcp.json` DOES NOT LEAVE THE MACHINE.**
 *
 * Every other refusal here is a convenience — the person finds out before an upload instead of
 * after one. That one is not. `agentConfig.ts` writes `.mcp.json` into every project the editor
 * creates or opens, it holds **absolute paths into the author's home directory and into their
 * install of NodeGX**, and the editor already gitignores it with that reason written out. A
 * "share" that walked the project directory the obvious way would upload it to a public shelf and
 * write it onto the disk of everybody who installed the template.
 *
 * ⚠️ **AND THE SPEC IS BUILT SO THAT A BROKEN COLLECTOR CANNOT PASS IT.** An absence check whose
 * subject was never in the fixture proves nothing — this repo's own recorded trap. So every
 * exclusion case is asserted beside a **file that IS collected from the same walk**, and the
 * fixture puts the excluded files in places a naive walk would certainly reach.
 *
 * 🔴 **`shareAsTemplate` is graded, not `submitTemplate`.** T1's finding was a complete mechanism
 * reached by nobody. A spec over the client's method alone would be green through a share button
 * that collected the wrong files, or none.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { STARTER_ASSETS } from '@noodl-models/template/starterAssets';

import {
  MAX_TEMPLATE_BYTES,
  NEVER_SHARED,
  RESTORED_ON_INSTALL,
  isRestoredOnInstall,
  collectTemplateFiles,
  hasProjectManifest,
  isNeverShared,
  shareAsTemplate,
  suggestedSlug,
  templatePayloadBytes,
  whyNeverShared,
  type ShareAsTemplateOutcome,
  type TemplateReadFs,
  type TemplateSubmissionSink
} from '@noodl-models/template/shareAsTemplate';

// ─────────────────────────────────────────────────────────────────────────────
// A fake project on a fake disk.
// ─────────────────────────────────────────────────────────────────────────────

/** Paths → contents. Directories are inferred from the keys, as a real walk would find them. */
function fakeFs(tree: Record<string, string>): TemplateReadFs {
  return {
    async listDirectory(path: string) {
      const prefix = path === '/p' ? '' : `${path.slice('/p/'.length)}/`;
      const names = new Set<string>();
      const dirs = new Set<string>();
      for (const key of Object.keys(tree)) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        if (rest === '') continue;
        const slash = rest.indexOf('/');
        if (slash === -1) {
          names.add(rest);
        } else {
          dirs.add(rest.slice(0, slash));
        }
      }
      return [
        ...[...names].map((name) => ({
          name,
          fullPath: `/p/${prefix}${name}`,
          isDirectory: false
        })),
        ...[...dirs].map((name) => ({
          name,
          fullPath: `/p/${prefix}${name}`,
          isDirectory: true
        }))
      ];
    },
    async readFile(path: string) {
      const key = path.slice('/p/'.length);
      if (!(key in tree)) throw new Error(`no such file ${path}`);
      return tree[key];
    }
  };
}

const PROJECT = {
  'nodegx.project.json': '{"name":"A pricing page"}',
  'components/_registry.json': '{"components":["Pages/Home"]}',
  'components/Pages/Home/component.json': '{"name":"/Pages/Home"}'
};

/** A project as it actually sits on a builder's disk, after the editor has opened it once. */
const REAL_PROJECT_ON_DISK = {
  ...PROJECT,
  // 🔴 The one that matters. Real shape, real absolute paths.
  '.mcp.json':
    '{"mcpServers":{"nodegx":{"command":"/Users/richardosborne/Applications/NodeGX.app/Contents/runtime/node"}}}',
  '.nodegx/plan': '{"staged":[]}',
  '.git/config': '[remote "origin"]\n\turl = git@github.com:someone/private.git',
  '.git/HEAD': 'ref: refs/heads/main',
  'node_modules/left-pad/index.js': 'module.exports = () => {};',
  '.env': 'STRIPE_SECRET_KEY=sk_live_do_not_publish_this',
  '.env.local': 'DATABASE_URL=postgres://user:password@host/db',
  '.DS_Store': 'binary-ish finder junk',
  'CLAUDE.md': '# A pricing page\n\nThis project is built with NodeGX.'
};

function sink(
  result: Awaited<ReturnType<TemplateSubmissionSink['submitTemplate']>> = {
    outcome: 'ok',
    value: { submissionId: 'sub-1', status: 'pending' }
  }
): TemplateSubmissionSink & { sent: Parameters<TemplateSubmissionSink['submitTemplate']>[0][] } {
  const sent: Parameters<TemplateSubmissionSink['submitTemplate']>[0][] = [];
  return {
    sent,
    async submitTemplate(input) {
      sent.push(input);
      return result;
    }
  };
}

const META = {
  projectDir: '/p',
  proposedSlug: 'a-pricing-page',
  title: 'A pricing page',
  summary: 'Three tiers, a toggle for annual billing, and a form that captures interest.',
  category: 'site',
  attestedLicence: 'MIT'
};

// ═════════════════════════════════════════════════════════════════════════════
describe('🔴 what does NOT leave the machine', () => {
  it('does not send .mcp.json — the file the editor gitignores because it holds absolute paths', async () => {
    const fs = fakeFs(REAL_PROJECT_ON_DISK);
    const s = sink();
    const result = await shareAsTemplate({ fs, sink: s }, META);

    expect(result.outcome).toBe('submitted');
    const files = s.sent[0].files;

    // The absence.
    expect(Object.keys(files)).not.toContain('.mcp.json');
    // 🔴 AND THE CONTENTS ARE NOWHERE IN THE PAYLOAD AT ALL — a stronger assertion than the key
    // being absent, and the one that survives somebody "helpfully" merging config into another
    // file. The home directory path is the thing that must not travel.
    expect(JSON.stringify(files)).not.toContain('/Users/richardosborne');
    expect(JSON.stringify(files)).not.toContain('mcpServers');

    // ⚠️ THE CONTROL, from the same walk: ordinary project files DID come through, so the
    // assertions above are about the exclusion rather than about a collector that returned
    // nothing.
    expect(files['nodegx.project.json']).toBe(PROJECT['nodegx.project.json']);
    expect(files['components/Pages/Home/component.json']).toBeDefined();
    expect(files['CLAUDE.md']).toContain('A pricing page');
  });

  it('does not send secrets, git history, editor state or dependencies', async () => {
    const fs = fakeFs(REAL_PROJECT_ON_DISK);
    const s = sink();
    await shareAsTemplate({ fs, sink: s }, META);
    const payload = JSON.stringify(s.sent[0].files);

    // Each of these is a real thing that sits in a project directory and must not be published.
    expect(payload).not.toContain('sk_live_do_not_publish_this');
    expect(payload).not.toContain('postgres://user:password@host/db');
    expect(payload).not.toContain('github.com:someone/private.git');
    expect(payload).not.toContain('left-pad');
    expect(payload).not.toContain('"staged"');

    const keys = Object.keys(s.sent[0].files);
    expect(keys.some((k) => k.startsWith('.git/'))).toBe(false);
    expect(keys.some((k) => k.startsWith('node_modules/'))).toBe(false);
    expect(keys.some((k) => k.startsWith('.nodegx/'))).toBe(false);
    expect(keys).not.toContain('.DS_Store');
  });

  it('🔴 reports what it withheld rather than dropping it silently', async () => {
    // A hazard list is a hypothesis, not a measurement — it holds for the paths somebody thought
    // of. Reporting is what lets a person notice when something they WANTED was excluded.
    const fs = fakeFs(REAL_PROJECT_ON_DISK);
    const { excluded } = await collectTemplateFiles(fs, '/p');
    expect(excluded).toContain('.mcp.json');
    expect(excluded).toContain('.env');
    expect(excluded).toContain('.env.local');
    // ⚠️ A directory is reported ONCE, by its own name, rather than as every path underneath it —
    // it is never descended into, which is also why sharing a project with dependencies installed
    // does not read tens of thousands of files to throw them away.
    expect(excluded).toContain('node_modules');
    expect(excluded).not.toContain('node_modules/left-pad/index.js');

    const outcome = (await shareAsTemplate(
      { fs, sink: sink() },
      META
    )) as Extract<ShareAsTemplateOutcome, { outcome: 'submitted' }>;
    expect(outcome.excluded).toContain('.mcp.json');
  });

  it('every exclusion can say why, and a shared file cannot', () => {
    for (const rule of NEVER_SHARED) {
      expect(isNeverShared(rule.path)).toBe(true);
      expect(whyNeverShared(rule.path).length).toBeGreaterThan(10);
    }
    // ⚠️ Both directions. Without this the rule could be `() => true` and every case above passes.
    expect(isNeverShared('nodegx.project.json')).toBe(false);
    expect(isNeverShared('components/Pages/Home/component.json')).toBe(false);
    // ⚠️ A directory rule matches the directory and its contents, and NOT a file whose name merely
    // starts with the same characters.
    expect(isNeverShared('.git/config')).toBe(true);
    expect(isNeverShared('.gitignore')).toBe(false);
    expect(isNeverShared('node_modules_notes.md')).toBe(false);
  });

  it('🔴 a NESTED .DS_Store is withheld too — Finder writes one per directory', async () => {
    // 🔴 **THIS SPEC EXISTS BECAUSE A DRIVE FOUND WHAT THE FIXTURES COULD NOT.** The rule was an
    // exact project-relative path, which is right for `.mcp.json` — that file only ever sits at
    // the root — and wrong for `.DS_Store`. Walking 25 real projects turned up **seven** nested
    // ones the root-only rule could not see.
    //
    // ⚠️ **And the visible symptom was not a leak.** A `.DS_Store` is binary, so each one landed
    // in `binaries` and refused the whole share — a project that could not be shared, for a
    // reason naming a file the person had never heard of. Every spec in this file was green
    // through it, because every fixture put `.DS_Store` at the root.
    expect(isNeverShared('components/.DS_Store')).toBe(true);
    expect(isNeverShared('components/Pages/.DS_Store')).toBe(true);
    expect(isNeverShared('.DS_Store')).toBe(true);
    // ⚠️ Both directions: a name that merely ENDS with the rule is not the rule.
    expect(isNeverShared('components/my.DS_Store')).toBe(false);
    expect(isNeverShared('DS_Store')).toBe(false);
    // And the same predicate answers `why`, rather than a second copy that could disagree.
    expect(whyNeverShared('components/.DS_Store')).toBe(whyNeverShared('.DS_Store'));

    // 🔴 Through the real walk, beside a file that IS collected — an exclusion asserted on a
    // fixture that never reached the walk proves nothing.
    const fs = fakeFs({
      'nodegx.project.json': '{}',
      'components/.DS_Store': 'Finder\u0000junk',
      'components/Home.json': '{"name":"Home"}'
    });
    const { files, excluded, binaries } = await collectTemplateFiles(fs, '/p');
    expect(Object.keys(files)).toContain('components/Home.json');
    expect(excluded).toContain('components/.DS_Store');
    // ⚠️ The point of the fix: it is WITHHELD, not classified as a binary that refuses the share.
    expect(binaries).toEqual([]);
  });

  it('an exact-path rule stays exact — .mcp.json elsewhere is not silently withheld', () => {
    // ⚠️ The control for the rule above. `basename` was added for one entry, and adding it to all
    // of them would change what `.mcp.json` means without anybody deciding to.
    expect(isNeverShared('vendor/.mcp.json')).toBe(false);
    expect(isNeverShared('.mcp.json')).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The modules left out because the editor puts them back
  // ───────────────────────────────────────────────────────────────────────────

  it('control: there really are starter modules, and they are the two the editor ships', () => {
    // 🔴 Read FIRST. Every assertion below is about what this list excludes, and an empty list
    // excludes nothing while satisfying most of them.
    expect(RESTORED_ON_INSTALL.length).toBeGreaterThan(0);
    expect(RESTORED_ON_INSTALL).toEqual(['noodl_modules/inter', 'noodl_modules/lucide-icons']);
  });

  it('🔴 the list is DERIVED from STARTER_ASSETS, both directions', () => {
    // A copy of a list drifts. This one is computed from the list it must agree with, and this
    // spec is what makes that visible if somebody replaces the derivation with a literal.
    const fromAssets = Array.from(
      new Set(
        STARTER_ASSETS.map((a) => a.to)
          .filter((to) => to.startsWith('noodl_modules/'))
          .map((to) => to.split('/').slice(0, 2).join('/'))
      )
    );
    for (const dir of RESTORED_ON_INSTALL) expect(fromAssets).toContain(dir);
    for (const dir of fromAssets) expect(RESTORED_ON_INSTALL).toContain(dir);
    // ⚠️ The cardinality assertion — two `toContain` loops are satisfied by two EMPTY lists too.
    expect(RESTORED_ON_INSTALL).toHaveLength(fromAssets.length);
  });

  it('🔴 EVERY module on the list is one the editor can actually put back', () => {
    // **This is the rule that makes the exclusion legitimate rather than data loss.** A module
    // omitted from a template and not reinstalled hands somebody a project that renders wrong.
    // ⚠️ `createProjectFromTemplate` calling `installStarterAssets` AFTER `installTemplate` is
    // asserted in `template-install-path.test.ts`; this asserts the other half — that what is
    // withheld is inside what that call restores.
    for (const dir of RESTORED_ON_INSTALL) {
      const restores = STARTER_ASSETS.filter((a) => a.to === dir || a.to.startsWith(`${dir}/`));
      expect(restores.length).toBeGreaterThan(0);
    }
  });

  it('withholds a starter module through the real walk, and says it comes back', async () => {
    const fs = fakeFs({
      'nodegx.project.json': '{}',
      'noodl_modules/inter/Inter-Bold.ttf': 'font\u0000bytes',
      'noodl_modules/inter/manifest.json': '{"name":"inter"}',
      'noodl_modules/lucide-icons/lucide.woff2': 'font\u0000bytes',
      'components/Home.json': '{"name":"Home"}'
    });
    const { files, excluded, binaries } = await collectTemplateFiles(fs, '/p');

    // Beside a file that IS collected from the same walk — otherwise this is an absence check on
    // a population the walk never reached.
    expect(Object.keys(files)).toContain('components/Home.json');
    // ⚠️ **Reported as the DIRECTORY, once — not as seven files.** The walk tests each entry
    // before descending, so a restored module is never walked at all. That is the same shape
    // `node_modules` gets and it is the right one twice over: the author reads one line rather
    // than a wall of font names, and a project with dependencies installed is not read only to
    // be thrown away.
    expect(excluded).toContain('noodl_modules/inter');
    expect(excluded).toContain('noodl_modules/lucide-icons');
    expect(Object.keys(files).some((f) => f.startsWith('noodl_modules/'))).toBe(false);

    // 🔴 THE POINT: the fonts no longer refuse the share. Measured over 25 real projects, 42 of
    // the 46 files blocking a share were exactly these.
    expect(binaries).toEqual([]);

    // And the sentence tells the author the omission is undone rather than just naming it.
    expect(whyNeverShared('noodl_modules/inter')).toMatch(/added back automatically/i);
    // The per-file predicate still answers, for anything that asks it directly.
    expect(isNeverShared('noodl_modules/inter/Inter-Bold.ttf')).toBe(true);
  });

  it('🔴 a module the editor CANNOT restore still travels', () => {
    // The other arm, and the one that keeps this from becoming "drop anything awkward". A kit
    // somebody installed or wrote has no record to restore from, so it is part of the template.
    expect(isRestoredOnInstall('noodl_modules/my-own-kit/index.js')).toBe(false);
    expect(isNeverShared('noodl_modules/my-own-kit/index.js')).toBe(false);
    // ⚠️ And a name that merely starts with a restored one is not that one.
    expect(isRestoredOnInstall('noodl_modules/inter-custom/styles.css')).toBe(false);
    expect(isNeverShared('noodl_modules/inter-custom/styles.css')).toBe(false);
    // The directory itself, and its contents, both match.
    expect(isRestoredOnInstall('noodl_modules/inter')).toBe(true);
  });

  it('catches every .env variant, not just the bare name', () => {
    for (const p of ['.env', '.env.local', '.env.production', 'sub/.env.staging']) {
      expect(isNeverShared(p)).toBe(true);
    }
    // ⚠️ And not a file that merely mentions it — `.environment` is not an env file.
    expect(isNeverShared('.environment')).toBe(false);
    expect(isNeverShared('docs/environment.md')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('refusals arrive before the upload, in the order a person can act on', () => {
  it('🔴 says "no manifest" before it says "too many binaries" — the wrong folder is the likelier mistake', async () => {
    // Somebody who picked their Downloads folder should be told they picked the wrong folder, not
    // that their holiday photos cannot travel. Both are true; only one is useful.
    const fs = fakeFs({ 'photo.png': 'not\uFFFDtext', 'notes.txt': 'hello' });
    const result = await shareAsTemplate({ fs, sink: sink() }, META);
    expect(result.outcome).toBe('no-manifest');

    // 🔴 AND THE REFUSAL NAMES WHAT IT LOOKED FOR — asserted because a MUTANT FOUND THIS GAP.
    // Adding a fourth entry to `MANIFESTS` survived every spec in this file: the accept/reject
    // decision could not see it (a files map is keyed by FILES, so it never holds a bare
    // `components` key), but `looked` is user-facing text and nothing graded it. A person told
    // "no manifest" needs the list of names that would fix it, and that list must be true.
    expect((result as Extract<ShareAsTemplateOutcome, { outcome: 'no-manifest' }>).looked).toEqual([
      'nodegx.project.json',
      'components/_registry.json',
      'project.json'
    ]);
  });

  it('refuses a project with binaries, naming them', async () => {
    const fs = fakeFs({ ...PROJECT, 'assets/logo.png': 'PNG\uFFFD\uFFFDIHDR' });
    const result = await shareAsTemplate({ fs, sink: sink() }, META);
    expect(result.outcome).toBe('binaries');
    expect((result as Extract<ShareAsTemplateOutcome, { outcome: 'binaries' }>).paths).toEqual([
      'assets/logo.png'
    ]);
  });

  it('detects a NUL as well as a replacement character', async () => {
    // 🔴 The platform tests bytes; this side has already decoded to UTF-16, so the byte-level test
    // ALONE would pass binaries through to a 400 naming a rule about jsonb. Both tells are needed.
    const nul = fakeFs({ ...PROJECT, 'assets/a.bin': 'head\u0000tail' });
    expect((await shareAsTemplate({ fs: nul, sink: sink() }, META)).outcome).toBe('binaries');
    // ⚠️ THE CONTROL — ordinary text with unusual characters in it is NOT a binary. Without this
    // the detector could be `() => true` and the case above still passes.
    const text = fakeFs({ ...PROJECT, 'docs/notes.md': '# Héllo — ünicode, emoji 🎉, tabs\tand all' });
    expect((await shareAsTemplate({ fs: text, sink: sink() }, META)).outcome).toBe('submitted');
  });

  it('refuses an empty directory rather than filing an empty submission', async () => {
    expect((await shareAsTemplate({ fs: fakeFs({}), sink: sink() }, META)).outcome).toBe('empty');
  });

  it('🔴 refuses past the cap BEFORE the upload, and the cap is the platform’s', async () => {
    const big = { ...PROJECT, 'components/Pages/Big/c.json': 'x'.repeat(MAX_TEMPLATE_BYTES + 1) };
    const s = sink();
    const result = await shareAsTemplate({ fs: fakeFs(big), sink: s }, META);
    expect(result.outcome).toBe('too-big');
    // 🔴 AND NOTHING WAS SENT. Without this the spec passes on a module that uploads 8 MiB, waits,
    // and then reports the refusal it could have made first — which is the whole point of the
    // check being on this side.
    expect(s.sent).toHaveLength(0);
    expect((result as Extract<ShareAsTemplateOutcome, { outcome: 'too-big' }>).limit).toBe(
      8 * 1024 * 1024
    );
  });

  it('accepts the three manifests the detector accepts, and refuses components/ alone', () => {
    expect(hasProjectManifest({ 'nodegx.project.json': '{}' })).toBe(true);
    expect(hasProjectManifest({ 'components/_registry.json': '{}' })).toBe(true);
    expect(hasProjectManifest({ 'project.json': '{}' })).toBe(true);
    // ⚠️ `ProjectFormatDetector` scores a bare `components/` at 1 against its own threshold of 2,
    // so a bundle of components with no manifest installs into a directory the editor answers
    // `unknown` for. Refused on both sides for that reason.
    expect(hasProjectManifest({ 'components/Pages/Home/component.json': '{}' })).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('what the outcome says, and what it must not say', () => {
  it('🔴 says SUBMITTED, never published', async () => {
    const result = await shareAsTemplate({ fs: fakeFs(PROJECT), sink: sink() }, META);
    expect(result.outcome).toBe('submitted');
    // The one thing a person must not conclude from a success. Asserted on the union itself so a
    // later edit cannot introduce it quietly.
    expect(JSON.stringify(result)).not.toContain('published');
  });

  it('carries the platform’s own sentence back on a refusal', async () => {
    const s = sink({ outcome: 'refused', detail: '[template-slug] that is not a slug' });
    const result = await shareAsTemplate({ fs: fakeFs(PROJECT), sink: s }, META);
    expect(result.outcome).toBe('refused');
    expect((result as Extract<ShareAsTemplateOutcome, { outcome: 'refused' }>).detail).toContain(
      'template-slug'
    );
  });

  it('tells an unauthenticated caller apart from an unreachable one and from D15', async () => {
    // 🔴 Three outcomes, three different fixes, and folding any two of them together is how a
    // person who needs to sign in is told the community is down.
    const cases = [
      [{ outcome: 'unauthenticated' as const }, 'unauthenticated'],
      [{ outcome: 'absent' as const }, 'absent'],
      [
        { outcome: 'unreachable' as const, status: 500, detail: 'HTTP 500' },
        'unreachable'
      ]
    ] as const;
    for (const [reply, expected] of cases) {
      const result = await shareAsTemplate({ fs: fakeFs(PROJECT), sink: sink(reply) }, META);
      expect(result.outcome).toBe(expected);
    }
  });

  it('sends exactly the fields the route reads, and no others', async () => {
    const s = sink();
    await shareAsTemplate({ fs: fakeFs(PROJECT), sink: s }, META);
    expect(Object.keys(s.sent[0]).sort()).toEqual(
      ['attestedLicence', 'category', 'files', 'proposedSlug', 'summary', 'title'].sort()
    );
    // 🔴 No `submitterAccountId`. The platform takes it from the session — a body that could name
    // its own submitter could file a submission as somebody else, and the decline that followed
    // would be sent to a person who had done nothing.
    expect(Object.keys(s.sent[0])).not.toContain('submitterAccountId');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('the slug suggestion is a suggestion', () => {
  it('turns a project name into a legal slug', () => {
    expect(suggestedSlug('A Pricing Page')).toBe('a-pricing-page');
    expect(suggestedSlug('Todo — v2!')).toBe('todo-v2');
    expect(suggestedSlug('  Leading and trailing  ')).toBe('leading-and-trailing');
  });

  it('🔴 does NOT invent a name when it cannot make one', () => {
    // Returning `untitled-1` here would file somebody's template under a name they never chose
    // and never saw. The empty string comes back as `template-slug` from the platform, which is
    // a refusal naming the field they can fix.
    expect(suggestedSlug('…')).toBe('');
    expect(suggestedSlug('!!!')).toBe('');
  });

  it('never leaves a trailing hyphen, which the platform’s pattern refuses', () => {
    // 80 characters of `a`, then a space and more — the slice can land on a separator.
    const long = `${'a'.repeat(79)} tail`;
    const slug = suggestedSlug(long);
    expect(slug.endsWith('-')).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
describe('reach — the caller-grep made executable', () => {
  it('🔴 the editor’s client has no method that publishes a template', () => {
    // T1's finding was a complete mechanism reached by nobody; the mirror image of that defect is
    // a client that offers a verb the platform does not have. `publishTemplate` on this class
    // would be a promise it cannot keep, and the first caller to believe it would tell somebody
    // their template was live on a public shelf.
    const source = readFileSync(
      join(__dirname, '../../src/editor/src/models/community/communityapi.ts'),
      'utf8'
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');

    expect(code).toContain('submitTemplate(');
    expect(code).not.toContain('publishTemplate(');
    // ⚠️ THE CONTROL FOR THE STRIPPER, both directions — `publishTemplate` appears in the doc
    // comment explaining why it does not exist, so a raw `includes` would fail on correct code.
    expect(source).toContain('publishTemplate');
    expect(code).not.toContain('publishTemplate');
  });

  it('the payload size is measured the way the route measures it', () => {
    // Two copies of a number, agreeing about what they COUNT — bytes of the JSON body, not
    // characters. A cap measured in UTF-16 units is one a caller can exceed by a factor of four.
    const files = { 'a.json': '🎉'.repeat(10) };
    expect(templatePayloadBytes(files)).toBe(
      Buffer.byteLength(JSON.stringify(files), 'utf8')
    );
  });
});
