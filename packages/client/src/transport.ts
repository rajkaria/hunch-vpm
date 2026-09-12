/**
 * The one place this package talks to a network. Everything else takes a
 * `GraphQLTransport`, so the whole read surface is testable against recorded
 * responses without a socket.
 */

export interface GraphQLRequest {
  url: string;
  query: string;
  variables?: Record<string, unknown>;
  /** Free-form label used in error messages, e.g. "market". */
  operation: string;
}

export interface GraphQLTransport {
  request<T>(request: GraphQLRequest): Promise<T>;
}

export interface GraphQLErrorEntry {
  message: string;
  path?: (string | number)[];
}

export class GraphQLRequestError extends Error {
  readonly operation: string;
  readonly url: string;
  readonly errors: GraphQLErrorEntry[];

  constructor(operation: string, url: string, errors: GraphQLErrorEntry[]) {
    const detail = errors.map((error) => error.message).join('; ');
    super(`GraphQL ${operation} failed: ${detail}`);
    this.name = 'GraphQLRequestError';
    this.operation = operation;
    // The URL can carry an API key in its path, so it is kept on the error for
    // debugging but deliberately not interpolated into the message.
    this.url = url;
    this.errors = errors;
  }
}

export class GraphQLHttpError extends Error {
  readonly status: number;

  constructor(operation: string, status: number, statusText: string, body: string) {
    super(`GraphQL ${operation} failed: HTTP ${status} ${statusText}${body === '' ? '' : ` — ${body}`}`);
    this.name = 'GraphQLHttpError';
    this.status = status;
  }
}

/**
 * The slice of `fetch` we use. Declared structurally rather than pulled from
 * the DOM lib, because this package compiles with `lib: ["ES2023"]` and has no
 * business dragging in DOM types.
 */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}>;

export interface FetchTransportOptions {
  /** Defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Extra headers on every request, e.g. `Authorization`. */
  headers?: Record<string, string>;
}

interface GraphQLEnvelope<T> {
  data?: T | null;
  errors?: GraphQLErrorEntry[];
}

export function fetchTransport(options: FetchTransportOptions = {}): GraphQLTransport {
  const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
  const doFetch = options.fetch ?? globalFetch;
  if (doFetch === undefined) {
    throw new Error('no global fetch available; pass `fetch` to fetchTransport');
  }
  const extraHeaders = options.headers ?? {};

  return {
    async request<T>(request: GraphQLRequest): Promise<T> {
      const response = await doFetch(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', ...extraHeaders },
        body: JSON.stringify({ query: request.query, variables: request.variables ?? {} }),
      });

      const body = await response.text();
      if (!response.ok) {
        throw new GraphQLHttpError(request.operation, response.status, response.statusText, body.slice(0, 512));
      }

      const envelope = JSON.parse(body) as GraphQLEnvelope<T>;
      if (envelope.errors !== undefined && envelope.errors.length > 0) {
        throw new GraphQLRequestError(request.operation, request.url, envelope.errors);
      }
      if (envelope.data === undefined || envelope.data === null) {
        throw new GraphQLRequestError(request.operation, request.url, [{ message: 'response carried no data' }]);
      }
      return envelope.data;
    },
  };
}
