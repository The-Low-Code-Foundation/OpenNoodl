import React from 'react';

export interface IRadioButtonContext {
  name: string;
  selected: string;
  /**
   * Whether `selected` got its current value from a click rather than from the group's `Value`
   * input.
   *
   * NDA-012 (Visual) A1. The Radio Button's own `Changed` output has to mean what `Changed`
   * means on `Checkbox` and on `Radio Button Group` — *the user did this* — and only the group
   * knows which of its two write paths ran. Without this the graph setting the group's `Value`
   * would fire every affected button's `Changed` while the group's own stayed silent, which is
   * the inconsistency A1 is about, reintroduced one level down.
   */
  selectionFromUser: boolean;
  checkedChanged?: (value: string) => void;
}

/**
 * `null` when there is no `Radio Button Group` above this button — see NDA-012 (Visual) F1.
 *
 * ⚠️ The default used to be an *object* with undefined fields, which is truthy, so a Radio
 * Button outside a group could not tell that it was outside one. Two consequences: the node had
 * nowhere to report the condition from (F1), and `selected === props.value` compared
 * `undefined === undefined` and rendered a groupless button with no `Value` as **checked** — a
 * control that looks selected, cannot be deselected, and reports nothing.
 */
const RadioButtonContext = React.createContext<IRadioButtonContext | null>(null);

export default RadioButtonContext;
