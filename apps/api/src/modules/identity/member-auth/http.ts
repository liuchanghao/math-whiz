import { createError } from '@math-whiz/contracts';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const jsonResponse = <T>(body: T, status = 200) =>
  NextResponse.json(body, { status });

export const errorResponse = (
  status: number,
  message: string,
  errorCode: string,
  fields?: string[],
) => jsonResponse(createError(status, message, errorCode, fields), status);

export const readBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization');
  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(authorization ?? '');
  return match?.[1];
};

export const parseJsonBody = async <TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<
  | { kind: 'success'; data: z.output<TSchema> }
  | { kind: 'error'; response: NextResponse }
> => {
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return {
      kind: 'error',
      response: errorResponse(415, '请求格式不支持', 'UNSUPPORTED_MEDIA_TYPE'),
    };
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return {
      kind: 'error',
      response: errorResponse(400, '请求参数错误', 'VALIDATION_ERROR', [
        'body',
      ]),
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
        parsed.error.issues.map((issue) => issue.path.join('.') || 'body'),
      ),
    };
  }

  return { kind: 'success', data: parsed.data };
};
