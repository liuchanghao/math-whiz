import { adminLoginRequestSchema, createSuccess } from '@math-whiz/contracts';

import {
  errorResponse,
  forbiddenOriginResponse,
  getClientIp,
  getRequestId,
  isTrustedAdminOrigin,
  jsonResponse,
  optionsResponse,
  setAdminSessionCookie,
} from '@/src/modules/identity/admin-auth/http';
import { loginAdmin } from '@/src/modules/identity/admin-auth/service';

export const dynamic = 'force-dynamic';

export const OPTIONS = optionsResponse;

export const POST = async (request: Request) => {
  if (!isTrustedAdminOrigin(request)) {
    return forbiddenOriginResponse();
  }

  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return errorResponse(415, '请求格式不支持', 'UNSUPPORTED_MEDIA_TYPE');
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse(400, '请求参数错误', 'VALIDATION_ERROR', ['body']);
  }

  const parsed = adminLoginRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(
      400,
      '请求参数错误',
      'VALIDATION_ERROR',
      parsed.error.issues.map((issue) => issue.path.join('.') || 'body'),
    );
  }

  const result = await loginAdmin({
    ...parsed.data,
    ipAddress: getClientIp(request),
    requestId: getRequestId(request),
  });

  if (result.kind === 'invalid-credentials') {
    return errorResponse(401, '用户名或密码错误', 'ADMIN_INVALID_CREDENTIALS');
  }

  if (result.kind === 'blocked') {
    return errorResponse(
      429,
      '登录尝试过多，请稍后再试',
      'ADMIN_LOGIN_BLOCKED',
    );
  }

  const response = jsonResponse(
    createSuccess('登录成功', {
      admin: result.admin,
      csrfToken: result.csrfToken,
    }),
  );
  setAdminSessionCookie(response, result.sessionToken, result.expiresAt);
  return response;
};
