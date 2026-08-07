/**
 * SUB-006 — Semantic Validator
 *
 * The rule engine. Given a normalized project and a catalog index, it runs the
 * enabled rules and returns a `ValidationReport` of diagnostics. It knows
 * nothing about disk, the editor, or the CLI — adapters (./normalize,
 * ./loadV2Project) produce its input and the edge (./diagnostics formatters,
 * the CLI, the editor panel) consumes its output.
 *
 * Relationship to the catalog: the catalog is the language definition; this is
 * the compiler's error output. An AI authoring a component iterates against
 * these diagnostics the way a developer iterates against a type checker.
 *
 * @module noodl-editor/validation/SemanticValidator
 */

import { CatalogIndex } from './CatalogIndex';
import { loadDefaultCatalog } from './catalog';
import { Diagnostic, DiagnosticCode, ValidationReport, summarize } from './diagnostics';
import { NormNode, NormProject } from './model';
import { ALL_RULES, ComponentContext, Rule, RuleContext, ValidatorOptions } from './rules';

export class SemanticValidator {
  private readonly catalog: CatalogIndex;
  private readonly rules: Rule[];

  constructor(catalog?: CatalogIndex, rules: Rule[] = ALL_RULES) {
    this.catalog = catalog ?? loadDefaultCatalog();
    this.rules = rules;
  }

  /** Which rules will run for the given options (respects `only`/`disabled`/defaults). */
  activeRules(options: ValidatorOptions = {}): Rule[] {
    return this.rules.filter((rule) => {
      if (options.only && options.only.size > 0) return options.only.has(rule.code);
      if (options.disabled && options.disabled.has(rule.code)) return false;
      return rule.defaultEnabled;
    });
  }

  /** Validate a whole normalized project. */
  validate(project: NormProject, options: ValidatorOptions = {}): ValidationReport {
    const components: ComponentContext[] = project.components.map((component) => ({
      component,
      nodeById: buildNodeById(component.nodes)
    }));

    const counters = { nodesChecked: 0, endpointsChecked: 0 };
    for (const c of components) counters.nodesChecked += c.component.nodes.length;

    const ctx: RuleContext = {
      project,
      catalog: this.catalog,
      options,
      components,
      counters
    };

    const diagnostics: Diagnostic[] = [];
    for (const rule of this.activeRules(options)) {
      diagnostics.push(...rule.run(ctx));
    }

    return {
      diagnostics,
      summary: summarize(diagnostics, counters)
    };
  }

  /**
   * Validate a single component by name (incremental / editor-time use). Other
   * components are still needed for component-reference resolution, so the whole
   * project is passed but diagnostics are filtered to the target component.
   */
  validateComponent(project: NormProject, componentName: string, options: ValidatorOptions = {}): ValidationReport {
    const full = this.validate(project, options);
    const diagnostics = full.diagnostics.filter((d) => d.location.component === componentName);
    return {
      diagnostics,
      summary: summarize(diagnostics, {
        nodesChecked: project.components.find((c) => c.name === componentName)?.nodes.length ?? 0,
        endpointsChecked: full.summary.endpointsChecked
      })
    };
  }
}

function buildNodeById(nodes: NormNode[]): Map<string, NormNode> {
  const map = new Map<string, NormNode>();
  for (const node of nodes) map.set(node.id, node);
  return map;
}

/** Convenience: validate a normalized project with the default catalog. */
export function validateProject(project: NormProject, options?: ValidatorOptions): ValidationReport {
  return new SemanticValidator().validate(project, options);
}

export { DiagnosticCode };
