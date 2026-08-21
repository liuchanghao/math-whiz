import { adminLoginRequestSchema, createSuccess } from '@math-whiz/contracts';

import {
  errorResponse,
  forbiddenOriginResponse,
  getClientIp,
  getRequestId,
  isTrustedAdminOrigin,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
  setAdminSessionCookie,
} from '@/src/modules/identity/admin-auth/http';
import { loginAdmin } from '@/src/modules/identity/admin-auth/service';

export const dynamic = 'force-dynamic';

export const OPTIONS = optionsResponse;

export const POST = async (request: Request) => {
  if (!isTrustedAdminOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const parsed = await parseJsonBody(request, adminLoginRequestSchema);
  if (parsed.kind === 'error') {
    return parsed.response;
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
