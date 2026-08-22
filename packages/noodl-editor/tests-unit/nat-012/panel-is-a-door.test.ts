/**
 * NAT-012 / D6 — the community panel is a DOOR, not a second home.
 *
 * D6 ruled that the launcher tab is the community's home and the rail panel is the door to it
 * from inside a project. FB-006 built the home; this grades the narrowing at the other end, plus
 * AC3's ruled behaviour: the door **closes your project**, says so, and reopening puts you back on
 * the component you were on.
 *
 * ## ⚠️ Why this reads source text rather than rendering
 *
 * `CommunityPanel` calls four hooks. `tests-unit`'s element walker invokes function components
 * directly and throws on any hook in the tree, and this repo's jest cannot load `Icon.tsx` at all
 * (webpack's `require.context`). A render spec here would not fail — it would fail *to run*,
 * which is the shape of green this phase has been bitten by. So the claims are made against the
 * real file on disk, comments stripped, with a known-firing arm proving the reader is not blind.
 *
 * 🔴 **Revert-and-count, measured 2026-08-22** (`git show HEAD:CommunityPanel.tsx` over the fixed
 * file, this spec alone): **11 of 20** rows go red — the narrowing's absence rows, the NAT-008
 * pairing, both `openCommunity` rows, all three AC3 door rows, and the comment-stripping control
 * (the old file has *"Call replays"* in code, not only in prose).
 *
 * ⚠️ And the door's honesty is graded **separately from its existence**: mutating only the label
 * to `"Community home"` — the button still there, still working — turns **exactly 1** row red.
 * That is the row carrying Richard's ruling, and it is worth knowing it fails alone, because a
 * silent door is the failure mode that would otherwise look like a working feature.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const EDITOR_SRC = join(__dirname, '../../src/editor/src');

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const panel = stripComments(readFileSync(join(EDITOR_SRC, 'views/panels/CommunityPanel/CommunityPanel.tsx'), 'utf8'));
const gesture = stripComments(readFileSync(join(EDITOR_SRC, 'utils/launcher/leaveForLauncher.ts'), 'utf8'));
const nodeGraphContext = stripComments(
  readFileSync(join(EDITOR_SRC, 'contexts/NodeGraphContext/NodeGraphContext.tsx'), 'utf8')
);
const editorDocument = stripComments(
  readFileSync(join(EDITOR_SRC, 'views/documents/EditorDocument/EditorDocument.tsx'), 'utf8')
);

describe('the reader is not blind — the known-firing arm', () => {
  /**
   * 🔴 Every `absent` row below is an ABSENCE claim, and an absence claim read off a file that
   * failed to load, or off a path that silently moved, is indistinguishable from a pass. These
   * two rows are what make the rest mean anything: the file is real, and the *kind* of string the
   * absence rows look for is a kind this file demonstrably still contains.
   */
  it('the panel source loaded and still draws a titled section', () => {
    expect(panel.length).toBeGreaterThan(1000);
    expect(panel).toContain('title="Discussions"');
  });

  it('and comment-stripping does not hide a live string', () => {
    // The prose above the narrowing NAMES every removed section in a table. Without stripping,
    // every `absent` row below would read as present; with it, the table is invisible and the
    // code is not. This asserts the stripper did its job on THIS file.
    const raw = readFileSync(join(EDITOR_SRC, 'views/panels/CommunityPanel/CommunityPanel.tsx'), 'utf8');
    expect(raw).toContain('Call replays');
    expect(panel).not.toContain('Call replays');
  });

  /**
   * 🔴 The AC3 rows below assert absences in the GESTURE and the node graph BOOTSTRAP, not in the
   * panel — and the arm above cannot speak for either. A moved path or a failed read there would
   * make `not.toContain('restoreEditorPlace')` pass for the wrong reason, which is the exact shape
   * of the defect the drive just found: a source-text row that was true and meant nothing.
   *
   * ⚠️ `EditorDocument` is here for the same reason — it is where AC3's restore actually lives, so
   * an absence-only file list would leave the surviving mechanism ungraded.
   */
  it('the gesture, the bootstrap and EditorDocument all loaded and still say something', () => {
    expect({
      gesture: gesture.includes('App.instance.exitProject()'),
      bootstrap: nodeGraphContext.includes('new NodeGraphEditor({})'),
      editorDocument: editorDocument.includes('EditorSettings.instance')
    }).toEqual({ gesture: true, bootstrap: true, editorDocument: true });
  });
});

describe('AC1 — what the door keeps, because it is about the project on your canvas', () => {
  it('the questions you asked from this editor', () => {
    expect(panel).toContain('title="Discussions"');
  });

  it('TUT-004’s installable tutorials, which write a lesson into your project', () => {
    expect(panel).toContain('<Tutorials pane={tutorials} />');
  });

  it('the thread pane and the profile pane, both continuations of something project-shaped', () => {
    expect({
      thread: panel.includes('<CommunityThreadView'),
      profile: panel.includes('<CommunityProfileView')
    }).toEqual({ thread: true, profile: true });
  });
});

describe('D6 — and what it hands back to the launcher', () => {
  it('the People DIRECTORY is gone from the rail', () => {
    expect(panel).not.toContain('<CommunityDirectoryView');
  });

  it('guides, replays and the health readout are gone with it', () => {
    expect({
      guides: panel.includes('Guides and tutorials'),
      replays: panel.includes('Call replays'),
      health: panel.includes('<Health ')
    }).toEqual({ guides: false, replays: false, health: false });
  });

  /**
   * 🔴 **The pairing, and it is the point of the whole row.** NAT-008 has two halves and the
   * narrowing withdraws exactly one: AC1's *directory in the rail* goes to the launcher's People
   * tab, AC2's *profile pane* stays, because you reach it from the author line of a thread that
   * is still drawn here. A spec that only checked the directory was gone would be equally happy
   * with a narrowing that took the profile pane with it — which would turn every author line in
   * the panel into the dead end AC5 forbids.
   */
  it('but the profile PANE survives, and the hook still feeds it', () => {
    expect({
      directory: panel.includes('<CommunityDirectoryView'),
      pane: panel.includes('<CommunityProfileView'),
      opener: panel.includes('onOpenPerson={openPerson}')
    }).toEqual({ directory: false, pane: true, opener: true });
  });

  it('and the panel no longer destructures the directory it does not draw', () => {
    expect(panel).toContain('const { profile, openPerson } = useCommunityPeople();');
  });
});

describe('AC3 — the door says what it costs, which is the ruling', () => {
  /**
   * Richard, 2026-08-22: the router disposes the project on the way to the launcher and that was
   * accepted rather than fixed, so the honesty is the deliverable. A control labelled only
   * "Community home" would be the silent version of exactly the hand-off D6 removed.
   */
  it('the label names the consequence, not just the destination', () => {
    expect(panel).toContain('label="Community home — closes your project"');
  });

  it('and it goes through the gesture that remembers where you were', () => {
    expect(panel).toContain("onClick={() => leaveForLauncher('community')}");
  });

  it('and the panel promises the return trip in words', () => {
    expect(panel).toContain('brings you back to the component you were on');
  });
});

describe('AC2 — openExternal survives on exactly one explicitly labelled control', () => {
  it('the browser link says it opens a browser', () => {
    expect(panel).toContain('label="Open community.nodegx.io in your browser"');
  });

  /**
   * 🔴 The rows that opened Chrome silently are gone with their sections. `openCommunity` is now
   * called **once**, from the labelled control — the article and replay rows used to call it with
   * a path, which is what AC2 calls "a row that silently jumps to Chrome".
   */
  it('and nothing calls it with a path any more — the silent jumps are gone', () => {
    // ⚠️ The lookbehind drops the declaration, which is not a call site. Counting CALLS is the
    // claim; counting occurrences would have been satisfied by deleting the function.
    expect(panel.match(/(?<!function )openCommunity\(/g)).toHaveLength(1);
    expect(panel).toContain('onClick={() => openCommunity()}');
  });

  it('and the helper cannot take a path even if somebody tries', () => {
    // 🔴 The stronger half: the row above says nobody passes one TODAY. This says the next person
    // to try gets a type error rather than a working silent jump.
    expect(panel).toContain('function openCommunity(): void {');
  });
});

describe('AC3 — the gesture stashes the landing before it closes the project', () => {
  /**
   * 🔴 `exitProject` notifies `'exitEditor'` SYNCHRONOUSLY, which routes and disposes the
   * ProjectModel and mounts `ProjectsPage`. The stash therefore has to happen first, or the
   * launcher reads an empty one and lands on Projects. Order is the whole correctness argument,
   * so it is asserted as order.
   */
  it('stashes the landing BEFORE exitProject', () => {
    const stash = gesture.indexOf('stashLauncherLanding(');
    const exit = gesture.indexOf('App.instance.exitProject()');

    expect(stash).toBeGreaterThan(-1);
    expect(exit).toBeGreaterThan(stash);
  });

  /**
   * 🔴 **This is the row that replaced four that passed on dead code.** The gesture used to
   * `rememberEditorPlace(...)` and the bootstrap used to `restoreEditorPlace(currentInstance)`,
   * and this file asserted both source strings were present — which they were, and which proved
   * nothing. Driving AC3 on 2026-08-22 showed `useSwitchToDefaultComponent`
   * (`UseSetupNodeGraph.ts:26`) runs after the node-graph bootstrap effect and switches to the
   * default unconditionally, so that restore was overwritten on **every** open.
   *
   * ⚠️ So the assertion is inverted: the door must NOT grow its own restore back. The real one
   * is `EditorDocument`'s, pinned below.
   */
  it('and does NOT carry a second, weaker copy of the restore', () => {
    expect(gesture).not.toContain('rememberEditorPlace');
    expect(gesture).not.toContain('restoreEditorPlace');
    expect(nodeGraphContext).not.toContain('restoreEditorPlace');
  });

  /**
   * 🔴 The restore AC3 actually promises, pinned where it lives. `EditorDocument` writes
   * `selectedComponentName` on every `activeComponentChanged` and reads it back on open — keyed
   * by `ProjectModel.id`, resolved by name, and **persisted**, so it survives a restart and
   * covers every exit route rather than this one door.
   *
   * ⚠️ Graded from source because the subject is a hook in a tree this repo's jest cannot mount;
   * the consequence is graded by the drive, which is what AC3 asks for.
   */
  it('the component you were on is restored by EditorDocument, and that is what makes AC3 true', () => {
    expect(editorDocument).toContain("EditorSettings.instance.setMerge(ProjectModel.instance.id, { selectedComponentName: model.fullName })");
    expect(editorDocument).toContain('if (settings.selectedComponentName) {');
    expect(editorDocument).toContain('nodeGraph.switchToComponent(component, { replaceHistory: true });');
  });
});

describe('D15 still holds — the refused viewer draws nothing, before anything else', () => {
  /**
   * ⚠️ The narrowing moved code around the early return. If the hidden check ever ends up below a
   * pane, a refused viewer gets a drawn surface — which is the reachability claim AC6 exists for.
   * Cheap to assert here; AC6's full claim is a route sweep and a drive, and is not this file's.
   */
  it('the hidden check comes before the profile pane, the thread pane and the sections', () => {
    const hidden = panel.indexOf("view.surface === 'hidden'");
    expect(hidden).toBeGreaterThan(-1);
    expect(panel.indexOf('<CommunityProfileView')).toBeGreaterThan(hidden);
    expect(panel.indexOf('<CommunityThreadView')).toBeGreaterThan(hidden);
    expect(panel.indexOf('title="Discussions"')).toBeGreaterThan(hidden);
  });
});
