const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const { readMergeDriverOptionsSync, cleanMergeDriverOptionsSync } = require('@noodl/git/src/merge-driver');

function datePathExt(date) {
  return date.toUTCString().replace(/[:\ ,]/g, '-');
}

/**
 * Git hands the driver three temp files plus, since SUB-007, the path of the
 * file being merged (%P). The path is what tells a monolithic `project.json`
 * apart from one of the three files of a decomposed v2 component.
 *
 * Repositories configured before %P was added still work: `mergePath` is then
 * undefined and everything is treated as a project file, exactly as before.
 */
function v2FileKind(mergePath) {
  if (!mergePath) return undefined;
  const name = path.basename(mergePath);
  if (name === 'component.json' || name === 'nodes.json' || name === 'connections.json') {
    return name.replace('.json', '');
  }
  return undefined;
}

module.exports = {
  handleProjectMerge(args) {
    var mergeArgIndex = args.indexOf('--merge');
    var ancestorFileName = process.argv[mergeArgIndex + 1];
    var currentFileName = process.argv[mergeArgIndex + 2];
    var branchFileName = process.argv[mergeArgIndex + 3];
    // +4 is %L (conflict marker size), which this driver has no use for.
    var mergePath = process.argv[mergeArgIndex + 5];

    const options = readMergeDriverOptionsSync();
    cleanMergeDriverOptionsSync();

    if (ancestorFileName && currentFileName && branchFileName) {
      const { mergeProject, mergeV2ComponentFiles } = require('../../editor/src/versioning/ProjectMerge');
      const { applyPatches } = require('../../editor/src/models/ProjectPatches/applypatches');

      const kind = v2FileKind(mergePath);

      console.log(kind ? `Merging Noodl v2 component file (${kind})` : 'Merging Noodl project');

      // Perform merge
      try {
        // A merge with no common ancestor is normal (unrelated histories, a
        // file added on both sides), and applyPatches assumes a whole project.
        // Both have to stay inside the guard — patching an empty ancestor
        // throws, and that must not fail the merge.
        let ancestors = {};
        try {
          ancestors = JSON.parse(fs.readFileSync(ancestorFileName, 'utf8'));
          if (!kind) applyPatches(ancestors);
        } catch (e) {
          console.log('failed to parse ancestors file');
          ancestors = {};
        }

        let ours = JSON.parse(fs.readFileSync(currentFileName, 'utf8'));
        let theirs = JSON.parse(fs.readFileSync(branchFileName, 'utf8'));

        if (!kind) {
          applyPatches(ours);
          applyPatches(theirs);
        }

        if (options.reversed) {
          const tmp = ours;
          ours = theirs;
          theirs = tmp;
        }

        let result;
        if (kind) {
          // Git merges one file at a time, so only this file's side is known.
          // The engine handles a partial trio; what it loses is the
          // cross-file cases (a connection to a node the other side deleted),
          // which the in-editor merge path still catches with all three files.
          const merged = mergeV2ComponentFiles(
            { [kind]: ancestors },
            { [kind]: ours },
            { [kind]: theirs }
          );
          result = merged.files[kind];
        } else {
          result = mergeProject(ancestors, ours, theirs);
        }

        //git expects result to be written to the currentFileName path
        fs.writeFileSync(currentFileName, JSON.stringify(result, null, 4));

        app.exit(0);
      } catch (e) {
        // Merge failed, write error to debug log
        console.error('merge failed', e);

        try {
          const date = datePathExt(new Date());
          const userDataPath = app.getPath('userData');
          const logFile = userDataPath + '/debug/git-merge-failed-' + date + '.json';
          fs.writeFileSync(logFile, e.toString());

          const anscestorsDebugFile = userDataPath + '/debug/git-ancestors-merge-project-' + date + '.json';
          const oursDebugFile = userDataPath + '/debug/git-ours-merge-project-' + date + '.json';
          const theirsDebugFile = userDataPath + '/debug/git-theirs-merge-project-' + date + '.json';
          fs.copyFileSync(ancestorFileName, anscestorsDebugFile);
          fs.copyFileSync(currentFileName, oursDebugFile);
          fs.copyFileSync(branchFileName, theirsDebugFile);
        } catch (e) {
          //do nothing if error log fails
        }

        //exit with a failure code
        app.exit(1);
      }
    } else {
      console.log('invalid args', args);
      //exit with a failure code
      app.exit(1);
    }
  }
};
