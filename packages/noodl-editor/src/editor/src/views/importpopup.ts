import React from 'react';
import { createRoot, Root } from 'react-dom/client';

import {
  ImportPopupFolderState,
  ImportPopupItem,
  ImportPopupSection,
  ImportPopupVariant,
  ImportPopupView
} from './importpopup/ImportPopupView';

export interface ImportPopupArgs {
  /** Which of the three legacy templates this popup used to be */
  variant?: ImportPopupVariant;
  imports: TSFixme;
  initAllAsImport?: boolean;
  ignoreDependencies?: boolean;
  onOk?: () => void;
  onCancel?: () => void;
}

const SECTIONS: { key: string; label: string; get: (imports: TSFixme) => ImportPopupItem[] }[] = [
  { key: 'components', label: 'COMPONENTS', get: (i) => i.components },
  { key: 'resources', label: 'RESOURCES', get: (i) => i.resources },
  { key: 'modules', label: 'MODULES', get: (i) => i.modules },
  { key: 'variants', label: 'VARIANTS', get: (i) => i.variants },
  { key: 'color-styles', label: 'COLOR STYLES', get: (i) => i.styles.colors },
  { key: 'text-styles', label: 'TEXT STYLES', get: (i) => i.styles.text }
];

/**
 * Pick what to import from a project, what to overwrite when the import collides,
 * and what to export — the same list with different copy, which is why one class
 * used to be rendered with three templates.
 */
export class ImportPopup {
  el: HTMLElement;

  variant: ImportPopupVariant;
  imports: TSFixme;
  initAllAsImport: boolean;
  ignoreDependencies: boolean;
  onOk: () => void;
  onCancel: () => void;

  private root: Root | null = null;
  private folders: Record<string, ImportPopupFolderState> = {};

  constructor(args: ImportPopupArgs) {
    this.variant = args.variant || 'import';

    for (const i in args) this[i] = args[i];

    if (this.initAllAsImport === true) {
      this.imports.components.forEach((c) => (c.import = true));
      this.imports.resources.forEach((c) => (c.import = true));
      this.imports.modules.forEach((c) => (c.import = true));
      this.imports.variants.forEach((c) => (c.import = true));
      this.imports.styles.colors.forEach((c) => (c.import = true));
      this.imports.styles.text.forEach((c) => (c.import = true));
    }
    this.updateDependencies();
  }

  render() {
    this.el = document.createElement('div');

    if (!this.root) {
      this.root = createRoot(this.el);
    }

    this.renderReact();

    return this.el;
  }

  dispose() {
    if (this.root) {
      const root = this.root;
      this.root = null;
      setTimeout(() => root.unmount(), 0);
    }
  }

  private getSections(): ImportPopupSection[] {
    return SECTIONS
      // The collisions popup never listed text styles
      .filter((section) => !(this.variant === 'overwrite' && section.key === 'text-styles'))
      .map((section) => ({
        key: section.key,
        label: section.label,
        items: section.get(this.imports) || []
      }));
  }

  private folderState(path: string): ImportPopupFolderState {
    if (!this.folders[path]) this.folders[path] = { open: true, import: false };
    return this.folders[path];
  }

  renderReact() {
    if (!this.root) return;

    this.root.render(
      React.createElement(ImportPopupView, {
        variant: this.variant,
        sections: this.getSections(),
        folders: this.folders,
        onToggleItem: (item) => {
          item.import = !item.import;
          this.updateDependencies();
          this.renderReact();
        },
        onToggleFolder: (path) => {
          const folder = this.folderState(path);
          folder.import = !folder.import;

          // Set all items (resources or components) in this folder to the
          // folder import status
          this.getSections().forEach((section) => {
            section.items.forEach((item) => {
              const itemPath = item.name[0] !== '/' ? '/' + item.name : item.name;
              if (itemPath.indexOf(path) === 0) item.import = folder.import;
            });
          });

          // Same for sub folders
          Object.keys(this.folders).forEach((other) => {
            if (other.indexOf(path) === 0) this.folders[other].import = folder.import;
          });

          this.updateDependencies();
          this.renderReact();
        },
        onToggleFolderOpen: (path) => {
          const folder = this.folderState(path);
          folder.open = !folder.open;
          this.renderReact();
        },
        onOk: () => this.onOk && this.onOk(),
        onCancel: () => {
          // Timeout for tick reasons
          setTimeout(() => {
            this.onCancel && this.onCancel();
          }, 10);
        }
      })
    );
  }

  updateDependencies() {
    // Update implicit import status for components
    const components = this.imports.components;
    const resources = this.imports.resources;
    const modules = this.imports.modules;
    const variants = this.imports.variants;
    const styles = this.imports.styles;

    // First unmark all
    components.forEach((c) => (c.implicit = false));
    resources.forEach((r) => (r.implicit = false));
    modules.forEach((m) => (m.implicit = false));
    variants.forEach((v) => (v.implicit = false));
    styles.colors.forEach((c) => (c.implicit = false));
    styles.text.forEach((t) => (t.implicit = false));

    if (this.ignoreDependencies !== true) {
      const _markComponent = (name) => {
        components.forEach((c) => {
          if (c.name === name) {
            c.implicit = true;
            c.fileDependencies.forEach((d) => _markResource(d));
            c.dependencies.forEach((d) => _markComponent(d));
            c.styleDependencies.colors.forEach((d) => _markColorStyle(d));
            c.styleDependencies.text.forEach((d) => _markTextStyle(d));
            c.variantDependencies.forEach((d) => _markVariant(d));
          }
        });
      };

      const _markResource = (name) => {
        resources.forEach((r) => {
          if (r.name === name) r.implicit = true;
        });
      };

      const _markColorStyle = (name) => {
        styles.colors.forEach((c) => {
          if (c.name === name) c.implicit = true;
        });
      };

      const _markTextStyle = (name) => {
        styles.text.forEach((t) => {
          if (t.name === name) {
            t.implicit = true;
            t.fileDependencies.forEach((d) => _markResource(d));
          }
        });
      };

      const _markVariant = (_v) => {
        variants.forEach((v) => {
          if (v.name === _v.name && v.typename === _v.typename) {
            v.implicit = true;
            v.fileDependencies.forEach((d) => _markResource(d));
            v.styleDependencies.colors.forEach((d) => _markColorStyle(d));
            v.styleDependencies.text.forEach((d) => _markTextStyle(d));
          }
        });
      };

      components.forEach((c) => {
        c.import && _markComponent(c.name);
      });
      variants.forEach((v) => {
        v.import && _markVariant(v);
      });
      styles.text.forEach((t) => {
        t.import && _markTextStyle(t.name);
      });
    }

    function _isChecked(c) {
      return c.implicit || c.import;
    }
    components.forEach((c) => (c.check = _isChecked(c)));
    resources.forEach((c) => (c.check = _isChecked(c)));
    variants.forEach((c) => (c.check = _isChecked(c)));
    modules.forEach((c) => (c.check = _isChecked(c)));
    styles.text.forEach((c) => (c.check = _isChecked(c)));
    styles.colors.forEach((c) => (c.check = _isChecked(c)));
  }

  getSelectedImports() {
    const components = this.imports.components;
    const resources = this.imports.resources;
    const modules = this.imports.modules;
    const variants = this.imports.variants;
    const styles = this.imports.styles;

    const imports = {
      components: components.filter((c) => c.import || c.implicit),
      resources: resources.filter((c) => c.import || c.implicit),
      modules: modules.filter((c) => c.import || c.implicit),
      variants: variants.filter((c) => c.import || c.implicit),
      styles: {
        colors: styles.colors.filter((c) => c.import || c.implicit),
        text: styles.text.filter((c) => c.import || c.implicit)
      }
    };

    return imports;
  }

  getUnselectedImports() {
    const components = this.imports.components;
    const resources = this.imports.resources;
    const modules = this.imports.modules;
    const variants = this.imports.variants;
    const styles = this.imports.styles;

    const unselected = {
      components: components.filter((c) => c.import === false),
      resources: resources.filter((c) => c.import === false),
      modules: modules.filter((c) => c.import === false),
      variants: variants.filter((c) => c.import === false),
      styles: {
        colors: styles.colors.filter((c) => c.import === false),
        text: styles.text.filter((c) => c.import === false)
      }
    };

    return unselected;
  }
}

export default ImportPopup;
