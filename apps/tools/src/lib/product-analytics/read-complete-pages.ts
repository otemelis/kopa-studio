/** Refuse partial results: requesting a large limit does not override a server row cap. */
export async function readCompletePages<Row>(
  read: (
    offset: number,
    last: Row | undefined,
  ) => Promise<{ data: Row[] | null; count: number | null; error: unknown }>,
  maximum = 50_000,
): Promise<Row[]> {
  const rows: Row[] = [];
  let expected: number | undefined;
  while (true) {
    const page = await read(rows.length, rows.at(-1));
    if (page.error || !page.data)
      throw new Error("Could not read complete product event analytics.");
    if (expected === undefined) {
      if (
        page.count === null ||
        !Number.isSafeInteger(page.count) ||
        page.count < 0
      )
        throw new Error("Source completeness could not be verified.");
      expected = page.count;
      if (expected > maximum)
        throw new Error(
          "This source window exceeds the supported size; narrow the period.",
        );
    }
    rows.push(...page.data);
    if (rows.length > expected)
      throw new Error("Source count changed during the read.");
    if (rows.length === expected) return rows;
    if (!page.data.length)
      throw new Error(
        "Source ended before its declared row count. No partial metrics returned.",
      );
  }
}
