import { createSuccess, prizeIdSchema } from '@math-whiz/contracts';

import { authorizeAdminRequest } from '@/src/modules/identity/admin-auth/guard';
import {
  errorResponse,
  getRequestId,
  jsonResponse,
} from '@/src/modules/identity/admin-auth/http';

import { RewardNotFoundError, setPrizeStatus } from './service';

type PrizeStatus = 'ACTIVE' | 'DISABLED';

const messages: Record<PrizeStatus, string> = {
  ACTIVE: '奖品已启用',
  DISABLED: '奖品已停用',
};

export const changePrizeStatus = async (
  request: Request,
  params: Promise<{ prizeId: string }>,
  status: PrizeStatus,
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
        messages[status],
        await setPrizeStatus({
          adminId: authorization.adminId,
          prizeId: parsedId.data,
          status,
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
