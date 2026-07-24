/**
 * Runs `iteratorFn` over `values` with at most `poolLimit` in flight at once, resolving to
 * the results in input order.
 *
 * Note the `poolLimit <= values.length` guard: when the pool is larger than the work, no
 * throttling bookkeeping happens at all and every item starts immediately.
 */
async function asyncPool<T, R>(
  poolLimit: number,
  values: T[],
  iteratorFn: (item: T, values: T[]) => R | Promise<R>
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<void>[] = [];
  for (const item of values) {
    const p = Promise.resolve().then(() => iteratorFn(item, values));
    ret.push(p);

    if (poolLimit <= values.length) {
      const e: Promise<void> = p.then(() => {
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

export = asyncPool;
