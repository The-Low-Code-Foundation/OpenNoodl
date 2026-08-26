/**
 * FB-005 T3 — the curated template shelf, as a template provider.
 *
 * ## What this is, in one sentence
 *
 * `EmbeddedTemplateProvider` offers the templates compiled into this editor; this one offers the
 * templates the platform has published, so a template can reach a builder **without shipping a
 * new editor**. It is the second implementation of `ITemplateProvider` that has ever run, and the
 * first that fetches anything.
 *
 * ## 🔴 The URL scheme is `community://<slug>` and it is not the bundle URL
 *
 * `TemplateItem.projectURL` travels through the wizard, into `newProject`, and back out of
 * `resolveTemplateUrl` — it is an **identifier this registry resolves**, not an address anything
 * dereferences. Putting `https://community.nodegx.io/api/…` there would make the picker's rows
 * into fetchable URLs held in React state, which is the shape `TutorialSummary` deliberately
 * refuses (*"a URL nobody can read is a URL nobody can be tempted to fetch"*). The base URL is
 * decided once, here, from `communityorigin`.
 *
 * ## ⚠️ Why the client is built per call rather than held
 *
 * `templateRegistry` is constructed at module load in `utils/forge/index.ts`, and the session
 * token is read **asynchronously** out of the editor's store. A provider that captured a client
 * at construction would capture the signed-out one forever — and D15 answers 404 to an org-owned
 * minor, so that provider would show a pupil templates their school has switched off, or hide
 * ones it has not. `repullFromPlatform` and `useTutorialInstall` both build their client the same
 * way, for the same reason.
 *
 * @module noodl-editor/models/template
 */

import { CommunityApiClient, type Read, type TemplateBundlePayload, type TemplateSummary } from '../community/communityapi';
import { COMMUNITY_URL } from '../community/communityorigin';
import { readCommunitySession } from '../community/communitysession';
import type { ITemplateProvider, TemplateItem } from '../../utils/forge/template/template';

/** The `community://` prefix, in one place — the picker never spells it and neither does a spec. */
export const COMMUNITY_TEMPLATE_SCHEME = 'community://';

/** The half of `CommunityApiClient` this provider uses. Narrow on purpose: it is also the seam. */
export interface TemplateSource {
  templates(): Promise<Read<{ items: TemplateSummary[] }>>;
  templateBundle(slug: string): Promise<Read<TemplateBundlePayload>>;
}

/** The half of `@noodl/platform`'s filesystem this provider uses. */
export interface TemplateWriteFs {
  join(...parts: string[]): string;
  dirname(path: string): string;
  makeDirectory(path: string): Promise<void>;
  /**
   * ⚠️ **`Buffer | string`, matching `IFileSystem.writeFile`'s own `FileBlob`.** The real
   * implementation has always branched on the two (`typeof blob === 'string' ? Buffer.from(blob)
   * : blob`); this interface simply stopped hiding half of it. A decoded font must reach disk as
   * bytes, and a `Buffer` passed through a `string` parameter would be stringified.
   */
  writeFile(path: string, contents: Buffer | string): Promise<void>;
}

/** `community://hello` → `hello`, and `null` for anything this provider does not claim. */
export function slugFromTemplateUrl(url: string): string | null {
  if (typeof url !== 'string' || !url.startsWith(COMMUNITY_TEMPLATE_SCHEME)) return null;
  const slug = url.slice(COMMUNITY_TEMPLATE_SCHEME.length);
  // A slug is a path segment on the platform's routes. Refusing the shapes that are not one here
  // means `encodeURIComponent` never has to rescue a request that should not have been made.
  if (slug === '' || slug.includes('/') || slug.includes('?') || slug.includes('#')) return null;
  return slug;
}

/** `TemplateItem` as the picker draws it. Exported so a spec grades the mapping, not the fetch. */
export function templateItemFor(row: TemplateSummary): TemplateItem {
  return {
    title: row.title,
    desc: row.summary,
    category: row.category,
    // ⚠️ No thumbnail column exists on the platform (T2's stated omission), so this is empty
    // rather than a URL to somewhere. A card draws a title, a category and a file count.
    iconURL: '',
    projectURL: `${COMMUNITY_TEMPLATE_SCHEME}${row.slug}`
  };
}

/**
 * The sentence a caller is shown when a read did not come back `ok`.
 *
 * 🔴 **`subject` IS NOT COSMETIC, and the first version of this function did not have it.** Found
 * by driving, 2026-08-26: with the platform not yet deployed, listing the shelf produced *"that
 * template is no longer on the community shelf"* — a sentence about a template, in a refusal
 * where **no template was named**, because the same string served the list and the install. A
 * 404 on `/templates` means the shelf could not be read; a 404 on `/templates/x/bundle` means
 * *x* is gone. Two different facts, and only one of them is about a template.
 *
 * ⚠️ **This is the failure the spec could not have caught**: both arms were `absent`, both were
 * refused, and asserting *"it refused"* is green on either wording. The instrument that found it
 * was the app.
 *
 * 🔴 **`absent` is not an error, and none of these may narrate permission.** D15 answers 404 for
 * an org minor whose community is switched off, and the same 404 covers a draft and a slug that
 * never existed. A sentence naming permission would tell somebody about a door the platform is
 * deliberately not showing them.
 */
export function refusalSentence(read: { outcome: string; detail?: string }, subject: 'shelf' | 'template'): string {
  switch (read.outcome) {
    case 'absent':
      return subject === 'template'
        ? 'that template is no longer on the community shelf'
        : 'the community shelf is not available to this editor';
    case 'unauthenticated':
      return 'the community sign-in for this editor has expired';
    default:
      return `the community could not be reached: ${read.detail ?? 'no detail'}`;
  }
}

export class PlatformTemplateProvider implements ITemplateProvider {
  constructor(
    private readonly deps: {
      /** Built fresh per call — see the header. */
      source?: () => Promise<TemplateSource>;
      fs?: () => Promise<TemplateWriteFs>;
    } = {}
  ) {}

  get name(): string {
    return 'community-templates';
  }

  private source(): Promise<TemplateSource> {
    if (this.deps.source) return this.deps.source();
    return readCommunitySession().then(
      (session) => new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null })
    );
  }

  private async fs(): Promise<TemplateWriteFs> {
    if (this.deps.fs) return this.deps.fs();
    // Imported lazily for `EmbeddedTemplateProvider`'s reason: `utils/forge/index.ts` constructs
    // the registry at module load, and `@noodl/platform` resolves a real Electron filesystem.
    const { filesystem } = await import('@noodl/platform');
    return filesystem as unknown as TemplateWriteFs;
  }

  /**
   * The shelf.
   *
   * 🔴 **Throws on anything but `ok`, and that is the opposite of defensive.** `TemplateRegistry.list`
   * logs a provider's error and carries on with the rest, so a throw here is *"the community could
   * not answer"* and an empty array is *"the community answered, and the shelf is empty"*. Returning
   * `[]` on a failed read would make an outage look like curation.
   */
  async list(): Promise<ReadonlyArray<TemplateItem>> {
    const source = await this.source();
    const read = await source.templates();
    if (read.outcome !== 'ok') {
      throw new Error(refusalSentence(read, 'shelf'));
    }
    return read.value.items.map(templateItemFor);
  }

  async canInstall(url: string): Promise<boolean> {
    return slugFromTemplateUrl(url) !== null;
  }

  /**
   * Write the published project into `destination`.
   *
   * 🔴 **THE WHOLE BUNDLE IS FETCHED AND CHECKED BEFORE ONE BYTE IS WRITTEN**, and that ordering
   * is AC2 — *"a refusal leaves nothing on disk"* — bought at the only place a multi-file install
   * can honestly buy it. `templateBundle` refuses the entire payload if any single entry is not a
   * relative path or not text, and it does so over a value held in memory. A provider that
   * streamed files as they arrived would be one whose 84th file could fail on a machine where
   * nobody can fix it, leaving 83 files that look like a project.
   *
   * ⚠️ What remains after that is a filesystem failure mid-write — disk full, a permission that
   * changed. `createProjectFromTemplate` removes a directory **it created** when an install
   * refuses, which is where that case is answered; it cannot be answered here, because this
   * provider did not decide the destination and must not delete it.
   */
  async install(url: string, destination: string): Promise<void> {
    const slug = slugFromTemplateUrl(url);
    if (!slug) {
      // Unreachable through the registry, which asks `canInstall` first. Present because a
      // provider whose two methods disagree is a provider that installs the wrong thing.
      throw new Error(`'${url}' is not a community template URL`);
    }

    const source = await this.source();
    const read = await source.templateBundle(slug);
    if (read.outcome !== 'ok') {
      throw new Error(`${slug}: ${refusalSentence(read, 'template')}`);
    }

    const files = read.value.files;
    const binaryFiles = read.value.binaryFiles;
    const paths = Object.keys(files);
    if (paths.length === 0) {
      // `0020`'s `project_template_has_files` refuses this at publish. Checked again because an
      // empty write would otherwise "succeed" into a directory the editor then cannot open, and
      // "Failed to create project from template" is what the user would be told instead.
      throw new Error(`${slug}: the community sent a template with no files in it`);
    }

    const fs = await this.fs();
    await fs.makeDirectory(destination);
    for (const path of paths) {
      const full = fs.join(destination, path);
      // Every entry may be nested, and the parent may not exist yet. `makeDirectory` is mkdirp
      // and idempotent, so this costs a stat per file rather than a branch that can be wrong.
      await fs.makeDirectory(fs.dirname(full));
      await fs.writeFile(full, files[path]);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // 🔴 **THE DECODE, AND IT IS THE ONLY PLACE A TEMPLATE'S BYTES COME BACK (`0023`).** The
    // fonts and images the author owns travel as base64 because the transport is jsonb; this loop
    // is what makes them files again.
    //
    // ⚠️ **A SECOND LOOP RATHER THAN A BRANCH INSIDE THE FIRST**, because the two maps are two
    // sources and a merged iteration would need a predicate to tell them apart — which is exactly
    // the sentinel-in-the-value design `0023` rejected. The order between them is free:
    // `..._binary_files_disjoint` on the platform and `readBundlePayload` on this side both
    // refuse a path that appears in both, so neither loop can overwrite the other's file.
    //
    // 🔴 **`Buffer.from(x, 'base64')` DOES NOT THROW ON RUBBISH — IT TRUNCATES.** That is why the
    // shape is gated at publish (`..._binary_files_base64`) rather than caught here: by this
    // point the only thing this code could do is write a short file, and there is nothing to
    // compare it against.
    for (const path of Object.keys(binaryFiles)) {
      const full = fs.join(destination, path);
      await fs.makeDirectory(fs.dirname(full));
      await fs.writeFile(full, Buffer.from(binaryFiles[path], 'base64'));
    }
  }
}
