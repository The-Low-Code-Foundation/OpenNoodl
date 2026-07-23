/**
 * SUB-006 — Semantic Validator: rule registry
 *
 * The canonical, ordered list of rules. Order is "value order" (the order a
 * reader most wants to see problems in): unknown type → missing port → dangling
 * connection → unresolved component ref → orphaned node → type mismatch.
 *
 * @module noodl-editor/validation/rules
 */

import { Rule } from './types';
import { unknownNodeType } from './unknownNodeType';
import { nonexistentPort } from './nonexistentPort';
import { danglingConnection } from './danglingConnection';
import { unresolvedComponentRef } from './unresolvedComponentRef';
import { orphanedNode } from './orphanedNode';
import { typeIncompatibleConnection } from './typeIncompatibleConnection';

export const ALL_RULES: Rule[] = [
  unknownNodeType,
  nonexistentPort,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  typeIncompatibleConnection
];

export {
  unknownNodeType,
  nonexistentPort,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  typeIncompatibleConnection
};

export * from './types';
