/**
 * SUB-006 — Semantic Validator: rule registry
 *
 * The canonical, ordered list of rules. Order is "value order" (the order a
 * reader most wants to see problems in): duplicate id → legacy placeholder →
 * unknown type → missing port → dangling connection → unresolved component ref
 * → orphaned node → type mismatch → mis-sequenced control signal.
 *
 * `legacyImportPlaceholder` (LIB-006) sits second because it is the most
 * definite statement in the set — the importer looked at that construct and
 * could not convert it — and because it *supersedes* the unknown-type warning
 * on the same node, so a reader should meet it first.
 *
 * `duplicateNodeId` leads because a colliding id undermines every rule after
 * it: the others resolve nodes by id, so if the primary key is not unique their
 * findings are reported against whichever node won the collision.
 *
 * @module noodl-editor/validation/rules
 */

import { Rule } from './types';
import { duplicateNodeId } from './duplicateNodeId';
import { legacyImportPlaceholder } from './legacyImportPlaceholder';
import { unknownNodeType } from './unknownNodeType';
import { nonexistentPort } from './nonexistentPort';
import { danglingConnection } from './danglingConnection';
import { unresolvedComponentRef } from './unresolvedComponentRef';
import { orphanedNode } from './orphanedNode';
import { detachedPageContent } from './detachedPageContent';
import { typeIncompatibleConnection } from './typeIncompatibleConnection';
import { signalDrivenStaleInput } from './signalDrivenStaleInput';
import { unwiredOutcome } from './unwiredOutcome';
import { repeatedSiblingSubtree } from './repeatedSiblingSubtree';

export const ALL_RULES: Rule[] = [
  duplicateNodeId,
  legacyImportPlaceholder,
  unknownNodeType,
  nonexistentPort,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  detachedPageContent,
  typeIncompatibleConnection,
  signalDrivenStaleInput,
  unwiredOutcome,
  repeatedSiblingSubtree
];

export {
  duplicateNodeId,
  legacyImportPlaceholder,
  unknownNodeType,
  nonexistentPort,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  detachedPageContent,
  typeIncompatibleConnection,
  signalDrivenStaleInput,
  unwiredOutcome
};

export * from './types';
