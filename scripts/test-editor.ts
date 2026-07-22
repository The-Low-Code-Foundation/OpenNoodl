import path from "path";
import { execSync } from "child_process";

const CWD = path.join(__dirname, "..");
const LOCAL_GIT_DIRECTORY = path.join(
  __dirname,
  "..",
  "node_modules",
  "dugite",
  "git"
);
const LOCAL_GIT_TRAMPOLINE_DIRECTORY = path.join(
  __dirname,
  "..",
  "node_modules",
  "desktop-trampoline/build/Release/desktop-trampoline"
);

console.log("---");
console.log(`> CWD: `, CWD);
console.log(`> LOCAL_GIT_DIRECTORY: `, LOCAL_GIT_DIRECTORY);
console.log(
  `> LOCAL_GIT_TRAMPOLINE_DIRECTORY: `,
  LOCAL_GIT_TRAMPOLINE_DIRECTORY
);
console.log("---");

// `--ci` builds the bundle to disk and runs Electron with a hidden window.
const script = process.argv.includes("--ci") ? "test:ci" : "test";

const env: NodeJS.ProcessEnv = {
  ...process.env,
  LOCAL_GIT_DIRECTORY,
  LOCAL_GIT_TRAMPOLINE_DIRECTORY,
};

// Electron boots as a plain Node process when this is set — VS Code sets it in
// integrated terminals — which makes `electron.app` undefined before any spec runs.
delete env.ELECTRON_RUN_AS_NODE;

try {
  execSync(`npx lerna exec --scope noodl-editor -- npm run ${script}`, {
    cwd: CWD,
    stdio: "inherit",
    env,
  });
} catch (err: any) {
  process.exit(typeof err?.status === "number" ? err.status : 1);
}
