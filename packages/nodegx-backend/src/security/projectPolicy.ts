/**
 * SB-015 — the policy a project carries to the backend it is provisioned onto.
 *
 * ## What was broken
 *
 * `security.json` lives in a **backend's** data directory. A template ships a
 * **project** directory. There was no field, no file and no provisioning path
 * between the two, so a project whose whole product is *what a stranger cannot
 * see* was provisioned onto `defaultSecurityConfig()` — and SB-015's drive
 * measured what that costs, in both directions at once:
 *
 *   - **locally** `devOpen: true` + loopback disables row-level ACL entirely, so
 *     every draft renders to every anonymous visitor and the template appears to
 *     work;
 *   - **deployed** with `devOpen: false` and nothing else, `Page.find` falls back
 *     to `authenticated` and the public site serves the public nothing — while
 *     the *function* gate falls back the other way and hands a stranger the
 *     site's admin verbs (SB-016).
 *
 * 🔴 **Each failure looks like the other's fix**, and the person who hits the
 * second and reaches for the first has turned the boundary off.
 *
 * ## The shape, and the two objections it had to answer
 *
 * Richard ruled shape 1: the template ships a policy file and provisioning
 * applies it. `nodegx.security.json`, at the project root, in exactly the shape
 * `security.json` has — validated by the same `validateSecurityConfig`, so there
 * is one grammar and no translation layer to drift.
 *
 * SB-015 §3 raised two objections against this shape and they are answered here
 * rather than argued away:
 *
 * **1. "It adds a project-level artefact every existing project lacks."** It
 * does, and the absence is the no-op: a project with no such file provisions
 * exactly as it does today. The mechanism is opt-in by construction — nothing
 * migrates, nothing changes for the nineteen thousand projects that never had
 * one, and a project that acquires one is one somebody put it in.
 *
 * **2. "A policy travelling with a shared project is a policy its recipient did
 * not write."** True, and the reason it is a *file at the project root* rather
 * than a block inside `nodegx.project.json`: the recipient can open it, diff it,
 * and delete it, and it shows up in a review of the project the way any other
 * source file does. Beyond that, `applyProjectPolicy` is deliberately narrow in
 * three ways, each of which bounds what a received policy can do:
 *
 *   - it **only ever writes a `security.json` that does not exist**. A backend
 *     someone has already configured is never edited — the same rule the
 *     container entrypoint has followed since WF-003;
 *   - it **cannot loosen an existing posture**, because of the above: the only
 *     thing it can replace is `defaultSecurityConfig()`, which is what the
 *     backend was about to mint anyway;
 *   - it **refuses loudly on an invalid file** rather than falling back to the
 *     defaults. A policy that silently does not apply is the entire failure this
 *     module exists to end, and re-introducing it one layer up as "we tried"
 *     would be worse than not having the mechanism.
 *
 * ⚠️ **What it is NOT**: a sandbox. A policy file can say `find: "public"` on
 * every collection, and a recipient who provisions without reading it gets that.
 * The claim here is that it is *visible and inert-by-default*, not that it is
 * safe to run unread — which is equally true of the graphs in the same project,
 * and those already execute.
 *
 * ## The local case
 *
 * SB-015 §3's ⚠️ asks separately what `devOpen` should be on the machine the
 * site is built on. This module's answer is **whatever the file says, verbatim**,
 * and the reason is that any other answer re-opens the gap it closes: a policy
 * applied everywhere except the one field that decides whether it is enforced
 * would leave the author testing a site with the boundary off and shipping one
 * with it on. The Site Builder template therefore ships `devOpen: false` and is
 * enforced from its first local run.
 *
 * 🔴 **That has a cost and it is stated rather than discovered**: with the
 * boundary on locally, an author is an anonymous visitor to their own machine
 * until they hold the `admin` role, and on this template the only thing that
 * grants it is `claimSite`, which needs a `SITE_SETUP_TOKEN` secret that
 * provisioning does not write. See SB-015 §6.
 *
 * @module nodegx-backend/security/projectPolicy
 */

import * as fs from 'fs';
import * as path from 'path';

import { SecurityConfig, validateSecurityConfig } from './model';

/** The project-root file a template ships and provisioning applies. */
export const PROJECT_POLICY_FILE = 'nodegx.security.json';

/** The backend-side file it becomes. */
export const BACKEND_POLICY_FILE = 'security.json';

export class ProjectPolicyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProjectPolicyError';
    this.code = code;
  }
}

/**
 * What `applyProjectPolicy` did, as a value.
 *
 * Every outcome is *named* rather than collapsed into a boolean, because three
 * of the five are "nothing happened" for reasons a caller reports differently:
 * `no-policy-file` is the ordinary case and deserves silence, while
 * `backend-already-configured` on a project that HAS a policy is a provision
 * whose policy went nowhere, and a caller that says nothing about it has
 * reproduced the silent failure.
 */
export type ProjectPolicyOutcome =
  /** No project directory was supplied — this spawner does not know one. */
  | { status: 'no-project-dir' }
  /** The project has no policy file. The ordinary case, and a no-op. */
  | { status: 'no-policy-file'; policyPath: string }
  /** The backend already has a `security.json`, which is never edited. */
  | { status: 'backend-already-configured'; policyPath: string; backendPath: string }
  /** Written. */
  | { status: 'applied'; policyPath: string; backendPath: string; config: SecurityConfig };

/** Where a project's policy file would be, whether or not it is there. */
export function projectPolicyPath(projectDir: string): string {
  return path.join(projectDir, PROJECT_POLICY_FILE);
}

/**
 * Read and validate a project's policy file.
 *
 * Throws `ProjectPolicyError` for a file that exists and is not a valid policy —
 * unreadable, unparseable, or rejected by the same validator the backend runs
 * over `security.json`. Returns null only when there is no file at all.
 */
export function readProjectPolicy(projectDir: string): SecurityConfig | null {
  const policyPath = projectPolicyPath(projectDir);
  if (!fs.existsSync(policyPath)) return null;

  let raw: string;
  try {
    raw = fs.readFileSync(policyPath, 'utf-8');
  } catch (e) {
    throw new ProjectPolicyError(
      'PROJECT_POLICY_UNREADABLE',
      `${policyPath} exists but could not be read: ${e instanceof Error ? e.message : e}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new ProjectPolicyError(
      'PROJECT_POLICY_INVALID',
      `${policyPath} is not valid JSON: ${e instanceof Error ? e.message : e}\n` +
        `  This file is the project's security policy. Fix it or delete it — a backend provisioned from a ` +
        `project whose policy cannot be read would run the default posture, which is not what the project's ` +
        `graphs assume.`
    );
  }

  const errors = validateSecurityConfig(parsed);
  if (errors.length > 0) {
    throw new ProjectPolicyError(
      'PROJECT_POLICY_INVALID',
      `${policyPath} is not a valid security policy:\n${errors.map((e) => `  - ${e}`).join('\n')}\n` +
        `  It uses the same grammar as a backend's ${BACKEND_POLICY_FILE}. Fix it or delete it.`
    );
  }
  return parsed as SecurityConfig;
}

/**
 * Install a project's policy into a backend's data directory, if there is one
 * to install and the backend has no policy of its own yet.
 *
 * ⚠️ **Must run before `SecurityState` is constructed.** SecurityState reads
 * `security.json` in its constructor and mints the defaults when it is absent,
 * so a policy written afterwards would be a file on disk that the running
 * process is not enforcing — which is the most confusing of all the states this
 * task could produce.
 */
export function applyProjectPolicy(args: { projectDir?: string | null; dataDir: string }): ProjectPolicyOutcome {
  if (!args.projectDir) return { status: 'no-project-dir' };

  const policyPath = projectPolicyPath(args.projectDir);
  const config = readProjectPolicy(args.projectDir);
  if (!config) return { status: 'no-policy-file', policyPath };

  const backendPath = path.join(args.dataDir, BACKEND_POLICY_FILE);
  if (fs.existsSync(backendPath)) {
    return { status: 'backend-already-configured', policyPath, backendPath };
  }

  fs.mkdirSync(args.dataDir, { recursive: true });
  const tmp = `${backendPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n');
  fs.renameSync(tmp, backendPath);
  return { status: 'applied', policyPath, backendPath, config };
}

/**
 * What a caller should tell the operator about an outcome, or null for silence.
 *
 * 🔴 `backend-already-configured` is the one that must never be silent. It is
 * the exact shape of SB-015's original bug — a policy that exists, is correct,
 * and is not the one being enforced — and the only difference is that here we
 * know it. The reuse path in a provision hits it whenever a project with a
 * policy is pointed at a backend that has already started once.
 */
export function describeProjectPolicyOutcome(outcome: ProjectPolicyOutcome): string | null {
  switch (outcome.status) {
    case 'applied':
      return (
        `[nodegx-backend] SB-015: applied the project's security policy from ${outcome.policyPath} to ` +
        `${outcome.backendPath}` +
        (outcome.config.devOpen
          ? ' — note it sets "devOpen": true, so the data and function gates are relaxed on a loopback bind.'
          : ' — enforcement is ON (devOpen: false), locally as well as deployed.')
      );
    case 'backend-already-configured':
      return (
        `[nodegx-backend] SB-015: this project ships a security policy (${outcome.policyPath}) but the backend ` +
        `already has its own (${outcome.backendPath}), which is never overwritten. The running policy is the ` +
        `backend's. If the project's is the one you want, stop the backend, compare the two files and copy it ` +
        `across deliberately.`
      );
    default:
      return null;
  }
}
