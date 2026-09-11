#!/usr/bin/env node
/**
 * Assert a draft release carries the COMPLETE set of artifacts, and that the
 * macOS update feed describes both architectures.
 *
 * ## Why this exists
 *
 * **electron-builder uploads as it goes, so a published artifact is not evidence
 * of a green job.** The v0.1.0 Linux leg is the standing example: it built the
 * AppImage, uploaded it, then aborted building the `.deb` on a missing `author`
 * email. The release carried an AppImage and the leg was red — and the release
 * was read as "succeeded, no update feed" for over a week (F73).
 *
 * The matrix is `fail-fast: false`, so a failed leg does show up red in Actions.
 * That is the only signal there is, and it is a signal nobody is looking at when
 * the draft in front of them has files in it. This turns "the draft is short an
 * artifact" into its own failing job, named for the thing that is missing.
 *
 * It also closes the one place the pipeline can go green while producing the
 * wrong thing: `merge-mac-update-feed` rebuilds `latest-mac.yml` so it lists
 * BOTH mac architectures, and nothing downstream ever checked that the merged
 * feed actually landed. An arm64-only feed means every Intel Mac silently stops
 * receiving updates — a failure with no symptom at all on the machine that cut
 * the release.
 *
 * ## Usage
 *
 *   gh release view "$TAG" --json assets > assets.json
 *   node scripts/check-release-assets.js --assets assets.json [--mac-feed latest-mac.yml]
 *
 *   node scripts/check-release-assets.js --self-test    # the rules, against fixtures
 *
 * ## Expectations, and why they are patterns rather than names
 *
 * `artifactName` is `${productName}-${version}-${os}-${arch}.${ext}`, but the
 * arch token is not uniform: electron-builder writes `x86_64` for AppImage and
 * `amd64` for `.deb`, against `x64` everywhere else. Matching on suffix is
 * robust to that, and to a productName or version change, in a way a literal
 * file list is not.
 *
 * `latest-linux.yml` is deliberately NOT expected — `autoupdater.js` returns
 * early on Linux, so nothing would ever read it. See RELEASE-PROCESS.md.
 */

const fs = require('fs');

const EXPECTED = [
  { id: 'macOS Apple Silicon disk image', re: /-mac-arm64\.dmg$/, why: 'the download for an Apple Silicon Mac' },
  { id: 'macOS Apple Silicon update zip', re: /-mac-arm64\.zip$/, why: 'Squirrel.Mac updates from a .zip, not the .dmg' },
  { id: 'macOS Intel disk image', re: /-mac-x64\.dmg$/, why: 'the download for an Intel Mac' },
  { id: 'macOS Intel update zip', re: /-mac-x64\.zip$/, why: 'Squirrel.Mac updates from a .zip, not the .dmg' },
  { id: 'Windows installer', re: /-win-x64\.exe$/, why: 'the NSIS installer' },
  { id: 'Windows update feed', re: /^latest\.yml$/, why: 'electron-updater reads this on Windows' },
  { id: 'macOS update feed', re: /^latest-mac\.yml$/, why: 'electron-updater reads this on macOS' },
  { id: 'Linux AppImage', re: /\.AppImage$/, why: 'the only Linux artifact users are told to download' },
  { id: 'Linux .deb', re: /\.deb$/, why: 'the leg that aborted in v0.1.0 after the AppImage had already uploaded (F73)' },
  {
    id: 'Linux .rpm',
    re: /\.rpm$/,
    why: 'Fedora/RHEL/openSUSE have no .deb path, and the AppImage was the only thing they could run (#29, FLD-016)'
  }
];

/** Entries the merged macOS feed must describe — one per architecture. */
const MAC_FEED_ARCHES = [
  { id: 'arm64', re: /-mac-arm64\.zip/ },
  { id: 'x64', re: /-mac-x64\.zip/ }
];

/**
 * @param {string[]} names asset file names on the release
 * @param {string|null} macFeed contents of latest-mac.yml, or null to skip
 * @returns {string[]} problems, empty when the release is complete
 */
function check(names, macFeed) {
  const problems = [];

  for (const expectation of EXPECTED) {
    if (!names.some((name) => expectation.re.test(name))) {
      problems.push(`missing ${expectation.id} (${String(expectation.re)}) — ${expectation.why}`);
    }
  }

  if (macFeed != null) {
    for (const arch of MAC_FEED_ARCHES) {
      if (!arch.re.test(macFeed)) {
        problems.push(
          `latest-mac.yml does not list the ${arch.id} build — every Mac on that architecture would silently ` +
            'stop receiving updates. The merge-mac-update-feed job is what produces a feed covering both.'
        );
      }
    }
  }

  return problems;
}

// ---------------------------------------------------------------------------

function selfTest() {
  const complete = [
    'NodeGX-0.1.1-mac-arm64.dmg',
    'NodeGX-0.1.1-mac-arm64.zip',
    'NodeGX-0.1.1-mac-arm64.zip.blockmap',
    'NodeGX-0.1.1-mac-x64.dmg',
    'NodeGX-0.1.1-mac-x64.zip',
    'NodeGX-0.1.1-win-x64.exe',
    'NodeGX-0.1.1-win-x64.exe.blockmap',
    'NodeGX-0.1.1-linux-x86_64.AppImage',
    'NodeGX-0.1.1-linux-amd64.deb',
    'NodeGX-0.1.1-linux-x86_64.rpm',
    'latest.yml',
    'latest-mac.yml'
  ];
  const bothArchFeed = 'files:\n  - url: NodeGX-0.1.1-mac-arm64.zip\n  - url: NodeGX-0.1.1-mac-x64.zip\n';

  const cases = [
    { name: 'a complete release passes', names: complete, feed: bothArchFeed, expect: 0 },
    {
      // The measured v0.1.0 draft, verbatim. Every check below has to be red on
      // it, or this file is decoration.
      name: 'the real v0.1.0 draft is caught',
      names: ['latest.yml', 'NodeGX-0.1.0-linux-x86_64.AppImage', 'NodeGX-0.1.0-win-x64.exe', 'NodeGX-0.1.0-win-x64.exe.blockmap'],
      feed: null,
      expect: 7 // 4 mac artifacts + latest-mac.yml + the .deb + the .rpm
    },
    {
      name: 'F73 exactly: AppImage uploaded, .deb aborted',
      names: complete.filter((n) => !n.endsWith('.deb')),
      feed: bothArchFeed,
      expect: 1
    },
    {
      // FLD-016 AC4: "the release-asset check fails when it is absent —
      // asserted by removing it, because a check that has never failed has not
      // been tested." Adding a third Linux target is exactly the situation
      // that produced F73, so the new artifact gets the same removal case the
      // .deb has.
      name: 'the .rpm is missing (FLD-016 AC4)',
      names: complete.filter((n) => !n.endsWith('.rpm')),
      feed: bothArchFeed,
      expect: 1
    },
    {
      name: 'a single-arch mac feed is caught even when every file is present',
      names: complete,
      feed: 'files:\n  - url: NodeGX-0.1.1-mac-arm64.zip\n',
      expect: 1
    }
  ];

  let failures = 0;
  for (const testCase of cases) {
    const problems = check(testCase.names, testCase.feed);
    const ok = problems.length === testCase.expect;
    if (!ok) failures++;
    console.log(`  ${ok ? '✓' : '✗'} ${testCase.name} (${problems.length} problem(s), expected ${testCase.expect})`);
    if (!ok) for (const problem of problems) console.log(`      ${problem}`);
  }

  if (failures > 0) {
    console.error(`\n✗ ${failures} self-test case(s) failed`);
    process.exit(1);
  }
  console.log(`✓ check-release-assets self-test: ${cases.length}/${cases.length} cases`);
  process.exit(0);
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1];
}

if (process.argv.includes('--self-test')) selfTest();

const assetsPath = argValue('--assets');
if (!assetsPath) {
  console.error('usage: check-release-assets.js --assets <gh-release-view.json> [--mac-feed <latest-mac.yml>]');
  console.error('       check-release-assets.js --self-test');
  process.exit(2);
}

const payload = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
// `gh release view --json assets` gives `{ assets: [{ name, ... }] }`; accept a
// bare array too, so a hand-made list can be checked.
const assets = Array.isArray(payload) ? payload : payload.assets || [];
const names = assets.map((asset) => (typeof asset === 'string' ? asset : asset.name)).filter(Boolean);

const macFeedPath = argValue('--mac-feed');
const macFeed = macFeedPath && fs.existsSync(macFeedPath) ? fs.readFileSync(macFeedPath, 'utf8') : null;

console.log(`Release carries ${names.length} asset(s):`);
for (const name of names) console.log(`    ${name}`);

if (names.some((name) => /^latest-linux\.yml$/.test(name))) {
  console.log('\n  note: latest-linux.yml is present. Nothing reads it — autoupdater.js returns early on Linux.');
}

const problems = check(names, macFeed);

if (problems.length > 0) {
  console.error(`\n✗ the draft release is incomplete — ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`    ${problem}`);
  console.error(
    '\nelectron-builder uploads as it goes, so a draft with files in it is NOT\n' +
      'evidence that every leg went green. Read the matrix legs in this run before\n' +
      'retagging: one of them uploaded something and then failed.\n'
  );
  process.exit(1);
}

console.log(
  macFeed
    ? `\n✓ all ${EXPECTED.length} expected artifacts are present, and latest-mac.yml covers both architectures`
    : `\n✓ all ${EXPECTED.length} expected artifacts are present (latest-mac.yml contents not checked)`
);
process.exit(0);
