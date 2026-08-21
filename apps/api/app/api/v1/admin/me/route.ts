import { createSuccess } from '@math-whiz/contracts';

import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  errorResponse,
  forbiddenOriginResponse,
  isTrustedAdminOrigin,
  jsonResponse,
  optionsResponse,
  readCookie,
} from '@/src/modules/identity/admin-auth/http';
import { restoreAdminSession } from '@/src/modules/identity/admin-auth/service';

export const dynamic = 'force-dynamic';

export const OPTIONS = optionsResponse;

export const GET = async (request: Request) => {
  if (!isTrustedAdminOrigin(request)) {
    return forbiddenOriginResponse();
  }

  const sessionToken = readCookie(request, ADMIN_SESSION_COOKIE);
  if (sessionToken === undefined) {
    return errorResponse(401, '登录状态已失效', 'ADMIN_UNAUTHORIZED');
  }

  const result = await restoreAdminSession({ sessionToken });
  if (result.kind === 'unauthorized') {
    const response = errorResponse(401, '登录状态已失效', 'ADMIN_UNAUTHORIZED');
    clearAdminSessionCookie(response);
    return response;
  }

  return jsonResponse(
    createSuccess('会话有效', {
      admin: result.admin,
      csrfToken: result.csrfToken,
    }),
  );
};
