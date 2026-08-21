import {
  createSuccess,
  prizeIdSchema,
  prizeUpdateRequestSchema,
} from '@math-whiz/contracts';

import {
  getPrize,
  RewardNotFoundError,
  updatePrize,
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

const parseId = async (params: Promise<{ prizeId: string }>) =>
  prizeIdSchema.safeParse((await params).prizeId);

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ prizeId: string }> },
) => {
  const authorization = await authorizeAdminRequest(request);
  if (authorization.kind === 'rejected') return authorization.response;
  const parsedId = await parseId(params);
  if (!parsedId.success) {
    return errorResponse(404, '奖品不存在', 'PRIZE_NOT_FOUND');
  }
  const prize = await getPrize(parsedId.data);
  return prize === null
    ? errorResponse(404, '奖品不存在', 'PRIZE_NOT_FOUND')
    : jsonResponse(createSuccess('奖品获取成功', prize));
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ prizeId: string }> },
) => {
  const authorization = await authorizeAdminRequest(request, {
    requireCsrf: true,
  });
  if (authorization.kind === 'rejected') return authorization.response;
  const parsedId = await parseId(params);
  if (!parsedId.success) {
    return errorResponse(404, '奖品不存在', 'PRIZE_NOT_FOUND');
  }
  const parsed = await parseJsonBody(request, prizeUpdateRequestSchema);
  if (parsed.kind === 'error') return parsed.response;
  try {
    const prize = await updatePrize({
      adminId: authorization.adminId,
      prizeId: parsedId.data,
      input: parsed.data,
      requestId: getRequestId(request),
    });
    return jsonResponse(createSuccess('奖品更新成功', prize));
  } catch (error) {
    if (error instanceof RewardNotFoundError) {
      return errorResponse(404, '奖品或年级不存在', 'PRIZE_NOT_FOUND');
    }
    throw error;
  }
};
