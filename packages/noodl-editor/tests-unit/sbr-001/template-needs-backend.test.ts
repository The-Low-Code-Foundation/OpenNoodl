/**
 * SBR-001 — the need is DERIVED from what the template ships, and the
 * derivation is graded over the templates that actually exist, not fixtures.
 *
 * 🔴 A hand-written `requiresBackend:` flag was rejected for `lessonbackend`'s
 * reason: a second statement of the same fact drifts on the first edit. Here
 * the facts are the shipped `securityPolicy` and the `/#__cloud__/` components,
 * so a template cannot declare one thing and ship another.
 */

import {
  EmbeddedTemplateProvider,
  templateNeedsBackend
} from '../../src/editor/src/models/template/EmbeddedTemplateProvider';
import { helloWorldTemplate } from '../../src/editor/src/models/template/templates/hello-world.template';
import { siteBuilderTemplate } from '../../src/editor/src/models/template/templates/site-builder.template';
import type { ProjectTemplate } from '../../src/editor/src/models/template/ProjectTemplate';
import { galleryFromListing } from '../../src/editor/src/hooks/useProjectTemplates';
import { DEFAULT_PROJECT_TEMPLATE } from '../../src/editor/src/utils/forge';

describe('SBR-001 templateNeedsBackend', () => {
  it('the Site Builder template needs one — it ships a policy AND seven cloud functions', () => {
    expect(templateNeedsBackend(siteBuilderTemplate)).toBe(true);
  });

  it('hello-world does not — the AC5 negative control', () => {
    expect(templateNeedsBackend(helloWorldTemplate)).toBe(false);
  });

  it('a cloud component alone is enough — a function only a backend can run', () => {
    const template = {
      name: 'x',
      description: '',
      category: 'starter',
      content: { components: [{ name: '/#__cloud__/doThing', graph: { roots: [], connections: [] } }] }
    } as unknown as ProjectTemplate;
    expect(templateNeedsBackend(template)).toBe(true);
  });

  it('🔴 the boundary is startsWith, not includes — /Utils/#__cloud__/x is NOT a cloud component', () => {
    const template = {
      name: 'x',
      description: '',
      category: 'starter',
      content: { components: [{ name: '/Utils/#__cloud__/doThing', graph: { roots: [], connections: [] } }] }
    } as unknown as ProjectTemplate;
    expect(templateNeedsBackend(template)).toBe(false);
  });
});

describe('SBR-001 the derived need reaches the wizard', () => {
  it('the embedded provider fills TemplateItem.needsBackend on every row', async () => {
    /**
     * This is the composition itself — `templateNeedsBackend` reaching `TemplateItem.needsBackend`
     * — which neither the unit cases above nor `galleryFromListing` below covers.
     *
     * ⚠️ **Graded with NOTHING held, and BOTH values asserted.** The site builder is on the
     * shipped shelf as of 0.2.2, so the mapping could be read there; `hello-world` could not, and
     * a mapping read at one value passes for a function that returns a constant. The blank project
     * carries no security policy and no cloud component, so the two rows disagree — which is what
     * makes this a reading of the mapping rather than of the row it happened to find.
     */
    const rows = await new EmbeddedTemplateProvider(new Set()).list();
    const byUrl = new Map(rows.map((r) => [r.projectURL, r.needsBackend]));

    expect(byUrl.get('embedded://site-builder')).toBe(true);
    expect(byUrl.get('embedded://hello-world')).toBe(false);
    // TPL-003: no policy, no cloud component — the wizard must attach nothing.
    expect(byUrl.get('embedded://landing-pages')).toBe(false);
  });

  it('🔴 offers the site builder and the landing pages and NOTHING else in 0.2.2 — the blank project stays off', async () => {
    /**
     * Richard, 2026-09-05, shown the seams he named built: *"It's passable, let's include it in
     * the 0.2.2 release, add it to the templates menu."* That closes D1, which had held it from
     * 2026-09-04 (*"we need that out of the create modal please"*).
     *
     * 🔴 **`toEqual` over the whole list, not a `toContain`.** The ruling was about the site
     * builder alone; the other half of it — *"We should remove Hello World, it's not a template"*
     * — is a separate standing decision, and a `toContain` would let the blank project back onto
     * the shelf without a word. Both facts live in one assertion because they are one screen.
     *
     * The members' area is still not here: when it is published it arrives through
     * `PlatformTemplateProvider`, not this one.
     *
     * TPL-003 joined the same day — Richard, 2026-09-05: *"I want to make it one of the
     * packages templates like the members area and site builder."* The list grew by one
     * row and this assertion grew with it, on purpose: it is still the whole screen.
     */
    const rows = await new EmbeddedTemplateProvider().list();
    expect(rows.map((r) => r.projectURL)).toEqual(['embedded://site-builder', 'embedded://landing-pages']);
  });

  it('🔴 keeps the DEFAULT project template installable even though it is not on the shelf', async () => {
    /**
     * 🔴 **The near-miss this pins.** `hello-world` was first deleted from the registry outright,
     * on the reasoning that nothing imported it — which was true of the *symbol* and false of the
     * *id*. `DEFAULT_PROJECT_TEMPLATE` is the string `'embedded://hello-world'`, and
     * `resolveTemplateUrl` returns it whenever no template was chosen, so hello-world is the source
     * of every **blank** project. Deleting it made `install()` throw `Unknown embedded template`
     * on the most common path in the product — Quick Start — while the shelf looked correct.
     *
     * Being held must therefore mean *"not offered"* and never *"not installable"*. This asserts
     * both halves against the same id, which is the only way the distinction can be graded.
     */
    const provider = new EmbeddedTemplateProvider();
    const id = DEFAULT_PROJECT_TEMPLATE.replace('embedded://', '');

    // Not offered…
    const urls = (await provider.list()).map((r) => r.projectURL);
    expect(urls).not.toContain(DEFAULT_PROJECT_TEMPLATE);

    // …and still resolvable, which is what Quick Start depends on.
    expect(provider.getTemplate(id)).toBeDefined();
    expect(await provider.canInstall(DEFAULT_PROJECT_TEMPLATE)).toBe(true);
  });

  it('🔴 the HOLD MECHANISM still works, which nothing on the shipped shelf exercises any more', async () => {
    /**
     * This used to read *"unholding is one string"* against a nothing-held provider — which is now
     * strictly weaker than the shipped-shelf assertion above and would have gone on passing as a
     * duplicate of it.
     *
     * 🔴 **What is no longer graded anywhere is the skip itself.** `hello-world` is the only held
     * id left and it is asserted through `DEFAULT_PROJECT_TEMPLATE` below, so a `continue` that
     * stopped working would still leave the shipped list correct-looking. That is the exact shape
     * of the defect D1 turned up: a hold everyone believed was in force while `list()` returned
     * the whole map. Graded here against the id the ruling was about, and both halves together —
     * held means unoffered, and never means uninstallable.
     */
    // TPL-003 joined the map 2026-09-05; holding everything registered is what keeps this a
    // reading of the skip and not of whichever rows happen to be unheld.
    const held = new EmbeddedTemplateProvider(new Set(['hello-world', 'site-builder', 'landing-pages']));
    expect((await held.list()).map((r) => r.projectURL)).toEqual([]);
    expect(await held.canInstall('embedded://site-builder')).toBe(true);
  });

  it('galleryFromListing carries it through, and a community row without the field stays undefined (AC6)', () => {
    const gallery = galleryFromListing({
      items: [
        {
          provider: 'embedded-templates',
          item: {
            iconURL: '',
            title: 'Site Builder',
            desc: '',
            category: 'starter',
            projectURL: 'embedded://site-builder',
            needsBackend: true
          }
        },
        {
          provider: 'community-templates',
          // The community wire has no column for this — the row arrives without
          // the field, and it must stay that way rather than becoming a guess.
          item: { iconURL: '', title: 'Shelf thing', desc: '', category: 'starter', projectURL: 'community://shelf-thing' }
        }
      ],
      failures: []
    });

    expect(gallery.items[0].needsBackend).toBe(true);
    expect(gallery.items[1].needsBackend).toBeUndefined();
  });
});
