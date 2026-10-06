import type { Page } from '@dating/types';

/** `take: limit + 1` ile çekilmiş kayıtlardan sayfa ve sonraki cursor'ı üretir. */
export function toPage<T extends { id: string }, R>(rows: T[], limit: number, map: (row: T) => R): Page<R> {
  const items = rows.slice(0, limit);
  return {
    items: items.map(map),
    nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
  };
}

export function cursorArgs(cursor: string | undefined): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}
