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
  templateHomeStatus,
  templatePayloadBytes,
  whyNeverShared,
  type ShareAsTemplateOutcome,
  type TemplateReadFs,
  type TemplateSubmissionSink
} from '@noodl-models/template/shareAsTemplate';

// ─────────────────────────────────────────────────────────────────────────────
// A fake project on a fake disk.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Paths → contents. Directories are inferred from the keys, as a real walk would find them.
 *
 * ⚠️ **A VALUE MAY BE A `Buffer` (`0023`).** The walk reads bytes now, so a fixture that could
 * only hold a string could not express the case the binary transport exists for: a PNG whose
 * bytes are not valid UTF-8. A string value is encoded as UTF-8, which is what a text file is.
 */
function fakeFs(tree: Record<string, string | Buffer>): TemplateReadFs {
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
    async readBinaryFile(path: string) {
      const key = path.slice('/p/'.length);
      if (!(key in tree)) throw new Error(`no such file ${path}`);
      const value = tree[key];
      return Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
    }
  };
}

/**
 * 🔴 **A REAL PNG HEADER, NOT A STRING OF LETTERS.** The property under test is that BYTES
 * survive the trip, and a fixture made of printable ASCII would survive a transport that decoded
 * to UTF-8 and back — the exact failure the two maps exist to prevent. These eight bytes are a
 * PNG's signature, and they include a NUL plus two (`0x89`, `0x1a`) that are not valid UTF-8.
 */
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const PROJECT = {
  /**
   * ⚠️ **`rootNodeId` IS LOAD-BEARING, NOT DECORATION — DEF-007.** A project with no home page is
   * refused (`no-home`) before it is weighed or sent, so every spec below that expects a share to
   * get *past* collection needs a fixture that has one. Deleting this field turns roughly half
   * this file red, which is the point: it is what a project looks like after somebody has picked
   * a home, and that is the only shape this door accepts.
   */
  'nodegx.project.json': '{"name":"A pricing page","rootNodeId":"node-home-1"}',
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
    const { files, binaryFiles, excluded } = await collectTemplateFiles(fs, '/p');
    expect(Object.keys(files)).toContain('components/Home.json');
    expect(excluded).toContain('components/.DS_Store');
    // ⚠️ The point of the fix: it is WITHHELD, not sorted into the payload. 🔴 The stakes changed
    // with `0023` and the assertion is worth MORE now, not less: before, a stray `.DS_Store`
    // refused the share loudly; now it would be UPLOADED, as base64, to a public shelf. A rule
    // whose failure mode moved from "refuses" to "publishes" is a rule to keep measuring.
    expect(binaryFiles).toEqual({});
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

  it('control: there really are starter modules, and they are the three the editor ships', () => {
    // 🔴 Read FIRST. Every assertion below is about what this list excludes, and an empty list
    // excludes nothing while satisfying most of them.
    expect(RESTORED_ON_INSTALL.length).toBeGreaterThan(0);
    // ⚠️ A LITERAL, deliberately, and it did its job: adding VIB-003's `starter-imagery` to
    // `STARTER_ASSETS` reddened exactly this row and nothing else, which is a starter module
    // arriving with somebody deciding it should. A derived list would have grown in silence.
    expect(RESTORED_ON_INSTALL).toEqual([
      'noodl_modules/inter',
      'noodl_modules/lucide-icons',
      'noodl_modules/starter-imagery'
    ]);
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
    const { files, binaryFiles, excluded } = await collectTemplateFiles(fs, '/p');

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

    // 🔴 THE POINT, AND `0023` SHARPENED IT RATHER THAN RETIRING IT. Before the binary transport
    // these fonts REFUSED the share — 42 of the 46 blocking files over 25 real projects. Now they
    // would travel: nine weights of Inter and 1,998 Lucide glyphs, base64'd, in every template
    // anybody shared, when `installStarterAssets` puts them back from the app bundle for free.
    // The exclusion stopped being about a limit and became about not shipping half a megabyte
    // that the installer already has.
    expect(binaryFiles).toEqual({});

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
  it('🔴 says "no manifest" for a folder of photographs — the wrong folder is the likelier mistake', async () => {
    // Somebody who picked their Downloads folder should be told they picked the wrong folder.
    // ⚠️ **THE COMPETING SENTENCE CHANGED WITH `0023` AND THE ORDER STILL HOLDS.** This used to
    // read "no manifest" before "too many binaries"; there is no binaries refusal any more, so
    // what it now guards is that a folder whose only text file is `notes.txt` is refused for the
    // reason that helps, rather than uploaded as a template made of holiday photos.
    const fs = fakeFs({ 'photo.png': PNG_BYTES, 'notes.txt': 'hello' });
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

  it('🔴 CARRIES a project with a real PNG in it, as base64, and the BYTES survive', async () => {
    // 🔴 **THIS SPEC REPLACES ITS OWN OPPOSITE.** It used to read *"refuses a project with
    // binaries, naming them"*, and the measurement that ended it is in the module header: over
    // the 77 real projects on this machine, eleven were refused after the starter-module
    // exclusion, and the residue was 19 `.ttf` in `fonts/` and 4 `.png` in `assets/` — the
    // author's own content, which nothing can restore.
    const record = sink();
    const fs = fakeFs({ ...PROJECT, 'assets/logo.png': PNG_BYTES });
    const result = await shareAsTemplate({ fs, sink: record }, META);
    expect(result.outcome).toBe('submitted');

    // ⚠️ **THE ASSERTION IS THE DECODE, NOT THE PRESENCE.** A transport that base64'd the UTF-8
    // *decoding* of these bytes would put a string here too — and it would be the wrong string,
    // which is the whole failure `0023` exists to prevent. The two bytes this fixture was chosen
    // for (`0x89` and `0x1a`) are exactly the ones that would not survive.
    expect(Buffer.from(record.sent[0].binaryFiles!['assets/logo.png'], 'base64')).toEqual(PNG_BYTES);

    // And it is NOT in the text map. Two maps, one path each.
    expect(record.sent[0].files['assets/logo.png']).toBeUndefined();
    expect(record.sent[0].files['nodegx.project.json']).toBe(PROJECT['nodegx.project.json']);
  });

  it('🔴 a NUL is binary, and a REPLACEMENT CHARACTER in a source file no longer is', async () => {
    const nul = fakeFs({ ...PROJECT, 'assets/a.bin': Buffer.from([0x68, 0x00, 0x74]) });
    const record = sink();
    expect((await shareAsTemplate({ fs: nul, sink: record }, META)).outcome).toBe('submitted');
    expect(Object.keys(record.sent[0].binaryFiles ?? {})).toEqual(['assets/a.bin']);

    // 🔴 **A FALSE POSITIVE THE OLD TEST COULD NOT AVOID, NOW FIXED, AND ASSERTED AS THE FIX.**
    // The previous classifier worked on a decoded string and had to treat U+FFFD as a binary
    // tell, because decoding a PNG produces one. A Markdown file that quotes a mojibake bug
    // contains a real U+FFFD, round-trips through UTF-8 perfectly, and was being classified as a
    // binary — which, before `0023`, refused the whole share.
    const mojibake = sink();
    const withFffd = fakeFs({ ...PROJECT, 'docs/bug.md': 'the header rendered as \uFFFD\uFFFD' });
    expect((await shareAsTemplate({ fs: withFffd, sink: mojibake }, META)).outcome).toBe('submitted');
    expect(mojibake.sent[0].files['docs/bug.md']).toContain('\uFFFD');
    expect(mojibake.sent[0].binaryFiles ?? {}).toEqual({});

    // ⚠️ THE CONTROL — ordinary text with unusual characters in it is NOT a binary. Without this
    // the classifier could be `() => false` and both cases above still pass.
    const record2 = sink();
    const text = fakeFs({ ...PROJECT, 'docs/notes.md': '# Héllo — ünicode, emoji 🎉, tabs\tand all' });
    expect((await shareAsTemplate({ fs: text, sink: record2 }, META)).outcome).toBe('submitted');
    expect(record2.sent[0].binaryFiles ?? {}).toEqual({});
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

  // ═══════════════════════════════════════════════════════════════════════════
  // DEF-007 — a template with no home page is refused before it is uploaded.
  //
  // 🧭 Richard, 2026-08-31: *"Refuse at publish, make sure people define a home page, it's a very
  // basic requirement."*
  // ═══════════════════════════════════════════════════════════════════════════

  it('🔴 refuses a project with NO HOME PAGE, and sends nothing', async () => {
    // The defect in one sentence: today this uploads cleanly and lands on a public shelf as a
    // template that opens on nothing. `hasProjectManifest` only ever asked whether a manifest
    // EXISTS.
    const homeless = { ...PROJECT, 'nodegx.project.json': '{"name":"A pricing page"}' };
    const s = sink();
    const result = await shareAsTemplate({ fs: fakeFs(homeless), sink: s }, META);

    expect(result.outcome).toBe('no-home');
    // 🔴 AND NOTHING WAS SENT — the same assertion `too-big` needs, for the same reason. Without
    // it this passes on a module that uploads the broken template and then mentions the problem.
    expect(s.sent).toHaveLength(0);

    // 🔴 **THE CONTROL, AND IT IS RUN AGAINST THE SAME FIXTURE MINUS ONE FIELD.** An absence
    // check whose subject was never accepted proves nothing: if `shareAsTemplate` were broken in
    // some way that refused everything, the assertion above would still pass.
    const ok = sink();
    expect((await shareAsTemplate({ fs: fakeFs(PROJECT), sink: ok }, META)).outcome).toBe('submitted');
    expect(ok.sent).toHaveLength(1);
  });

  it('🔴 refuses BEFORE the size check — a template nobody can open is not a size problem', async () => {
    // Ordering is asserted rather than assumed, because both refusals are true of this fixture
    // and a `switch` of independent `if`s has no order a reader can see.
    const bigAndHomeless = {
      ...PROJECT,
      'nodegx.project.json': '{"name":"A pricing page"}',
      'components/Pages/Big/c.json': 'x'.repeat(MAX_TEMPLATE_BYTES + 1)
    };
    expect((await shareAsTemplate({ fs: fakeFs(bigAndHomeless), sink: sink() }, META)).outcome).toBe('no-home');
  });

  it('🔴 ...but AFTER "no manifest" — the wrong folder is the likelier mistake', async () => {
    // Somebody who picked their Downloads folder must not be told their project has no home page.
    // That is a true sentence about a thing that is not their problem.
    const fs = fakeFs({ 'photo.png': PNG_BYTES, 'notes.txt': 'hello' });
    expect((await shareAsTemplate({ fs, sink: sink() }, META)).outcome).toBe('no-manifest');
  });

  it('the refusal names the manifest it read, so the sentence is about a real file', async () => {
    const homeless = { ...PROJECT, 'nodegx.project.json': '{"name":"x"}' };
    const result = await shareAsTemplate({ fs: fakeFs(homeless), sink: sink() }, META);
    expect((result as Extract<ShareAsTemplateOutcome, { outcome: 'no-home' }>).manifest).toBe(
      'nodegx.project.json'
    );
  });

  describe('templateHomeStatus', () => {
    it('takes rootNodeId, and the LEGACY rootComponent too', () => {
      // 🔴 Both spellings, and the asymmetry is deliberate: `rootComponent` is the legacy NAME
      // field which the v2 schema forbids, but `fromJSON` still resolves it — so a project
      // carrying only the name is one that DOES open, and refusing it would be wrong. This
      // function decides a refusal, so it must err towards letting a working project through.
      expect(templateHomeStatus({ 'nodegx.project.json': '{"rootNodeId":"n1"}' })).toBe('has-home');
      expect(templateHomeStatus({ 'project.json': '{"rootComponent":"App"}' })).toBe('has-home');
      expect(templateHomeStatus({ 'nodegx.project.json': '{"name":"x"}' })).toBe('no-home');
    });

    it('🔴 an EMPTY or NULL rootNodeId is not a home', () => {
      // The shape an agent-written or hand-written manifest actually produces for "I did not set
      // this". `loader.ts` says of exactly this population: *"projects authored from outside …
      // frequently do not"* carry one. Testing presence instead of content would pass them all.
      expect(templateHomeStatus({ 'nodegx.project.json': '{"rootNodeId":""}' })).toBe('no-home');
      expect(templateHomeStatus({ 'nodegx.project.json': '{"rootNodeId":null}' })).toBe('no-home');
    });

    it('🔴 prefers the V2 manifest when a project carries both', () => {
      // A project mid-migration has both files. The v2 one is what the editor writes and what
      // `fromJSON` reads first, so a stale legacy `project.json` must not decide this.
      expect(
        templateHomeStatus({
          'nodegx.project.json': '{"rootNodeId":"n1"}',
          'project.json': '{"name":"stale"}'
        })
      ).toBe('has-home');
    });

    it('🔴 an UNREADABLE manifest is not reported as "no home page"', () => {
      // A confident sentence about the wrong problem is the failure `no-manifest`'s header warns
      // about. Torn JSON, and a project whose only manifest is the registry (which carries no
      // home field at all), are both unmeasurable — and an unmeasured project is NOT refused.
      expect(templateHomeStatus({ 'nodegx.project.json': '{not json' })).toBe('unreadable');
      expect(templateHomeStatus({ 'nodegx.project.json': '[]' })).toBe('unreadable');
      expect(templateHomeStatus({ 'components/_registry.json': '{"components":[]}' })).toBe('unreadable');
    });

    it('an unreadable manifest is passed to the platform rather than refused here', async () => {
      const torn = { ...PROJECT, 'nodegx.project.json': '{not json' };
      const s = sink();
      const result = await shareAsTemplate({ fs: fakeFs(torn), sink: s }, META);
      expect(result.outcome).not.toBe('no-home');
      expect(s.sent).toHaveLength(1);
    });
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

  it('the payload size is measured the way the DATABASE measures it, and counts base64 as base64', () => {
    // Two copies of a number, agreeing about what they COUNT — bytes of the JSON body, not
    // characters. A cap measured in UTF-16 units is one a caller can exceed by a factor of four.
    //
    // 🔴 **THE SUBJECT MOVED WITH `0023` AND THE SPEC MOVED WITH IT.** It used to compare against
    // `JSON.stringify(files)`; the thing `project_template_payload_size` actually caps is
    // `payload`, which is `{ files, binaryFiles }`. ⚠️ Still an approximation of the ROUTE's cap,
    // which counts the whole request body — five short strings more — and deliberately so: the
    // two numbers are matched so a payload the API accepts is not one the database then refuses,
    // and erring a few hundred bytes UNDER is the safe direction.
    const files = { 'a.json': '🎉'.repeat(10) };
    expect(templatePayloadBytes(files)).toBe(Buffer.byteLength(JSON.stringify({ files }), 'utf8'));

    // 🔴 A binary is counted as the base64 it TRAVELS as, not as its decoded size. `0020` warned
    // that base64 costs +33% against the cap; a measurement that reported the decoded size would
    // tell somebody they were at 6 MiB when the route was about to refuse them at 8.1.
    const binaryFiles = { 'a.png': PNG_BYTES.toString('base64') };
    expect(templatePayloadBytes(files, binaryFiles)).toBe(
      Buffer.byteLength(JSON.stringify({ files, binaryFiles }), 'utf8')
    );
    expect(templatePayloadBytes(files, binaryFiles)).toBeGreaterThan(templatePayloadBytes(files));

    // ⚠️ And an EMPTY binary map costs nothing — an ordinary text-only share is byte-identical
    // on the wire to what it was before this change.
    expect(templatePayloadBytes(files, {})).toBe(templatePayloadBytes(files));
  });
});
