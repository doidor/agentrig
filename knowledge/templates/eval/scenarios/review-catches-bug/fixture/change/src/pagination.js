// Pagination helper. Returns a single page of items for a 1-indexed page number
// and a page size. Page 1 is the first `pageSize` items, page 2 the next, etc.
export function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  const end = pageSize * page + 1;
  return items.slice(start, end);
}
