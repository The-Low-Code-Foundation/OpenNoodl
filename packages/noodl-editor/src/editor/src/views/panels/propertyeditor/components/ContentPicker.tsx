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

export interface ContentPickerProps {
  title: string;
  items: ContentPickerItem[];
  filter?: string;
  /** 'folder' groups by folder with root first (fonts/images/files);
   *  'nameDesc' is the identifier picker's flat descending sort. */
  sortMode?: 'folder' | 'nameDesc';
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
export function ContentPicker({ title, items, filter, sortMode = 'folder', onSelect }: ContentPickerProps) {
  const sorted = [...items].sort(
    sortMode === 'nameDesc' ? (a, b) => (a.name > b.name ? -1 : 1) : folderCompare
  );

  const lowerFilter = (filter || '').toLowerCase();
  const rows: React.ReactNode[] = [];
  let folder: string | undefined;

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
        {rows}
      </div>
    </div>
  );
}
