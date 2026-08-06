import { execSync } from 'child_process';
import path from 'path';

// import { gitSimpleDownload } from "./git/download-git";

// HACK :)
import { FileSystemNode } from '../../packages/noodl-platform-node/src/filesystem-node';
import { getCurrentPlatform } from '../helper';

(async function () {
  const filesystem = new FileSystemNode();

  // Inputs
  const WORKSPACE_PATH = path.resolve(__dirname, '../..');
  const TARGET_PLATFORM = process.env.TARGET_PLATFORM || getCurrentPlatform();

  // Variables
  const noodlEditorPath = path.join(WORKSPACE_PATH, 'packages', 'noodl-editor');
  const pkgPath = path.join(noodlEditorPath, 'package.json');
  const configPath = path.join(noodlEditorPath, 'src/shared/config/config.js');
  const configDistPath = path.join(noodlEditorPath, 'src/shared/config/config-dist.js');

  const [platform, arch] = TARGET_PLATFORM.trim().split('-');
  // @ts-expect-error TODO: Add validation on the input.
  const target: BuildTarget = { platform, arch };

  // Debug Configuration
  console.log('--- Configuration');
  console.log('> WORKSPACE_PATH: ', WORKSPACE_PATH);
  console.log('> TARGET_PLATFORM: ', TARGET_PLATFORM);
  console.log('---');
  console.log('> noodlEditorPath: ', noodlEditorPath);
  console.log('> pkgPath: ', pkgPath);
  console.log('> configPath: ', configPath);
  console.log('> configDistPath: ', configDistPath);
  console.log('---');

  // Update "package.json"
  console.log("--- Update 'package.json' ...");
  {
    // const rawGitBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    //   env: process.env
    // });
    // const gitBranch = rawGitBranch.toString().trim().replace(/\//, '-');

    const pkg = await filesystem.readJson(pkgPath);
    pkg.main = 'src/main/main.bundle.js';
    // TODO: Set our own new versionTag
    pkg.versionTag = undefined;
    // pkg.build.publish.url = getPublishUrl() + `/${TARGET_PLATFORM}`;
    // console.log('> Auto update URL:', pkg.build.publish.url);

    await filesystem.writeJson(pkgPath, pkg);
  }

  // Replace `config.js`
  await filesystem.removeFile(configPath);
  await filesystem.copyFile(configDistPath, configPath);

  // Yup, arm64 vs x64 battle going on here ...
  console.log("--- Delete 'node_modules' ...");
  execSync('npx rimraf ./node_modules', {
    stdio: 'inherit',
    env: {
      ...process.env
    }
  });

  // Install dependencies
  // NOTE: Getting error "Cannot set properties of null (setting 'dev')" here,
  //       It basically means that some package is not relative to this path.
  console.log("--- Run 'npm install' ...");

  // NOTE: a `npm install electron-notarize` used to run here for darwin. It
  // wrote the dependency into the root package.json, so every macOS build left
  // the working tree dirty — and nothing ever needed it installed *here*:
  // build/macos-notarize.js requires `@electron/notarize`, which is a declared
  // devDependency of noodl-editor. Removed in REV-008.
  //
  // (An earlier version of this note said the hook "is a no-op stub". It is
  // not, and has not been since REV-007: it notarises for real whenever
  // DISABLE_SIGNING is off and the Apple credentials are present.)
  execSync(`npm install --arch=${arch} --scope noodl-editor`, {
    stdio: 'inherit',
    env: process.env
  })
  console.log("--- 'npm install' done!");

  // NOTE: npm install --arch=  does this too
  // // Download git natives for the targeted platform
  // const gitDir = path.resolve("../../node_modules/dugite/git");
  // await gitSimpleDownload({
  //   outputPath: gitDir,
  //   architecture: target.arch,
  //   platform: target.platform,
  // });

  // Build
  // Build: Replace "dugite"
  // Build: Replace "desktop-trampoline"
  console.log("--- Run 'npm run build' ...");
  execSync('npx lerna exec --scope noodl-editor -- npm run build', {
    stdio: 'inherit',
    env: {
      ...process.env,
      TARGET_PLATFORM
    }
  });
  console.log("--- 'npm run build' done!");

  // TODO: Create a JSON with metadata example data updated in package.json
  // TODO: Create a dump of all npm packages + sizes
})();
