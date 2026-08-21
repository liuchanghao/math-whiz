import { createSuccess, prizeIdSchema } from '@math-whiz/contracts';

import {
  RewardNotFoundError,
  setPrizeStatus,
} from '@/src/modules/rewards/service';
import { authorizeAdminRequest } from '@/src/modules/identity/admin-auth/guard';
import {
  errorResponse,
  getRequestId,
  jsonResponse,
  optionsResponse,
} from '@/src/modules/identity/admin-auth/http';

export const dynamic = 'force-dynamic';
export const OPTIONS = optionsResponse;

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ prizeId: string }> },
) => {
  const authorization = await authorizeAdminRequest(request, {
    requireCsrf: true,
  });
  if (authorization.kind === 'rejected') return authorization.response;
  const parsedId = prizeIdSchema.safeParse((await params).prizeId);
  if (!parsedId.success)
    return errorResponse(404, '奖品不存在', 'PRIZE_NOT_FOUND');
  try {
    return jsonResponse(
      createSuccess(
        '奖品已停用',
        await setPrizeStatus({
          adminId: authorization.adminId,
          prizeId: parsedId.data,
          status: 'DISABLED',
          requestId: getRequestId(request),
        }),
      ),
    );
  } catch (error) {
    if (error instanceof RewardNotFoundError)
      return errorResponse(404, '奖品不存在', 'PRIZE_NOT_FOUND');
    throw error;
  }
};
