import {
  createSuccess,
  memberRefreshRequestSchema,
} from '@math-whiz/contracts';

import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
} from '@/src/modules/identity/member-auth/http';
import { refreshMemberSession } from '@/src/modules/identity/member-auth/service';

export const dynamic = 'force-dynamic';

export const POST = async (request: Request) => {
  const parsed = await parseJsonBody(request, memberRefreshRequestSchema);
  if (parsed.kind === 'error') {
    return parsed.response;
  }

  const result = await refreshMemberSession(parsed.data);
  if (result.kind === 'invalid-session') {
    return errorResponse(401, '登录状态已失效', 'MEMBER_SESSION_INVALID');
  }

  return jsonResponse(createSuccess('会话已刷新', result.session));
};
