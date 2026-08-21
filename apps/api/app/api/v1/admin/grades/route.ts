import { createSuccess } from '@math-whiz/contracts';

import { listGrades } from '@/src/modules/catalog/service';
import {
  optionsResponse,
  jsonResponse,
} from '@/src/modules/identity/admin-auth/http';
import { authorizeAdminRequest } from '@/src/modules/identity/admin-auth/guard';

export const dynamic = 'force-dynamic';

export const OPTIONS = optionsResponse;

export const GET = async (request: Request) => {
  const authorization = await authorizeAdminRequest(request);
  if (authorization.kind === 'rejected') {
    return authorization.response;
  }

  return jsonResponse(createSuccess('年级列表获取成功', await listGrades()));
};
