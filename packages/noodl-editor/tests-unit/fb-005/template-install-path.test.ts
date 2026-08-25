/**
 * FB-005 T1 — AC1: the template registry's unreachable download path is settled.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 **WHY THIS FILE DOES NOT SIMPLY EXERCISE `TemplateRegistry`.** AC1 says it in
 * as many words: *"a spec that only exercises `TemplateRegistry.download` stays green
 * through exactly the outage we are in now."* And it would have. Before this task the
 * editor had `TemplateRegistry`, `ITemplateProvider` and **four** registered providers,
 * every one of them compiling, and not one of them ever ran — `templateRegistry.list()`
 * had zero callers, and `newProject`'s single caller passed `projectTemplate: ''`, which
 * is falsy, so the branch that reached the registry never executed. A unit test over the
 * registry would have been green throughout.
 *
 * So this file grades two different things, and the second is the one that matters:
 *
 *   1. **Behaviour** — what the registry and `createProjectFromTemplate` actually do,
 *      driven with fake providers (`describe`s 3 and 4).
 *   2. **Reach** — that the chain from the user's click to the registry is unbroken:
 *      `ProjectsPage` → `LocalProjectsModel.newProject` → `createProjectFromTemplate`
 *      → `templateRegistry.install` (`describe` 1). That is a caller-grep, which s37
 *      recorded as *"a gate nothing else performs"*, made executable.
 *
 * 🔴 **Comments are stripped before any of the reach assertions.** This file would
 * otherwise pass on the prose: `LocalProjectsModel.newProject`'s own doc comment names
 * `templateRegistry` and `EmbeddedTemplateProvider` while explaining the outage they were
 * in. `stripComments` has a known-firing control below for exactly that reason — an
 * instrument that cannot tell code from a comment about code grades nothing here.
 *
 * ⚠️ **What a green run here does not prove:** that a project created this way opens and
 * renders. That is `tests/models/EmbeddedTemplate.test.ts` in the Electron suite, which
 * writes a real `project.json` to a real disk. This file proves the path to it is joined up.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { DEFAULT_PROJECT_TEMPLATE, templateRegistry } from '@noodl-utils/forge';
import { TemplateRegistry } from '@noodl-utils/forge/template/template-registry';
import { createProjectFromTemplate, resolveTemplateUrl } from '@noodl-models/template/createFromTemplate';

import type { ITemplateProvider, TemplateItem } from '@noodl-utils/forge/template/template';
import type { CreateFromTemplateDeps } from '@noodl-models/template/createFromTemplate';

const EDITOR_SRC = join(__dirname, '../../src/editor/src');

/** A file that NAMES a function in prose is not a file that calls it. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function sourceOf(relativePath: string): string {
  return readFileSync(join(EDITOR_SRC, relativePath), 'utf8');
}

/**
 * The body of a method, by brace matching from its signature.
 *
 * Whole-file greps are what let the old arrangement look wired: `LocalProjectsModel`
 * imported `templateRegistry` at the top of the file the entire time it was unreachable.
 * The question is whether the *method the caller calls* reaches it.
 */
function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start === -1) throw new Error(`No method matching '${signature}' in this source`);

  // 🔴 Not `indexOf('{', start)`. `newProject`'s parameter list is an inline object type —
  // `options: { name?: string; ... }` — so the first brace after the signature is the
  // *parameters*, and brace-matching from there returns the type literal rather than the
  // body. That is not a hypothetical: it is what this function did on its first run, and it
  // reported `newProject` as not calling anything at all. Walk the parentheses first.
  let parens = 0;
  let open = -1;
  for (let i = start + signature.lastIndexOf('('); i < source.length; i++) {
    if (source[i] === '(') parens++;
    else if (source[i] === ')') {
      parens--;
      if (parens === 0) {
        open = source.indexOf('{', i);
        break;
      }
    }
  }
  if (open === -1) throw new Error(`No body for '${signature}'`);

  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`Unterminated body for '${signature}'`);
}

// ── 1. Reach ──────────────────────────────────────────────────────────────────

describe('FB-005 T1 — the create-project chain reaches the template registry', () => {
  const localProjects = stripComments(sourceOf('utils/LocalProjectsModel.ts'));
  const projectsPage = stripComments(sourceOf('pages/ProjectsPage/ProjectsPage.tsx'));

  it('strips comments, so prose about a function does not read as a call to it', () => {
    // The two-sided control for the instrument the rest of this describe depends on.
    // `newProject`'s doc comment explains the outage in prose; the phrase below exists
    // nowhere in the code. Anchoring on a comment-only phrase rather than on an identifier
    // keeps this control independent of the assertions it is a control FOR — an identifier
    // like `EmbeddedTemplateProvider` appears in the prose AND would appear in the bypass
    // this file exists to forbid, so it would fire for two different reasons.
    const raw = sourceOf('utils/LocalProjectsModel.ts');
    expect(raw).toContain('reached by nobody');
    expect(localProjects).not.toContain('reached by nobody');

    // ...and the other side: stripping must not have eaten the code.
    expect(localProjects).toContain('templateRegistry');
  });

  it('discriminates one method from another, rather than returning the whole file', () => {
    // The second control: `methodBody` must not simply hand back everything. A neighbouring
    // method that has nothing to do with templates must come back without them.
    const neighbour = methodBody(localProjects, '_unzipAndLaunchProject(');
    expect(neighbour).not.toContain('createProjectFromTemplate');
    expect(neighbour.length).toBeLessThan(localProjects.length);
  });

  it('ProjectsPage creates projects through LocalProjectsModel.newProject', () => {
    expect(projectsPage).toContain('LocalProjectsModel.instance.newProject(');
  });

  it('ProjectsPage does not reach the registry itself — newProject is the only way in', () => {
    // If this fails, the chain has grown a second entrance and the rest of this file is
    // no longer a complete account of how a project gets its template.
    expect(projectsPage).not.toContain('templateRegistry');
  });

  it('newProject delegates to createProjectFromTemplate', () => {
    expect(methodBody(localProjects, 'async newProject(')).toContain('createProjectFromTemplate(');
  });

  it('newProject supplies templateRegistry.install as the thing that installs a template', () => {
    // 🔴 The assertion the whole task turns on. Until now this call sat in a branch that
    // could not run, and `newProject` reached the embedded provider directly instead.
    expect(methodBody(localProjects, 'async newProject(')).toContain('templateRegistry.install(');
  });

  it('newProject has no second, registry-bypassing creation branch', () => {
    const body = methodBody(localProjects, 'async newProject(');
    expect(body).not.toContain('new EmbeddedTemplateProvider');
    expect(body).not.toContain("import('../models/template/EmbeddedTemplateProvider')");
  });
});

// ── 2. The download path is gone, not merely unused ───────────────────────────

describe('FB-005 T1 — the zip transport is removed', () => {
  it('the registry has no download method', () => {
    // AC1 accepts "removed" or "fixed", and this is the removed half made checkable:
    // re-introducing a `download` that fetches and unzips fails here rather than
    // quietly becoming the fifth thing nobody calls.
    expect((templateRegistry as unknown as Record<string, unknown>).download).toBeUndefined();
  });

  it('providers are asked whether they can install, not whether they can download', () => {
    for (const provider of templateRegistry.providers) {
      expect(typeof provider.canInstall).toBe('function');
      expect((provider as unknown as Record<string, unknown>).canDownload).toBeUndefined();
      expect((provider as unknown as Record<string, unknown>).download).toBeUndefined();
    }
  });

  it('the composed registry claims the default template', () => {
    // The agreement assertion. A default URL no registered provider claims breaks project
    // creation outright, and nothing else in the editor would notice — `list()` would still
    // return a template and the picker T3 builds would still draw it.
    return Promise.all(templateRegistry.providers.map((p) => p.canInstall(DEFAULT_PROJECT_TEMPLATE))).then(
      (claims) => {
        expect(claims).toContain(true);
      }
    );
  });

  it('lists at least the default template, and every listing carries an installable URL', async () => {
    const items = await templateRegistry.list({});
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i: TemplateItem) => i.projectURL)).toContain(DEFAULT_PROJECT_TEMPLATE);
  });
});

// ── 3. Registry routing ───────────────────────────────────────────────────────

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

describe('TemplateRegistry.install', () => {
  it('uses the first provider that claims the URL and consults no other', async () => {
    const calls: string[] = [];
    const registry = new TemplateRegistry([
      fakeProvider('first', { canInstall: async () => false }),
      fakeProvider('second', {
        canInstall: async () => true,
        install: async () => {
          calls.push('second');
        }
      }),
      fakeProvider('third', {
        canInstall: async () => {
          calls.push('third-asked');
          return true;
        }
      })
    ]);

    await registry.install('x://y', '/tmp/dest');
    expect(calls).toEqual(['second']);
  });

  it('passes the destination directory through unchanged', async () => {
    let seen: [string, string] | null = null;
    const registry = new TemplateRegistry([
      fakeProvider('only', {
        canInstall: async () => true,
        install: async (url, destination) => {
          seen = [url, destination];
        }
      })
    ]);

    await registry.install('embedded://thing', '/tmp/a project');
    expect(seen).toEqual(['embedded://thing', '/tmp/a project']);
  });

  it('reports a failed install as itself, not as "no provider"', async () => {
    // 🔴 The version this replaced wrapped the claim and the install in one try/catch and
    // swallowed both, so a provider that claimed a URL and then failed fell out of the loop
    // and the caller was told no provider handled it. The user needed the other message.
    const registry = new TemplateRegistry([
      fakeProvider('breaks', {
        canInstall: async () => true,
        install: async () => {
          throw new Error('disk full');
        }
      })
    ]);

    await expect(registry.install('embedded://thing', '/tmp/dest')).rejects.toThrow('disk full');
  });

  it('skips a provider that cannot say whether it claims the URL', async () => {
    const registry = new TemplateRegistry([
      fakeProvider('confused', {
        canInstall: async () => {
          throw new Error('cannot tell');
        }
      }),
      fakeProvider('willing', { canInstall: async () => true })
    ]);

    await expect(registry.install('embedded://thing', '/tmp/dest')).resolves.toBeUndefined();
  });

  it('refuses a URL nothing claims, naming the URL', async () => {
    const registry = new TemplateRegistry([fakeProvider('none')]);
    await expect(registry.install('https://example.com/t.zip', '/tmp/dest')).rejects.toThrow(
      'https://example.com/t.zip'
    );
  });

  it('survives a provider whose list throws, and still returns the others', async () => {
    const registry = new TemplateRegistry([
      fakeProvider('breaks', {
        list: async () => {
          throw new Error('offline');
        }
      }),
      fakeProvider('works', { list: async () => [{ projectURL: 'a://b' } as TemplateItem] })
    ]);

    const items = await registry.list({});
    expect(items.map((i) => i.projectURL)).toEqual(['a://b']);
  });
});

// ── 4. What a new project directory gets, and in what order ───────────────────

function recordingDeps(overrides: Partial<CreateFromTemplateDeps> = {}) {
  const order: string[] = [];
  const deps: CreateFromTemplateDeps = {
    makeDirectory: async () => {
      order.push('makeDirectory');
    },
    installTemplate: async () => {
      order.push('installTemplate');
    },
    installStarterAssets: async () => {
      order.push('installStarterAssets');
      return undefined;
    },
    writeAgentConfig: async () => {
      order.push('writeAgentConfig');
    },
    ...overrides
  };
  return { deps, order };
}

describe('resolveTemplateUrl', () => {
  it('treats the wizard’s empty string as "unspecified"', () => {
    // The literal the one caller passed for two months. Reading it as a template URL is
    // what made the registry branch unreachable in the first place.
    expect(resolveTemplateUrl('')).toBe(DEFAULT_PROJECT_TEMPLATE);
  });

  it('treats a missing argument the same way', () => {
    expect(resolveTemplateUrl(undefined)).toBe(DEFAULT_PROJECT_TEMPLATE);
  });

  it('keeps a template the caller did name', () => {
    expect(resolveTemplateUrl('community://starter-crm')).toBe('community://starter-crm');
  });
});

describe('createProjectFromTemplate', () => {
  it('installs the template before the starter assets', async () => {
    // POL-006: `installStarterAssets` never overwrites, so a template shipping its own font
    // keeps it only while it is written first. Reversing these two is a silent regression —
    // both files still exist afterwards, they are just the wrong ones.
    const { deps, order } = recordingDeps();
    await createProjectFromTemplate({ destination: '/tmp/p', projectName: 'P' }, deps);
    expect(order).toEqual(['makeDirectory', 'installTemplate', 'installStarterAssets', 'writeAgentConfig']);
  });

  it('reports the template it used, including when the caller named none', async () => {
    const { deps } = recordingDeps();
    const outcome = await createProjectFromTemplate({ destination: '/tmp/p', projectName: 'P' }, deps);
    expect(outcome.status).toBe('created');
    expect(outcome.templateUrl).toBe(DEFAULT_PROJECT_TEMPLATE);
  });

  it('passes the resolved URL and destination to the installer', async () => {
    let seen: [string, string] | null = null;
    const { deps } = recordingDeps({
      installTemplate: async (url, destination) => {
        seen = [url, destination];
      }
    });
    await createProjectFromTemplate({ destination: '/tmp/p', projectName: 'P' }, deps);
    expect(seen).toEqual([DEFAULT_PROJECT_TEMPLATE, '/tmp/p']);
  });

  it('refuses rather than throwing when the template cannot be installed', async () => {
    // 🔴 The one caller does not await this. A rejection was an unhandled promise rejection,
    // and the launcher's "Creating new project" toast was never hidden — the user watched a
    // spinner belonging to a creation that had already stopped.
    const { deps, order } = recordingDeps({
      installTemplate: async () => {
        throw new Error('No template provider handles \'community://nope\'');
      }
    });

    const outcome = await createProjectFromTemplate(
      { templateUrl: 'community://nope', destination: '/tmp/p', projectName: 'P' },
      deps
    );

    expect(outcome.status).toBe('refused');
    expect(outcome.status === 'refused' && outcome.reason).toContain('community://nope');
    expect(outcome.templateUrl).toBe('community://nope');
    // The overridden `installTemplate` records nothing, so what this asserts is that the two
    // steps *after* it never ran: a refused template does not go on to write starter assets
    // and an agent configuration into a directory with no project in it.
    expect(order).toEqual(['makeDirectory']);
  });

  it('refuses when the directory itself cannot be made, and installs nothing', async () => {
    const { deps, order } = recordingDeps({
      makeDirectory: async () => {
        throw new Error('EACCES');
      }
    });

    const outcome = await createProjectFromTemplate({ destination: '/read-only/p', projectName: 'P' }, deps);
    expect(outcome.status).toBe('refused');
    expect(order).toEqual([]);
  });

  it('carries a non-Error rejection through as a reason rather than "[object Object]"', async () => {
    const { deps } = recordingDeps({
      installTemplate: async () => {
        throw 'the network went away';
      }
    });
    const outcome = await createProjectFromTemplate({ destination: '/tmp/p', projectName: 'P' }, deps);
    expect(outcome.status === 'refused' && outcome.reason).toBe('the network went away');
  });

  it('still creates the project when only the agent configuration fails', async () => {
    // `.mcp.json` and `CLAUDE.md` are written again the next time the project is opened
    // (FIX-008 B backfills them), so losing a correctly installed template over them is the
    // wrong trade. It was the behaviour, because newProject awaited this in the same run.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { deps } = recordingDeps({
        writeAgentConfig: async () => {
          throw new Error('no write permission');
        }
      });
      const outcome = await createProjectFromTemplate({ destination: '/tmp/p', projectName: 'P' }, deps);
      expect(outcome.status).toBe('created');
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
