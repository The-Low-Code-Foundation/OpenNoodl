/**
 * Icon sets, from the one registration path there already was — NDA-007 §2.
 *
 * **The spec's premise here was wrong in the most useful direction.** It said "an icon set should
 * be declared once and become available to both the editor picker and the viewer. Today there is no
 * such declaration." There is: a module directory under `noodl_modules/` whose `manifest.json`
 * carries `type: 'iconset'`. LIB-003 already made `scanModuleManifests` the *single* scanner of
 * that directory, and both consumers already read it — the picker through
 * `ProjectModel.listModules`, the preview and deploy HTML through `injectIntoHtml`. So §2 is not
 * "invent a registration path", it is "the one that exists only understands fonts", and criterion 4
 * (*exactly one place registers a set*) was nearly met before this file existed.
 *
 * What this file adds is the shaping layer: scanned manifests in, icon *sets* out, plus the one
 * function that turns a chosen glyph into a `Noodl.Icon` value. Same relationship
 * `toInjectModules` has to the scanner, and for the same reason — the picker had this logic inline
 * and font-shaped.
 *
 * ## Why a sprite needs no registration in the app at all
 *
 * This is the asymmetry that makes §2 small. A **font** set is only renderable once a stylesheet
 * and a font file are in the *document* — which is why adding one meant fighting two asset
 * pipelines, and it is what `browser.stylesheets` + `injectIntoHtml` exist for. A **sprite** set
 * is not: `{ kind: 'sprite', url, symbolId }` is self-describing, the URL is an ordinary project
 * asset, and `noodl_modules/` ships verbatim in a deploy (it is absent from
 * `build/ignore.ts`'s defaults, checked). So nothing has to be injected anywhere for a sprite to
 * render in the app — the value *is* the registration, once the picker can produce it.
 *
 * ## Why `inline` is declarable-but-not-here
 *
 * `Noodl.Icon` has three kinds and the viewer renders all three (§1). Only `font` and `sprite` can
 * be *installed as a set* here. An `inline` set would have to put its markup into the editor's own
 * document for the picker to preview it, and that is a different trust question from putting it in
 * the app's — deferred deliberately rather than skipped, and recorded in `ICON-SOURCE-MODEL.md`.
 * An `inline` value reaching the node still renders.
 */
import type { ModuleManifest, ScannedModule } from './projectmodules';

/** The kinds a *set* can be installed as. `Noodl.Icon` also has `inline`; see the header. */
export type IconSetKind = 'font' | 'sprite';

/**
 * One installed icon set, normalised. Everything the picker needs and nothing it has to know the
 * manifest layout to get at.
 */
export interface IconSetDescriptor {
  /** Directory name under `noodl_modules/` — the set's identity, and what stylesheet ids key on. */
  moduleName: string;
  /** Display name, falling back to the directory name rather than rendering "undefined". */
  name: string;
  kind: IconSetKind;
  /** Glyph names: codepoints or per-glyph classes for a font, `<symbol>` ids for a sprite. */
  icons: string[];
  /** Font sets: the CSS class that selects the family. */
  iconClass?: string;
  /** Font sets: each glyph is its own class rather than the element's text. */
  codeAsClass: boolean;
  /**
   * Sprite sets: **project-relative** URL of the sheet, e.g.
   * `noodl_modules/my-icons/icons/sprite.svg`. Project-relative on purpose — it is what the
   * stored value carries, and it has to resolve in the preview *and* in a deploy, neither of which
   * shares an origin or a path prefix with the editor document. The picker resolves it for its own
   * preview; nothing else does.
   */
  spriteUrl?: string;
  /** Font sets: stylesheet paths, verbatim from the manifest (may be http URLs). */
  stylesheets: string[];
  /** Why a set was rejected, or what was wrong with one that was kept. Never silent. */
  warnings: string[];
}

/** What the picker hands back and what lands in the port. A `Noodl.Icon`, structurally. */
export type IconSetValue =
  | { class?: string; code?: string; codeAsClass?: boolean }
  | { kind: 'sprite'; url: string; symbolId: string };

function isIconsetManifest(manifest: ModuleManifest | null): manifest is ModuleManifest {
  return manifest !== null && manifest.type === 'iconset';
}

function readStylesheets(manifest: ModuleManifest): string[] {
  const sheets = manifest.browser && manifest.browser.stylesheets;
  if (!Array.isArray(sheets)) return [];
  return sheets.filter((sheet): sheet is string => typeof sheet === 'string');
}

/**
 * Every icon set in a scanned project, in scan order.
 *
 * Loud on the same terms as the scanner it feeds from: a set that cannot be rendered at all is
 * left out **with a warning naming the module**, and one that is merely odd is kept with a warning.
 * A silently missing icon set is indistinguishable from a picker bug, which is the whole reason
 * this returns diagnostics rather than filtering quietly.
 */
export function toIconSets(scanned: ScannedModule[]): IconSetDescriptor[] {
  const sets: IconSetDescriptor[] = [];

  for (const module of scanned) {
    const manifest = module.manifest;
    if (!isIconsetManifest(manifest)) continue;

    const warnings: string[] = [];
    const kind: IconSetKind = manifest.iconSource === 'sprite' ? 'sprite' : 'font';
    const icons = Array.isArray(manifest.icons) ? manifest.icons.filter((i) => typeof i === 'string') : [];

    if (icons.length === 0) {
      warnings.push(warn(module.name, 'iconset declares no icons — nothing to show in the picker'));
    }

    const set: IconSetDescriptor = {
      moduleName: module.name,
      name: typeof manifest.name === 'string' && manifest.name ? manifest.name : module.name,
      kind,
      icons,
      codeAsClass: manifest.codeAsClass === true,
      stylesheets: kind === 'font' ? readStylesheets(manifest) : [],
      warnings
    };

    if (kind === 'sprite') {
      if (typeof manifest.sprite !== 'string' || !manifest.sprite) {
        // Rejected, not degraded to a font: a sprite set with no sheet has no glyph to render and
        // no class to fall back on, so keeping it would put a row of blanks in the picker.
        warnings.push(warn(module.name, "iconset has iconSource 'sprite' but no 'sprite' path — set ignored"));
        sets.push({ ...set, icons: [], warnings });
        continue;
      }
      set.spriteUrl = joinModulePath(module.dirPath, manifest.sprite);
    } else {
      set.iconClass = typeof manifest.iconClass === 'string' ? manifest.iconClass : undefined;
      if (!set.iconClass && !set.codeAsClass) {
        warnings.push(warn(module.name, "font iconset has no 'iconClass' — glyphs will render in the default font"));
      }
    }

    sets.push(set);
  }

  return sets;
}

/**
 * The value a chosen glyph becomes.
 *
 * The font branch is **byte-identical to what the picker emitted before** — no `kind` field is
 * added. That is criterion 2: an existing project's icon parameters must not change shape, and
 * `Noodl.IconFontSource.kind` is optional precisely so the absence of it means font.
 */
export function iconValueForGlyph(set: IconSetDescriptor, glyph: string): IconSetValue {
  if (set.kind === 'sprite') {
    return { kind: 'sprite', url: set.spriteUrl as string, symbolId: glyph };
  }

  return { class: set.iconClass, code: glyph, codeAsClass: set.codeAsClass };
}

/** Whether a stored parameter is a sprite value. Structural, because the value is plain JSON. */
export function isSpriteIconValue(value: unknown): value is { kind: 'sprite'; url: string; symbolId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'sprite' &&
    typeof (value as { url?: unknown }).url === 'string'
  );
}

/**
 * Join a module-relative asset onto its module directory, leaving absolute URLs alone.
 *
 * Same rule `toInjectModules` applies to dependencies, and the same trap: `d.startsWith['http']`
 * is a property access and always truthy, which mangled every http dependency until LIB-003.
 */
function joinModulePath(dirPath: string, assetPath: string): string {
  if (/^https?:\/\//.test(assetPath) || assetPath.startsWith('/')) return assetPath;
  return dirPath + '/' + assetPath.replace(/^\.\//, '');
}

function warn(name: string, message: string): string {
  const line = `[iconsets] module "${name}": ${message}`;
  // eslint-disable-next-line no-console
  console.warn(line);
  return line;
}
