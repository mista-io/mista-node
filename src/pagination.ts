export interface PageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

/**
 * One page of results. Iterate it with `for await` to walk every item across
 * all remaining pages, or call `nextPage()` to step manually.
 */
export class Page<T> implements AsyncIterable<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
    private readonly fetchPage: (page: number) => Promise<Page<T>>
  ) {}

  hasNextPage(): boolean {
    return this.meta.currentPage < this.meta.lastPage;
  }

  async nextPage(): Promise<Page<T> | null> {
    return this.hasNextPage() ? this.fetchPage(this.meta.currentPage + 1) : null;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let page: Page<T> | null = this;
    while (page) {
      yield* page.items;
      page = await page.nextPage();
    }
  }
}

const num = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

type Raw = Record<string, unknown>;

/** Laravel paginator: `{ current_page, data, last_page, per_page, total }`. */
export function laravelPage<T>(raw: unknown, fetchPage: (page: number) => Promise<Page<T>>): Page<T> {
  const r = (raw ?? {}) as Raw;
  const items = (Array.isArray(r.data) ? r.data : []) as T[];
  return new Page(
    items,
    {
      currentPage: num(r.current_page, 1),
      lastPage: num(r.last_page, 1),
      perPage: num(r.per_page, items.length),
      total: num(r.total, items.length),
    },
    fetchPage
  );
}

/** Voice paginator: `{ items, pagination: { current_page, per_page, total, last_page } }`. */
export function itemsPage<T>(raw: unknown, fetchPage: (page: number) => Promise<Page<T>>): Page<T> {
  const r = (raw ?? {}) as Raw;
  const p = (r.pagination ?? {}) as Raw;
  const items = (Array.isArray(r.items) ? r.items : []) as T[];
  return new Page(
    items,
    {
      currentPage: num(p.current_page, 1),
      lastPage: num(p.last_page, 1),
      perPage: num(p.per_page, items.length),
      total: num(p.total, items.length),
    },
    fetchPage
  );
}

export function emptyPage<T>(fetchPage: (page: number) => Promise<Page<T>>): Page<T> {
  return new Page<T>([], { currentPage: 1, lastPage: 1, perPage: 0, total: 0 }, fetchPage);
}
