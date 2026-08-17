/**
 * Kit health diagnostics (CN-015, phase 69) — "failures name the kit".
 *
 * ## The promise this extends
 *
 * `projectmodules.ts` opens with an explicit contract: **loud, never silent** — a
 * manifest that cannot be read is skipped *with a warning naming the module*.
 * That promise covers the **manifest**. It stops before the thing most likely to
 * go wrong: the **definitions**. This turns the facts the extractor already
 * collects into diagnostics that name the kit, the node where there is one, and
 * what to do about it.
 *
 * Nothing here executes a kit or reads disk. It classifies an overlay that has
 * already been built, so both the headless/MCP route and (later) the editor can
 * report the same things in the same words.
 *
 * ## Severity follows `diagnostics.ts`, it does not invent a scale
 *
 * *definitely wrong* → `error`; *probably wrong* → `warning`; *a check
 * deliberately not performed* → `info`. A kit that throws is an **error** (its
 * nodes are simply gone). A kit registering zero nodes is a **warning** — it may
 * be an iconset, or a module whose whole job is a side effect. A kit shadowing a
 * built-in is an **error**, because the consequence is a node behaving unlike
 * its name.
 *
 * ## 🔴 Why the shadowing message says the KIT wins
 *
 * ⚠️ **Precedence is not one rule here. It is two rules that disagree**, and the
 * message that shipped before this said the wrong one.
 *
 * - **Catalog / validation**: the *built-in* wins. `catalogNodesFromNodeLibrary`
 *   drops the kit's node and records a collision, so every check in the editor
 *   goes on describing the shipped type.
 * - **Runtime**: the *kit* wins. `NodeRegister.register` is an unguarded
 *   assignment (`this._constructors[name] = nodeDefinition`) and `viewer.jsx`
 *   registers built-ins **before** module nodes on both its paths, so the last
 *   writer — the kit — is what `createNode` hands back. Measured, not inferred.
 *
 * So the real consequence of a collision is the **worst of both**: validation
 * checks the built-in's ports while the runtime runs the kit's code. The message
 * below says that, because the previous wording — *"The built-in wins; the kit's
 * node is not available"* — was false at runtime and would send an author to
 * debug the wrong node.
 *
 * ⚠️ **Making the runtime agree (built-ins winning everywhere) is a behaviour
 * change and a ruling, not a tidy-up** — an existing module may override
 * deliberately. CN-015's scope is visibility; this reports the divergence
 * truthfully and leaves the resolution to Richard.
 */

/** @typedef {import('./index').KitHealthDiagnostic} KitHealthDiagnostic */

/**
 * ⚠️ **There is deliberately no "nameless definition" diagnostic here, and the
 * reason is worth keeping.**
 *
 * CN-015's spec expects one: *"a malformed definition — no `name`, no
 * `getReactComponent` — `createNodeFromReactComponent` will do something."* It
 * is true that `createNodeFromReactComponent` has no guard, and a probe that
 * called `NodeRegister.register` **directly** did register a nameless
 * definition under the literal type name `'undefined'`.
 *
 * 🔴 **That probe skipped a layer and the finding was wrong for the real path.**
 * A kit never reaches `NodeRegister.register` directly: `registerModule` wraps
 * every entry as `{ node }`, so `registerNode` takes its `defineNode` branch,
 * and `NodeDefinition.defineNode` **throws `'Node must have a name'`**
 * (`nodedefinition.ts:252-254`). The extractor catches that and it surfaces as a
 * `kit-load-failed` — which is why a nameless node in a real kit is already
 * reported, and why a separate check for it would be a guard that can never
 * fire. This task's own trap list forbids exactly that.
 *
 * ⚠️ **What IS unreported, and wants a task:** the throw happens *mid-module*,
 * so a kit is left **half-registered** — nodes before the bad definition are in
 * the register, nodes after it are silently absent — and the message names the
 * kit but not the node. See `notes/cn-015-premise-census.md`.
 */

/**
 * Classify one project's kit overlay into diagnostics that name the kit.
 *
 * ⚠️ **Only meaningful on a route that actually loaded the kits.** The editor
 * reads what a running viewer already sent (✅ D3), where a kit with no nodes is
 * *"installed, not yet loaded"* rather than *"registered nothing"* — CN-006b's
 * `joinKitNodes` keeps those two apart deliberately, and this must not collapse
 * them. Pass `assumeLoaded: false` from any caller that cannot tell the
 * difference, and the zero-node check is skipped rather than guessed.
 *
 * @param {{
 *   kits?: Array<{ kitModule: string, dirPath?: string }>,
 *   nodes?: Array<{ typeName?: string, kitModule?: string }>,
 *   collisions?: Array<{ typeName: string, kitModule: string }>,
 *   failures?: Array<{ kitModule: string, dirPath?: string, message: string }>
 * }} overlay
 * @param {{ assumeLoaded?: boolean }} [options]
 * @returns {KitHealthDiagnostic[]}
 */
function kitDiagnostics(overlay, options = {}) {
  const assumeLoaded = options.assumeLoaded !== false;
  const out = [];

  const failures = (overlay && overlay.failures) || [];
  const collisions = (overlay && overlay.collisions) || [];
  const nodes = (overlay && overlay.nodes) || [];
  const kits = (overlay && overlay.kits) || [];

  // Which kits got at least one node into the catalog. A collided node counts:
  // it registered, it is simply not in `nodes` because the catalog dropped it.
  const registeredSomething = new Set();
  for (const node of nodes) if (node && node.kitModule) registeredSomething.add(node.kitModule);
  for (const collision of collisions) registeredSomething.add(collision.kitModule);

  // 1. The kit threw, at import or at registration. Report the message the
  //    loader actually caught rather than a summary of it.
  //
  // 🔴 **"None of its nodes are available" is not always true, and saying it
  // when it is not repeats the mistake this task exists to fix.** A definition
  // that throws does so *mid-module*: `registerModule` loops the node list, so
  // everything before the bad definition is already registered and everything
  // after it is silently dropped. Observed live — a kit whose first node was
  // `Text` and whose second had no `name` produced BOTH a load failure and a
  // `Text` collision, which is only possible if `Text` registered. So the
  // half-registered case gets its own sentence, and it is the more alarming one:
  // the kit looks present and is quietly incomplete.
  for (const failure of failures) {
    const partial = registeredSomething.has(failure.kitModule);
    out.push({
      code: 'kit-load-failed',
      severity: 'error',
      kitModule: failure.kitModule,
      dirPath: failure.dirPath,
      partial,
      message:
        `kit "${failure.kitModule}" failed to load: ${failure.message}. ` +
        (partial
          ? 'It is only PARTIALLY registered — nodes defined before the failure are available and ' +
            'every node after it is missing, so the kit looks present while being incomplete.'
          : 'None of its nodes are available — a node from this kit will report as an unknown type.')
    });
  }

  // 2. A type-name collision with a built-in. See the module header for why this
  //    message names the KIT as the runtime winner.
  for (const collision of collisions) {
    out.push({
      code: 'kit-shadows-builtin',
      severity: 'error',
      kitModule: collision.kitModule,
      typeName: collision.typeName,
      message:
        `kit "${collision.kitModule}" declares "${collision.typeName}", which is a built-in type name. ` +
        'Validation keeps describing the built-in, but at runtime the kit\'s node replaces it — ' +
        'so the checks and the running app disagree about what this type is. Rename the kit\'s node.'
    });
  }

  // 3. A kit that registered nothing.
  //
  // 🔴 A kit whose only node COLLIDED is not a kit that registered nothing —
  // `catalogNodesFromNodeLibrary` drops collided entries from `nodes`, so
  // counting `nodes` alone would report the same kit twice, once with a cause
  // and once with a wrong one. Failures are excluded for the same reason: the
  // load error is the better message and it has already been emitted.
  if (assumeLoaded) {
    const produced = new Set(registeredSomething);
    for (const failure of failures) produced.add(failure.kitModule);

    for (const kit of kits) {
      if (produced.has(kit.kitModule)) continue;
      out.push({
        code: 'kit-registered-nothing',
        severity: 'warning',
        kitModule: kit.kitModule,
        dirPath: kit.dirPath,
        message:
          `kit "${kit.kitModule}" loaded without error but registered no nodes. ` +
          'If it is meant to provide nodes, check that its `main` calls `Noodl.defineModule` ' +
          '(or `Noodl.defineNode`) at import time.'
      });
    }
  }

  return out;
}

/**
 * Format one diagnostic as a single CLI line.
 *
 * Kept here rather than in the CLI so the editor and the CLI cannot drift into
 * describing the same failure differently — the drift this phase has now found
 * four times in four consecutive tasks (`docs`, `summary`, `dp.note`, `module`).
 *
 * @param {KitHealthDiagnostic} diagnostic
 */
function formatKitDiagnostic(diagnostic) {
  return `${diagnostic.severity.toUpperCase()} ${diagnostic.message}`;
}

module.exports = { kitDiagnostics, formatKitDiagnostic };
