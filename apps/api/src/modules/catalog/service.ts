import type {
  Grade,
  GradeUpdateRequest,
  KnowledgePoint,
  KnowledgePointCreateRequest,
  KnowledgePointUpdateRequest,
} from '@math-whiz/contracts';

import { getDatabase } from '@/src/infrastructure/database';

export const listGrades = async (): Promise<Grade[]> => {
  const grades = await getDatabase().grade.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  return grades.map((grade) => ({
    id: grade.id,
    name: grade.name,
    sortOrder: grade.sortOrder,
    status: grade.status,
  }));
};

export class CatalogNotFoundError extends Error {}

export class CatalogConflictError extends Error {}

const isPrismaErrorCode = (error: unknown, code: string) =>
  error instanceof Error &&
  'code' in error &&
  (error as Error & { code?: string }).code === code;

type KnowledgePointRecord = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
  updatedAt: Date;
  grades: { gradeId: number }[];
};

const toKnowledgePoint = (record: KnowledgePointRecord): KnowledgePoint => ({
  id: record.id,
  name: record.name,
  status: record.status,
  gradeIds: record.grades.map(({ gradeId }) => gradeId).sort((a, b) => a - b),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

export const updateGrade = async ({
  adminId,
  gradeId,
  input,
  requestId,
}: {
  adminId: string;
  gradeId: number;
  input: GradeUpdateRequest;
  requestId: string;
}): Promise<Grade> => {
  const database = getDatabase();

  try {
    const grade = await database.$transaction(async (transaction) => {
      const updated = await transaction.grade.update({
        where: { id: gradeId },
        data: input,
      });
      await transaction.auditLog.create({
        data: {
          adminId,
          action: 'GRADE_UPDATED',
          targetType: 'GRADE',
          targetId: String(gradeId),
          summary: { changedFields: Object.keys(input).sort() },
          requestId,
        },
      });
      return updated;
    });

    return {
      id: grade.id,
      name: grade.name,
      sortOrder: grade.sortOrder,
      status: grade.status,
    };
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new CatalogNotFoundError('Grade not found');
    }
    if (isPrismaErrorCode(error, 'P2002')) {
      throw new CatalogConflictError('Grade sort order conflicts');
    }
    throw error;
  }
};

export const listKnowledgePoints = async (): Promise<KnowledgePoint[]> => {
  const knowledgePoints = await getDatabase().knowledgePoint.findMany({
    include: { grades: { select: { gradeId: true } } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  return knowledgePoints.map(toKnowledgePoint);
};

export const getKnowledgePoint = async (
  knowledgePointId: string,
): Promise<KnowledgePoint | null> => {
  const knowledgePoint = await getDatabase().knowledgePoint.findUnique({
    where: { id: knowledgePointId },
    include: { grades: { select: { gradeId: true } } },
  });
  return knowledgePoint === null ? null : toKnowledgePoint(knowledgePoint);
};

const ensureGradesExist = async (
  transaction: Parameters<
    Parameters<ReturnType<typeof getDatabase>['$transaction']>[0]
  >[0],
  gradeIds: number[],
) => {
  const gradeCount = await transaction.grade.count({
    where: { id: { in: gradeIds } },
  });
  if (gradeCount !== gradeIds.length) {
    throw new CatalogNotFoundError('Grade not found');
  }
};

export const createKnowledgePoint = async ({
  adminId,
  input,
  requestId,
}: {
  adminId: string;
  input: KnowledgePointCreateRequest;
  requestId: string;
}): Promise<KnowledgePoint> => {
  const database = getDatabase();
  try {
    const created = await database.$transaction(async (transaction) => {
      await ensureGradesExist(transaction, input.gradeIds);
      const knowledgePoint = await transaction.knowledgePoint.create({
        data: { name: input.name },
      });
      await transaction.knowledgePointGrade.createMany({
        data: input.gradeIds.map((gradeId) => ({
          knowledgePointId: knowledgePoint.id,
          gradeId,
        })),
      });
      await transaction.auditLog.create({
        data: {
          adminId,
          action: 'KNOWLEDGE_POINT_CREATED',
          targetType: 'KNOWLEDGE_POINT',
          targetId: knowledgePoint.id,
          summary: { gradeIds: [...input.gradeIds].sort((a, b) => a - b) },
          requestId,
        },
      });
      return transaction.knowledgePoint.findUniqueOrThrow({
        where: { id: knowledgePoint.id },
        include: { grades: { select: { gradeId: true } } },
      });
    });
    return toKnowledgePoint(created);
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      throw error;
    }
    if (isPrismaErrorCode(error, 'P2002')) {
      throw new CatalogConflictError('Knowledge-point name conflicts');
    }
    throw error;
  }
};

export const updateKnowledgePoint = async ({
  adminId,
  knowledgePointId,
  input,
  requestId,
}: {
  adminId: string;
  knowledgePointId: string;
  input: KnowledgePointUpdateRequest;
  requestId: string;
}): Promise<KnowledgePoint> => {
  const database = getDatabase();
  try {
    const updated = await database.$transaction(async (transaction) => {
      if (input.gradeIds !== undefined) {
        await ensureGradesExist(transaction, input.gradeIds);
      }
      await transaction.knowledgePoint.update({
        where: { id: knowledgePointId },
        data: { name: input.name, status: input.status },
      });
      if (input.gradeIds !== undefined) {
        await transaction.knowledgePointGrade.deleteMany({
          where: { knowledgePointId },
        });
        await transaction.knowledgePointGrade.createMany({
          data: input.gradeIds.map((gradeId) => ({
            knowledgePointId,
            gradeId,
          })),
        });
      }
      await transaction.auditLog.create({
        data: {
          adminId,
          action: 'KNOWLEDGE_POINT_UPDATED',
          targetType: 'KNOWLEDGE_POINT',
          targetId: knowledgePointId,
          summary: { changedFields: Object.keys(input).sort() },
          requestId,
        },
      });
      return transaction.knowledgePoint.findUniqueOrThrow({
        where: { id: knowledgePointId },
        include: { grades: { select: { gradeId: true } } },
      });
    });
    return toKnowledgePoint(updated);
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      throw error;
    }
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new CatalogNotFoundError('Knowledge point not found');
    }
    if (isPrismaErrorCode(error, 'P2002')) {
      throw new CatalogConflictError('Knowledge-point name conflicts');
    }
    throw error;
  }
};
