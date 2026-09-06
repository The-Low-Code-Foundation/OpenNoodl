/**
 * EmbeddedTemplateProvider
 *
 * Provides access to templates that are embedded directly in the application code.
 * These templates are bundled with the editor and work reliably in both
 * development and production (no file I/O or path resolution issues).
 *
 * @module noodl-editor/models/template
 */

import { CLOUD_COMPONENT_PREFIX } from '../../validation/runtimeContext';
import { ITemplateProvider, TemplateItem } from '../../utils/forge/template/template';
import { STYLE_TOKENS_METADATA_KEY } from '../StyleTokensModel/ProjectTokenCss';
import { INITIAL_OPEN_COMPONENT_METADATA_KEY } from './firstOpenComponent';
import { assertTemplateDocPath, ProjectContent, NodeDefinition, ProjectTemplate } from './ProjectTemplate';
import { helloWorldTemplate } from './templates/hello-world.template';
import { landingPagesTemplate } from './templates/landing-pages.template';
import { siteBuilderTemplate } from './templates/site-builder.template';

/**
 * SBR-001 — does a project made from this template need a local backend?
 *
 * Derived from what the template ships, never declared beside it: a security
 * policy is a set of rules for a backend to enforce, and a `/#__cloud__/`
 * component is a function only a backend can run — either one without a backend
 * is a template that can do nothing at all (finding 1: Site Builder shipped
 * `devOpen: false` into a project with no backend attached). A hand-written
 * `requiresBackend:` flag would be a second statement of the same fact;
 * `lessonbackend.ts` records why that drifts.
 */
export function templateNeedsBackend(template: ProjectTemplate): boolean {
  if (template.securityPolicy) return true;
  return (template.content.components ?? []).some((c) => c.name?.startsWith(CLOUD_COMPONENT_PREFIX));
}

/**
 * Generate a fresh unique node id (UUID v4-ish, matching the editor's format).
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Templates that stay **installable but unoffered** — registered here, absent from the shelf.
 *
 * ✅ **`site-builder` was UNHELD for 0.2.2 on 2026-09-05, and D1 is closed.** Richard held it on
 * 2026-09-04 having ruled nine of its ten screens SHITTY; shown the same screens again after the
 * two seams he named were built — status demoted and the action promoted on the admin row, and a
 * per-kind width and rhythm on the public page — he ruled it **PASSABLE** and asked for it in the
 * release and on the shelf. REL-011c AC3 §13.
 *
 * ⚠️ **The seams were ruled on a ONE-VARIABLE pair.** The pictures behind D1 came from a harness
 * that supplied its own blue and drew gradient rectangles where photographs belong; the pair
 * behind this ruling holds that instrument fixed and moves only the seams (REL-011 §12). What
 * changed his answer was the product, not the photography.
 *
 * 🔴 **Unholding is exactly this line, and that is what the hold was built to make true.** D1 was
 * given believing *"holding costs no action — it is not in `templates/` and has never been staged
 * for publication."* **The premise was false about this file**: the site builder was in the map
 * below and `list()` returns the whole map, so every 0.2.2 user would have been offered the held
 * template regardless. Holding it cost one string here; so did letting it out.
 *
 * 🔴 **`hello-world` is held for an entirely different reason, and it CANNOT be deleted.** Richard
 * asked for it to go — *"We should remove Hello World, it's not a template"* — and he is right
 * about the shelf: *"I start a blank app and that has the hello world thing"*, so offering it as a
 * template was offering the blank project twice.
 *
 * But it **is** the blank project. `DEFAULT_PROJECT_TEMPLATE` in `utils/forge/index.ts` is
 * `'embedded://hello-world'`, and `resolveTemplateUrl` (`createFromTemplate.ts`) returns it
 * whenever no template was chosen — the "Quick Start" path. Removing it from the map would make
 * every blank project creation throw `Unknown embedded template: hello-world`. Holding it removes
 * the row from the shelf and leaves the fallback intact, which is what was actually wanted.
 */
export const HELD_TEMPLATE_IDS: ReadonlySet<string> = new Set(['hello-world']);

/**
 * Provider for templates that are embedded in the application code
 */
export class EmbeddedTemplateProvider implements ITemplateProvider {
  /**
   * @param heldIds Ids to register but not offer. Defaults to {@link HELD_TEMPLATE_IDS}.
   *
   * ⚠️ **A parameter so the shelf can be graded with nothing held.** `list()` is the one place
   * `templateNeedsBackend` is composed into a `TemplateItem`, and with everything held there is no
   * row left to assert that composition on — the gate would go quiet exactly where the mapping
   * lives. Production passes nothing and gets the real set.
   */
  constructor(private readonly heldIds: ReadonlySet<string> = HELD_TEMPLATE_IDS) {}

  /**
   * Registry of all embedded templates
   * New templates should be added here
   */
  private templates: Map<string, ProjectTemplate> = new Map([
    // 🔴 **`hello-world` is REGISTERED AND UNOFFERED, and it must stay registered.** It is what
    // `DEFAULT_PROJECT_TEMPLATE` points at (`utils/forge/index.ts`), and `resolveTemplateUrl`
    // falls back to it whenever no template was chosen — so it is the source of the **blank
    // project** that "Quick Start" creates. Deleting it from this map does not remove a template
    // choice; it makes every blank project creation throw `Unknown embedded template`.
    ['hello-world', helloWorldTemplate],
    // SB-007. ⚠️ Its `content` is a generated JSON blob — `npm run
    // template:site-builder` — not a hand-written graph like `hello-world`'s.
    ['site-builder', siteBuilderTemplate],
    // TPL-003 — generated the same way (`npm run template:landing`); Richard,
    // 2026-09-05: *"make it one of the packages templates like the members
    // area and site builder"*. No backend, so `templateNeedsBackend` reads false.
    ['landing-pages', landingPagesTemplate]
    // Add more templates here as they are created
  ]);

  get name(): string {
    return 'embedded-templates';
  }

  /**
   * List all available embedded templates
   * @returns Array of template items
   */
  async list(): Promise<ReadonlyArray<TemplateItem>> {
    const items: TemplateItem[] = [];

    for (const [id, template] of this.templates) {
      // Held templates stay installable and unoffered — see `HELD_TEMPLATE_IDS`.
      if (this.heldIds.has(id)) continue;

      items.push({
        title: template.name,
        desc: template.description,
        category: template.category,
        iconURL: template.thumbnail || '',
        projectURL: `embedded://${id}`,
        needsBackend: templateNeedsBackend(template)
      });
    }

    return items;
  }

  /**
   * Check if this provider can handle the given URL
   * @param url - The template URL to check
   * @returns True if URL starts with "embedded://"
   */
  async canInstall(url: string): Promise<boolean> {
    return url.startsWith('embedded://');
  }

  /**
   * Write the template into the destination **project directory**.
   *
   * Nothing is fetched and nothing is unzipped: an embedded template is a
   * TypeScript object bundled with the editor, so this instantiates it and
   * writes one `project.json`. This method was called `download` until FB-005
   * T1, which is how it came to be driven by a registry that then tried to
   * unzip its output — see `ITemplateProvider` for the full account.
   *
   * @param url - Template URL (e.g., "embedded://hello-world")
   * @param destination - Destination project directory
   * @returns Promise that resolves when template is written
   */
  async install(url: string, destination: string): Promise<void> {
    // Extract template ID from URL
    const templateId = url.replace('embedded://', '');

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Unknown embedded template: ${templateId}`);
    }

    // Instantiate the template into concrete project content: regenerate node
    // ids so every new project is unique, and resolve `rootComponent` (a name)
    // into a concrete `rootNodeId`. The latter is critical: ProjectModel.fromJSON
    // only honours the `rootComponent` name hint by calling setRootComponent(),
    // which silently no-ops unless the NodeLibrary already has the root node's
    // type loaded (allowAsExportRoot). At project-creation time the editor is on
    // the launcher with an empty NodeLibrary, so that hint is lost and the
    // project is saved with no home component. A concrete `rootNodeId` is
    // resolved purely by id lookup, independent of the NodeLibrary.
    const projectContent = this.instantiateContent(template.content);

    // SBR-002: the first-open hint rides project metadata, where
    // `getDefaultComponent` reads it back. Set only when the template declares
    // one — every other template's project.json is byte-identical to before.
    // The name is NOT id-remapped: component names are stable through
    // `instantiateContent` (only node ids are regenerated).
    if (template.initialOpenComponent) {
      projectContent.metadata = {
        ...(projectContent.metadata || {}),
        [INITIAL_OPEN_COMPONENT_METADATA_KEY]: template.initialOpenComponent
      };
    }

    // SBR-003: the template's look, as the project's own token overrides —
    // the same metadata key the style panel persists to, read by the deploy's
    // `:root` stamp and the preview injector. Metadata, not a stylesheet, so
    // the recipient can open the style panel and see (and change) every value.
    if (template.designTokens) {
      projectContent.metadata = {
        ...(projectContent.metadata || {}),
        [STYLE_TOKENS_METADATA_KEY]: template.designTokens
      };
    }

    // Ensure destination directory exists
    const { filesystem } = await import('@noodl/platform');

    // Create destination directory if it doesn't exist
    if (!filesystem.exists(destination)) {
      await filesystem.makeDirectory(destination);
    }

    // Write project.json to destination
    const projectJsonPath = filesystem.join(destination, 'project.json');
    await filesystem.writeFile(projectJsonPath, JSON.stringify(projectContent, null, 2));

    // SB-015: and the policy the graphs assume, if this template carries one.
    //
    // 🔴 It is written UNINSTANTIATED — no id remapping, no clone-and-rewrite —
    // because a security policy names collections, functions and roles, and not
    // one node id. Running it through `instantiateContent`'s neighbourhood would
    // be a rewrite looking for ids in a document that has none, which is the
    // shape of near-miss SB-007 F22 already recorded (a string-matching rewrite
    // would have corrupted eight parameters whose values collide with ids).
    //
    // A template with no `securityPolicy` writes no file, which is every
    // template but one and is exactly today's behaviour.
    if (template.securityPolicy) {
      const policyPath = filesystem.join(destination, 'nodegx.security.json');
      await filesystem.writeFile(policyPath, JSON.stringify(template.securityPolicy, null, 2) + '\n');
    }

    // SBR-003: docs the template ships — `docs/` only, validated per entry
    // (`assertTemplateDocPath` throws rather than skips, so a bad path cannot
    // ship a doc-less project silently). `docs/` is the door's
    // `get_project_doc` surface: this is how the next authoring session reads
    // the template's contracts instead of rediscovering them.
    if (template.docs) {
      for (const doc of template.docs) {
        assertTemplateDocPath(doc.path);
        const docDir = filesystem.join(destination, doc.path.split('/').slice(0, -1).join('/'));
        if (!filesystem.exists(docDir)) {
          await filesystem.makeDirectory(docDir);
        }
        await filesystem.writeFile(filesystem.join(destination, doc.path), doc.content);
      }
    }
  }

  /**
   * Turn a template's declarative content into a concrete, ready-to-save project:
   *  - deep-clones the content so the shared template object is never mutated;
   *  - regenerates every node id (recursively through children) and rewrites
   *    **every** field that references one — connections and `graph.visualRoots`
   *    — so two projects created from the same template don't share node UUIDs;
   *  - resolves the `rootComponent` name into a top-level `rootNodeId` pointing at
   *    that component's first root node, so the home component is set deterministically
   *    without depending on the NodeLibrary being loaded.
   *
   * 🔴 **`visualRoots` was missed until SB-007, and it was missed because nothing
   * had one.** `hello-world` is a hand-written graph with no `visualRoots` at
   * all, and it was the only embedded template for the whole life of this class,
   * so the field had no population to be wrong about. Every component a v2 door
   * writes carries one (`reconstructLegacyComponent` restores it from
   * `nodes.json`), and the Site Builder template brought twelve of them at once —
   * measured as twelve dangling ids in an installed project before this loop
   * existed. `lessonstarter.ts:341` checks the same class of defect on a
   * different artefact, in the same words.
   *
   * ⚠️ **The rewrite is structural, and that is not fussiness.** A pass that
   * replaced any string matching an old id would corrupt eight parameters in this
   * one template: `as: 'section'`, `as: 'nav'`, `as: 'header'` and five
   * `flexDirection: 'row'` all collide with a node id, because the ids a graph
   * author picks and the HTML element names a Group takes come from the same
   * small vocabulary. Only fields that are *declared* to hold ids are touched.
   *
   * @param content - The template's declarative content
   * @returns A fresh project content object safe to serialize
   */
  private instantiateContent(content: ProjectContent): ProjectContent {
    const project: ProjectContent = JSON.parse(JSON.stringify(content));

    // Regenerate node ids, keeping an old->new map to fix up connections.
    const idMap = new Map<string, string>();
    const remapNode = (node: NodeDefinition) => {
      if (node.id) {
        const newId = generateId();
        idMap.set(node.id, newId);
        node.id = newId;
      }
      if (node.children) node.children.forEach(remapNode);
    };

    for (const component of project.components || []) {
      for (const root of component.graph?.roots || []) {
        remapNode(root);
      }
    }

    for (const component of project.components || []) {
      for (const connection of component.graph?.connections || []) {
        if (connection.fromId && idMap.has(connection.fromId)) connection.fromId = idMap.get(connection.fromId);
        if (connection.toId && idMap.has(connection.toId)) connection.toId = idMap.get(connection.toId);
      }

      // The second field that names node ids. `ComponentGraph` does not declare
      // it — it is canvas state that arrives through the v2 round trip — so it is
      // read off the graph rather than through the interface.
      const graph = component.graph as (typeof component.graph & { visualRoots?: string[] }) | undefined;
      if (graph?.visualRoots) {
        graph.visualRoots = graph.visualRoots.map((id) => idMap.get(id) ?? id);
      }
    }

    // Resolve rootComponent (a name) into a concrete rootNodeId.
    if (project.rootComponent) {
      const rootComp = (project.components || []).find((c) => c.name === project.rootComponent);
      const firstRoot = rootComp?.graph?.roots?.[0];
      if (firstRoot?.id) {
        project.rootNodeId = firstRoot.id;
      }
    }

    return project;
  }

  /**
   * Get a specific template by ID (utility method)
   * @param id - Template ID
   * @returns The template, or undefined if not found
   */
  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all template IDs (utility method)
   * @returns Array of template IDs
   */
  getTemplateIds(): string[] {
    return Array.from(this.templates.keys());
  }
}
