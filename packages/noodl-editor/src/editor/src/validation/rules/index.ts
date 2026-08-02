/**
 * SUB-006 — Semantic Validator: rule registry
 *
 * The canonical, ordered list of rules. Order is "value order" (the order a
 * reader most wants to see problems in): duplicate id → unknown type → missing
 * port → dangling connection → unresolved component ref → orphaned node → type
 * mismatch → mis-sequenced control signal.
 *
 * `duplicateNodeId` leads because a colliding id undermines every rule after
 * it: the others resolve nodes by id, so if the primary key is not unique their
 * findings are reported against whichever node won the collision.
 *
 * @module noodl-editor/validation/rules
 */

import { Rule } from './types';
import { duplicateNodeId } from './duplicateNodeId';
import { unknownNodeType } from './unknownNodeType';
import { nonexistentPort } from './nonexistentPort';
import { danglingConnection } from './danglingConnection';
import { unresolvedComponentRef } from './unresolvedComponentRef';
import { orphanedNode } from './orphanedNode';
import { typeIncompatibleConnection } from './typeIncompatibleConnection';
import { signalDrivenStaleInput } from './signalDrivenStaleInput';
import { unwiredOutcome } from './unwiredOutcome';

export const ALL_RULES: Rule[] = [
  duplicateNodeId,
  unknownNodeType,
  nonexistentPort,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  typeIncompatibleConnection,
  signalDrivenStaleInput,
  unwiredOutcome
];

export {
  duplicateNodeId,
  unknownNodeType,
  nonexistentPort,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  typeIncompatibleConnection,
  signalDrivenStaleInput,
  unwiredOutcome
};

export * from './types';
