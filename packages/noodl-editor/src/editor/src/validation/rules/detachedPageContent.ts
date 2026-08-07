/**
 * Rule: a page's content actually hangs off its `Page` node.
 *
 * A page component renders from its `Page` node. Content parented anywhere else
 * — a second canvas root sitting beside the Page rather than inside it — is not
 * rendered at all, and the page comes up blank.
 *
 * Found on an AI-authored admin page: `page-4` (the `Page`) had **zero**
 * children while a Group called "Page Root" carried all twenty content nodes as
 * a parallel visual root. The page rendered nothing. The runtime noticed at run
 * time ("this node is detached from the main node tree and won't be rendered"),
 * but only as a soft per-node warning in a running preview — the project
 * validated clean, so the plan applied, the build reported success, and the
 * blank page shipped.
 *
 * Deliberately narrow, because `orphanedNode` documents why "a visual node with
 * no parent" cannot be flagged on its own: legitimate canvas roots have no
 * parent. This fires only on the unambiguous case — the `Page` has no children
 * *and* the component has visual content somewhere else. A page whose Page node
 * is empty and which has no other content is an empty page, not a broken one,
 * and is left alone.
 *
 * @module noodl-editor/validation/rules/detachedPageContent
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { Rule, RuleContext } from './types';

const PAGE_TYPE = 'Page';

export const detachedPageContent: Rule = {
  code: DiagnosticCode.DetachedPageContent,
  description: "A page's content is parented to its Page node, so the page renders.",
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const { component, nodeById } of ctx.components) {
      const pages = component.nodes.filter((n) => n.type === PAGE_TYPE);
      if (pages.length === 0) continue;

      // Anything reachable from a Page is rendered; that is the whole test.
      const rendered = new Set<string>();
      const walk = (id: string) => {
        if (rendered.has(id)) return;
        rendered.add(id);
        const node = nodeById.get(id);
        if (!node) return;
        for (const child of node.children) walk(child);
      };
      for (const page of pages) walk(page.id);

      for (const page of pages) {
        if (page.children.length > 0) continue;

        // A parentless node carrying children is a parallel root — the shape
        // that swallows a whole page. A stray leaf is not worth a diagnostic.
        const detachedRoots = component.nodes.filter(
          (n) => !rendered.has(n.id) && n.parent === undefined && n.children.length > 0
        );
        if (detachedRoots.length === 0) continue;

        for (const root of detachedRoots) {
          out.push({
            code: DiagnosticCode.DetachedPageContent,
            severity: 'error',
            message:
              `"${root.label ?? root.id}" is a second visual root beside the Page node "${page.label ?? page.id}", ` +
              `which has no children. A page renders only what is parented to its Page node, so this page renders blank. ` +
              `Parent it to the Page node.`,
            location: {
              component: component.name,
              nodeId: root.id,
              nodeType: root.type,
              nodeLabel: root.label
            }
          });
        }
      }
    }

    return out;
  }
};
