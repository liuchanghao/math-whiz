import {
  createSuccess,
  currentPrizeUpdateRequestSchema,
  gradeIdSchema,
} from '@math-whiz/contracts';

import {
  RewardConflictError,
  RewardNotFoundError,
  setCurrentPrize,
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

export const PUT = async (
  request: Request,
  { params }: { params: Promise<{ gradeId: string }> },
) => {
  const authorization = await authorizeAdminRequest(request, {
    requireCsrf: true,
  });
  if (authorization.kind === 'rejected') return authorization.response;
  const parsedGradeId = gradeIdSchema.safeParse(Number((await params).gradeId));
  if (!parsedGradeId.success)
    return errorResponse(404, '年级不存在', 'GRADE_NOT_FOUND');
  const parsed = await parseJsonBody(request, currentPrizeUpdateRequestSchema);
  if (parsed.kind === 'error') return parsed.response;
  try {
    return jsonResponse(
      createSuccess(
        '当前奖品设置成功',
        await setCurrentPrize({
          adminId: authorization.adminId,
          gradeId: parsedGradeId.data,
          prizeId: parsed.data.prizeId,
          requestId: getRequestId(request),
        }),
      ),
    );
  } catch (error) {
    if (error instanceof RewardNotFoundError)
      return errorResponse(404, '年级或奖品不存在', 'PRIZE_NOT_FOUND');
    if (error instanceof RewardConflictError) {
      return errorResponse(
        409,
        error.reason === 'PRIZE_NOT_ACTIVE'
          ? '只能选择已启用的奖品'
          : '奖品不适用于该年级',
        error.reason,
      );
    }
    throw error;
  }
};
