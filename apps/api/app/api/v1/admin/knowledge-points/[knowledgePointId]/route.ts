import {
  createSuccess,
  knowledgePointIdSchema,
  knowledgePointUpdateRequestSchema,
} from '@math-whiz/contracts';

import {
  CatalogConflictError,
  CatalogNotFoundError,
  getKnowledgePoint,
  updateKnowledgePoint,
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

const parseKnowledgePointId = async (
  params: Promise<{ knowledgePointId: string }>,
) => knowledgePointIdSchema.safeParse((await params).knowledgePointId);

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ knowledgePointId: string }> },
) => {
  const authorization = await authorizeAdminRequest(request);
  if (authorization.kind === 'rejected') {
    return authorization.response;
  }
  const parsedId = await parseKnowledgePointId(params);
  if (!parsedId.success) {
    return errorResponse(404, '知识点不存在', 'KNOWLEDGE_POINT_NOT_FOUND');
  }
  const knowledgePoint = await getKnowledgePoint(parsedId.data);
  return knowledgePoint === null
    ? errorResponse(404, '知识点不存在', 'KNOWLEDGE_POINT_NOT_FOUND')
    : jsonResponse(createSuccess('知识点获取成功', knowledgePoint));
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ knowledgePointId: string }> },
) => {
  const authorization = await authorizeAdminRequest(request, {
    requireCsrf: true,
  });
  if (authorization.kind === 'rejected') {
    return authorization.response;
  }
  const parsedId = await parseKnowledgePointId(params);
  if (!parsedId.success) {
    return errorResponse(404, '知识点不存在', 'KNOWLEDGE_POINT_NOT_FOUND');
  }
  const parsedBody = await parseJsonBody(
    request,
    knowledgePointUpdateRequestSchema,
  );
  if (parsedBody.kind === 'error') {
    return parsedBody.response;
  }

  try {
    const knowledgePoint = await updateKnowledgePoint({
      adminId: authorization.adminId,
      knowledgePointId: parsedId.data,
      input: parsedBody.data,
      requestId: getRequestId(request),
    });
    return jsonResponse(createSuccess('知识点更新成功', knowledgePoint));
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      return errorResponse(404, '知识点不存在', 'KNOWLEDGE_POINT_NOT_FOUND');
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
