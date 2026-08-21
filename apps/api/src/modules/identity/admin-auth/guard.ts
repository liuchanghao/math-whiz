import type { NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  errorResponse,
  forbiddenOriginResponse,
  isTrustedAdminOrigin,
  readCookie,
} from './http';
import { authorizeAdminSession } from './service';

type AuthorizedAdmin = {
  kind: 'success';
  adminId: string;
};

type RejectedAdmin = {
  kind: 'rejected';
  response: NextResponse;
};

export const authorizeAdminRequest = async (
  request: Request,
  options: { requireCsrf?: boolean } = {},
): Promise<AuthorizedAdmin | RejectedAdmin> => {
  if (!isTrustedAdminOrigin(request)) {
    return { kind: 'rejected', response: forbiddenOriginResponse() };
  }

  const sessionToken = readCookie(request, ADMIN_SESSION_COOKIE);
  if (sessionToken === undefined) {
    return {
      kind: 'rejected',
      response: errorResponse(401, '登录状态已失效', 'ADMIN_UNAUTHORIZED'),
    };
  }

  const csrfToken = options.requireCsrf
    ? (request.headers.get('x-csrf-token') ?? '')
    : undefined;
  const result = await authorizeAdminSession({ sessionToken, csrfToken });

  if (result.kind === 'csrf-invalid') {
    return {
      kind: 'rejected',
      response: errorResponse(403, '安全校验失败', 'ADMIN_CSRF_INVALID'),
    };
  }

  if (result.kind === 'unauthorized') {
    const response = errorResponse(401, '登录状态已失效', 'ADMIN_UNAUTHORIZED');
    clearAdminSessionCookie(response);
    return { kind: 'rejected', response };
  }

  return {
    kind: 'success',
    adminId: result.admin.id,
  };
};
