/**
 * Test-suite environment.
 *
 * `apply_plan` renders the project after writing anything visual (LAS-005 §4),
 * which costs about eight seconds of real Chrome. Every plan spec would pay it,
 * and none of them are about the picture — so the automatic render is off here.
 * The behaviour itself is pinned in `renderTools.test.ts`, which turns it back
 * on against a stub CLI (`NODEGX_RENDER_CLI`) and asserts the block arrives.
 */
process.env.NODEGX_RENDER_DISABLED = '1';
