import { ProviderError } from '../data/providers/http';
export async function paginate<T>(
  fetchPage: (
    cursor?: string,
  ) => Promise<{ items: T[]; hasMore: boolean; nextCursor?: string }>,
  processItem: (item: T) => Promise<void>,
  commit: () => Promise<void>,
  maxPages = 1000,
) {
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    for (const item of result.items) await processItem(item);
    if (!result.hasMore) {
      await commit();
      return;
    }
    if (!result.nextCursor || seen.has(result.nextCursor))
      throw new ProviderError('schema');
    seen.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new ProviderError('schema');
}
