import {
  createSuccess,
  memberChangePasswordRequestSchema,
} from '@math-whiz/contracts';

import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
  readBearerToken,
} from '@/src/modules/identity/member-auth/http';
import {
  authenticateMember,
  changeMemberPassword,
} from '@/src/modules/identity/member-auth/service';

export const dynamic = 'force-dynamic';

export const POST = async (request: Request) => {
  const accessToken = readBearerToken(request);
  if (accessToken === undefined) {
    return errorResponse(401, '登录状态已失效', 'MEMBER_UNAUTHORIZED');
  }
  const parsed = await parseJsonBody(
    request,
    memberChangePasswordRequestSchema,
  );
  if (parsed.kind === 'error') {
    return parsed.response;
  }

  const authenticated = await authenticateMember({ accessToken });
  if (authenticated.kind === 'unauthorized') {
    return errorResponse(401, '登录状态已失效', 'MEMBER_UNAUTHORIZED');
  }
  const result = await changeMemberPassword({
    memberId: authenticated.member.id,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });
  if (result.kind === 'invalid-current-password') {
    return errorResponse(401, '原密码错误', 'MEMBER_CURRENT_PASSWORD_INVALID');
  }
  if (result.kind === 'unauthorized') {
    return errorResponse(401, '登录状态已失效', 'MEMBER_UNAUTHORIZED');
  }

  return jsonResponse(createSuccess('密码修改成功，请重新登录', null));
};
