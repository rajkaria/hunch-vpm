import { describe, expect, it } from 'vitest';
import type { FetchLike } from '../src/transport.js';
import { GraphQLHttpError, GraphQLRequestError, fetchTransport } from '../src/transport.js';

interface StubCall {
  url: string;
  body: string;
  headers: Record<string, string>;
}

function stubFetch(response: { ok?: boolean; status?: number; statusText?: string; body: unknown }): {
  fetch: FetchLike;
  calls: StubCall[];
} {
  const calls: StubCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      text: async () => (typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
    };
  };
  return { fetch, calls };
}

const request = { url: 'https://gateway.invalid/api/SECRET/subgraphs/id/ABC', query: '{ x }', operation: 'market' };

describe('fetchTransport', () => {
  it('posts the query and returns the data', async () => {
    const { fetch, calls } = stubFetch({ body: { data: { market: { id: 'm' } } } });
    const result = await fetchTransport({ fetch }).request<{ market: { id: string } }>(request);

    expect(result.market.id).toBe('m');
    expect(calls[0]?.url).toBe(request.url);
    expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ query: '{ x }', variables: {} });
    expect(calls[0]?.headers['content-type']).toBe('application/json');
  });

  it('passes extra headers through', async () => {
    const { fetch, calls } = stubFetch({ body: { data: {} } });
    await fetchTransport({ fetch, headers: { authorization: 'Bearer t' } }).request(request);
    expect(calls[0]?.headers['authorization']).toBe('Bearer t');
  });

  it('raises GraphQL errors', async () => {
    const { fetch } = stubFetch({ body: { errors: [{ message: 'bad field' }] } });
    await expect(fetchTransport({ fetch }).request(request)).rejects.toBeInstanceOf(GraphQLRequestError);
  });

  it('keeps the api key out of the error message', async () => {
    const { fetch } = stubFetch({ body: { errors: [{ message: 'bad field' }] } });
    const error = await fetchTransport({ fetch })
      .request(request)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GraphQLRequestError);
    expect((error as Error).message).not.toContain('SECRET');
    // It is still available for debugging, just not in the message.
    expect((error as GraphQLRequestError).url).toContain('SECRET');
  });

  it('raises HTTP failures with their status', async () => {
    const { fetch } = stubFetch({ ok: false, status: 429, statusText: 'Too Many Requests', body: 'slow down' });
    const error = await fetchTransport({ fetch })
      .request(request)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GraphQLHttpError);
    expect((error as GraphQLHttpError).status).toBe(429);
  });

  it('treats a null data envelope as a failure, not as an empty result', async () => {
    const { fetch } = stubFetch({ body: { data: null } });
    await expect(fetchTransport({ fetch }).request(request)).rejects.toThrow(/no data/);
  });
});
