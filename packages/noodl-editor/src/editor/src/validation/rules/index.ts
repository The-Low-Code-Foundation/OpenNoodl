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
import { malformedNode } from './malformedNode';
import { legacyImportPlaceholder } from './legacyImportPlaceholder';
import { unknownNodeType } from './unknownNodeType';
import { nonexistentPort } from './nonexistentPort';
import { parameterValue } from './parameterValue';
import { danglingConnection } from './danglingConnection';
import { unresolvedComponentRef } from './unresolvedComponentRef';
import { orphanedNode } from './orphanedNode';
import { detachedPageContent } from './detachedPageContent';
import { typeIncompatibleConnection } from './typeIncompatibleConnection';
import { signalDrivenStaleInput } from './signalDrivenStaleInput';
import { unwiredOutcome } from './unwiredOutcome';
import { repeatedSiblingSubtree } from './repeatedSiblingSubtree';
import { oversizedPage } from './oversizedPage';
import { unlabelledNode } from './unlabelledNode';

export const ALL_RULES: Rule[] = [
  duplicateNodeId,
  // FIX-023 — second, for the same reason `legacyImportPlaceholder` is third:
  // it makes the most definite statement about the nodes it covers ("this
  // object is not a node") and it supersedes the unknown-type warning on them.
  // It cannot lead, because it reports *by id* and a colliding id would send
  // the reader to the wrong node.
  malformedNode,
  legacyImportPlaceholder,
  unknownNodeType,
  nonexistentPort,
  // ✅ D13 — beside `nonexistentPort` because they are the same question asked
  // of the two halves of a node's surface: that one checks the ports a
  // *connection* names, this one the ports a *parameter* names, and it also
  // checks the value. Until this rule existed the second half was unchecked by
  // the CLI gate entirely.
  parameterValue,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  detachedPageContent,
  typeIncompatibleConnection,
  signalDrivenStaleInput,
  unwiredOutcome,
  repeatedSiblingSubtree,
  oversizedPage,
  // LEG-002 — last, and deliberately: it is the only rule in the set that
  // reports a matter of legibility rather than of correctness, and a reader
  // should meet everything that describes breakage first.
  unlabelledNode
];

export {
  duplicateNodeId,
  malformedNode,
  legacyImportPlaceholder,
  unknownNodeType,
  nonexistentPort,
  parameterValue,
  danglingConnection,
  unresolvedComponentRef,
  orphanedNode,
  detachedPageContent,
  typeIncompatibleConnection,
  signalDrivenStaleInput,
  unwiredOutcome,
  repeatedSiblingSubtree,
  oversizedPage,
  unlabelledNode
};

export * from './types';
