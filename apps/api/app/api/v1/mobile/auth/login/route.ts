import { createSuccess, memberLoginRequestSchema } from '@math-whiz/contracts';

import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
} from '@/src/modules/identity/member-auth/http';
import { loginMember } from '@/src/modules/identity/member-auth/service';

export const dynamic = 'force-dynamic';

export const POST = async (request: Request) => {
  const parsed = await parseJsonBody(request, memberLoginRequestSchema);
  if (parsed.kind === 'error') {
    return parsed.response;
  }

  const result = await loginMember(parsed.data);
  if (result.kind === 'invalid-credentials') {
    return errorResponse(401, '手机号或密码错误', 'MEMBER_INVALID_CREDENTIALS');
  }

  return jsonResponse(createSuccess('登录成功', result.session));
};
