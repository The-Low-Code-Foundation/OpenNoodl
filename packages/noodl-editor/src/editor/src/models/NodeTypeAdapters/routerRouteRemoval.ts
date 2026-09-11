/**
 * REL-009b — what a Router's `pages` parameter should become when a component
 * is removed, and the one case where the answer is "nothing".
 *
 * This lives in its own module, with **no imports**, for the same reason
 * `services/ProjectFileWatcher/decide.ts` does: `RouterAdapter` reaches
 * `ProjectModel` → `bugtracker` → Electron's `getUserDataPath()` at module
 * load, so nothing in that file is gradeable outside Electron. The decision is
 * what needed grading.
 *
 * 🔴 The case this module exists for. A reload from disk removes a component
 * and adds its replacement straight back under the same name. Before this,
 * `componentRemoved` could not tell that swap from a deletion, so it spliced
 * the page out of every Router's `routes`, cleared `startPage` when it named
 * that page, and the editor's next autosave wrote the loss to disk. Measured in
 * the running product: `/App` read `routes: ["/Pages/Third"]` with
 * `startPage: "/Pages/Third"`, an agent added one node to `Pages/Third` over
 * MCP, and fourteen seconds later the same file read `routes: []` with no
 * `startPage`. That is REL-009a arm C2's silent page loss, caused by
 * REL-009b's own watcher.
 *
 * ⚠️ The guard must stay narrow. Refusing every removal would leave deleted
 * pages listed in routers forever, and every caller that predates REL-009b
 * sends no flag at all — so only an explicit `true` means "this is a swap".
 */

export type RouterPages = {
  routes?: string[];
  startPage?: string;
};

export type RemovalContext = {
  reloadingFromDisk?: boolean;
};

/**
 * The replacement `pages` value, or `null` when the parameter must be left
 * exactly as it is. `null` covers three distinct situations that all mean "do
 * not write": the removal is half of a reload, the parameter holds no route
 * list, and this router never listed the component.
 */
export function pagesAfterComponentRemoved(
  pages: RouterPages | undefined,
  componentName: string,
  context: RemovalContext = {}
): RouterPages | null {
  if (context.reloadingFromDisk === true) return null;
  if (pages === undefined || pages.routes === undefined) return null;

  const idx = pages.routes.indexOf(componentName);
  if (idx === -1) return null;

  // Same clone as before; `routes` is rebuilt rather than spliced because the
  // stricter compile `noodl-mcp` runs this under (P79 K1 re-exports it) cannot
  // see through the `undefined` check above.
  const next: RouterPages = { ...JSON.parse(JSON.stringify(pages)), routes: pages.routes.filter((_, i) => i !== idx) };
  if (next.startPage === componentName) next.startPage = undefined;
  return next;
}
