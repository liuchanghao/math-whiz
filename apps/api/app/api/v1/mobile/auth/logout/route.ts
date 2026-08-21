import { createSuccess, memberLogoutRequestSchema } from '@math-whiz/contracts';

import {
  jsonResponse,
  parseJsonBody,
} from '@/src/modules/identity/member-auth/http';
import { logoutMember } from '@/src/modules/identity/member-auth/service';

export const dynamic = 'force-dynamic';

export const POST = async (request: Request) => {
  const parsed = await parseJsonBody(request, memberLogoutRequestSchema);
  if (parsed.kind === 'error') {
    return parsed.response;
  }

  await logoutMember(parsed.data);
  return jsonResponse(createSuccess('已退出登录', null));
};
