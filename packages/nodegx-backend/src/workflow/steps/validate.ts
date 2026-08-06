/**
 * CWF-004 slice 2's `validate` step kind: assert the shape you were sent, and
 * fail the run with something a human can act on.
 *
 * WHY THIS IS THE STRONGEST ENTRY IN THE FAMILY TABLE
 * --------------------------------------------------
 * A workflow's entry point is very often a webhook from somebody else's system,
 * and the failure mode CWF-004 names is exact: *a silent `undefined` from a
 * third-party payload ruins an afternoon three weeks later*. Without this step
 * the first thing that notices a missing `body.email` is whatever finally tried
 * to use it — a cloud function, an email send, a record write — and by then the
 * run has half-happened. A guard at the top turns that into one loud failure
 * with the path named, at the step whose job was to check.
 *
 * WHY IT DOES NOT COMPUTE
 * -----------------------
 * Every rule is either "this path is present / is of this type" or "this
 * condition holds", and the second is the SAME closed 19-operator condition
 * language `branch` and `switch` already use — not a second dialect, and not an
 * expression. The type vocabulary below is likewise a closed table with a fixed
 * meaning per name, served by the backend, so the editor can never offer a check
 * this backend does not perform and an agent cannot invent one. That is exactly
 * the `transform` trick, applied to a smaller vocabulary.
 *
 * WHY IT HAS NO ROUTES
 * --------------------
 * "Valid" is `next` and "invalid" is `onError`. A `valid` / `invalid` route pair
 * would be a second way to write the thing error edges already are — the page
 * says it in those words: **error edges ARE try/catch; there is no try/catch
 * step kind.** One way to express a branch on validity, not two.
 *
 * @module nodegx-backend/workflow/steps/validate
 */

import type { StepExecContext, StepExecutor } from '../StepExecutor';
import { StepExecutionError } from '../StepExecutor';
import type { Condition } from './conditions';
import { evaluateCondition, validateCondition } from './conditions';
import { getPath, isPlainObject } from './values';

// ---------------------------------------------------------------------------
// The closed type vocabulary
// ---------------------------------------------------------------------------

/**
 * One type a rule may assert, as a NAME with one meaning.
 *
 * Deliberately the JSON types and nothing else. "A string that looks like an
 * email", "a number over 100" and "one of these three values" are all
 * *conditions*, and a rule can carry one — so widening this table would be
 * building a second, weaker condition language beside the one already served.
 */
export interface ValidateType {
  test(value: unknown): boolean;
  /** Filled into "must be …" in the failure message. */
  article: string;
}

export const VALIDATE_TYPES: Readonly<Record<string, ValidateType>> = {
  string: { test: (v) => typeof v === 'string', article: 'text' },
  number: { test: (v) => typeof v === 'number' && Number.isFinite(v), article: 'a number' },
  boolean: { test: (v) => typeof v === 'boolean', article: 'true or false' },
  object: { test: (v) => isPlainObject(v), article: 'an object' },
  array: { test: (v) => Array.isArray(v), article: 'an array' }
};

/** Every type name, in table order. */
export const VALIDATE_TYPE_NAMES = Object.keys(VALIDATE_TYPES);

/**
 * The served `control` name for the `rules` param (CWF-005's mechanism).
 *
 * Named rather than inferred from `param.name === 'rules'`, for the reason
 * `CONTROL_TRANSFORM_OUTPUT` gives: a control keyed on a common param name is a
 * collision waiting to be debugged.
 */
export const CONTROL_VALIDATE_RULES = 'validate-rules';

// ---------------------------------------------------------------------------
// The rule shapes
// ---------------------------------------------------------------------------

/**
 * A rule about one path in the run's data.
 *
 * ⚠️ `required` defaults to **true**, and that is a decision rather than an
 * accident: you write a rule naming a path because you expect the path to be
 * there. `{"path": "body.note", "required": false, "type": "string"}` is how an
 * author says "optional, but text when it is present" — which is the shape that
 * needs the extra word, not the other one.
 */
export interface ValidatePathRule {
  path: string;
  required?: boolean;
  type?: string;
  message?: string;
}

/** A rule that is any condition the branch/switch language can express. */
export interface ValidateConditionRule {
  when: Condition;
  message?: string;
}

export type ValidateRule = ValidatePathRule | ValidateConditionRule;

function isConditionRule(rule: Record<string, unknown>): boolean {
  return 'when' in rule;
}

// ---------------------------------------------------------------------------
// The served description of the vocabulary
// ---------------------------------------------------------------------------

export interface ValidateTypeSpec {
  name: string;
  label: string;
  description: string;
}

export interface ValidateLanguageSpec {
  summary: string;
  /** The closed type list a path rule may assert. */
  types: ValidateTypeSpec[];
  /** The two rule forms, with an example of each. */
  ruleForms: { form: string; example: unknown; description: string }[];
  notes: string[];
}

const TYPE_DOCS: Record<string, { label: string; description: string }> = {
  string: { label: 'text', description: 'A JSON string. A number that happens to look like text is not one.' },
  number: { label: 'a number', description: 'A finite JSON number. The string "42" is NOT a number here.' },
  boolean: { label: 'true or false', description: 'A JSON boolean.' },
  object: { label: 'an object', description: 'A JSON object. An array is not one.' },
  array: { label: 'a list', description: 'A JSON array.' }
};

/**
 * The machine-readable description of the rule vocabulary, served inside
 * `GET /admin/workflow-step-kinds`.
 *
 * Served rather than bundled for the reason every other language here is:
 * removing a type from this table removes it from the editor's picker with no
 * editor change, and an agent working from memory would otherwise invent
 * `"type": "email"` and get a 400 it could not have predicted.
 */
export const VALIDATE_LANGUAGE: ValidateLanguageSpec = {
  summary:
    'A validate step asserts the shape of the run\'s data before anything acts on it. Each rule is either a PATH ' +
    'rule (is it there, and is it of this type) or a CONDITION rule in the same closed language `branch` uses. ' +
    'Nothing here computes: a rule reads a path and compares, and a broken rule fails the step.',
  types: VALIDATE_TYPE_NAMES.map((name) => ({
    name,
    label: TYPE_DOCS[name].label,
    description: TYPE_DOCS[name].description
  })),
  ruleForms: [
    {
      form: 'path',
      example: { path: 'body.customer.email', type: 'string', message: 'The supplier sent no email address.' },
      description:
        'Assert that a path is present and, optionally, of a type. `required` defaults to TRUE — set it false for ' +
        '"optional, but this type when present".'
    },
    {
      form: 'when',
      example: { when: { left: { $path: 'body.total' }, op: 'gt', right: 0 }, message: 'Order total must be positive.' },
      description: 'Assert any condition the branch/switch language can express, against the same run scope.'
    }
  ],
  notes: [
    'A rule has EXACTLY ONE of `path` and `when` — the same rule `switch` cases follow for `equals` / `when`.',
    'A `message` replaces the generated one. Write it for whoever reads the execution record at 3am.',
    'Mode `all` (the default) reports EVERY broken rule in one failure. Mode `first` stops at the first.',
    'A failure is an ordinary step failure, so an `onError` edge routes it. There is no `invalid` route: error ' +
      'edges already are try/catch.',
    'A condition that cannot be evaluated is reported as a broken rule rather than as a different kind of ' +
      'failure — either way the step fails loudly and the message says which rule.'
  ]
};

// ---------------------------------------------------------------------------
// Write-time validation
// ---------------------------------------------------------------------------

export function validateValidateRules(rules: unknown, at: string): string[] {
  if (rules === undefined) {
    return [`${at}: validate needs a "rules" array — a validate step with no rules asserts nothing`];
  }
  if (!Array.isArray(rules) || rules.length === 0) {
    return [`${at}.params.rules must be a non-empty array of rules — a validate step with no rules asserts nothing`];
  }

  const errors: string[] = [];
  rules.forEach((rule, i) => {
    const where = `${at}.params.rules[${i}]`;
    if (!isPlainObject(rule)) {
      errors.push(`${where}: must be an object — either { path, … } or { when, … }`);
      return;
    }

    const hasPath = 'path' in rule;
    const hasWhen = 'when' in rule;
    if (hasPath === hasWhen) {
      errors.push(`${where}: needs exactly one of "path" (assert a path) or "when" (assert a condition)`);
      return;
    }

    if (rule.message !== undefined && typeof rule.message !== 'string') {
      errors.push(`${where}.message must be a string — it is what a person reads when the run fails`);
    }

    if (hasWhen) {
      errors.push(...validateCondition(rule.when, `${where}.when`));
      return;
    }

    if (typeof rule.path !== 'string' || !rule.path.trim()) {
      errors.push(`${where}.path must be a dotted path string, e.g. "body.customer.email"`);
    }
    if (rule.required !== undefined && typeof rule.required !== 'boolean') {
      errors.push(`${where}.required must be true or false (it defaults to true)`);
    }
    if (rule.type !== undefined) {
      if (typeof rule.type !== 'string' || !VALIDATE_TYPES[rule.type]) {
        errors.push(
          `${where}.type: unknown type ${JSON.stringify(rule.type)} — this backend checks ` +
            `${VALIDATE_TYPE_NAMES.join(', ')}. The vocabulary is served by GET /admin/workflow-step-kinds ` +
            '(validateLanguage). Anything richer than a JSON type is a `when` rule.'
        );
      }
    }
    if (rule.required === false && rule.type === undefined) {
      // Not an error the backend could refuse on principle — but a rule that
      // asserts nothing at all is always a mistake, and finding it at write
      // time costs nothing.
      errors.push(
        `${where}: a rule with "required": false and no "type" asserts nothing. Give it a type, or remove it.`
      );
    }
  });
  return errors;
}

// ---------------------------------------------------------------------------
// The executor
// ---------------------------------------------------------------------------

function describe(v: unknown): string {
  if (v === undefined) return 'nothing';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'object') return 'an object';
  return String(v);
}

/**
 * Run a `validate` step: check every rule and fail the step if any broke.
 *
 * ⚠️ `rules` is a `raw` param, so the engine hands it over untouched and the
 * `$path` operands inside a `when` rule are resolved HERE, against `ctx.scope`
 * — the same lazy evaluation a `branch` condition gets, and for the same
 * reason: resolving it eagerly would rewrite the authored rule into its own
 * answer in the execution record.
 */
export class ValidateStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const params = (ctx.step.params || {}) as Record<string, unknown>;
    const rules = params.rules;
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}" is a validate step with no rules — it asserts nothing. ` +
          'Write-time validation should have refused this definition.'
      );
    }
    const stopAtFirst = params.mode === 'first';

    const broken: string[] = [];
    let unchecked = 0;
    for (let i = 0; i < rules.length; i++) {
      const problem = this.check(rules[i], i, ctx);
      if (problem) {
        broken.push(problem);
        if (stopAtFirst) {
          unchecked = rules.length - 1 - i;
          break;
        }
      }
      // Cancellation is checked between rules rather than inside one: a rule is
      // a comparison, not an await, so there is nothing to interrupt within it.
      if (ctx.signal.aborted) break;
    }

    if (broken.length > 0) {
      // ⚠️ The tail is counted rather than assumed. "later rules were not
      // checked" on a run where the LAST rule broke is a message that sends
      // someone looking for a rule that did in fact run.
      throw new StepExecutionError(
        `Step "${ctx.step.id}" rejected the data: ${broken.join('; ')}` +
          (unchecked > 0 ? ` (mode "first": ${unchecked} later rule${unchecked === 1 ? '' : 's'} not checked)` : '')
      );
    }

    return { ok: true, checked: rules.length };
  }

  /** The problem with one rule, or null when it holds. */
  private check(rule: unknown, index: number, ctx: StepExecContext): string | null {
    if (!isPlainObject(rule)) return `rule ${index + 1} is not a rule object`;
    const custom = typeof rule.message === 'string' && rule.message ? rule.message : null;

    if (isConditionRule(rule)) {
      let held: boolean;
      try {
        held = evaluateCondition(rule.when as Condition, ctx.scope);
      } catch (e) {
        // A rule that cannot be evaluated is a BROKEN rule, not a separate
        // class of failure. Either way the step fails; reporting it here keeps
        // mode "all" able to tell you about the other four rules as well.
        return custom
          ? `${custom} (the rule could not be evaluated: ${e instanceof Error ? e.message : String(e)})`
          : `rule ${index + 1} could not be evaluated: ${e instanceof Error ? e.message : String(e)}`;
      }
      if (held) return null;
      return custom || `rule ${index + 1} does not hold`;
    }

    const path = String(rule.path);
    const value = getPath(ctx.scope, path);
    const required = rule.required !== false;

    if (value === undefined || value === null) {
      if (!required) return null; // Optional and absent: nothing to check.
      return custom || `"${path}" is required and the data has ${value === null ? 'null' : 'nothing'} there`;
    }

    const typeName = typeof rule.type === 'string' ? rule.type : undefined;
    if (!typeName) return null;
    const type = VALIDATE_TYPES[typeName];
    if (!type) {
      // Unreachable for a persisted definition — refused at write time — and
      // loud anyway, because a silently-skipped check is worse than no check.
      return `rule ${index + 1} asks for type "${typeName}", which this backend does not check`;
    }
    if (type.test(value)) return null;
    return custom || `"${path}" must be ${type.article}, got ${describe(value)}`;
  }
}
