import { execSync } from 'child_process';

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
    env: process.env
  });
  console.log('--- done!');

  // Build Main
  console.log("--- Run webpack 'webpack.main.production.js' ...");
  execSync('npx webpack --config=webpackconfigs/webpack.main.production.js', {
    stdio: 'inherit',
    env: process.env
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
  const env = Object.assign({}, process.env, signingEnv);
  for (const key of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'WIN_CSC_LINK',
    'WIN_CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID'
  ]) {
    if (env[key] !== undefined && String(env[key]).trim() === '') delete env[key];
  }

  console.log(`--- Run: 'npx electron-builder ${args}' ...`);
  console.log(`> DISABLE_SIGNING: ${DISABLE_SIGNING} | PUBLISH_RELEASE: ${PUBLISH_RELEASE}`);
  execSync('npx electron-builder ' + args, {
    stdio: [0, 1, 2],
    env
  });
})();
