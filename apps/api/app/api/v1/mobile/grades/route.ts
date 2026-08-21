import { createSuccess } from '@math-whiz/contracts';

import { listAvailableGrades } from '@/src/modules/rewards/service';
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
  const member = await authenticateMember({ accessToken });
  if (member.kind === 'unauthorized') {
    return errorResponse(401, '登录状态已失效', 'MEMBER_UNAUTHORIZED');
  }
  return jsonResponse(
    createSuccess('可答年级获取成功', await listAvailableGrades()),
  );
};
