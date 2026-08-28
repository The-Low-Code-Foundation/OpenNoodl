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
    const rows = await new EmbeddedTemplateProvider().list();
    const byUrl = new Map(rows.map((r) => [r.projectURL, r.needsBackend]));

    expect(byUrl.get('embedded://site-builder')).toBe(true);
    expect(byUrl.get('embedded://hello-world')).toBe(false);
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
