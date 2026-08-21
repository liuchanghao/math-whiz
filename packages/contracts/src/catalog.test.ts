import { describe, expect, it } from 'vitest';

import {
  gradeListDataSchema,
  gradeUpdateRequestSchema,
  knowledgePointCreateRequestSchema,
} from './catalog';

describe('grade and knowledge-point contracts', () => {
  it('accepts the fixed six-grade catalogue returned to administrators', () => {
    const data = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      name: `小学${index + 1}年级`,
      sortOrder: index + 1,
      status: 'ACTIVE' as const,
    }));

    expect(gradeListDataSchema.parse(data)).toEqual(data);
  });

  it('accepts only editable grade fields and requires at least one change', () => {
    expect(
      gradeUpdateRequestSchema.parse({ name: '一年级', sortOrder: 2 }),
    ).toEqual({ name: '一年级', sortOrder: 2 });
    expect(() => gradeUpdateRequestSchema.parse({})).toThrow();
    expect(() =>
      gradeUpdateRequestSchema.parse({ id: 7, name: '七年级' }),
    ).toThrow();
  });

  it('requires every knowledge point to belong to at least one fixed grade', () => {
    expect(
      knowledgePointCreateRequestSchema.parse({
        name: '20 以内加减法',
        gradeIds: [1, 2],
      }),
    ).toEqual({ name: '20 以内加减法', gradeIds: [1, 2] });
    expect(() =>
      knowledgePointCreateRequestSchema.parse({
        name: '无年级知识点',
        gradeIds: [],
      }),
    ).toThrow();
    expect(() =>
      knowledgePointCreateRequestSchema.parse({
        name: '超出小学范围',
        gradeIds: [7],
      }),
    ).toThrow();
  });
});
