/**
 * A kit that throws at import time — project code doing what project code does.
 *
 * CN-003's trap, in a file: extraction must survive it, name it, and still
 * report the kits that loaded beside it. A project with two kits, one broken,
 * that reports zero node types is indistinguishable from a project with none.
 */
throw new Error('this kit is deliberately broken');
