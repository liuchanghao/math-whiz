import { createSuccess } from '@math-whiz/contracts';

import {
  errorResponse,
  jsonResponse,
  readBearerToken,
} from '@/src/modules/identity/member-auth/http';
import { authenticateMember } from '@/src/modules/identity/member-auth/service';

export const dynamic = 'force-dynamic';

export const GET = async (request: Request) => {
  const accessToken = readBearerToken(request);
  if (accessToken === undefined) {
    return errorResponse(401, '登录状态已失效', 'MEMBER_UNAUTHORIZED');
  }

  const result = await authenticateMember({ accessToken });
  if (result.kind === 'unauthorized') {
    return errorResponse(401, '登录状态已失效', 'MEMBER_UNAUTHORIZED');
  }

  return jsonResponse(createSuccess('会话有效', { member: result.member }));
};
