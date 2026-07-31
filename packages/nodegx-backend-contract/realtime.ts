/**
 * `@noodl/backend-contract/realtime` — the subpath entry point.
 *
 * A real file at the package root rather than an `exports` map, for the reason
 * `translators.ts` gives: both consumers resolve modules the Node 10 way, which
 * ignores `exports` entirely.
 *
 * It exists at all so the runtime's transports can import `REALTIME_TIMING` and
 * `nextReconnectDelay` as *values* without dragging the descriptor tables, the
 * wire profiles and the filter translators into the viewer bundle behind them.
 */
export * from './src/realtime';
