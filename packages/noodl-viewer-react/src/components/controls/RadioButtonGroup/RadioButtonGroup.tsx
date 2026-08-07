import React, { useEffect, useState } from 'react';

import RadioButtonContext from '../../../contexts/radiobuttoncontext';
import Layout from '../../../layout';
import { Noodl, Slot } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';

export interface RadioButtonGroupProps extends Noodl.ReactProps {
  name: string;
  value: string;

  valueChanged?: (value: string) => void;

  children: Slot;
}

export function RadioButtonGroup(props: RadioButtonGroupProps) {
  // NDA-012 (Visual) A1. The selection and *how it was made* are one piece of state, not two:
  // stored apart they can be read in an order where the value is new and the provenance is
  // stale, and a Radio Button's `Changed` would then fire for a graph-driven selection.
  const [selection, setSelection] = useState({ value: props.value, fromUser: false });

  const context = {
    selected: selection.value,
    selectionFromUser: selection.fromUser,
    name: props.name,
    checkedChanged: (value) => {
      setSelection({ value, fromUser: true });
      props.valueChanged && props.valueChanged(value);
    }
  };

  // The graph's write path. `valueChanged` above also lands here a render later, because the
  // node mirrors the click back onto `props.value` — but by then the buttons' effects have
  // already run against `fromUser: true`, and `checked` does not change a second time, so
  // nothing re-fires.
  useEffect(() => {
    setSelection({ value: props.value, fromUser: false });
  }, [props.value]);

  const style: React.CSSProperties = { ...props.style };
  Layout.size(style, props);
  Layout.align(style, props);

  let className = 'ndl-controls-radiobuttongroup';
  if (props.className) className = className + ' ' + props.className;

  return (
    <RadioButtonContext.Provider value={context}>
      <div ref={noodlRootRef(props.noodlNode)} className={className} style={style}>
        {props.children}
      </div>
    </RadioButtonContext.Provider>
  );
}
