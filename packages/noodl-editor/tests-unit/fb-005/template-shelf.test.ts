/**
 * FB-005 T3 — "New project from a template", from the picker to the files on disk.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 **WHAT THIS FILE IS GUARDING AGAINST IS T1's FINDING REPEATING ONE LAYER UP.** T1 found a
 * complete template mechanism — registry, interface, four providers, all typechecking — reached
 * by nobody, because the one call site passed `''`. A spec over `PlatformTemplateProvider` alone
 * would be green through exactly that outage again: the provider would work, the registry would
 * hold it, and no screen would ever ask. So this file grades three things, and the third is the
 * one a unit test does not usually cover:
 *
 *   1. **The provider** — what it fetches, what it refuses, and what it writes.
 *   2. **The listing** — that a provider which cannot answer produces a *reported* short shelf
 *      rather than a silently short one.
 *   3. **Reach** — that the wizard's chosen URL survives `onConfirm` → `newProject`. That is a
 *      caller-grep made executable, and it is the assertion that would have caught `''`.
 *
 * ⚠️ **What a green run here does not prove**: that a community template installs into a project
 * that opens and renders. Nothing here has a running platform or a real disk. The provider's
 * writes go through an injected filesystem, and AC2's *"a refusal leaves nothing on disk"* is
 * graded as a decision (`removeDirectory` called, and only when this module created the
 * directory), not as an observation of a filesystem.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { CommunityApiClient, readBundlePayload, type Read } from '@noodl-models/community/communityapi';
import { createProjectFromTemplate, type CreateFromTemplateDeps } from '@noodl-models/template/createFromTemplate';
import {
  PlatformTemplateProvider,
  refusalSentence,
  slugFromTemplateUrl,
  templateItemFor,
  type TemplateSource,
  type TemplateWriteFs
} from '@noodl-models/template/PlatformTemplateProvider';
import { EmbeddedTemplateProvider } from '@noodl-models/template/EmbeddedTemplateProvider';
import { DEFAULT_PROJECT_TEMPLATE, templateRegistry } from '@noodl-utils/forge';
import { TemplateRegistry } from '@noodl-utils/forge/template/template-registry';
import type { ITemplateProvider, TemplateItem } from '@noodl-utils/forge/template/template';

import {
  TemplateStepBody,
  type TemplateChoice
} from '../../../noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/TemplateStep';

import { galleryFromListing } from '../../src/editor/src/hooks/useProjectTemplates';
import { byClass, render, stripComments, text, walk } from '../support/renderElements';

const EDITOR_SRC = join(__dirname, '../../src/editor/src');
const CORE_UI_SRC = join(__dirname, '../../../noodl-core-ui/src');

function sourceOf(root: string, relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

// ── 1. The URL scheme ─────────────────────────────────────────────────────────

describe('FB-005 T3 — community:// is an identifier the registry resolves, not an address', () => {
  it('reads the slug out of a community URL', () => {
    expect(slugFromTemplateUrl('community://starter-crm')).toBe('starter-crm');
  });

  it('does not claim the embedded scheme', () => {
    // The agreement that makes provider ORDER not matter for installs: no two providers claim
    // each other's URLs, so which one installs a template is decided by the template.
    expect(slugFromTemplateUrl('embedded://hello-world')).toBeNull();
  });

  it('refuses an empty slug', () => {
    expect(slugFromTemplateUrl('community://')).toBeNull();
  });

  it('refuses a slug carrying a path, a query or a fragment', () => {
    // 🔴 Not decoration. `templateBundle` interpolates the slug into a route; refusing the
    // shapes that are not one path segment means `encodeURIComponent` never has to rescue a
    // request that should not have been made.
    expect(slugFromTemplateUrl('community://a/../b')).toBeNull();
    expect(slugFromTemplateUrl('community://a?b=c')).toBeNull();
    expect(slugFromTemplateUrl('community://a#b')).toBeNull();
  });

  it('refuses a value that is not a string at all', () => {
    expect(slugFromTemplateUrl(undefined as unknown as string)).toBeNull();
  });
});

describe('templateItemFor', () => {
  const row = {
    slug: 'starter-crm',
    title: 'Starter CRM',
    summary: 'Contacts, companies and a deal board.',
    category: 'data-app',
    version: 3,
    fileCount: 41,
    // FB-005 T5. ⚠️ `null` because this fixture is a CURATED row — one we published — and null is
    // what the platform stores for those. A third-party template carries the licence its
    // submitter attested.
    attestedLicence: null,
    updatedAt: '2026-08-26T00:00:00.000Z'
  };

  it('turns a shelf row into a picker row whose URL the registry can install', () => {
    expect(templateItemFor(row)).toEqual({
      title: 'Starter CRM',
      desc: 'Contacts, companies and a deal board.',
      category: 'data-app',
      iconURL: '',
      projectURL: 'community://starter-crm'
    });
  });

  it('produces a URL the provider itself claims', () => {
    // The round trip. A mapper and a matcher that disagree is a picker whose rows cannot be
    // installed, and both halves would pass their own tests.
    return new PlatformTemplateProvider().canInstall(templateItemFor(row).projectURL).then((claims) => {
      expect(claims).toBe(true);
    });
  });

  it('carries no thumbnail URL, because the platform has no column for one', () => {
    expect(templateItemFor(row).iconURL).toBe('');
  });
});

describe('refusalSentence', () => {
  it('never narrates permission, on any outcome or subject', () => {
    // 🔴 D15 answers 404 for an org minor whose community is switched off, and the same 404
    // covers a draft and a slug that never existed. A sentence that named permission would tell
    // somebody about a door the platform is deliberately not showing them.
    for (const subject of ['shelf', 'template'] as const) {
      for (const outcome of ['absent', 'unauthenticated', 'unreachable']) {
        expect(refusalSentence({ outcome }, subject)).not.toMatch(/permission|not allowed|forbidden/i);
      }
    }
  });

  it('does NOT name a template when no template was asked for', () => {
    // 🔴 FOUND BY DRIVING, 2026-08-26. With the platform undeployed, listing the shelf produced
    // "that template is no longer on the community shelf" — a sentence about a template, in a
    // refusal where none was named, because one string served both reads. Both arms are
    // `absent`, both are refusals, and a spec asserting only "it refused" is green on either.
    expect(refusalSentence({ outcome: 'absent' }, 'shelf')).not.toContain('that template');
  });

  it('DOES name a template when one was, and the two differ', () => {
    // The control. Without it, the assertion above passes on a function that says nothing.
    const template = refusalSentence({ outcome: 'absent' }, 'template');
    expect(template).toContain('template');
    expect(template).not.toBe(refusalSentence({ outcome: 'absent' }, 'shelf'));
  });

  it('tells the three outcomes apart', () => {
    const absent = refusalSentence({ outcome: 'absent' }, 'template');
    const expired = refusalSentence({ outcome: 'unauthenticated' }, 'template');
    const down = refusalSentence({ outcome: 'unreachable', detail: 'HTTP 500' }, 'template');
    expect(new Set([absent, expired, down]).size).toBe(3);
    expect(down).toContain('HTTP 500');
  });

  it('a shelf that could not be read does not blame a template, end to end', async () => {
    // The behavioural arm, driven through the provider rather than the helper — which is the
    // level the defect actually appeared at.
    const provider = providerWith(fakeSource({ templates: async () => ({ outcome: 'absent' }) }));
    await expect(provider.list()).rejects.toThrow(/shelf is not available/);
    await expect(provider.list()).rejects.not.toThrow(/that template/);
  });
});

// ── 2. The provider ───────────────────────────────────────────────────────────

function fakeSource(overrides: Partial<TemplateSource> = {}): TemplateSource {
  return {
    templates: async () => ({ outcome: 'ok', value: { items: [] } }),
    templateBundle: async () => ({ outcome: 'absent' }),
    ...overrides
  };
}

function fakeFs() {
  const written = new Map<string, string>();
  const directories: string[] = [];
  const fs: TemplateWriteFs = {
    join: (...parts: string[]) => parts.join('/'),
    dirname: (path: string) => path.slice(0, path.lastIndexOf('/')),
    makeDirectory: async (path: string) => {
      directories.push(path);
    },
    writeFile: async (path: string, contents: string) => {
      written.set(path, contents);
    }
  };
  return { fs, written, directories };
}

function providerWith(source: TemplateSource, fs?: TemplateWriteFs) {
  return new PlatformTemplateProvider({
    source: async () => source,
    fs: fs ? async () => fs : undefined
  });
}

describe('PlatformTemplateProvider.list', () => {
  it('maps the shelf into picker rows', async () => {
    const provider = providerWith(
      fakeSource({
        templates: async () => ({
          outcome: 'ok',
          value: {
            items: [
              {
                slug: 'a',
                title: 'A',
                summary: 's',
                category: 'starter',
                version: 1,
                fileCount: 2,
                attestedLicence: null,
                updatedAt: ''
              }
            ]
          }
        })
      })
    );
    const items = await provider.list();
    expect(items.map((i) => i.projectURL)).toEqual(['community://a']);
  });

  it('returns an empty list when the platform answers with an empty shelf', async () => {
    // 🔴 THE CONTROL FOR THE NEXT TEST, and it is the whole point of the pair. Without it,
    // "throws when unreachable" is consistent with a provider that throws on everything.
    const provider = providerWith(fakeSource());
    await expect(provider.list()).resolves.toEqual([]);
  });

  it('THROWS when the community could not answer, rather than returning an empty list', async () => {
    // 🔴 An empty array and a failed read are the same length. `TemplateRegistry.listing` can
    // only report "this shelf is short because a provider failed" if the provider says so, and
    // a provider that swallowed the failure would make an outage look like curation.
    const provider = providerWith(
      fakeSource({ templates: async () => ({ outcome: 'unreachable', status: null, detail: 'ENOTFOUND' }) })
    );
    await expect(provider.list()).rejects.toThrow('ENOTFOUND');
  });

  it('throws on an absent shelf too — D15 refusing is still not an empty shelf', async () => {
    const provider = providerWith(fakeSource({ templates: async () => ({ outcome: 'absent' }) }));
    await expect(provider.list()).rejects.toThrow(/shelf/);
  });

  it('names the SHELF, not a template, when the shelf is what could not be read', async () => {
    const provider = providerWith(fakeSource({ templates: async () => ({ outcome: 'absent' }) }));
    await expect(provider.list()).rejects.toThrow(/shelf is not available/);
  });
});

describe('PlatformTemplateProvider.install', () => {
  const bundle = {
    outcome: 'ok' as const,
    value: {
      slug: 'starter',
      title: 'Starter',
      version: 1,
      updatedAt: '',
      files: {
        'project.json': '{"name":"Starter"}',
        'components/Home.json': '{"id":"home"}'
      }
    }
  };

  it('writes every file of the bundle under the destination', async () => {
    const { fs, written } = fakeFs();
    await providerWith(fakeSource({ templateBundle: async () => bundle }), fs).install(
      'community://starter',
      '/projects/mine'
    );
    expect([...written.keys()].sort()).toEqual(['/projects/mine/components/Home.json', '/projects/mine/project.json']);
    expect(written.get('/projects/mine/project.json')).toBe('{"name":"Starter"}');
  });

  it('makes the parent directory of a nested entry', async () => {
    const { fs, directories } = fakeFs();
    await providerWith(fakeSource({ templateBundle: async () => bundle }), fs).install(
      'community://starter',
      '/projects/mine'
    );
    expect(directories).toContain('/projects/mine/components');
  });

  it('asks the platform for the slug in the URL, and only that', async () => {
    const asked: string[] = [];
    const { fs } = fakeFs();
    await providerWith(
      fakeSource({
        templateBundle: async (slug) => {
          asked.push(slug);
          return bundle;
        }
      }),
      fs
    ).install('community://starter', '/projects/mine');
    expect(asked).toEqual(['starter']);
  });

  it('WRITES NOTHING when the bundle cannot be read — AC2, at the only place it can be bought', async () => {
    // 🔴 The whole bundle is fetched and checked before one byte is written. A provider that
    // streamed files as they arrived would be one whose 84th file could fail on a machine
    // where nobody can fix it, leaving 83 files that look like a project.
    const { fs, written, directories } = fakeFs();
    const provider = providerWith(
      fakeSource({ templateBundle: async () => ({ outcome: 'unreachable', status: 500, detail: 'HTTP 500' }) }),
      fs
    );
    await expect(provider.install('community://starter', '/projects/mine')).rejects.toThrow('HTTP 500');
    expect(written.size).toBe(0);
    expect(directories).toEqual([]);
  });

  it('names the template in the refusal, so a picker row can be blamed', async () => {
    const { fs } = fakeFs();
    const provider = providerWith(fakeSource({ templateBundle: async () => ({ outcome: 'absent' }) }), fs);
    await expect(provider.install('community://gone', '/projects/mine')).rejects.toThrow('gone');
  });

  it('refuses a bundle with no files rather than "succeeding" into an empty directory', async () => {
    // `0020`'s `project_template_has_files` refuses this at publish. Checked again because the
    // failure it prevents here is the editor answering "Failed to create project from template"
    // about a directory this provider reported it had filled.
    const { fs, written } = fakeFs();
    const provider = providerWith(
      fakeSource({
        templateBundle: async () => ({
          outcome: 'ok',
          value: { slug: 's', title: 'S', version: 1, updatedAt: '', files: {} }
        })
      }),
      fs
    );
    await expect(provider.install('community://s', '/projects/mine')).rejects.toThrow(/no files/);
    expect(written.size).toBe(0);
  });

  it('refuses a URL it does not claim, even asked directly', async () => {
    const { fs } = fakeFs();
    await expect(
      providerWith(fakeSource(), fs).install('embedded://hello-world', '/projects/mine')
    ).rejects.toThrow(/not a community template URL/);
  });
});

// ── 3. The listing: a short shelf that says it is short ───────────────────────

function fakeProvider(name: string, overrides: Partial<ITemplateProvider> = {}): ITemplateProvider {
  return {
    get name() {
      return name;
    },
    list: async () => [],
    canInstall: async () => false,
    install: async () => undefined,
    ...overrides
  } as ITemplateProvider;
}

const item = (url: string): TemplateItem => ({
  title: url,
  desc: '',
  category: '',
  iconURL: '',
  projectURL: url
});

describe('TemplateRegistry.listing', () => {
  it('tags each row with the provider that supplied it', async () => {
    const registry = new TemplateRegistry([
      fakeProvider('embedded-templates', { list: async () => [item('embedded://a')] }),
      fakeProvider('community-templates', { list: async () => [item('community://b')] })
    ]);
    const listing = await registry.listing({});
    expect(listing.items.map((e) => e.provider)).toEqual(['embedded-templates', 'community-templates']);
    expect(listing.failures).toEqual([]);
  });

  it('records a provider that could not answer, and keeps the others rows', async () => {
    const registry = new TemplateRegistry([
      fakeProvider('community-templates', {
        list: async () => {
          throw new Error('offline');
        }
      }),
      fakeProvider('embedded-templates', { list: async () => [item('embedded://a')] })
    ]);
    const listing = await registry.listing({});
    expect(listing.items.map((e) => e.item.projectURL)).toEqual(['embedded://a']);
    expect(listing.failures).toEqual([{ provider: 'community-templates', reason: 'offline' }]);
  });

  it('asks every provider even after one has failed', async () => {
    // A failure that short-circuited the loop would hide a working shelf behind a broken one.
    const asked: string[] = [];
    const registry = new TemplateRegistry([
      fakeProvider('a', {
        list: async () => {
          asked.push('a');
          throw new Error('no');
        }
      }),
      fakeProvider('b', {
        list: async () => {
          asked.push('b');
          return [];
        }
      })
    ]);
    await registry.listing({});
    expect(asked).toEqual(['a', 'b']);
  });

  it('list() is listing() with the failures dropped', async () => {
    const registry = new TemplateRegistry([
      fakeProvider('breaks', {
        list: async () => {
          throw new Error('offline');
        }
      }),
      fakeProvider('works', { list: async () => [item('a://b')] })
    ]);
    expect((await registry.list({})).map((i) => i.projectURL)).toEqual(['a://b']);
  });
});

describe('galleryFromListing', () => {
  it('labels a row by where it came from', () => {
    const gallery = galleryFromListing({
      items: [{ provider: 'community-templates', item: item('community://a') }],
      failures: []
    });
    expect(gallery.items[0].origin).toBe('Community');
    expect(gallery.partial).toBeUndefined();
  });

  it('says nothing about a shelf that is genuinely empty', () => {
    // 🔴 The control. "Empty" and "could not be read" are the same array, and a gallery that
    // apologised for both would train people to ignore the sentence that matters.
    expect(galleryFromListing({ items: [], failures: [] }).partial).toBeUndefined();
  });

  it('says the list may be short when a provider failed, naming which one', () => {
    const gallery = galleryFromListing({
      items: [{ provider: 'embedded-templates', item: item('embedded://a') }],
      failures: [{ provider: 'community-templates', reason: 'ENOTFOUND' }]
    });
    expect(gallery.items).toHaveLength(1);
    expect(gallery.partial).toContain('Community');
    // ⚠️ The user's sentence, not ours: the technical detail belongs in the console.
    expect(gallery.partial).not.toContain('ENOTFOUND');
  });

  it('falls back to a provider’s raw name rather than dropping the badge', () => {
    const gallery = galleryFromListing({ items: [{ provider: 'org-shelf', item: item('org://a') }], failures: [] });
    expect(gallery.items[0].origin).toBe('org-shelf');
  });
});

// ── 4. The composed registry ──────────────────────────────────────────────────

describe('the registry the editor actually ships', () => {
  it('holds the community provider as well as the embedded one', () => {
    expect(templateRegistry.providers.map((p) => p.name)).toEqual(['embedded-templates', 'community-templates']);
  });

  it('claims a community URL', async () => {
    const claims = await Promise.all(templateRegistry.providers.map((p) => p.canInstall('community://x')));
    expect(claims).toContain(true);
  });

  it('puts the offline provider first, so the first card is drawable with no network', () => {
    expect(templateRegistry.providers[0].name).toBe('embedded-templates');
  });
});

// ── 5. AC2: a refusal leaves nothing on disk ──────────────────────────────────

function cleanupDeps(overrides: Partial<CreateFromTemplateDeps> = {}) {
  const order: string[] = [];
  const removed: string[] = [];
  const deps: CreateFromTemplateDeps = {
    makeDirectory: async () => {
      order.push('makeDirectory');
    },
    installTemplate: async () => {
      order.push('installTemplate');
      throw new Error('the community sent half a project');
    },
    installStarterAssets: async () => undefined,
    writeAgentConfig: async () => undefined,
    directoryExists: () => {
      order.push('directoryExists');
      return false;
    },
    removeDirectory: (directory) => {
      order.push('removeDirectory');
      removed.push(directory);
    },
    ...overrides
  };
  return { deps, order, removed };
}

describe('createProjectFromTemplate — AC2', () => {
  it('removes the directory it created when the install refuses', async () => {
    const { deps, removed } = cleanupDeps();
    const outcome = await createProjectFromTemplate({ destination: '/projects/mine', projectName: 'P' }, deps);
    expect(outcome.status).toBe('refused');
    expect(outcome.status === 'refused' && outcome.removed).toBe(true);
    expect(removed).toEqual(['/projects/mine']);
  });

  it('asks whether the directory exists BEFORE making it', async () => {
    // 🔴 The ordering is the entire precondition. Asked afterwards, the answer is always "yes"
    // and the cleanup would never run; asked before `makeDirectory` and inverted, it would
    // delete directories the caller chose and filled.
    //
    // 🔴 **PRESENCE IS ASSERTED FIRST, AND THAT IS NOT BELT-AND-BRACES — IT IS THE WHOLE TEST.**
    // Written as `indexOf(a) < indexOf(b)` alone, this passed a mutant that deleted the
    // `directoryExists` call outright: a missing entry gives `indexOf` **-1**, and `-1 < 0` is
    // true. So the version that survived could not tell *asked first* from *never asked* — the
    // two things this assertion exists to distinguish. Found by mutation, 2026-08-26.
    const { deps, order } = cleanupDeps();
    await createProjectFromTemplate({ destination: '/projects/mine', projectName: 'P' }, deps);
    expect(order).toContain('directoryExists');
    expect(order).toContain('makeDirectory');
    expect(order.indexOf('directoryExists')).toBeLessThan(order.indexOf('makeDirectory'));
  });

  it('LEAVES a directory that was already there — the destructive mistake stays refused', async () => {
    // 🔴 The control, and the more important half. T1 left every directory behind precisely
    // because deleting one the caller chose is worse than leaving an empty one.
    const { deps, removed } = cleanupDeps({ directoryExists: () => true });
    const outcome = await createProjectFromTemplate({ destination: '/projects/existing', projectName: 'P' }, deps);
    expect(outcome.status === 'refused' && outcome.removed).toBe(false);
    expect(removed).toEqual([]);
  });

  it('removes nothing on a creation that succeeded', async () => {
    const { deps, removed } = cleanupDeps({ installTemplate: async () => undefined });
    const outcome = await createProjectFromTemplate({ destination: '/projects/mine', projectName: 'P' }, deps);
    expect(outcome.status).toBe('created');
    expect(removed).toEqual([]);
  });

  it('keeps T1’s behaviour for a caller that supplies neither dep', async () => {
    const { deps } = cleanupDeps({ directoryExists: undefined, removeDirectory: undefined });
    const outcome = await createProjectFromTemplate({ destination: '/projects/mine', projectName: 'P' }, deps);
    expect(outcome.status === 'refused' && outcome.removed).toBe(false);
  });

  it('reports the INSTALL’s reason when the cleanup also fails', async () => {
    // A refusal that then failed to tidy up is still a refusal. Reporting the removal's error
    // instead would name the wrong thing at the one moment somebody needs the right one.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { deps } = cleanupDeps({
        removeDirectory: () => {
          throw new Error('EBUSY');
        }
      });
      const outcome = await createProjectFromTemplate({ destination: '/projects/mine', projectName: 'P' }, deps);
      expect(outcome.status === 'refused' && outcome.reason).toContain('half a project');
      expect(outcome.status === 'refused' && outcome.removed).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

// ── 6. The wire ───────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response;
}

describe('CommunityApiClient.templates', () => {
  const client = (impl: typeof fetch) => new CommunityApiClient({ baseUrl: 'https://c.test', fetchImpl: impl });

  it('reads the shelf', async () => {
    const read = await client(async () =>
      jsonResponse({
        items: [
          { slug: 'a', title: 'A', summary: 's', category: 'starter', version: 2, fileCount: 9, updatedAt: 'z' }
        ]
      })
    ).templates();
    expect(read.outcome).toBe('ok');
    expect(read.outcome === 'ok' && read.value.items[0]).toEqual({
      slug: 'a',
      title: 'A',
      summary: 's',
      category: 'starter',
      version: 2,
      fileCount: 9,
      // 🔴 FB-005 T5, and this assertion is worth more than it looks: the PAYLOAD above carries no
      // `attestedLicence` field at all — it is an older platform's response — and the reader turns
      // that into `null` rather than `undefined`. Both mean "no third-party attestation to show",
      // which is why the two are safe to conflate here and nowhere that decides visibility.
      attestedLicence: null,
      updatedAt: 'z'
    });
  });

  it('drops a row with no slug rather than inventing one', async () => {
    const read = await client(async () => jsonResponse({ items: [{ title: 'no slug' }, { slug: 'b', title: 'B' }] }))
      .templates();
    expect(read.outcome === 'ok' && read.value.items.map((i) => i.slug)).toEqual(['b']);
  });

  it('reports a payload it could not read as unreachable, not as an empty shelf', async () => {
    const read = await client(async () => jsonResponse({ items: 'not an array' })).templates();
    expect(read.outcome).toBe('unreachable');
  });

  it('reports D15’s 404 as absent', async () => {
    const read = await client(async () => jsonResponse({}, 404)).templates();
    expect(read.outcome).toBe('absent');
  });

  it('requests the templates route', async () => {
    let url = '';
    await client(async (input: RequestInfo | URL) => {
      url = String(input);
      return jsonResponse({ items: [] });
    }).templates();
    expect(url).toBe('https://c.test/api/v1/community/templates');
  });

  it('encodes a slug into the bundle route', async () => {
    let url = '';
    await client(async (input: RequestInfo | URL) => {
      url = String(input);
      return jsonResponse({}, 404);
    }).templateBundle('a b');
    expect(url).toBe('https://c.test/api/v1/community/templates/a%20b/bundle');
  });
});

describe('readBundlePayload — one copy, two shelves', () => {
  it('accepts a bundle of relative paths', () => {
    const read = readBundlePayload({ slug: 's', title: 'S', version: 2, updatedAt: 'z', files: { 'a.json': '{}' } });
    expect(read.outcome === 'ok' && read.value.files).toEqual({ 'a.json': '{}' });
  });

  it('refuses the WHOLE bundle for one traversing entry', async () => {
    // 🔴 Dropping the entry and installing the rest would produce a project that is quietly not
    // the one that was published — and the dropped file is exactly the one an attacker chose.
    const read = readBundlePayload({
      slug: 's',
      title: 'S',
      version: 1,
      updatedAt: '',
      files: { 'a.json': '{}', '../../.ssh/authorized_keys': 'x' }
    }) as Extract<Read<unknown>, { outcome: 'unreachable' }>;
    expect(read.outcome).toBe('unreachable');
    expect(read.detail).toContain('authorized_keys');
  });

  it('refuses an absolute path', () => {
    expect(readBundlePayload({ slug: 's', files: { '/etc/passwd': 'x' } }).outcome).toBe('unreachable');
  });

  it('refuses an entry that is not text', () => {
    expect(readBundlePayload({ slug: 's', files: { 'a.json': 5 } }).outcome).toBe('unreachable');
  });

  it('refuses a files value that is an array rather than an object', () => {
    expect(readBundlePayload({ slug: 's', files: ['a.json'] }).outcome).toBe('unreachable');
  });

  it('falls back to the slug when the platform sends no title', () => {
    const read = readBundlePayload({ slug: 's', files: { 'a.json': '{}' } });
    expect(read.outcome === 'ok' && read.value.title).toBe('s');
  });
});

// ── 7. Reach: the chosen URL survives the click ───────────────────────────────

describe('FB-005 T3 — the picker’s choice reaches newProject', () => {
  const projectsPage = stripComments(sourceOf(EDITOR_SRC, 'pages/ProjectsPage/ProjectsPage.tsx'));
  const wizard = stripComments(
    sourceOf(CORE_UI_SRC, 'preview/launcher/Launcher/components/ProjectCreationWizard/ProjectCreationWizard.tsx')
  );

  it('strips comments, so prose about a value does not read as a use of it', () => {
    // The two-sided control. The phrase below exists only in `ProjectsPage`'s prose; the
    // identifier below it exists only in its code.
    const raw = sourceOf(EDITOR_SRC, 'pages/ProjectsPage/ProjectsPage.tsx');
    expect(raw).toContain("template's own styling is not overwritten");
    expect(projectsPage).not.toContain("template's own styling is not overwritten");
    expect(projectsPage).toContain('useProjectTemplates');
  });

  it('the wizard hands its chosen template URL to onConfirm', () => {
    expect(wizard).toContain('selectedTemplateUrl');
    expect(wizard).toMatch(/onConfirm\([\s\S]*?selectedTemplateUrl/);
  });

  it('the wizard sends an empty URL in every mode but template', () => {
    // 🔴 The assertion that stops a leftover choice creating a project from a template the
    // user backed out of. `''` is what `resolveTemplateUrl` maps to the default.
    expect(wizard).toContain("mode === 'template' ? selectedTemplateUrl : ''");
  });

  it('ProjectsPage passes the wizard’s URL to newProject as projectTemplate', () => {
    // 🔴 THE ASSERTION THAT WOULD HAVE CAUGHT T1's OUTAGE. This call site passed the literal
    // `projectTemplate: ''` for the entire life of the registry, so every provider registered
    // in it was unreachable while typechecking perfectly.
    expect(projectsPage).toContain('projectTemplate: templateUrl');
    expect(projectsPage).not.toContain("projectTemplate: ''");
  });

  it('ProjectsPage supplies the shelf to the wizard', () => {
    expect(projectsPage).toContain('templates={projectTemplates}');
  });

  it('the picker is fed from the registry, and nowhere else', () => {
    const hook = stripComments(sourceOf(EDITOR_SRC, 'hooks/useProjectTemplates.ts'));
    expect(hook).toContain('templateRegistry');
    expect(hook).toContain('.listing(');
    // A hook that reached the community client directly would bypass the embedded provider,
    // and the picker would be empty with no network.
    expect(hook).not.toContain('CommunityApiClient');
  });
});

// ── 8. The picker, rendered ───────────────────────────────────────────────────

/**
 * 🔴 **RENDERED, NOT GREPPED.** `NAT-005`'s walker evaluates a React element tree in a runner
 * with no DOM, and the reason it is worth the trouble here is stated in its own header: source
 * analysis *"cannot tell a component that draws nothing from one that was never called"*. The
 * three states below are claims about what a person sees, and a `toContain` over the `.tsx` is
 * green on all three even if the component returns `null`.
 */
describe('TemplateStepBody — the three states are three different screens', () => {
  const rows: TemplateChoice[] = [
    { url: 'embedded://hello-world', title: 'Hello World', description: 'A blank start.', category: 'starter', origin: 'Built in' },
    { url: 'community://crm', title: 'Starter CRM', description: 'Contacts and deals.', category: 'data-app', origin: 'Community' }
  ];

  const draw = (gallery: Parameters<typeof TemplateStepBody>[0]['gallery'], selectedUrl = '') =>
    render(TemplateStepBody({ gallery, selectedUrl, onSelect: () => undefined }));

  it('says it is looking while the shelf is being read', () => {
    const tree = draw({ items: [], isLoading: true });
    expect(text(tree)).toContain('Looking for templates');
    expect(byClass(tree, 'TemplateCard')).toHaveLength(0);
  });

  it('says the shelf is empty only once the read has finished', () => {
    // 🔴 The pair that matters. "Loading" and "there is nothing" are opposite sentences, and a
    // screen that showed the second while still fetching would tell somebody to go back.
    const tree = draw({ items: [], isLoading: false });
    expect(text(tree)).toContain('no templates to start from');
    expect(text(tree)).not.toContain('Looking for templates');
  });

  it('draws one card per template, with its origin and category', () => {
    const tree = draw({ items: rows, isLoading: false });
    expect(byClass(tree, 'TemplateCard')).toHaveLength(2);
    const words = text(tree);
    expect(words).toContain('Hello World');
    expect(words).toContain('Starter CRM');
    expect(words).toContain('Community');
    // 🔴 CHANGED BY T4, and the pair is the point. T3 asserted the raw slug `data-app`, which is
    // what the card genuinely drew: the category vocabulary was ruled to the platform's machine
    // slugs on 2026-08-26, and nothing turned them back into words on the way to a person. T4
    // added `categoryLabel`, so the assertion is now that the label is drawn AND the slug is not
    // — a `toContain` on the label alone would stay green if both were drawn side by side.
    expect(words).toContain('Data app');
    expect(words).not.toContain('data-app');
  });

  it('marks the chosen card in TEXT, not only in colour', () => {
    // 🔴 FB-002 shipped a selected pill at 1.16:1 against its panel: every individual label
    // passed AA while *which one is on* did not. A word survives any contrast failure.
    const tree = draw({ items: rows, isLoading: false }, 'community://crm');
    const selected = walk(tree).filter((n) => n.props['aria-pressed'] === true);
    expect(selected).toHaveLength(1);
    expect(text(tree)).toContain('Selected');
  });

  it('marks nothing when nothing has been chosen', () => {
    // The control: `aria-pressed` must discriminate, not simply be present.
    const tree = draw({ items: rows, isLoading: false });
    expect(walk(tree).filter((n) => n.props['aria-pressed'] === true)).toHaveLength(0);
    expect(text(tree)).not.toContain('Selected');
  });

  it('reports a short shelf BESIDE its rows, never instead of them', () => {
    // The community provider failing leaves the embedded templates. The screen has to show
    // both facts at once or it is lying about one of them.
    const tree = draw({
      items: [rows[0]],
      isLoading: false,
      partial: 'Some templates could not be loaded (Community), so this list may be short.'
    });
    expect(text(tree)).toContain('may be short');
    expect(byClass(tree, 'TemplateCard')).toHaveLength(1);
  });

  it('says nothing about a complete shelf', () => {
    const tree = draw({ items: rows, isLoading: false });
    expect(byClass(tree, 'TemplateStep-notice')).toHaveLength(0);
  });

  it('offers a retry only when the host supplied one', () => {
    const withRetry = draw({ items: rows, isLoading: false, partial: 'short', onRetry: () => undefined });
    expect(text(withRetry)).toContain('Try again');
    const without = draw({ items: rows, isLoading: false, partial: 'short' });
    expect(text(without)).not.toContain('Try again');
  });

  it('hands the card’s URL to onSelect, which is what the wizard stores', () => {
    const chosen: string[] = [];
    const tree = render(
      TemplateStepBody({ gallery: { items: rows, isLoading: false }, selectedUrl: '', onSelect: (u) => chosen.push(u) })
    );
    const cards = byClass(tree, 'TemplateCard');
    (cards[1].props.onClick as () => void)();
    expect(chosen).toEqual(['community://crm']);
  });
});

// ── 9. The contract this module promises: it never throws ─────────────────────

describe('createProjectFromTemplate never throws, including from the cleanup precondition', () => {
  it('treats a directoryExists that throws as "it was already there"', async () => {
    // 🔴 Of the two ways to be wrong about a directory, leaving one behind is the recoverable
    // one — and the caller does not await this function, so a rejection here is the unhandled
    // promise rejection T1 fixed, arriving through a new door.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { deps, removed } = cleanupDeps({
        directoryExists: () => {
          throw new Error('EPERM');
        }
      });
      const outcome = await createProjectFromTemplate({ destination: '/projects/mine', projectName: 'P' }, deps);
      expect(outcome.status).toBe('refused');
      expect(outcome.status === 'refused' && outcome.removed).toBe(false);
      expect(removed).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});

// ── 10. The category vocabulary, which the type system cannot hold ───────────

/**
 * 🔴 **THE THIRD COPY OF A LIST THAT LIVES IN ANOTHER REPOSITORY, AND THE COST IS STATED.**
 *
 * The authorities are `nodegx-community`'s `0020` (`project_template_category_known`, a CHECK
 * constraint) and its `TEMPLATE_CATEGORIES`, whose own spec compares those two **both ways**.
 * This is a third copy and it can drift from them. That is a real cost and it is the cheaper of
 * the two available:
 *
 * - **A drift costs one loud spec failure here** — a category added on the platform and not here
 *   reddens this file the next time an embedded template uses it, which is a sentence somebody
 *   reads and fixes.
 * - **No copy at all costs the ruling.** `category` is a plain `string`; nothing branches on it;
 *   the compiler has nothing to say. Without an assertion the next embedded template goes back to
 *   free text and nobody finds out until a facet bar is built over it.
 *
 * ⚠️ It is deliberately NOT imported from the platform. There is no dependency between these
 * repositories and inventing one for six strings would be the more expensive mistake.
 */
const EMBEDDED_TEMPLATE_CATEGORIES = ['starter', 'data-app', 'dashboard', 'site', 'form', 'integration'];

describe('FB-005 — embedded templates use the platform’s category vocabulary', () => {
  const provider = new EmbeddedTemplateProvider();

  it('control: there is at least one embedded template to grade', () => {
    // 🔴 Without this, every assertion below passes over an empty list — for the worst reason.
    expect(provider.getTemplateIds().length).toBeGreaterThan(0);
  });

  it('every embedded template names a category from the vocabulary', async () => {
    // Ruled 2026-08-26 between FB-005 T4 and phase 76: the platform's vocabulary is canonical,
    // and that includes templates compiled into the editor. `hello-world` said "Getting Started"
    // until then, and T3's picker draws embedded and platform rows in ONE list.
    const items = await provider.list();
    for (const item of items) {
      expect(EMBEDDED_TEMPLATE_CATEGORIES).toContain(item.category);
    }
  });

  it('would reject a prose title — the instrument discriminates', () => {
    // The known-firing arm. Without it, "every category is in the list" is satisfied by a list
    // that contains everything, or by a `toContain` that never actually ran.
    expect(EMBEDDED_TEMPLATE_CATEGORIES).not.toContain('Getting Started');
    expect(EMBEDDED_TEMPLATE_CATEGORIES).not.toContain('Dashboard');
  });

  it('the default template is one of them', async () => {
    const items = await provider.list();
    const preset = items.find((i) => i.projectURL === DEFAULT_PROJECT_TEMPLATE);
    expect(preset).toBeDefined();
    expect(EMBEDDED_TEMPLATE_CATEGORIES).toContain(preset?.category);
  });
});
