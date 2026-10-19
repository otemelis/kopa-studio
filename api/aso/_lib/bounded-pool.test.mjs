import assert from "node:assert/strict";
import test from "node:test";
import { runBounded } from "./bounded-pool.js";

test("runBounded processes each item once and honors the concurrency cap", async () => {
  const items = Array.from({ length: 25 }, (_, index) => index);
  const completed = [];
  let active = 0;
  let maximumActive = 0;

  await runBounded(items, 4, async (item) => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, item % 3));
    completed.push(item);
    active--;
  });

  assert.equal(maximumActive, 4);
  assert.deepEqual([...completed].sort((a, b) => a - b), items);
});

test("runBounded handles empty input without starting workers", async () => {
  let called = false;
  await runBounded([], 4, async () => { called = true; });
  assert.equal(called, false);
});
