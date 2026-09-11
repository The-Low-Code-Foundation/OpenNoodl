/**
 * BST-001 §2 — the defect this task was most likely to ship.
 *
 * Sixteen `register*Tools` functions took `store: ProjectStore` and closed over
 * it. Passing them a binding the same way — resolving it *where the store used
 * to be resolved*, at registration — captures the unbound state for the life of
 * the process: the tools register, and every one of them refuses forever.
 *
 * ⚠️ **That mistake is invisible in a bound server**, which is every existing
 * spec in this suite, so it would have shipped green. It has exactly one
 * observable consequence and this file is built around it: a registration-time
 * `require()` makes an unbound server **throw while it is being constructed**,
 * before any client ever sees it.
 *
 * The suite therefore asserts construction, not behaviour. Add a
 * `const store = binding.require()` at the top of any `register*Tools` function
 * and the first test here fails.
 */

import * as fs from 'fs';
import * as path from 'path';

import { NO_PROJECT_REFUSAL, ProjectBinding } from '../src/project/ProjectBinding';
import { ToolError } from '../src/errors';
import { createServer } from '../src/server';
import { copyFixture } from './helpers';

describe('BST-001 — the binding is dereferenced per request, not per registration', () => {
  it('an unbound server constructs without throwing', () => {
    // The whole test. Every registration function runs during this call; if any
    // of them resolves the binding instead of holding it, this is where it dies.
    expect(() => createServer({ allowWrites: true })).not.toThrow();
  });

  it('an unbound server registers the same tools a bound one does', () => {
    // The other half of "register everything, always": the bootstrap surface is
    // a *policy over the registered set*, not a smaller set of registrations. If
    // this ever diverges, binding a project later (BST-002) stops being a
    // one-object change and becomes a re-registration pass.
    const unbound = createServer({ allowWrites: true });
    const bound = createServer({ projectDir: copyFixture(), allowWrites: true });
    expect([...unbound.disclosure.registeredNames()].sort()).toEqual([...bound.disclosure.registeredNames()].sort());
  });

  it('the same construction with a project directory still throws on a non-v2 target', () => {
    // The bound path's failure mode is unchanged: a bad directory is still a
    // startup error with today's message, not a server that starts and refuses
    // every call. Making the store lazy must not make a typo silent.
    const empty = fs.mkdtempSync(path.join(require('os').tmpdir(), 'bst-not-a-project-'));
    expect(() => createServer({ projectDir: empty, allowWrites: true })).toThrow(/not a NodeGX v2 project/);
  });
});

describe('BST-001 — one refusal, in one place', () => {
  it('require() refuses with the shared string and a machine code', () => {
    const binding = new ProjectBinding();
    expect(binding.isBound).toBe(false);
    expect(binding.peek()).toBeNull();
    expect(binding.projectDir).toBeUndefined();

    let thrown: unknown;
    try {
      binding.require();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ToolError);
    expect((thrown as ToolError).code).toBe('no-project');
    expect((thrown as ToolError).message).toBe(NO_PROJECT_REFUSAL);
  });

  it('the refusal names both exits rather than diagnosing the state', () => {
    // ⚠️ Every unbound-mode error is read by a model with no other information
    // about why its call failed. "No project bound" produces a guess and a
    // second wrong call; naming the exits produces the next correct one. This is
    // the bar, and it is asserted rather than left to review.
    expect(NO_PROJECT_REFUSAL).toContain('list_projects');
    expect(NO_PROJECT_REFUSAL).toContain('create_project');
  });

  it('nothing outside ProjectBinding constructs a no-project refusal', () => {
    // The drift guard. A second copy of this sentence — or a second tool writing
    // its own version of it — is exactly what the single handle exists to
    // prevent, and it is only checkable across the whole source at once.
    const srcDir = path.join(__dirname, '..', 'src');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else if (entry.name.endsWith('.ts')) {
          const rel = path.relative(srcDir, abs);
          // `errors.ts` declares the code in the union; `ProjectBinding.ts` is
          // the one place allowed to throw it.
          if (rel === 'errors.ts' || rel === path.join('project', 'ProjectBinding.ts')) continue;
          if (fs.readFileSync(abs, 'utf8').includes("'no-project'")) offenders.push(rel);
        }
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });

  it('a bound binding hands back a real store', () => {
    const dir = copyFixture();
    const binding = new ProjectBinding(dir);
    expect(binding.isBound).toBe(true);
    expect(binding.require().readRegistry().components).toBeDefined();
    expect(binding.projectDir).toBe(binding.require().projectDir);
  });
});
