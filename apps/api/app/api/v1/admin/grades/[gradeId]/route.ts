import {
  createSuccess,
  gradeIdSchema,
  gradeUpdateRequestSchema,
} from '@math-whiz/contracts';

import {
  CatalogConflictError,
  CatalogNotFoundError,
  updateGrade,
} from '@/src/modules/catalog/service';
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

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ gradeId: string }> },
) => {
  const authorization = await authorizeAdminRequest(request, {
    requireCsrf: true,
  });
  if (authorization.kind === 'rejected') {
    return authorization.response;
  }

  const { gradeId: rawGradeId } = await params;
  const parsedGradeId = gradeIdSchema.safeParse(Number(rawGradeId));
  if (!parsedGradeId.success) {
    return errorResponse(404, '年级不存在', 'GRADE_NOT_FOUND');
  }

  const parsedBody = await parseJsonBody(request, gradeUpdateRequestSchema);
  if (parsedBody.kind === 'error') {
    return parsedBody.response;
  }

  try {
    const grade = await updateGrade({
      adminId: authorization.adminId,
      gradeId: parsedGradeId.data,
      input: parsedBody.data,
      requestId: getRequestId(request),
    });
    return jsonResponse(createSuccess('年级更新成功', grade));
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      return errorResponse(404, '年级不存在', 'GRADE_NOT_FOUND');
    }
    if (error instanceof CatalogConflictError) {
      return errorResponse(
        409,
        '年级排序不能重复',
        'GRADE_SORT_ORDER_CONFLICT',
      );
    }
    throw error;
  }
};
