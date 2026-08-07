/**
 * FH-010 criterion 4 — nothing `position: fixed` is left in the panel's tree.
 *
 * `BasePanel.Root` carries `container-type: inline-size`, which implies
 * `contain: layout style inline-size` and therefore makes the panel the
 * containing block for every `position: fixed` descendant. `BasePanel.module.scss`
 * writes the resulting contract down in its own comments: every full-screen
 * overlay reachable from a panel escapes the panel's DOM first, and "nothing
 * fixed is left in-tree".
 *
 * Four overlays in the version-control panel broke it, and the failure is
 * silent-looking: the user sees a grey wash inside the panel and no dialog, with
 * no error anywhere. There is no rendered-DOM check that would have caught it
 * either — the panel's own suite has no DOM, and a render throw would have hit
 * the SidePanel error boundary instead, which is a different symptom.
 *
 * So this is a **source** guard rather than a rendered one: it reads the panel's
 * stylesheets, finds every class that declares `position: fixed`, and insists
 * the component rendering that class hands it to `PanelOverlay` — the one seam
 * that portals out to `.dialog-layer-portal-target`. A new overlay added to this
 * panel the old way fails here, which is the class of defect returning rather
 * than one instance of it.
 *
 * Deliberately a plain-Node jest spec: it reads files, it renders nothing, and
 * it must keep working with no Electron and no renderer around it.
 */

import * as fs from 'fs';
import * as path from 'path';

const PANEL_DIR = path.join(__dirname, '../../src/editor/src/views/panels/VersionControlPanel');

/** The seam that portals an overlay to `.dialog-layer-portal-target`. */
const ESCAPE_HATCH = 'PanelOverlay';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(PANEL_DIR);
const styleSheets = allFiles.filter((f) => f.endsWith('.scss'));
const sources = allFiles.filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));

/** Comments carry the word `fixed` all over this panel now — strip them first. */
function stripComments(scss: string): string {
  return scss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Every top-level class whose block declares `position: fixed`. Walks braces
 * rather than matching a regex across the whole file so a nested rule is
 * attributed to the class that contains it, not to whatever appeared last.
 */
function fixedClassesIn(scss: string): string[] {
  const text = stripComments(scss);
  const found = new Set<string>();

  let depth = 0;
  let blockStart = 0;
  let currentTopLevelSelector = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) {
        currentTopLevelSelector = text.slice(blockStart, i).trim();
        blockStart = i;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const body = text.slice(blockStart, i);
        if (/position\s*:\s*fixed/.test(body)) {
          // A selector list is legal here; take every class in it.
          for (const m of currentTopLevelSelector.matchAll(/\.([A-Za-z_][\w-]*)/g)) found.add(m[1]);
        }
        blockStart = i + 1;
      }
    }
  }

  return [...found];
}

const fixedClasses = styleSheets.flatMap((file) =>
  fixedClassesIn(fs.readFileSync(file, 'utf8')).map((className) => ({ file, className }))
);

describe('FH-010 — the version-control panel leaves nothing fixed in-tree', () => {
  it('finds the fixed overlays it is meant to be guarding', () => {
    // A sweep that matches nothing passes for the wrong reason. These three are
    // the overlays FH-010 portalled; the spec is worthless if the parser stops
    // seeing them.
    expect(fixedClasses.map((c) => c.className).sort()).toEqual([
      'IssueDetailOverlay',
      'ModalBackdrop',
      'PRDetailOverlay'
    ]);
  });

  it.each(fixedClasses)('$className escapes the panel through PanelOverlay', ({ className }) => {
    const renderers = sources.filter((file) => {
      const src = fs.readFileSync(file, 'utf8');
      return new RegExp(`styles(\\.${className}\\b|\\['${className}'\\])`).test(src);
    });

    // A fixed overlay nobody renders is dead CSS, not a passing check.
    expect(renderers.length).toBeGreaterThan(0);

    for (const file of renderers) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).toContain(ESCAPE_HATCH);
      expect(src).toMatch(new RegExp(`backdropClassName=\\{styles\\.${className}\\}`));
    }
  });

  it('has no component pinning itself with an inline fixed style either', () => {
    // The stylesheet sweep above cannot see `style={{ position: 'fixed' }}`, and
    // that reintroduces exactly the same defect.
    const offenders = sources.filter((file) => /position\s*:\s*['"]fixed['"]/.test(fs.readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('portals to the dialog layer, which is where every other editor dialog goes', () => {
    const overlay = fs.readFileSync(path.join(PANEL_DIR, 'components/PanelOverlay.tsx'), 'utf8');
    expect(overlay).toContain('createPortal');
    expect(overlay).toContain('.dialog-layer-portal-target');
  });

  it('dismisses on a gesture, not on a click', () => {
    // PNL-002: a `click` fires on the nearest common ancestor of press and
    // release, so a backdrop `onClick` closes the dialog when a drag that began
    // *inside* it ends outside — which is every text selection near the edge.
    const overlay = fs.readFileSync(path.join(PANEL_DIR, 'components/PanelOverlay.tsx'), 'utf8');
    expect(overlay).toContain('onPointerDown');
    expect(overlay).toContain('onPointerUp');

    for (const { className } of fixedClasses) {
      for (const file of sources) {
        const src = fs.readFileSync(file, 'utf8');
        if (!new RegExp(`backdropClassName=\\{styles\\.${className}\\}`).test(src)) continue;
        expect(src).not.toMatch(new RegExp(`className=\\{styles\\.${className}\\}[^>]*onClick`));
      }
    }
  });
});
