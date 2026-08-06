import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { NodeLibrary } from '@noodl-models/nodelibrary';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import PopupLayer from '../../popuplayer';
import css from '../ConnectionPopup.module.scss';
import { docsParser } from '../DocsParser';
import { DocsPopup } from './DocsPopup';

const _shouldShowDocsForPort = {}; // Ugly fix for not showing duplicate docs on ports

export function PortItem(props: TSFixme) {
  const ref = useRef(null);
  const [showDocs, setShowDocs] = useState(false);
  const [docs, setDocs] = useState<string | undefined>(undefined);

  let tooltipTimeout;
  const onMouseOver = () => {
    if (props.port.message) {
      const bounds = ref.current.getBoundingClientRect();
      tooltipTimeout = setTimeout(() => {
        PopupLayer.instance.showTooltip({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height,
          position: 'bottom',
          content: props.port.message
        });
      }, 1000);
    }

    const p = props.port;
    _shouldShowDocsForPort[p.name] = true;

    // ALPHA-006 §1: a bundled-catalog lookup on the port's canonical name.
    // The three-step display-name / name / longest-regexp cascade this replaced
    // existed because the old markdown markers were hand-keyed and sometimes
    // wildcards; the catalog's keys are the port names themselves.
    docsParser.getDocsForType(p.parent?.type, (docs) => {
      if (!_shouldShowDocsForPort[p.name]) return; // Make sure we should still show docs for port

      const ports = p.section === 'from' ? docs.outputs : docs.inputs;
      const d = ports[p.name];

      if (d) {
        // There is documentation for this port
        setDocs(d);
        setShowDocs(true);
      }
    });
  };

  const onMouseOut = () => {
    _shouldShowDocsForPort[props.port.name] = false;
    PopupLayer.instance.hideTooltip();
    clearTimeout(tooltipTimeout);
    setDocs(undefined);
    setShowDocs(false);
  };

  const p = props.port;
  const state = (props.isSelected && 'selected') || (p.disabled && 'disabled') || 'enabled';

  useEffect(() => {
    if (props.isSelected) {
      ref?.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [props.isSelected]);

  return (
    <div>
      <div
        ref={ref}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        className={classNames(css.listElementPort, css[state])}
        onClick={props.onClick}
      >
        {NodeLibrary.nameForPortType(p.type) === 'signal' ? (
          <div className={css.signalIcon}>
            <Icon icon={IconName.Lightning} UNSAFE_style={{ width: 15, height: 15 }} />
          </div>
        ) : null}
        {p.annotatedName !== undefined ? (
          <span dangerouslySetInnerHTML={{ __html: p.annotatedName }} />
        ) : (
          <span>{p.displayName}</span>
        )}
        {showDocs ? <DocsPopup name={p.displayName} type={p.type} body={docs} /> : null}
      </div>
    </div>
  );
}
