import React from 'react';

export interface ContentPickerItem {
  name: string;
  /** The committed value; also the filter target */
  fullPath: string;
  /** '/', a project subfolder, or 'Common fonts' */
  folder?: string;
  thumbnail?: string;
  fontFamily?: string;
}

/** A route out of an empty picker — "Import image…", "Show project folder". */
export interface ContentPickerAction {
  label: string;
  onClick: () => void;
}

/**
 * FB-015 AC1/AC5 — what a picker says when it has nothing to offer, supplied per type.
 *
 * 🔴 The picker used to render the header over a blank scroll div, which is the *same* picture for
 * "this project has no images", "the walk is still running" and "the loader returned early and
 * will never call back" — the third being the actual filed bug (`ImageType`'s `if (!filesLeft)
 * return`). The three are separate states below, and this one only shows once a loader has
 * reported.
 */
export interface ContentPickerEmptyState {
  /** Why the list is blank, in the author's terms. */
  message: string;
  /** The routes out of it, in prose. */
  hint?: string;
}

export interface ContentPickerProps {
  title: string;
  items: ContentPickerItem[];
  filter?: string;
  /** 'folder' groups by folder with root first (fonts/images/files);
   *  'nameDesc' is the identifier picker's flat descending sort. */
  sortMode?: 'folder' | 'nameDesc';
  /** True until a loader has reported — distinguishes "still looking" from "nothing there". */
  isLoading?: boolean;
  /** Shown instead of a blank panel once loading has finished and there is nothing to list. */
  emptyState?: ContentPickerEmptyState;
  /**
   * Routes out of the picker, drawn in a footer that is **always** visible.
   *
   * 🔴 These were part of the empty state until the drive: importing the first image made the
   * empty state — and with it the Import button — disappear, so there was no way to import a
   * SECOND image. The route vanished exactly when the author started using it.
   */
  actions?: ContentPickerAction[];
  onSelect: (item: ContentPickerItem) => void;
}

function folderCompare(a: ContentPickerItem, b: ContentPickerItem) {
  if (a.folder === '/' && b.folder !== '/') return -1;
  if (b.folder === '/' && a.folder !== '/') return 1;

  // Fonts list the built-in fonts last
  if (a.folder === 'Common fonts' && b.folder !== 'Common fonts') return 1;
  if (b.folder === 'Common fonts' && a.folder !== 'Common fonts') return -1;

  return a.fullPath < b.fullPath ? -1 : 1;
}

/**
 * The shared popout list used by the font/image/identifier/file pickers:
 * a header label, optional folder group labels, and clickable items.
 * Reuses the legacy content-picker CSS.
 */
export function ContentPicker({
  title,
  items,
  filter,
  sortMode = 'folder',
  isLoading = false,
  emptyState,
  actions,
  onSelect
}: ContentPickerProps) {
  const sorted = [...items].sort(
    sortMode === 'nameDesc' ? (a, b) => (a.name > b.name ? -1 : 1) : folderCompare
  );

  const lowerFilter = (filter || '').toLowerCase();
  const rows: React.ReactNode[] = [];
  let folder: string | undefined;
  // 🔴 Counted separately from `rows`, which also holds folder headings: a filter that excludes
  // every item still leaves its group labels behind, so `rows.length` is never zero and would
  // report "there is something here" for a panel showing only headings.
  let visibleItems = 0;

  sorted.forEach((item, i) => {
    if (sortMode === 'folder' && item.folder !== folder) {
      folder = item.folder;
      if (folder !== '/') {
        rows.push(
          <div key={'folder:' + folder} className="content-picker-group-label">
            {folder}
          </div>
        );
      }
    }

    if (lowerFilter !== '' && item.fullPath.toLowerCase().indexOf(lowerFilter) === -1) return;

    visibleItems++;
    rows.push(
      <div
        key={item.fullPath + ':' + i}
        className="content-picker-list-item"
        style={item.thumbnail !== undefined ? { minHeight: 56, position: 'relative', display: 'flex', alignItems: 'center' } : undefined}
        onClick={() => onSelect(item)}
      >
        <div
          className="content-picker-item"
          style={{
            ...(item.thumbnail !== undefined ? { flexGrow: 1 } : undefined),
            ...(item.fontFamily ? { fontFamily: item.fontFamily } : undefined)
          }}
        >
          {item.name}
        </div>
        {item.thumbnail !== undefined && (
          <div
            className="image-picker-thumb-bg"
            style={{
              width: 50,
              height: 50,
              marginRight: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img style={{ width: 46, height: 46 }} src={item.thumbnail || undefined} />
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="content-picker">
      <label className="content-picker-header-label">{title}</label>
      <div className="content-picker-items" style={{ overflowY: 'auto' }}>
        {visibleItems > 0 && rows}
        {visibleItems === 0 && isLoading && <div className="content-picker-message">Looking…</div>}
        {visibleItems === 0 && !isLoading && items.length > 0 && (
          <div className="content-picker-message">Nothing here matches “{filter}”.</div>
        )}
        {visibleItems === 0 && !isLoading && items.length === 0 && emptyState && (
          <div className="content-picker-empty">
            <div className="content-picker-empty-message">{emptyState.message}</div>
            {emptyState.hint && <div className="content-picker-empty-hint">{emptyState.hint}</div>}
          </div>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="content-picker-actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className="content-picker-empty-action" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
