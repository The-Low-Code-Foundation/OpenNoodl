# The first render — kept as the "before" of one control pair

This is the run **before** two one-line fixes, and the only reason it exists is that
`VIB-002-THE-CEILING.md` §4 cites it:

- **§4(a)** — the image band's copy sits at the TOP of the frame with ~250px of empty photograph
  below it, while `justifyContent: 'flex-end'` was set correctly. Register **V1**: the shell inside
  the band had no `sizeMode`, so it grew to fill the band. Compare with `../ground-door/`, where the
  only change was `sizeMode: 'contentHeight'` on that one node.
- **§4(b)** — `--gradient-brand` reads as a flat blue block across the third band.

⚠️ **Trimmed to the two full-page shots the verdict points at** (desktop and wide), per
`VIB-001-THE-JUDGE.md` §10: keep what a verdict cites, delete the rest. `manifest.json` names the
HEAD sha, so the deleted viewports are reproducible from one command.
