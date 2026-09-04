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
     * ⚠️ **Graded with NOTHING held**, because the shipped shelf is empty (see the case below) and
     * a mapping cannot be asserted over zero rows. This is the composition itself —
     * `templateNeedsBackend` reaching `TemplateItem.needsBackend` — which neither the unit cases
     * above nor `galleryFromListing` below covers.
     */
    const rows = await new EmbeddedTemplateProvider(new Set()).list();
    const byUrl = new Map(rows.map((r) => [r.projectURL, r.needsBackend]));

    expect(byUrl.get('embedded://site-builder')).toBe(true);
  });

  it('🔴 offers NOTHING embedded in 0.2.2 — hello-world removed, site-builder held', async () => {
    /**
     * Richard, 2026-09-04: *"we need that out of the create modal please"* (site builder), and
     * earlier *"We should remove Hello World, it's not a template."*
     *
     * 🔴 This is the assertion that ruling D1 needed and did not have. D1 held the site builder
     * from 0.2.2 believing *"holding costs no action"* — but `list()` returned the whole map, so
     * the wizard offered it regardless. An empty shelf is the shipped state until the members' area
     * is published to the community, at which point the row arrives through
     * `PlatformTemplateProvider`, not this one.
     */
    const rows = await new EmbeddedTemplateProvider().list();
    expect(rows.map((r) => r.projectURL)).toEqual([]);
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

  it('unholding is one string — phase 77 gets the site builder back without a code change', async () => {
    const urls = (await new EmbeddedTemplateProvider(new Set()).list()).map((r) => r.projectURL);
    expect(urls).toContain('embedded://site-builder');
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
