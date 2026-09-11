/**
 * Rule: a parameter's value is the shape its port declares.
 *
 * ✅ **D13, 2026-08-18 — this rule is the ruling.** `checkParameterValues` has
 * existed and been good for some time, and it had exactly **one** caller:
 * `authoredPreconditionDiagnostics`, the path an AI-authored candidate goes
 * through before it is written. So a value check that knows about units,
 * colours, enums, the unit-suffix trap and the raw-colour-literal rule ran for
 * **no node of any provenance** on the gate that tells a human their project is
 * clean. On `cashflow-command-centre` alone that was 26 unverified parameters,
 * reported as a pass.
 *
 * 🔴 **Expect this to go red on real projects. That is the point, and it must
 * not be softened.** The corpus has never had its parameter values checked, so
 * the first run is a backlog rather than a regression. Severities are the
 * checker's own — `RawColorLiteral` and `UnknownParameter` are warnings and do
 * not fail the gate; a malformed value is an error and should.
 *
 * ## What made this a slice rather than a one-line registration
 *
 * `NormNode` carried no `parameters`. Two source files stated that absence as a
 * settled fact — *"`NormNode` carries no `parameters`, so no `rules/` rule could
 * see them"* — and they were right until this slice; both were corrected with
 * it. The normaliser now carries them on both node shapes.
 *
 * ## The `info` diagnostics, and why they are gated here and not in the checker
 *
 * `checkParameterValues` emits its skip notices unconditionally, deliberately:
 * CN-010 measured that gating them behind `emitDynamicPortInfo` in the editor
 * would build a diagnostic **no production caller can turn on**, because that
 * flag is read only by `scripts/validate-project.ts` — the other pipeline.
 * This rule *is* that pipeline, so here the flag has a caller and means what it
 * says. Filtered at the rule, so the checker's behaviour for its original
 * caller is untouched.
 *
 * @module noodl-editor/validation/rules/parameterValue
 */

import { Diagnostic, DiagnosticCode } from '../diagnostics';
import { checkParameterValues } from '../parameterValues';
import { Rule, RuleContext } from './types';

export const parameterValue: Rule = {
  // One handle for a check that emits several codes. `InvalidParameterValue` is
  // the one that blocks, so it is the one a user reaching for `--disabled`
  // means. ⚠️ Disabling it disables the whole check, including the warnings —
  // which is the honest behaviour, since they come from the same pass.
  code: DiagnosticCode.InvalidParameterValue,
  description: "Every parameter's value is the shape its port declares.",
  defaultEnabled: true,

  run(ctx: RuleContext): Diagnostic[] {
    const out: Diagnostic[] = [];
    const emitInfo = ctx.options.emitDynamicPortInfo === true;

    for (const { component } of ctx.components) {
      const diagnostics = checkParameterValues(component.nodes, ctx.catalog, { component: component.name });

      for (const diagnostic of diagnostics) {
        // The skip notices are the "we did not check this" half. On a large
        // project they are thousands of lines, which is why `--info` exists.
        if (diagnostic.severity === 'info' && !emitInfo) continue;
        out.push(diagnostic);
      }
    }

    return out;
  }
};
