import classNames from 'classnames';
import React from 'react';

import { platform } from '@noodl/platform';

import { tracker } from '@noodl-utils/tracker';

import { HtmlRenderer } from '@noodl-core-ui/components/common/HtmlRenderer';
import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { ExportBadge } from '../../../common/ExportBadge';
import { getChooserNote } from '../../NodePicker.chooser';
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
  // LGC-001 §2 — present for the three logic nodes only.
  const chooser = item.kind === 'node' ? getChooserNote(item.name) : undefined;

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

      {/* EXP-013 AC1 — the "expand" of the card's badge: the ledger's own sentence in full, above
          the docs, because "will this survive an export" is decided before "what does it do"
          for someone who intends to export. The same `Chooser` frame LGC-001 uses for a note
          that is about this node's place in the product rather than about the node itself. */}
      {item.exportBadge && (
        <div className={css['Chooser']} data-test="export-badge-reason">
          <p className={css['ChooserHeadline']}>
            <ExportBadge badge={item.exportBadge} variant="header" />
          </p>
          <p className={css['ChooserDetail']}>
            {item.exportBadge.kind === 'scheduled'
              ? 'You can place and run it, but "Export as React code" leaves it out — and every node it fires — until a release translates it. '
              : 'You can place and run it, but "Export as React code" leaves it out — and every node it fires. '}
            {item.exportBadge.reason}
          </p>
        </div>
      )}

      {/* LGC-001 §2 — above the reference prose, not inside it. The docs below
          answer "what does this node do"; this answers "why this one and not
          the other two", which is the question a person has while the picker is
          open and the only question the enriched catalog cannot answer, because
          it is written one node at a time. */}
      {chooser && (
        <div className={css['Chooser']}>
          <p className={css['ChooserHeadline']}>{chooser.headline}</p>
          {Boolean(chooser.detail) && <p className={css['ChooserDetail']}>{chooser.detail}</p>}
          {Boolean(chooser.examples.length) && (
            <ul className={css['ChooserExamples']}>
              {chooser.examples.map((example) => (
                <li key={example}>
                  <code className={css['ChooserExample']}>{example}</code>
                </li>
              ))}
            </ul>
          )}
          <p className={css['ChooserSignals']}>{chooser.signals}</p>
        </div>
      )}

      <div className={css['Body']}>
        {docs.content ? (
          <div className={css['Docs']}>
            <HtmlRenderer html={docs.content} />
          </div>
        ) : item.description ? (
          // LEG-006 — a project component has no docs page and never will; its
          // description is the documentation. The card's line is one row tall
          // and ellipsised, so the full sentence needs somewhere to be read.
          <p className={css['Placeholder']}>{item.description}</p>
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
