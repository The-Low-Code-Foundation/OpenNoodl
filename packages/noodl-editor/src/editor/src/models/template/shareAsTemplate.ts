/**
 * FB-005 T5 — "Share as template", editor side. **It files a submission and publishes nothing.**
 *
 * ## What this module is
 *
 * The seam. `createFromTemplate.ts` exists because `newProject` cannot be graded by a spec — it
 * reaches `electron-store`, `@noodl/git` and Richard's real launcher list — so the decisions moved
 * to a module plain-Node jest can drive. This is that arrangement for the opposite direction:
 * everything that decides *what leaves this machine* lives here, behind two small host interfaces,
 * and the UI does nothing but collect four strings and render an outcome.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THE PART THAT MATTERS MOST IS WHAT DOES NOT TRAVEL, AND IT IS NOT A TIDINESS RULE.**
 *
 * `readBundleDirectory` on the platform says of itself *"skips nothing silently"*, which is right
 * for a publisher: an operator points it at a directory they prepared. **"Share as template"
 * points at the project the person is working in right now** — with its git history, its editor
 * state, and its machine-specific agent registration in it.
 *
 * `.mcp.json` is the sharp one, and the editor already knows it: `agentConfig.ts` adds it to the
 * project's own `.gitignore` with the reason written out — *"`.mcp.json` holds absolute paths for
 * **this** machine — the runtime, and the bundle inside this install of NodeGX. Committed, it
 * arrives on a colleague's laptop as a registration that points at nothing."* A template is that
 * failure with an audience: the file would be uploaded to a public shelf and written to the disk
 * of everybody who installed it, carrying `/Users/<name>/…` paths out of the author's home
 * directory. **The editor's own gitignore rule is the precedent; this list is that rule applied to
 * a second way out of the folder.**
 *
 * ⚠️ **AND THE EXCLUSIONS ARE A LIST, WHICH MEANS THEY ARE A HYPOTHESIS.** A hazard list is not a
 * measurement — it holds for the paths somebody thought of. So the list is exported, every
 * exclusion is REPORTED rather than dropped in silence (`excluded` on the outcome), and the UI
 * shows what it left out. A person who can see that `.mcp.json` was excluded can also see when
 * something they wanted was.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * @module noodl-editor/models/template/shareAsTemplate
 */

/**
 * Paths that never leave the machine in a template, and why.
 *
 * 🔴 **A DIRECTORY PREFIX OR AN EXACT NAME, MATCHED ON THE POSIX-RELATIVE PATH.** Not a glob and
 * not a regex: this list decides what is withheld from an upload, and a pattern language is a
 * place for a rule to mean something slightly different from what it looks like.
 *
 * ⚠️ Kept beside `AGENT_CONFIG_PATHS` in spirit rather than imported from it, because the two
 * lists answer different questions — that one is *what the editor writes*, this one is *what must
 * not travel*, and they overlap only at `.mcp.json`. Importing would tie a security rule to a
 * convenience one and make a later edit to either silently change the other.
 */
export const NEVER_SHARED: readonly { path: string; directory: boolean; why: string }[] = [
  {
    path: '.mcp.json',
    directory: false,
    why: 'Holds absolute paths to this install of NodeGX. It is already in the project’s .gitignore for the same reason.',
  },
  {
    path: '.nodegx',
    directory: true,
    why: 'The editor and agent’s working state for this folder, not part of the app. Gitignored by default.',
  },
  { path: '.git', directory: true, why: 'Version history, remotes, and any credentials in them.' },
  { path: 'node_modules', directory: true, why: 'Installed dependencies, restored rather than shipped.' },
  {
    path: '.env',
    directory: false,
    why: 'Environment secrets. A template that carried one would publish it.',
  },
  { path: '.DS_Store', directory: false, why: 'Finder metadata.' },
];

/**
 * ⚠️ `.env.local`, `.env.production` and friends, which the exact-name rule above cannot catch.
 * Separate from the list because it is a different KIND of rule and folding it in would make
 * `NEVER_SHARED` a thing readers have to interpret rather than read.
 */
const ENV_FILE = /(^|\/)\.env(\.|$)/;

/** Does this project-relative path stay on the machine? */
export function isNeverShared(path: string): boolean {
  if (ENV_FILE.test(path)) return true;
  return NEVER_SHARED.some((rule) =>
    rule.directory ? path === rule.path || path.startsWith(`${rule.path}/`) : path === rule.path,
  );
}

/** Why a path was withheld, for the sentence the UI shows. */
export function whyNeverShared(path: string): string {
  if (ENV_FILE.test(path)) return 'Environment secrets. A template that carried one would publish it.';
  return NEVER_SHARED.find((rule) =>
    rule.directory ? path === rule.path || path.startsWith(`${rule.path}/`) : path === rule.path,
  )?.why ?? 'Excluded from templates.';
}

/** The half of `@noodl/platform`'s filesystem this module reads. Narrow, so a spec can supply it. */
export interface TemplateReadFs {
  listDirectory(path: string): Promise<{ name: string; fullPath: string; isDirectory: boolean }[]>;
  readFile(path: string): Promise<string>;
}

export type CollectedTemplate = {
  files: Record<string, string>;
  /** Withheld by `NEVER_SHARED`, reported rather than dropped silently. */
  excluded: string[];
  /** Not text, so this transport cannot carry them. See `binaryPaths` on the refusal. */
  binaries: string[];
};

/**
 * 🔴 A NUL **or** a replacement character.
 *
 * The platform's `readBundleDirectory` tests for a NUL byte in a `Buffer`, which is the reliable
 * tell. This side reads through `filesystem.readFile`, which has already decoded to UTF-16 — and
 * decoding a PNG does not necessarily preserve a NUL, it produces U+FFFD where the bytes were not
 * valid UTF-8. **So the byte-level test alone would pass binaries through to a 400 from the
 * platform**, which is a refusal the person cannot act on because it names a rule about jsonb.
 *
 * ⚠️ The cost is a false positive on a text file that genuinely contains U+FFFD, which is a
 * character that means "something was already corrupted here". Refusing to publish that file is
 * the right answer anyway.
 */
function looksBinary(contents: string): boolean {
  // ⚠️ Written as ESCAPES, not as the characters themselves. A literal NUL in a source file
  // makes `grep` treat the whole file as binary and skip it silently — a trap this repo has
  // already recorded — so the one module that reasons about NULs must not contain one.
  return contents.includes('\u0000') || contents.includes('\uFFFD');
}

/**
 * Walk a project directory into the flat, path-keyed map the platform's transport expects.
 *
 * ⚠️ **Recursive rather than `listDirectoryFiles`**, matching `compilation/build/copy.ts`'s choice
 * and for a reason that is load-bearing here: the exclusions are checked at the DIRECTORY level,
 * so `node_modules` is never descended into rather than walked and then filtered. On a project
 * with dependencies installed that is the difference between a share that takes a moment and one
 * that reads tens of thousands of files to throw them away.
 */
export async function collectTemplateFiles(
  fs: TemplateReadFs,
  projectDir: string,
): Promise<CollectedTemplate> {
  const files: Record<string, string> = {};
  const excluded: string[] = [];
  const binaries: string[] = [];

  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await fs.listDirectory(dir);
    for (const entry of entries) {
      // `/` rather than a platform join, matching what the transport keys on — the platform
      // refuses a backslash outright (`isSafeBundlePath`), so producing one here would be a
      // refusal manufactured on this side of the wire.
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;

      if (isNeverShared(rel)) {
        excluded.push(rel);
        continue;
      }
      if (entry.isDirectory) {
        await walk(entry.fullPath, rel);
        continue;
      }
      const contents = await fs.readFile(entry.fullPath);
      if (looksBinary(contents)) {
        binaries.push(rel);
        continue;
      }
      files[rel] = contents;
    }
  };

  await walk(projectDir, '');
  return { files, excluded, binaries };
}

/**
 * The three manifests `ProjectFormatDetector.detect()` accepts, restated — and the same restatement
 * `0020` and `0021` make in SQL.
 *
 * 🔴 Checked HERE as well as in the database, and this is the copy that earns its place: refusing
 * on this side means a person who picked the wrong folder is told so before an 8 MiB upload rather
 * than after one. ⚠️ `components/` alone is deliberately not enough — the detector scores it 1
 * against its own threshold of 2.
 */
const MANIFESTS = ['nodegx.project.json', 'components/_registry.json', 'project.json'];

export function hasProjectManifest(files: Record<string, string>): boolean {
  return MANIFESTS.some((m) => Object.prototype.hasOwnProperty.call(files, m));
}

/**
 * 8 MiB — `MAX_SUBMISSION_BYTES` on the route, and `0021`'s constraint.
 *
 * ⚠️ **A third copy of a number, and it is deliberate.** The alternative is discovering the cap
 * from a 413 at the end of an upload the person waited for. Measured the same way the route
 * measures it — bytes of the JSON body — so the two agree about what they are counting.
 */
export const MAX_TEMPLATE_BYTES = 8 * 1024 * 1024;

export function templatePayloadBytes(files: Record<string, string>): number {
  // `Buffer` is available in this renderer (`nodeIntegration: true`), but a spec should not need
  // it — and `TextEncoder` is what both environments agree on.
  return new TextEncoder().encode(JSON.stringify(files)).length;
}

/**
 * What sharing can come back as.
 *
 * 🔴 **A STRING DISCRIMINANT, and the repo's own trap is why.** This `tsconfig.json` sets no
 * `strict`, so a boolean discriminant does not narrow a union — `CreateFromTemplateOutcome` and
 * `PlatformInstallOutcome` are both string-discriminated for exactly this reason.
 *
 * ⚠️ **`submitted` is not `published`, and the word is chosen to make that hard to get wrong in a
 * later edit.** The one thing a person must not conclude from a success here is that their
 * template is on the shelf.
 */
export type ShareAsTemplateOutcome =
  | { outcome: 'submitted'; submissionId: string; excluded: string[] }
  | { outcome: 'no-manifest'; looked: string[] }
  | { outcome: 'binaries'; paths: string[] }
  | { outcome: 'too-big'; bytes: number; limit: number }
  | { outcome: 'empty' }
  /** No credential, or an expired one. An ordinary fact and the caller's own fix. */
  | { outcome: 'unauthenticated' }
  /** D15 says this surface does not exist for you. ⚠️ Not an error, and not narrated. */
  | { outcome: 'absent' }
  /** The platform refused it, in its own words. Safe to show; it chose them. */
  | { outcome: 'refused'; detail: string }
  | { outcome: 'unreachable'; detail: string };

/** The half of `CommunityApiClient` this module uses — narrow on purpose, and the seam. */
export interface TemplateSubmissionSink {
  submitTemplate(input: {
    proposedSlug: string;
    title: string;
    summary: string;
    category: string;
    attestedLicence: string;
    files: Record<string, string>;
  }): Promise<
    | { outcome: 'ok'; value: { submissionId: string; status: string } }
    | { outcome: 'unauthenticated' }
    | { outcome: 'absent' }
    | { outcome: 'refused'; detail: string }
    | { outcome: 'unreachable'; status: number | null; detail: string }
  >;
}

/**
 * Collect a project and file it as a submission.
 *
 * 🔴 **THE REFUSALS ARE ORDERED SO THE FIRST ONE A PERSON MEETS IS THE ONE THEY CAN ACT ON.**
 * Empty, then no manifest, then binaries, then size. A project with no manifest is usually the
 * wrong folder — telling somebody their 12 MB of images cannot travel, when what they picked was
 * their Downloads directory, is a true sentence about the wrong problem.
 */
export async function shareAsTemplate(
  deps: { fs: TemplateReadFs; sink: TemplateSubmissionSink },
  input: {
    projectDir: string;
    proposedSlug: string;
    title: string;
    summary: string;
    category: string;
    attestedLicence: string;
  },
): Promise<ShareAsTemplateOutcome> {
  const { files, excluded, binaries } = await collectTemplateFiles(deps.fs, input.projectDir);

  if (Object.keys(files).length === 0) return { outcome: 'empty' };
  if (!hasProjectManifest(files)) return { outcome: 'no-manifest', looked: MANIFESTS };
  if (binaries.length > 0) return { outcome: 'binaries', paths: binaries };

  const bytes = templatePayloadBytes(files);
  if (bytes > MAX_TEMPLATE_BYTES) {
    return { outcome: 'too-big', bytes, limit: MAX_TEMPLATE_BYTES };
  }

  const result = await deps.sink.submitTemplate({
    proposedSlug: input.proposedSlug,
    title: input.title,
    summary: input.summary,
    category: input.category,
    attestedLicence: input.attestedLicence,
    files,
  });

  switch (result.outcome) {
    case 'ok':
      // ⚠️ `excluded` travels out with the success so the UI can say what stayed behind. A share
      // that silently withheld a file is the same defect as one that silently sent one.
      return { outcome: 'submitted', submissionId: result.value.submissionId, excluded };
    case 'unauthenticated':
      return { outcome: 'unauthenticated' };
    case 'absent':
      return { outcome: 'absent' };
    case 'refused':
      return { outcome: 'refused', detail: result.detail };
    default:
      return { outcome: 'unreachable', detail: result.detail };
  }
}

/**
 * A slug from a project name — `"A Pricing Page"` → `"a-pricing-page"`.
 *
 * ⚠️ It produces a SUGGESTION, and the platform's `project_template_slug_shape` is the rule. This
 * cannot guarantee a legal slug: a project called `"…"` reduces to the empty string, and one
 * called `"A"` is under the floor of 3. Both come back as a refusal naming `template-slug`, which
 * is the honest outcome — inventing `untitled-1` here would file somebody's template under a name
 * they never chose and did not see.
 */
export function suggestedSlug(projectName: string): string {
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    // ⚠️ A trailing `-` can survive the slice above, and `^[a-z0-9]+(-[a-z0-9]+)*$` refuses it.
    .replace(/-+$/, '');
}
