import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';

import { NodeLibrary } from '@noodl-models/nodelibrary';
import { portWireShape } from '@noodl-models/nodelibrary/portWireShape';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import css from '../ConnectionPopup.module.scss';
import { docsParser } from '../DocsParser';
import { portTypeSentence } from '../portCopy';
import { DocsPopup } from './DocsPopup';

const _shouldShowDocsForPort = {}; // Ugly fix for not showing duplicate docs on ports

export function PortItem(props: TSFixme) {
  /*
   * FB-019 scope (3) — what this port takes, for the structured types. Read from
   * the node's stored parameter as well as the declaration, because an author who
   * picked a unit in the property panel keeps it whatever the port declares
   * (`Node.setInputValue` merges a bare number into the stored object).
   */
  const wireShape = portWireShape(
    props.port,
    props.port?.parent?.parameters ? props.port.parent.parameters[props.port.name] : undefined
  );

  const ref = useRef(null);
  const [showDocs, setShowDocs] = useState(false);
  const [docs, setDocs] = useState<string | undefined>(undefined);
  /*
   * SPR-003 §4 (F94): the explainer used to have no anchor at all and landed in
   * the bottom-left corner of the window. It is read here rather than inside
   * `DocsPopup` because by the time the catalog lookup returns this row is the
   * only thing that still knows which element was hovered.
   */
  const [docsAnchor, setDocsAnchor] = useState<DOMRect | undefined>(undefined);

  /*
   * SIG-001 — `port.message` used to open a `PopupLayer` tooltip after a 1000ms
   * hover, and this is the *third* half of the refusal UI that had never run:
   * `message` is only ever set on a refused port, and `ConnectionBar` deleted
   * every refused port before a `PortItem` could be built from one. So this
   * tooltip has fired exactly as often as the disabled row style has been seen,
   * which is never.
   *
   * Reviving it as written would have put two floating boxes under one pointer —
   * this tooltip and the port explainer, which now shows on every port. It is
   * folded into the explainer instead: one surface, no 1000ms wait, and the type
   * names the message carries stay available to somebody debugging a custom
   * module's port types (SIG-001 §4's warning).
   */
  const onMouseOver = () => {
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

      /*
       * SIG-004: this used to be `if (d) { … }` — a port the catalog has no
       * entry for showed no explainer at all. That guard is why a type sentence
       * added to `DocsPopup` would have appeared only on already-documented
       * ports, which are the ones that least need it, and why 35% of the library
       * has never explained one of its ports on hover.
       *
       * The popup now shows when there is a type sentence **or** a body. `docs`
       * may be undefined; `DocsPopup` treats it as absent rather than empty.
       */
      setDocs(d);
      // Measured at show time, not at hover time: the list scrolls itself
      // (`scrollIntoView` on selection) and the popup follows the node, so a
      // rect taken earlier can already be stale by the time the docs arrive.
      setDocsAnchor(ref.current ? ref.current.getBoundingClientRect() : undefined);
      /*
       * FB-019 scope (3): a wire shape is on its own sufficient reason to open
       * the explainer. Without this clause a units port that the catalog has no
       * entry for would compute a shape sentence and never render it — the same
       * shape of hole SIG-004 found here, one field along.
       */
      setShowDocs(
        Boolean(d) ||
          portTypeSentence(p.typeName, p.section === 'from' ? 'output' : 'input') !== undefined ||
          wireShape !== undefined
      );
    });
  };

  const onMouseOut = () => {
    _shouldShowDocsForPort[props.port.name] = false;
    setDocs(undefined);
    setDocsAnchor(undefined);
    setShowDocs(false);
  };

  const p = props.port;
  const state = (props.isSelected && 'selected') || (p.disabled && 'disabled') || 'enabled';
  // SIG-001: a refused row that redirects is a control; one with nowhere to send
  // you is a statement. They must not look the same.
  const isRedirect = Boolean(p.disabled && props.onClick);

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
        className={classNames(css.listElementPort, css[state], isRedirect && css.redirects)}
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
        {showDocs ? (
          <DocsPopup
            name={p.displayName}
            type={p.type}
            typeName={p.typeName}
            direction={p.section === 'from' ? 'output' : 'input'}
            body={docs}
            wireShape={wireShape}
            refusal={p.disabled ? p.message : undefined}
            anchor={docsAnchor}
          />
        ) : null}
      </div>
    </div>
  );
}
