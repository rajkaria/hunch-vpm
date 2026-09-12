import { dataSource } from '@/lib/data';

/**
 * Just the source's kind, importable from client code.
 *
 * `@/lib/data` pulls in the live source and its transport, which must not be
 * bundled for the browser. This re-export is a single string literal Next can
 * inline, so a client component can say whether it is looking at fixtures
 * without dragging the data layer across the boundary.
 */
export const dataSourceKind: 'fixture' | 'live' = dataSource.kind;
