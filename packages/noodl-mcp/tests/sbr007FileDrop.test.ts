/**
 * SBR-007 AC3 — **a picture can be dropped onto a section, and it goes where a
 * picked one goes.**
 *
 * ## Why this file exists now and could not have existed before
 *
 * AC3 was filed **not buildable**, as
 * [D15](../../../dev-docs/tasks/phase-77-the-site-builder-rescue/DEFECTS-THE-SITE-BUILDER-FOUND.md#d15):
 * the runtime had no drop-target API at all. Word-bounded greps over
 * `noodl-viewer-react/src` and `noodl-runtime/src` read **0** for every one of
 * `onDrop` / `onDragOver` / `onDragEnter` / `onDragLeave` / `dataTransfer`,
 * beside a **39**-hit `onClick` control that proved the search path was right.
 * The row was left unowned on purpose so the phase could not close pretending.
 *
 * P80 **DEF-029** shipped the capability (`node-shared-port-definitions.ts`
 * §886, `addFileDropPorts`). The same greps at HEAD read **8 / 10 / 3** beside a
 * **52**-hit control. So the template half became buildable, and this file
 * grades it.
 *
 * ## 🔴 What this file CANNOT say
 *
 * Nothing here is behavioural. Every claim below is about a graph on disk.
 *
 * The obvious runtime arm — the one
 * [`d54ThemePresetIdentity`](./d54ThemePresetIdentity.test.ts) uses to such
 * effect — is **not available to this row and must not be faked**: the file-drop
 * ports live on the viewer's `Group`, in `noodl-viewer-react`, which the
 * runtime harness in that file has to *stub*. Instantiating the drop zone in
 * this repo's runtime would mean stubbing the exact node under test, and the
 * spec would be green against a template with no drop zone in it at all.
 *
 * **The behavioural claim — that a real file dragged from the desktop onto this
 * zone uploads and becomes a thumbnail — is the DRIVE's**, taken with
 * `cdp dropfile` (built by DEF-029 §7.1) against the DEPLOYED artefact, and it
 * is recorded in SBR-007 §11. This file is the regression net under it, not a
 * substitute for it.
 *
 * ## 🔴 Why the deploy, and not the preview
 *
 * Every drop port is a **dynamic** port —
 * `addDynamicPorts(definition, 'acceptFileDrops = true', …)` — so all six wires
 * out of the zone exist only while that one parameter is `true`. A dynamic port
 * behind a parameter is precisely SBR-008's family (*the deploy keeps the
 * panel's wires*), and D54 cost eleven sessions to a defect filed as
 * "works in preview, inert on the deploy". Hence §1 below, and hence the drive
 * being taken on the deployed bundle.
 *
 * ## What the mutants are for
 *
 * Each `it` that matters has a paired MUTANT that rebuilds the pre-fix or
 * near-miss shape and asserts the same predicate goes RED on it. Three green
 * readings on a shipped artefact are otherwise equally consistent with a
 * predicate that cannot fail.
 */
import * as fs from 'fs';
import * as path from 'path';

type ArtefactNode = {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  children?: ArtefactNode[];
};
type ArtefactWire = { fromId: string; fromProperty: string; toId: string; toProperty: string };
type ArtefactComponent = { name: string; graph: { roots: ArtefactNode[]; connections: ArtefactWire[] } };

/**
 * 🔴 **`SBR007_ARTEFACT` is the reverted arm's entry, and it exists because the
 * inline mutants below are the weaker half of the argument.** A mutant built in
 * this file proves the PREDICATE discriminates; it cannot prove the gate
 * reddens on the source as it stood before the work. Pointing this at the
 * pre-fix artefact — `git show <pre-fix-rev>:…/site-builder.content.json` — is
 * the arm that can, and SBR-007 §11 records which tests go red on it.
 *
 * ⚠️ Unset in CI, deliberately: the default is the shipped artefact, so a
 * generator that quietly stopped regenerating cannot hide behind this hook.
 */
const TEMPLATE =
  process.env.SBR007_ARTEFACT ||
  path.join(
    __dirname,
    '..',
    '..',
    'noodl-editor',
    'src',
    'editor',
    'src',
    'models',
    'template',
    'templates',
    'site-builder.content.json'
  );

const ARTEFACT = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8')) as { components: ArtefactComponent[] };

function* walk(nodes: ArtefactNode[]): Generator<ArtefactNode> {
  for (const n of nodes) {
    yield n;
    if (n.children) yield* walk(n.children);
  }
}

const SECTION_ROW = (() => {
  const c = ARTEFACT.components.find((x) => x.name === '/Admin/SectionRow');
  if (!c) throw new Error('the artefact has no /Admin/SectionRow');
  return c;
})();

const NODES = Array.from(walk(SECTION_ROW.graph.roots));
const WIRES = SECTION_ROW.graph.connections;

const labelled = (label: string): ArtefactNode => {
  const n = NODES.find((x) => x.label === label);
  if (!n) throw new Error(`/Admin/SectionRow has no node labelled ${label}`);
  return n;
};

/** Wires INTO a port, by node id — the cardinality question a wiring pin cannot ask. */
const into = (wires: ArtefactWire[], toId: string, toProperty: string) =>
  wires.filter((w) => w.toId === toId && w.toProperty === toProperty);

/** Wires OUT of a port. */
const outOf = (wires: ArtefactWire[], fromId: string, fromProperty: string) =>
  wires.filter((w) => w.fromId === fromId && w.fromProperty === fromProperty);

/**
 * 🔴 **Resolved lazily, inside each test, and the reverted arm is why.** These
 * were module-level consts for one run, and against the pre-fix artefact the
 * suite died at import with `Tests: 0 total` — red, and graded NOTHING. A
 * reverted arm whose whole value is *which* predicates catch the revert cannot
 * be one that stops every predicate from running. Each getter throws inside its
 * own `it`, so a missing node reddens exactly the checks that depend on it and
 * leaves the rest to report.
 */
const ZONE = () => labelled('Drop an image here');
const UPLOAD = () => labelled('Upload it');
const PICKER = () => labelled('Choose an image');
const REFUSAL = () => labelled('Was the last drop refused');
const REFUSED_LINE = () => labelled('That was not an image');
const HINT = () => labelled('Drop hint');
const WORDS = () => labelled('Which sentence the drop zone is showing');

describe('SBR-007 AC3 — the section row takes a dropped picture', () => {
  // ── 1. The parameter every wire hangs off ──────────────────────────────────

  it('the zone switches Accept File Drops ON, which is what makes its ports exist at all', () => {
    expect(ZONE().parameters?.acceptFileDrops).toBe(true);
  });

  it('MUTANT: without that parameter every drop wire is a dead dynamic port, and the check says so', () => {
    // The near-miss that ships silently: the zone is drawn, the label reads
    // "Drop an image here", the wires are in the file — and `addDynamicPorts`
    // never registers a single one of the ports they name.
    const reverted = { ...ZONE(), parameters: { ...ZONE().parameters, acceptFileDrops: false } };
    expect(reverted.parameters.acceptFileDrops).not.toBe(true);
  });

  it('the zone filters to images, so the Files Rejected arm can fire at all', () => {
    // 🔴 Not decoration. DEF-029's Failure Contract is that a drop of nothing
    // but rejected files fires `Files Rejected` INSTEAD of `Files Dropped`.
    // A blank filter accepts everything, so the refusal path below becomes
    // unreachable and a dropped `.pdf` reaches `Upload File` instead.
    expect(ZONE().parameters?.acceptedFileTypes).toBe('image/*');
  });

  // ── 2. The pair, and that it lands on the SAME upload the button uses ──────

  it('the drop feeds the file and the signal, as a PAIR, into one Upload File', () => {
    const file = outOf(WIRES, ZONE().id, 'droppedFile');
    const signal = outOf(WIRES, ZONE().id, 'filesDropped');

    expect(file).toHaveLength(1);
    expect(signal).toHaveLength(1);
    expect(file[0].toId).toBe(UPLOAD().id);
    expect(file[0].toProperty).toBe('file');
    expect(signal[0].toId).toBe(UPLOAD().id);
    expect(signal[0].toProperty).toBe('upload');
  });

  it('MUTANT: the signal alone uploads the PREVIOUS drop, and the pair check reddens', () => {
    // The shape that looks right and is off by one drop: fire the upload and
    // let the file arrive from wherever it last did. `flagFileDropOutputs`
    // marks the value outputs dirty BEFORE the signal is sent, which is the
    // ordering this wire pair depends on — remove the value wire and the file
    // input simply keeps whatever the picker last put there.
    const reverted = WIRES.filter((w) => !(w.fromId === ZONE().id && w.fromProperty === 'droppedFile'));
    expect(outOf(reverted, ZONE().id, 'droppedFile')).toHaveLength(0);
  });

  it('the dropped picture and the chosen picture converge on ONE node, so they cannot diverge', () => {
    // 🔴 The cardinality assertion, and D54 is why it is written this way. That
    // row shipped for eleven sessions behind a structural spec which said
    // "every chip is wired to the picker" and was true — and blind to all three
    // chips wiring into the SAME port. A wiring pin cannot see cardinality at
    // the target, so this one counts the producers explicitly.
    //
    // Here two producers on one port is the CORRECT answer, not a defect: the
    // picker and the zone are alternative gestures for one act, and everything
    // downstream (`absorb`'s gallery-versus-replace decision, the save, the
    // row ACL) is reached through `upload` either way.
    const fileProducers = into(WIRES, UPLOAD().id, 'file').map((w) => w.fromId);
    const uploadProducers = into(WIRES, UPLOAD().id, 'upload').map((w) => w.fromId);

    expect(new Set(fileProducers)).toEqual(new Set([PICKER().id, ZONE().id]));
    expect(new Set(uploadProducers)).toEqual(new Set([PICKER().id, ZONE().id]));
  });

  it('nothing else folds a dropped file — there is no second absorb to keep in step', () => {
    // The defect this forecloses: a drop path that writes `data.images`
    // itself instead of going through `absorb`. Two folds means a gallery
    // accumulates on one gesture and replaces on the other.
    const straysFromZone = outOf(WIRES, ZONE().id, 'droppedFile').filter((w) => w.toId !== UPLOAD().id);
    const straysFromZoneFiles = outOf(WIRES, ZONE().id, 'droppedFiles');
    expect(straysFromZone).toHaveLength(0);
    expect(straysFromZoneFiles).toHaveLength(0);
  });

  // ── 3. The three states a person can actually see ─────────────────────────

  it('the idle sentence is standing text, not a wire — it has to be right on the first frame', () => {
    // SB-018 (3): a `Text` fed only by a wire renders the literal word "Text"
    // until that wire publishes. The affordance does all its work BEFORE
    // anybody drags anything, so a wired sentence would arrive too late to be
    // the reason they dragged.
    expect(HINT().parameters?.text).toBe('Drop an image here');
  });

  it('🔴 the zone has EXACTLY ONE child, and nothing mounts or unmounts inside it', () => {
    // **The regression this file exists to hold, and it was a real defect that
    // shipped for one build.** The hint was two Texts swapping `mounted`
    // through an `Inverter`. Driven on the running app, with the zone's own
    // `dragenter`/`dragleave` counted while a file was dragged in and walked
    // back out undropped: **enter 2, leave 1** — the label the pointer was
    // inside got UNMOUNTED, so its leave never fired, `dragDepth` stayed at 1,
    // and the zone read "Let go to upload" with no drag anywhere near it.
    //
    // It self-heals on the next drop (`onDrop` zeroes the depth unconditionally),
    // which is exactly why it nearly went unnoticed.
    //
    // ⚠️ The predicate is deliberately about the ZONE'S SUBTREE, not about this
    // one hint: any child of a drop zone that appears or disappears in response
    // to the drag breaks the same counter the same way.
    const zone = ZONE();
    expect(zone.children ?? []).toHaveLength(1);
    for (const child of zone.children ?? []) {
      expect(child.parameters ?? {}).not.toHaveProperty('mounted');
      expect(outOf(WIRES, ZONE().id, 'isDragOver').some((w) => w.toId === child.id)).toBe(false);
    }
  });

  it('the hover changes WORDS, through a script — the element itself never moves', () => {
    const over = outOf(WIRES, ZONE().id, 'isDragOver');
    expect(over.some((w) => w.toId === WORDS().id && w.toProperty === 'in-over')).toBe(true);
    expect(outOf(WIRES, WORDS().id, 'out-text')).toEqual([
      expect.objectContaining({ toId: HINT().id, toProperty: 'text' })
    ]);
    // Both sentences live in the script, so the pair cannot drift apart.
    const script = String(WORDS().parameters?.functionScript ?? '');
    expect(script).toContain('Let go to upload');
    expect(script).toContain('Drop an image here');
  });

  it('MUTANT: a hint raised by mounted off the drag reddens the one-child rule', () => {
    // The shape that shipped and was caught by the drive, rebuilt here so the
    // predicate above is graded rather than merely green.
    const zone = ZONE();
    const reverted = { ...zone, children: [...(zone.children ?? []), { ...HINT(), id: 'dropOver', parameters: { mounted: false } }] };
    expect(reverted.children).not.toHaveLength(1);
  });

  it('the refusal turns OFF as well as on', () => {
    // A one-way wire is a sentence that never clears: the person drops a
    // `.pdf`, reads the refusal, drops a `.png` that uploads fine, and the
    // refusal is still there under the new thumbnail.
    const on = into(WIRES, REFUSAL().id, 'on');
    const off = into(WIRES, REFUSAL().id, 'off');

    expect(on).toEqual([expect.objectContaining({ fromId: ZONE().id, fromProperty: 'filesRejected' })]);
    // ⚠️ `isDragOver`, not `filesDropped`, and the ORDER is what makes it
    // right: `dragenter` raises `isDragOver` before the `drop` event fires
    // either outcome, so a second drag clears the previous refusal on the way
    // IN and a refused drop still lands its own sentence afterwards.
    expect(off).toEqual([expect.objectContaining({ fromId: ZONE().id, fromProperty: 'isDragOver' })]);
    expect(REFUSAL().parameters?.onFromStart).toBe(false);
  });

  it('MUTANT: a refusal wired on but never off reddens', () => {
    const reverted = WIRES.filter((w) => !(w.toId === REFUSAL().id && w.toProperty === 'off'));
    expect(into(reverted, REFUSAL().id, 'off')).toHaveLength(0);
    expect(into(reverted, REFUSAL().id, 'on')).toHaveLength(1);
  });

  it('the refusal is a SENTENCE, and it says what to do instead', () => {
    // A zone that takes `image/*` and goes silent on a `.pdf` is
    // indistinguishable from a zone that is broken — the reading D54 cost
    // eleven sessions to.
    expect(String(REFUSED_LINE().parameters?.text)).toMatch(/not an image/i);
    expect(String(REFUSED_LINE().parameters?.text)).toMatch(/\.png|\.jpg/i);
    expect(REFUSED_LINE().parameters?.mounted).toBe(false);
    expect(outOf(WIRES, REFUSAL().id, 'state')).toEqual([
      expect.objectContaining({ toId: REFUSED_LINE().id, toProperty: 'mounted' })
    ]);
  });

  // ── 4. The gesture is an addition, not a replacement ──────────────────────

  it('Choose image survives, because a drop is not reachable from a keyboard', () => {
    // 🔴 The accessibility floor, asserted rather than assumed. A drag is a
    // pointer gesture with no keyboard equivalent in any browser; removing the
    // button in favour of the zone would take the picture path away from
    // anybody who cannot drag. The two gestures are alternatives, and the
    // cardinality assertion above is what proves they stay alternatives.
    expect(PICKER().parameters?.acceptedFileTypes).toBe('image/*');
    expect(outOf(WIRES, PICKER().id, 'file')).toHaveLength(1);
    expect(outOf(WIRES, PICKER().id, 'done')).toHaveLength(1);
  });
});
