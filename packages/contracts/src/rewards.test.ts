import { describe, expect, it } from 'vitest';

import {
  availableGradeListDataSchema,
  currentPrizeUpdateRequestSchema,
  prizeCreateRequestSchema,
  prizeSchema,
  prizeUpdateRequestSchema,
} from './rewards';

const prizeId = 'c4160f28-61a7-4c35-9473-259eef1da179';

describe('prize and available-grade contracts', () => {
  it('accepts only the text-only phase-one prize fields', () => {
    const input = {
      name: '数学星球模型',
      description: '一枚适合桌面摆放的实物奖品',
      claimInstructions: '请联系项目维护者线下领取',
      gradeIds: [1, 2],
    };

    expect(prizeCreateRequestSchema.parse(input)).toEqual(input);
    expect(() =>
      prizeCreateRequestSchema.parse({ ...input, price: 99 }),
    ).toThrow();
    expect(() => prizeUpdateRequestSchema.parse({})).toThrow();
  });

  it('returns prize status, applicable grades and timestamps to administrators', () => {
    const prize = {
      id: prizeId,
      name: '数学星球模型',
      description: '一枚适合桌面摆放的实物奖品',
      claimInstructions: '请联系项目维护者线下领取',
      status: 'ACTIVE' as const,
      gradeIds: [1, 2],
      createdAt: '2026-08-21T10:00:00.000Z',
      updatedAt: '2026-08-21T10:00:00.000Z',
    };

    expect(prizeSchema.parse(prize)).toEqual(prize);
    expect(currentPrizeUpdateRequestSchema.parse({ prizeId })).toEqual({
      prizeId,
    });
  });

  it('exposes only open grades and their current prize summary to members', () => {
    const grades = [
      {
        id: 1,
        name: '小学一年级',
        sortOrder: 1,
        currentPrize: {
          id: prizeId,
          name: '数学星球模型',
          description: '一枚适合桌面摆放的实物奖品',
        },
      },
    ];

    expect(availableGradeListDataSchema.parse(grades)).toEqual(grades);
  });
});
