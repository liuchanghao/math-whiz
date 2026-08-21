import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createError,
  createSuccess,
  errorEnvelopeSchema,
  paginationDataSchema,
  successEnvelopeSchema,
} from './envelope';

describe('unified API envelopes', () => {
  it('accepts a successful payload only with status 200', () => {
    const schema = successEnvelopeSchema(z.object({ name: z.string() }));
    const response = createSuccess('查询成功', { name: '小明' });

    expect(schema.parse(response)).toEqual({
      status: 200,
      message: '查询成功',
      data: { name: '小明' },
    });
    expect(schema.safeParse({ ...response, status: 201 }).success).toBe(false);
  });

  it('uses null for a successful response without business data', () => {
    expect(createSuccess('操作成功', null)).toEqual({
      status: 200,
      message: '操作成功',
      data: null,
    });
  });

  it('returns a stable machine-readable error shape', () => {
    const response = createError(400, '手机号格式不正确', 'INVALID_PHONE', [
      'phone',
    ]);

    expect(errorEnvelopeSchema.parse(response)).toEqual({
      status: 400,
      message: '手机号格式不正确',
      data: {
        errorCode: 'INVALID_PHONE',
        fields: ['phone'],
      },
    });
  });

  it('rejects a success status passed to the error factory', () => {
    expect(() => createError(200, '错误', 'INVALID_STATUS')).toThrow();
  });

  it('validates the fixed pagination data shape', () => {
    const schema = paginationDataSchema(z.object({ id: z.string() }));

    expect(
      schema.parse({
        items: [{ id: 'item-1' }],
        page: 1,
        pageSize: 20,
        total: 1,
      }),
    ).toEqual({
      items: [{ id: 'item-1' }],
      page: 1,
      pageSize: 20,
      total: 1,
    });
  });
});
