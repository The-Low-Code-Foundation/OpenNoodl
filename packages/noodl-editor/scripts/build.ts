import { execSync } from 'child_process';

import { withHeapCeiling } from './webpackHeapCeiling';
import { valueToBoolean } from '../../../scripts/helper';
import { BuildTarget, getDistPlatform } from './platform/build-platforms';

(async function () {
  // Inputs
  const DISABLE_SIGNING = valueToBoolean(process.env.DISABLE_SIGNING);
  const TARGET_PLATFORM = process.env.TARGET_PLATFORM;

  if (!TARGET_PLATFORM) throw new Error('TARGET_PLATFORM is falsy');

  // Variables
  const [platform, arch] = TARGET_PLATFORM.trim().split('-');
  // @ts-expect-error TODO: Add validation on the input.
  const target: BuildTarget = { platform, arch };

  // Debug Configuration
  console.log('@ -> packages/noodl-editor/scripts/build.ts');
  console.log('--- Configuration');
  console.log('> DISABLE_SIGNING: ', DISABLE_SIGNING);
  console.log('> TARGET_PLATFORM: ', TARGET_PLATFORM);
  console.log('---');

  // Build Renderer
  console.log("--- Run webpack 'webpack.renderer.production.js' ...");
  execSync('npx webpack --config=webpackconfigs/webpack.renderer.production.js', {
    stdio: 'inherit',
    env: withHeapCeiling(process.env)
  });
  console.log('--- done!');

  // Build Main
  console.log("--- Run webpack 'webpack.main.production.js' ...");
  execSync('npx webpack --config=webpackconfigs/webpack.main.production.js', {
    stdio: 'inherit',
    env: withHeapCeiling(process.env)
  });
  console.log('--- done!');

  const platformName = getDistPlatform(target.platform);

  // Publish to the configured feed (GitHub Releases) only when explicitly asked
  // — the tag-triggered release workflow sets PUBLISH_RELEASE=true and provides
  // GH_TOKEN. Nightly and local builds leave it unset and stay local-only.
  // `onTagOrDraft` respects the `releaseType: draft` in package.json, so a
  // release lands as a draft for a human to confirm before it goes public.
  const PUBLISH_RELEASE = valueToBoolean(process.env.PUBLISH_RELEASE);
  const publishArg = PUBLISH_RELEASE ? '--publish onTagOrDraft' : '--publish never';

  // Per-arch macOS builds (arm64 / x64), each fully functional. A single-file
  // `--universal` build was evaluated and deferred: it needs the bundled native
  // binaries (desktop-trampoline, dugite's git) built for both arches and
  // lipo-merged, which this one-`npm install`-per-arch pipeline does not
  // produce — @electron/universal correctly refuses to ship single-arch natives
  // in a universal app. See dev-docs/guidelines/RELEASE-PROCESS.md §6.
  const args = [`--${platformName}`, `--${target.arch}`, publishArg].join(' ');

  // Signing:
  //  - DISABLE_SIGNING=true  → force signing off (CSC_IDENTITY_AUTO_DISCOVERY=false).
  //    Without this, electron-builder would try to sign with whatever identity it
  //    finds in the local keychain, so "unsigned" nightly/dev builds were only
  //    unsigned by accident. Now they are unsigned by contract.
  //  - DISABLE_SIGNING=false → electron-builder reads signing material from the
  //    environment: CSC_LINK/CSC_KEY_PASSWORD (macOS Developer ID) and
  //    WIN_CSC_LINK/WIN_CSC_KEY_PASSWORD (Windows). Notarisation is handled by
  //    the afterSign hook (build/macos-notarize.js). No credentials are read here.
  const signingEnv = DISABLE_SIGNING ? { CSC_IDENTITY_AUTO_DISCOVERY: 'false' } : {};

  // CI passes the signing secrets unconditionally, so when a secret does not
  // exist the variable arrives as an EMPTY STRING — and electron-builder treats
  // an empty-but-set CSC_LINK as a certificate *path*, failing with
  // "<cwd> not a file". That is what actually broke the v0.1.0 darwin legs
  // (DEBT-007), not a signing misconfiguration. Strip empties so "secret
  // absent" degrades to an unsigned build, as the release workflow promises.
  const SIGNING_ENV_KEYS = [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'WIN_CSC_LINK',
    'WIN_CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER'
  ];

  const env = Object.assign({}, process.env, signingEnv);
  for (const key of SIGNING_ENV_KEYS) {
    if (env[key] !== undefined && String(env[key]).trim() === '') delete env[key];
  }

  // ⚠️ Scope each platform to its OWN signing material, because electron-builder
  // does not. `WIN_CSC_LINK` is not a separate variable to it — it is a
  // *preference*: platformPackager.js `getCscLink("WIN_CSC_LINK")` returns
  //
  //     chooseNotNull(process.env.WIN_CSC_LINK, process.env.CSC_LINK)
  //
  // and winPackager.js does the same for `WIN_CSC_KEY_PASSWORD` → `CSC_KEY_PASSWORD`.
  // release.yml hands every matrix leg every secret, so the moment the Apple
  // Developer ID `.p12` lands in `CSC_LINK` — and before a Windows certificate
  // is bought, which is the *expected* interim state — the Windows leg imports
  // that Apple certificate and hands it to signtool. It is a perfectly valid
  // .p12, so it imports; signing then fails with an opaque signtool error on a
  // leg that has nothing to do with macOS. That is a whole round trip through a
  // human, caused by adding a credential correctly.
  //
  // A mac certificate is mac material and a Windows certificate is Windows
  // material; neither is a fallback for the other. This makes that true.
  // ⚠️ `CSC_KEYCHAIN` and `CSC_NAME` are mac material for the same reason the
  // rest of this list is: release.yml prepares a signing keychain on the darwin
  // legs (see its "Prepare the signing keychain" step) and hands the path and
  // identity down through GITHUB_ENV. They are set only on those legs today, so
  // dropping them elsewhere changes nothing — it keeps the rule true rather than
  // relying on the workflow to keep being careful.
  const MAC_ONLY = ['CSC_LINK', 'CSC_KEY_PASSWORD', 'CSC_KEYCHAIN', 'CSC_NAME', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'];
  const WIN_ONLY = ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'];
  const foreign = target.platform === 'darwin' ? WIN_ONLY : target.platform === 'win32' ? MAC_ONLY : [...MAC_ONLY, ...WIN_ONLY];
  const dropped = foreign.filter((key) => env[key] !== undefined);
  for (const key of dropped) delete env[key];
  if (dropped.length > 0) {
    console.log(`> Dropped signing material for other platforms: ${dropped.join(', ')}`);
  }

  console.log(`--- Run: 'npx electron-builder ${args}' ...`);
  console.log(`> DISABLE_SIGNING: ${DISABLE_SIGNING} | PUBLISH_RELEASE: ${PUBLISH_RELEASE}`);
  execSync('npx electron-builder ' + args, {
    stdio: [0, 1, 2],
    env
  });
})();
