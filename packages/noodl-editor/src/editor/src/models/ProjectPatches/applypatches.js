const { Patches } = require('./projectpatchgenerators');
const {
  applyRunOnValueChangeMigration,
  describeRunOnValueChangeMigration
} = require('./runOnValueChangeMigration');

function _applyPatch(node, p) {
  if (p.typename) node.typename = p.typename;
  if (p.version) node.version = p.version;
  for (var name in p.params) {
    var value = p.params[name];
    if (value === null) node.parameters[name] = undefined;
    else node.parameters[name] = value;
  }
  if (p.portsToDelete) {
    for (const name of p.portsToDelete) {
      var idx = node.ports.findIndex((p) => p.name === name);
      if (idx !== -1) {
        node.ports.splice(idx, 1);
      }
    }
  }
}

function _applyPatches(node, patchSets) {
  for (const patchSet of patchSets) {
    for (const patch of patchSet.patches) {
      if (patch.condition(node)) {
        const patchData = patch.generatePatch(node);
        _applyPatch(node, patchData);
      }
    }
  }
}

function _applyPatchesRecursive(node, patchSets) {
  _applyPatches(node, patchSets);
  node.children &&
    node.children.forEach((child) => {
      _applyPatchesRecursive(child, patchSets);
    });
}

module.exports = {
  applyPatches: function (projectJSON, patchSets = Patches) {
    //iterate through all nodes
    projectJSON.components.forEach((component) => {
      component.graph &&
        component.graph.roots &&
        component.graph.roots.forEach((node) => {
          _applyPatchesRecursive(node, patchSets);
        });
    });

    /**
     * NDA-017 — restore the run-on-value-change contract a pre-§2 graph was authored against.
     *
     * Runs here rather than as another entry in `Patches` because a patch's `condition` and
     * `generatePatch` see one **node**, and this rule cannot be decided from a node: it turns on
     * whether the node's control signal is *connected*, which lives in the component's connection
     * list. `applyPatches` is the one point that holds the whole document and still runs before
     * `ProjectModel.fromJSON` — see the migration module's header for why that ordering is the
     * valid one and not merely a convenient one.
     *
     * ⚠️ This therefore also runs in the git **merge driver** (`src/main/src/merge-driver.js`),
     * which patches `ours`, `theirs` and the ancestor before merging. That is correct rather than
     * merely harmless: the migration is deterministic and idempotent, so all three sides are
     * normalised the same way and it can only remove conflicts, never manufacture one. A side
     * that had already been migrated is left exactly as it is.
     */
    const plan = applyRunOnValueChangeMigration(projectJSON);
    if (plan.writes.length > 0) {
      // The project format has nowhere to record that this ran (§2 left "once and stamp" open
      // for exactly that reason), so the log line IS the audit trail. Deliberately `info`: it
      // reports a silent rewrite of the user's graph and should be findable after the fact.
      console.info(describeRunOnValueChangeMigration(plan));
    }
    return plan;
  }
};
