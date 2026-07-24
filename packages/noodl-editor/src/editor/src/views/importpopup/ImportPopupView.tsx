import React from 'react';

export type ImportPopupVariant = 'import' | 'overwrite' | 'export';

export interface ImportPopupItem {
  name: string;
  /** Set while building the tree */
  localName?: string;
  folder?: string;
  import?: boolean;
  implicit?: boolean;
  /** import || implicit — what the checkmark follows */
  check?: boolean;
}

export interface ImportPopupFolderState {
  open: boolean;
  import: boolean;
}

export interface ImportPopupSection {
  key: string;
  label: string;
  items: ImportPopupItem[];
}

export interface ImportPopupViewProps {
  variant: ImportPopupVariant;
  sections: ImportPopupSection[];
  /** Per-folder open/import state, keyed by folder path, owned by the popup */
  folders: Record<string, ImportPopupFolderState>;

  onToggleItem: (item: ImportPopupItem) => void;
  onToggleFolder: (path: string) => void;
  onToggleFolderOpen: (path: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

const INDENT = 12;
const INDENT_OFFSET = 20;

type TreeNode =
  | { type: 'item'; item: ImportPopupItem; depth: number }
  | { type: 'folder'; path: string; localName: string; depth: number; children: TreeNode[] };

/**
 * Group items into the folder tree the legacy view built as it appended rows:
 * items sorted by name, folders created on demand (parents first) and each item
 * placed inside its folder.
 */
export function buildTree(items: ImportPopupItem[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const folders = new Map<string, TreeNode & { type: 'folder' }>();

  function folderFor(path: string): TreeNode[] {
    if (path === '') return roots;

    const existing = folders.get(path);
    if (existing) return existing.children;

    const comps = path.split('/');
    const node: TreeNode & { type: 'folder' } = {
      type: 'folder',
      path,
      localName: comps[comps.length - 1],
      depth: comps.length - 1,
      children: []
    };
    folders.set(path, node);

    folderFor(comps.slice(0, comps.length - 1).join('/')).push(node);
    return node.children;
  }

  [...items]
    .sort((a, b) => (a.name > b.name ? 1 : -1))
    .forEach((item) => {
      const path = item.name[0] !== '/' ? '/' + item.name : item.name; // Prepend / if missing
      const comps = path.split('/');

      item.localName = comps[comps.length - 1];
      item.folder = comps.slice(0, comps.length - 1).join('/');

      folderFor(item.folder).push({ type: 'item', item, depth: comps.length - 1 });
    });

  return roots;
}

/** The legacy `data-class="!check:hidden,implicit:…,import:…"` box, both marker classes can apply */
function CheckBox({
  isChecked,
  isImplicit,
  isImport,
  onClick
}: {
  isChecked: boolean;
  isImplicit: boolean;
  isImport: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="sidebar-panel-dark-input"
      style={{ position: 'absolute', left: 2, width: 24, top: 3, bottom: 3 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <i
        className={
          'fa fa-check' +
          (isChecked ? '' : ' hidden') +
          (isImplicit ? ' import-popup-implicit-check' : '') +
          (isImport ? ' import-popup-import-check' : '')
        }
        style={{ position: 'absolute', left: 7, top: 5 }}
      />
    </div>
  );
}

function Row({
  node,
  folders,
  onToggleItem,
  onToggleFolder,
  onToggleFolderOpen
}: {
  node: TreeNode;
} & Pick<ImportPopupViewProps, 'folders' | 'onToggleItem' | 'onToggleFolder' | 'onToggleFolderOpen'>) {
  const left = node.depth * INDENT + INDENT_OFFSET;

  if (node.type === 'item') {
    const item = node.item;

    return (
      <div className="import-popup-item" style={{ width: '100%', height: 24, position: 'relative' }}>
        <CheckBox
          isChecked={Boolean(item.check)}
          isImplicit={Boolean(item.implicit)}
          isImport={Boolean(item.import)}
          onClick={() => onToggleItem(item)}
        />
        <div
          className="indent-me"
          style={{ lineHeight: '20px', position: 'absolute', top: 3, bottom: 3, right: 3, left }}
        >
          {item.localName}
        </div>
      </div>
    );
  }

  const state = folders[node.path] || { open: true, import: false };

  return (
    <div className="import-popup-folder" style={{ width: '100%', position: 'relative' }}>
      <div style={{ width: '100%', height: 24, position: 'relative' }}>
        <CheckBox
          isChecked={state.import}
          isImplicit={false}
          isImport={state.import}
          onClick={() => onToggleFolder(node.path)}
        />
        <div
          className="indent-me"
          style={{ width: '100%', height: 24, position: 'absolute', left }}
          onClick={() => onToggleFolderOpen(node.path)}
        >
          <div style={{ position: 'absolute', width: 28, top: 4, bottom: 4 }}>
            <i className={'fa ' + (state.open ? 'fa-caret-down' : 'fa-caret-right')} />
          </div>
          <div style={{ lineHeight: '20px', position: 'absolute', left: 10, top: 3, bottom: 3, right: 3 }}>
            {node.localName}
          </div>
        </div>
      </div>

      <div className="content" style={{ display: state.open ? 'block' : 'none' }}>
        {node.children.map((child, i) => (
          <Row
            key={i}
            node={child}
            folders={folders}
            onToggleItem={onToggleItem}
            onToggleFolder={onToggleFolder}
            onToggleFolderOpen={onToggleFolderOpen}
          />
        ))}
      </div>
    </div>
  );
}

const SECTION_NOUNS: Record<string, string> = {
  components: 'components',
  resources: 'resources',
  modules: 'modules',
  variants: 'variants',
  'color-styles': 'color styles',
  'text-styles': 'text styles'
};

function sectionText(variant: ImportPopupVariant, key: string) {
  const noun = SECTION_NOUNS[key];

  if (variant === 'export') return `Select which ${noun} to export from the project.`;
  if (variant === 'overwrite') return `Choose which ${noun} that will be imported and overwrite your current ${noun}.`;
  return `Select which ${noun} to import from the project.`;
}

/**
 * The import / overwrite-collisions / export popup — one view for what used to be
 * three near-identical templates driven by the same class.
 */
export function ImportPopupView({
  variant,
  sections,
  folders,
  onToggleItem,
  onToggleFolder,
  onToggleFolderOpen,
  onOk,
  onCancel
}: ImportPopupViewProps) {
  const isExport = variant === 'export';
  const labelStyle: React.CSSProperties = isExport ? { position: 'sticky', zIndex: 1, top: 0 } : {};

  return (
    <div style={{ width: 400 }}>
      <div style={{ height: isExport ? 700 : 500, overflow: 'hidden auto' }}>
        {variant === 'overwrite' && (
          <>
            <label className="popup-group-label">COLLISIONS</label>
            <div className="import-popup-text">
              There are collisions when importing, you may select what to import (current project will be overwritten)
              and what to leave as is.
            </div>
          </>
        )}

        {sections
          .filter((section) => section.items.length > 0)
          .map((section, index) => (
            <div key={section.key} style={index === 0 && variant !== 'overwrite' ? undefined : { marginTop: 20 }}>
              <label className="popup-group-label" style={labelStyle}>
                {section.label}
              </label>

              <div className="import-popup-text">{sectionText(variant, section.key)}</div>

              <div className={section.key} style={{ marginTop: 10, width: '100%' }}>
                {buildTree(section.items).map((node, i) => (
                  <Row
                    key={i}
                    node={node}
                    folders={folders}
                    onToggleItem={onToggleItem}
                    onToggleFolder={onToggleFolder}
                    onToggleFolderOpen={onToggleFolderOpen}
                  />
                ))}
              </div>
            </div>
          ))}

        {variant === 'overwrite' && (
          <div className="import-popup-text" style={{ marginTop: 20 }}>
            <strong>Warning</strong> this operation cannot be undone! Would you like to proceed?
          </div>
        )}

        <div style={{ height: 30, padding: 5, paddingBottom: 10, marginTop: 20 }}>
          <button className="popup-button" onClick={onOk}>
            {variant === 'export' ? 'EXPORT' : variant === 'overwrite' ? 'Overwrite' : 'IMPORT'}
          </button>
          <button className="popup-button-grey" onClick={onCancel}>
            {variant === 'overwrite' ? 'Cancel' : 'CANCEL'}
          </button>
        </div>
      </div>
    </div>
  );
}
