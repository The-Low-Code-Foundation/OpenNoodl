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
            <HtmlRenderer html={stripEmbeds(docs.content)} />
          </div>
        ) : (
          <p className={css['Placeholder']}>
            {docs.isLoading ? 'Loading documentation…' : item.kind === 'action' ? item.meta : 'No documentation yet.'}
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

/**
 * Trim the fetched documentation for a 292px column.
 *
 * Node pages open with a run of tutorial videos, authored as
 * `<p>Tutorial 1: Styling</p><div class="youtube-embed"><iframe …>`. In this
 * width the iframe is an error box (the YouTube player refuses the `file://`
 * origin) rather than a video, and its caption is meaningless without it — so
 * the embed and the caption above it both go, and the page starts on the
 * description. The leading `<h1>` goes too: the pane already shows the node's
 * name one line above, in the right typography.
 */
function stripEmbeds(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;

  // `DocsParser` hands over its own wrapper element's `outerHTML`, so the
  // content is one level down.
  const root = el.children.length === 1 && el.firstElementChild.tagName === 'DIV' ? el.firstElementChild : el;

  root.querySelectorAll('iframe, video, script').forEach((node) => {
    const block = node.parentElement && node.parentElement !== root ? node.parentElement : node;
    const caption = block.previousElementSibling;

    if (caption && caption.tagName === 'P' && caption.textContent.trim().length < 60) caption.remove();
    block.remove();
  });

  const first = root.firstElementChild;
  if (first && /^H[1-3]$/.test(first.tagName)) first.remove();

  return el.innerHTML;
}
