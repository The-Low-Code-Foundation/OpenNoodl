import classNames from 'classnames';
import React from 'react';

import { platform } from '@noodl/platform';

import { tracker } from '@noodl-utils/tracker';

import { HtmlRenderer } from '@noodl-core-ui/components/common/HtmlRenderer';
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { getPreviewPorts, NodeDocs } from '../../NodePicker.hooks';
import { nodeIconName } from '../../NodePicker.icons';
import { PickerItem } from '../../NodePicker.search';
import css from './NodePickerPreview.module.scss';

export interface NodePickerPreviewProps {
  item: PickerItem | undefined;
  docs: NodeDocs;
}

/**
 * The right-hand pane (UIX-013).
 *
 * It used to be a fixed "Noodl AI (Beta)" promo for a product that no longer
 * exists under that name — a third of the picker spent on an advert while the
 * node you were about to place went undescribed. It now always previews the
 * node under the cursor or the mouse: identity, category, documentation and
 * the ports you would wire it up by.
 */
export function NodePickerPreview({ item, docs }: NodePickerPreviewProps) {
  if (!item) {
    return (
      <aside className={css['Root']}>
        <div className={css['Empty']}>
          <Icon icon={IconName.Search} />
          <p>Pick a node to see what it does and which ports it has.</p>
        </div>
      </aside>
    );
  }

  const iconName = item.kind === 'action' ? IconName.Chat : nodeIconName(item.name);
  const { ports, total } = getPreviewPorts(item.type);

  return (
    <aside className={classNames(css['Root'], css[`Root--tint-${item.tint}`])}>
      <header className={css['Head']}>
        <div className={css['HeadRow']}>
          <span className={css['Glyph']}>
            {iconName ? <Icon icon={iconName} /> : <span className={css['GlyphLetter']}>{item.label[0]}</span>}
          </span>
          <h2 className={css['Name']}>{item.label}</h2>
        </div>
        <span className={css['Chip']}>{item.subCategoryName ? `${item.categoryName} · ${item.subCategoryName}` : item.categoryName}</span>
      </header>

      <div className={css['Body']}>
        {docs.content ? (
          <div className={css['Docs']}>
            <HtmlRenderer html={docs.content} />
          </div>
        ) : (
          <p className={css['Placeholder']}>
            {item.kind === 'action' ? item.meta : 'No documentation yet.'}
          </p>
        )}
      </div>

      {/* Pinned below the docs rather than after them: a node's documentation
          can run to several screens, and the ports are the part you came for. */}
      {Boolean(ports.length) && (
        <div className={css['Ports']}>
          <p className={css['SubTitle']}>
            Key ports {total > ports.length && <span className={css['SubCount']}>{ports.length} of {total}</span>}
          </p>
          {ports.map((port) => (
            <div key={`${port.direction}-${port.name}`} className={css['Port']}>
              <span className={classNames(css['Pin'], port.isSignal ? css['Pin--is-signal'] : css['Pin--is-data'])} />
              <code className={css['PortName']}>{port.name}</code>
              <span className={css['PortDirection']}>{port.direction}</span>
            </div>
          ))}
        </div>
      )}

      {Boolean(docs.url) && (
        <footer className={css['Foot']}>
          <button
            type="button"
            className={css['DocsButton']}
            onClick={() => {
              tracker.track('Open Node Docs Clicked', { url: docs.url });
              platform.openExternal(docs.url);
            }}
          >
            <Icon icon={IconName.ExternalLink} />
            Open full docs
          </button>
        </footer>
      )}
    </aside>
  );
}
