import type {
  AvailableGrade,
  Grade,
  Prize,
  PrizeCreateRequest,
  PrizeUpdateRequest,
} from '@math-whiz/contracts';

import { getDatabase } from '@/src/infrastructure/database';

export class RewardNotFoundError extends Error {}

export class RewardConflictError extends Error {
  constructor(
    message: string,
    readonly reason: 'PRIZE_NOT_ACTIVE' | 'PRIZE_NOT_APPLICABLE',
  ) {
    super(message);
  }
}

const isPrismaErrorCode = (error: unknown, code: string) =>
  error instanceof Error &&
  'code' in error &&
  (error as Error & { code?: string }).code === code;

type PrizeRecord = {
  id: string;
  name: string;
  description: string;
  claimInstructions: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
  updatedAt: Date;
  grades: { gradeId: number }[];
};

const toPrize = (record: PrizeRecord): Prize => ({
  id: record.id,
  name: record.name,
  description: record.description,
  claimInstructions: record.claimInstructions,
  status: record.status,
  gradeIds: record.grades.map(({ gradeId }) => gradeId).sort((a, b) => a - b),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

type TransactionClient = Parameters<
  Parameters<ReturnType<typeof getDatabase>['$transaction']>[0]
>[0];

const ensureGradesExist = async (
  transaction: TransactionClient,
  gradeIds: number[],
) => {
  const count = await transaction.grade.count({
    where: { id: { in: gradeIds } },
  });
  if (count !== gradeIds.length) {
    throw new RewardNotFoundError('Grade not found');
  }
};

const prizeInclude = {
  grades: { select: { gradeId: true } },
} as const;

export const listPrizes = async (): Promise<Prize[]> => {
  const prizes = await getDatabase().prize.findMany({
    include: prizeInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
  return prizes.map(toPrize);
};

export const getPrize = async (prizeId: string): Promise<Prize | null> => {
  const prize = await getDatabase().prize.findUnique({
    where: { id: prizeId },
    include: prizeInclude,
  });
  return prize === null ? null : toPrize(prize);
};

export const createPrize = async ({
  adminId,
  input,
  requestId,
}: {
  adminId: string;
  input: PrizeCreateRequest;
  requestId: string;
}): Promise<Prize> => {
  const created = await getDatabase().$transaction(async (transaction) => {
    await ensureGradesExist(transaction, input.gradeIds);
    const prize = await transaction.prize.create({
      data: {
        name: input.name,
        description: input.description,
        claimInstructions: input.claimInstructions,
        grades: {
          create: input.gradeIds.map((gradeId) => ({ gradeId })),
        },
      },
      include: prizeInclude,
    });
    await transaction.auditLog.create({
      data: {
        adminId,
        action: 'PRIZE_CREATED',
        targetType: 'PRIZE',
        targetId: prize.id,
        summary: { gradeIds: [...input.gradeIds].sort((a, b) => a - b) },
        requestId,
      },
    });
    return prize;
  });
  return toPrize(created);
};

export const updatePrize = async ({
  adminId,
  prizeId,
  input,
  requestId,
}: {
  adminId: string;
  prizeId: string;
  input: PrizeUpdateRequest;
  requestId: string;
}): Promise<Prize> => {
  try {
    const updated = await getDatabase().$transaction(async (transaction) => {
      if (input.gradeIds !== undefined) {
        await ensureGradesExist(transaction, input.gradeIds);
      }
      await transaction.prize.update({
        where: { id: prizeId },
        data: {
          name: input.name,
          description: input.description,
          claimInstructions: input.claimInstructions,
        },
      });
      if (input.gradeIds !== undefined) {
        await transaction.prizeGrade.deleteMany({ where: { prizeId } });
        await transaction.prizeGrade.createMany({
          data: input.gradeIds.map((gradeId) => ({ prizeId, gradeId })),
        });
      }
      await transaction.auditLog.create({
        data: {
          adminId,
          action: 'PRIZE_UPDATED',
          targetType: 'PRIZE',
          targetId: prizeId,
          summary: { changedFields: Object.keys(input).sort() },
          requestId,
        },
      });
      return transaction.prize.findUniqueOrThrow({
        where: { id: prizeId },
        include: prizeInclude,
      });
    });
    return toPrize(updated);
  } catch (error) {
    if (error instanceof RewardNotFoundError) throw error;
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new RewardNotFoundError('Prize not found');
    }
    throw error;
  }
};

export const setPrizeStatus = async ({
  adminId,
  prizeId,
  status,
  requestId,
}: {
  adminId: string;
  prizeId: string;
  status: 'ACTIVE' | 'DISABLED';
  requestId: string;
}): Promise<Prize> => {
  try {
    const updated = await getDatabase().$transaction(async (transaction) => {
      await transaction.prize.update({
        where: { id: prizeId },
        data: { status },
      });
      await transaction.auditLog.create({
        data: {
          adminId,
          action: status === 'ACTIVE' ? 'PRIZE_ENABLED' : 'PRIZE_DISABLED',
          targetType: 'PRIZE',
          targetId: prizeId,
          summary: { status },
          requestId,
        },
      });
      return transaction.prize.findUniqueOrThrow({
        where: { id: prizeId },
        include: prizeInclude,
      });
    });
    return toPrize(updated);
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new RewardNotFoundError('Prize not found');
    }
    throw error;
  }
};

export const setCurrentPrize = async ({
  adminId,
  gradeId,
  prizeId,
  requestId,
}: {
  adminId: string;
  gradeId: number;
  prizeId: string;
  requestId: string;
}): Promise<Grade> =>
  getDatabase().$transaction(async (transaction) => {
    const [grade, prize] = await Promise.all([
      transaction.grade.findUnique({ where: { id: gradeId } }),
      transaction.prize.findUnique({
        where: { id: prizeId },
        include: prizeInclude,
      }),
    ]);
    if (grade === null || prize === null) {
      throw new RewardNotFoundError('Grade or prize not found');
    }
    if (prize.status !== 'ACTIVE') {
      throw new RewardConflictError('Prize is disabled', 'PRIZE_NOT_ACTIVE');
    }
    if (!prize.grades.some((candidate) => candidate.gradeId === gradeId)) {
      throw new RewardConflictError(
        'Prize is not applicable to grade',
        'PRIZE_NOT_APPLICABLE',
      );
    }
    const updated = await transaction.grade.update({
      where: { id: gradeId },
      data: { currentPrizeId: prizeId },
    });
    await transaction.auditLog.create({
      data: {
        adminId,
        action: 'GRADE_CURRENT_PRIZE_UPDATED',
        targetType: 'GRADE',
        targetId: String(gradeId),
        summary: { prizeId },
        requestId,
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      sortOrder: updated.sortOrder,
      status: updated.status,
      currentPrizeId: updated.currentPrizeId,
    };
  });

export const listAvailableGrades = async (): Promise<AvailableGrade[]> => {
  const database = getDatabase();
  const questionCounts = await database.questionGrade.groupBy({
    by: ['gradeId'],
    where: { question: { status: 'ACTIVE' } },
    _count: { questionId: true },
  });
  const sufficientlyStockedGradeIds = questionCounts
    .filter(({ _count }) => _count.questionId >= 10)
    .map(({ gradeId }) => gradeId);

  if (sufficientlyStockedGradeIds.length === 0) return [];

  const grades = await database.grade.findMany({
    where: {
      id: { in: sufficientlyStockedGradeIds },
      status: 'ACTIVE',
      currentPrize: { status: 'ACTIVE' },
    },
    include: {
      currentPrize: {
        include: { grades: { select: { gradeId: true } } },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  return grades.flatMap((grade) => {
    const prize = grade.currentPrize;
    if (
      prize === null ||
      !prize.grades.some((candidate) => candidate.gradeId === grade.id)
    ) {
      return [];
    }
    return [
      {
        id: grade.id,
        name: grade.name,
        sortOrder: grade.sortOrder,
        currentPrize: {
          id: prize.id,
          name: prize.name,
          description: prize.description,
        },
      },
    ];
  });
};
