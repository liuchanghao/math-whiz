import { createSuccess, prizeCreateRequestSchema } from '@math-whiz/contracts';

import {
  createPrize,
  listPrizes,
  RewardNotFoundError,
} from '@/src/modules/rewards/service';
import { authorizeAdminRequest } from '@/src/modules/identity/admin-auth/guard';
import {
  errorResponse,
  getRequestId,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from '@/src/modules/identity/admin-auth/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = optionsResponse;

export const GET = async (request: Request) => {
  const authorization = await authorizeAdminRequest(request);
  if (authorization.kind === 'rejected') return authorization.response;
  return jsonResponse(createSuccess('奖品列表获取成功', await listPrizes()));
};

export const POST = async (request: Request) => {
  const authorization = await authorizeAdminRequest(request, {
    requireCsrf: true,
  });
  if (authorization.kind === 'rejected') return authorization.response;
  const parsed = await parseJsonBody(request, prizeCreateRequestSchema);
  if (parsed.kind === 'error') return parsed.response;
  try {
    const prize = await createPrize({
      adminId: authorization.adminId,
      input: parsed.data,
      requestId: getRequestId(request),
    });
    return jsonResponse(createSuccess('奖品创建成功', prize));
  } catch (error) {
    if (error instanceof RewardNotFoundError) {
      return errorResponse(404, '年级不存在', 'GRADE_NOT_FOUND');
    }
    throw error;
  }
};
