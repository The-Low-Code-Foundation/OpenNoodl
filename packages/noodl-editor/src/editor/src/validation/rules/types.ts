/**
 * SUB-006 — Semantic Validator: rule contract
 *
 * A rule is a pure function from (normalized project + catalog + options) to a
 * list of diagnostics. Rules are independent and individually toggleable so a
 * rule that ever misfires can be disabled without losing the rest — a core
 * design requirement of this task.
 *
 * @module noodl-editor/validation/rules/types
 */

import { CatalogIndex } from '../CatalogIndex';
import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { NormComponent, NormNode, NormProject } from '../model';

export interface ValidatorOptions {
  /**
   * Greenfield/strict mode: promote "unknown node type" from a warning to an
   * error. Off by default so real projects (which legitimately carry
   * module/legacy nodes the catalog can't enumerate) don't fail CI.
   */
  strict?: boolean;
  /**
   * Emit info-level notes for ports that were skipped because the node creates
   * them at runtime. Off by default — on a large project this is thousands of
   * notes. Turn on when explaining *why* a port was not checked.
   */
  emitDynamicPortInfo?: boolean;
  /** When set, only these rules run. */
  only?: Set<DiagnosticCode>;
  /** Rules to skip. */
  disabled?: Set<DiagnosticCode>;
}

/** Per-component view precomputed once and shared across rules. */
export interface ComponentContext {
  component: NormComponent;
  nodeById: Map<string, NormNode>;
}

export interface RuleContext {
  project: NormProject;
  catalog: CatalogIndex;
  options: ValidatorOptions;
  /** Components with their id→node maps, computed once by the validator. */
  components: ComponentContext[];
  /** Running tally the validator reads for the summary. */
  counters: { nodesChecked: number; endpointsChecked: number };
}

export interface Rule {
  code: DiagnosticCode;
  /** One-line description shown in `--list-rules`. */
  description: string;
  /** Whether the rule runs unless explicitly disabled. */
  defaultEnabled: boolean;
  run(ctx: RuleContext): Diagnostic[];
}
