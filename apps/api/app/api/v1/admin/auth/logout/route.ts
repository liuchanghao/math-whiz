import { createSuccess } from '@math-whiz/contracts';

import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  errorResponse,
  forbiddenOriginResponse,
  getRequestId,
  isTrustedAdminOrigin,
  jsonResponse,
  optionsResponse,
  readCookie,
} from '@/src/modules/identity/admin-auth/http';
import { logoutAdmin } from '@/src/modules/identity/admin-auth/service';

export const dynamic = 'force-dynamic';

export const OPTIONS = optionsResponse;

export const POST = async (request: Request) => {
  if (!isTrustedAdminOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const sessionToken = readCookie(request, ADMIN_SESSION_COOKIE);
  if (sessionToken === undefined) {
    const response = errorResponse(401, '登录状态已失效', 'ADMIN_UNAUTHORIZED');
    clearAdminSessionCookie(response);
    return response;
  }

  const csrfToken = request.headers.get('x-csrf-token');
  if (csrfToken === null || csrfToken.length === 0) {
    return errorResponse(403, '安全校验失败', 'ADMIN_CSRF_INVALID');
  }

  const result = await logoutAdmin({
    sessionToken,
    csrfToken,
    requestId: getRequestId(request),
  });

  if (result.kind === 'csrf-invalid') {
    return errorResponse(403, '安全校验失败', 'ADMIN_CSRF_INVALID');
  }

  if (result.kind === 'unauthorized') {
    const response = errorResponse(401, '登录状态已失效', 'ADMIN_UNAUTHORIZED');
    clearAdminSessionCookie(response);
    return response;
  }

  const response = jsonResponse(createSuccess('已退出登录', null));
  clearAdminSessionCookie(response);
  return response;
};
