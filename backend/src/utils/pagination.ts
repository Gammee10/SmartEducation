// Pagination parsing - bounds page/pageSize query params so invalid values
// fall back to safe defaults and huge values cannot dump unbounded rows.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function parsePagination(
  query: { page?: unknown; pageSize?: unknown },
  defaultSize: number = DEFAULT_PAGE_SIZE,
  maxSize: number = MAX_PAGE_SIZE
): { page: number; pageSize: number } {
  let page = parseInt(String(query.page ?? '1'), 10);
  let pageSize = parseInt(String(query.pageSize ?? String(defaultSize)), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultSize;
  if (pageSize > maxSize) pageSize = maxSize;
  return { page, pageSize };
}
