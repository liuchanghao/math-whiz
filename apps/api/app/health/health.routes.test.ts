import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  errorEnvelopeSchema,
  successEnvelopeSchema,
} from '@math-whiz/contracts';

const checkDatabaseReadiness = vi.fn<() => Promise<boolean>>();

vi.mock('@/src/infrastructure/database', () => ({
  checkDatabaseReadiness,
}));

describe('health routes', () => {
  beforeEach(() => {
    checkDatabaseReadiness.mockReset();
  });

  it('returns a public liveness response with the unified success envelope', async () => {
    const { GET } = await import('./live/route');
    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(
      successEnvelopeSchema(z.object({ status: z.literal('ok') })).parse(body),
    ).toEqual({
      status: 200,
      message: '服务存活',
      data: { status: 'ok' },
    });
  });

  it('returns ready only when the database check succeeds', async () => {
    checkDatabaseReadiness.mockResolvedValue(true);
    const { GET } = await import('./ready/route');
    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(
      successEnvelopeSchema(z.object({ status: z.literal('ready') })).parse(
        body,
      ),
    ).toEqual({
      status: 200,
      message: '服务就绪',
      data: { status: 'ready' },
    });
  });

  it('returns an opaque 503 response when the database is unavailable', async () => {
    checkDatabaseReadiness.mockResolvedValue(false);
    const { GET } = await import('./ready/route');
    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(errorEnvelopeSchema.parse(body)).toEqual({
      status: 503,
      message: '服务未就绪',
      data: { errorCode: 'DATABASE_UNAVAILABLE' },
    });
    expect(JSON.stringify(body)).not.toContain('mysql://');
  });
});
