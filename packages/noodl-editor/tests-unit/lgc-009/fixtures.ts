/**
 * The two saved block programs that exist in the world, copied verbatim.
 *
 * 🔴 **Copies, on purpose.** `lgc59-cycle` is in active use by a live drive in the primary
 * checkout, and a spec that read the fixture off disk would (a) fail on any machine that is not
 * the authoring one and (b) couple a unit test to a directory a human is editing. These are the
 * `workspace` parameter of node `c6` in `/ErgCodes`, taken 2026-08-12 from
 * `NodeGX test projects/lgc59-drive/project.json` and `.../lgc59-cycle/project.json`.
 *
 * ⚠️ **The count of *programs* is two, and the count of *nodes* is three.** Recounted 2026-08-12
 * across `NodeGX test projects/`: `lgc59-drive` and `lgc59-cycle` hold the two programs the task
 * file names, and **`tier1-tails`** holds a third `Logic Builder` node whose workspace is the
 * empty `{"blocks":{"languageVersion":0,"blocks":[]}}` — a Visual Function that was placed and
 * never authored. It needs no migration, but it is the state a migration is most likely to get
 * wrong, so it is here as a fixture.
 *
 * ⚠️ A fourth, `lgc59-drive-qa`, existed during the first count and had vanished twenty minutes
 * later: it is a scratch copy a concurrent live drive makes and removes. **A population count
 * taken while another session is driving includes that session's temporary files** — worth
 * knowing before pricing anything off one.
 */

/** `lgc59-drive`: one stack, declaring `price`, the `run` signal, `total`. */
export const DRIVE_WORKSPACE =
  '{"blocks":{"languageVersion":0,"blocks":[{"type":"noodl_define_input","id":"defPrice000000000001","x":30,"y":30,"fields":{"NAME":"price","TYPE":"number"},"next":{"block":{"type":"noodl_define_signal_input","id":"defRun00000000000001","fields":{"NAME":"run"},"next":{"block":{"type":"noodl_set_output","id":"setTotal000000000001","fields":{"NAME":"total"},"inputs":{"VALUE":{"block":{"type":"math_arithmetic","id":"mulBlock000000000001","fields":{"OP":"MULTIPLY"},"inputs":{"A":{"block":{"type":"noodl_get_input","id":"getPrice000000000001","fields":{"NAME":"price"}}},"B":{"block":{"type":"noodl_get_input","id":"getQty00000000000001","fields":{"NAME":"quantity"}}}}}}},"next":{"block":{"type":"noodl_send_signal","id":"sendDone000000000001","fields":{"NAME":"done"}}}}}}}}]}}';

/**
 * `lgc59-cycle`: a My Blocks call at the top of one stack, **and a floating value block**.
 *
 * The floating `noodl_get_input` is the shape the `disableOrphans` finding's first correction is
 * about — parentless with an output plug — and it is the one the migration must leave exactly
 * where it is.
 */
export const CYCLE_WORKSPACE =
  '{"blocks":{"languageVersion":0,"blocks":[{"type":"myblocks_call_statement","id":"topCallAlpha00000001","x":40,"y":40,"extraState":{"defId":"defAAA","args":[],"label":"Alpha"},"next":{"block":{"type":"noodl_define_input","id":"Igyy=_f#}jw6#_no3=/c","fields":{"NAME":"myInput","TYPE":"*"}}}},{"type":"noodl_get_input","id":"CN4uvJJ*KHpbErhDQ4~K","x":170,"y":110,"fields":{"NAME":"myInput"}}]}}';

/** `tier1-tails`: a Visual Function that was placed and never authored. */
export const EMPTY_WORKSPACE = '{"blocks":{"languageVersion":0,"blocks":[]}}';
