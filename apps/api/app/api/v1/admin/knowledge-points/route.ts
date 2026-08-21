import {
  createSuccess,
  knowledgePointCreateRequestSchema,
} from '@math-whiz/contracts';

import {
  CatalogConflictError,
  CatalogNotFoundError,
  createKnowledgePoint,
  listKnowledgePoints,
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

export const GET = async (request: Request) => {
  const authorization = await authorizeAdminRequest(request);
  if (authorization.kind === 'rejected') {
    return authorization.response;
  }
  return jsonResponse(
    createSuccess('知识点列表获取成功', await listKnowledgePoints()),
  );
};

export const POST = async (request: Request) => {
  const authorization = await authorizeAdminRequest(request, {
    requireCsrf: true,
  });
  if (authorization.kind === 'rejected') {
    return authorization.response;
  }

  const parsedBody = await parseJsonBody(
    request,
    knowledgePointCreateRequestSchema,
  );
  if (parsedBody.kind === 'error') {
    return parsedBody.response;
  }

  try {
    const knowledgePoint = await createKnowledgePoint({
      adminId: authorization.adminId,
      input: parsedBody.data,
      requestId: getRequestId(request),
    });
    return jsonResponse(createSuccess('知识点创建成功', knowledgePoint));
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      return errorResponse(404, '年级不存在', 'GRADE_NOT_FOUND');
    }
    if (error instanceof CatalogConflictError) {
      return errorResponse(
        409,
        '知识点名称已存在',
        'KNOWLEDGE_POINT_NAME_CONFLICT',
      );
    }
    throw error;
  }
};
