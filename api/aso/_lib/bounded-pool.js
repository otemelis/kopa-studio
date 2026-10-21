/** Run independent collection items with a fixed concurrency limit. */
export async function runBounded(items, concurrency, worker) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer.");
  let nextIndex = 0;
  const workerCount = Math.min(items.length, concurrency);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await worker(items[index], index);
    }
  }));
}
