import { createError } from '@math-whiz/contracts';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const jsonResponse = <T>(body: T, status = 200, headers?: HeadersInit) =>
  NextResponse.json(body, { status, headers });

export const errorResponse = (
  status: number,
  message: string,
  errorCode: string,
  fields?: string[],
  headers?: HeadersInit,
) =>
  jsonResponse(
    createError(status, message, errorCode, fields),
    status,
    headers,
  );

export const parseJsonBody = async <TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  headers?: HeadersInit,
): Promise<
  | { kind: 'success'; data: z.output<TSchema> }
  | { kind: 'error'; response: NextResponse }
> => {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return {
      kind: 'error',
      response: errorResponse(
        415,
        '请求格式不支持',
        'UNSUPPORTED_MEDIA_TYPE',
        undefined,
        headers,
      ),
    };
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return {
      kind: 'error',
      response: errorResponse(
        400,
        '请求参数错误',
        'VALIDATION_ERROR',
        ['body'],
        headers,
      ),
    };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      kind: 'error',
      response: errorResponse(
        400,
        '请求参数错误',
        'VALIDATION_ERROR',
        [
          ...new Set(
            parsed.error.issues.map((issue) => issue.path.join('.') || 'body'),
          ),
        ],
        headers,
      ),
    };
  }

  return { kind: 'success', data: parsed.data };
};
