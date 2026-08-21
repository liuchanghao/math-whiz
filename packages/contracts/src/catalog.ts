import { z } from 'zod';

export const catalogueStatusSchema = z.enum(['ACTIVE', 'DISABLED']);

export const gradeIdSchema = z.number().int().min(1).max(6);

export const gradeSchema = z
  .object({
    id: gradeIdSchema,
    name: z.string().trim().min(1).max(32),
    sortOrder: z.number().int().min(1).max(100),
    status: catalogueStatusSchema,
  })
  .strict();

export const gradeListDataSchema = z.array(gradeSchema).length(6);

export const gradeUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(32).optional(),
    sortOrder: z.number().int().min(1).max(100).optional(),
    status: catalogueStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少提交一个需要修改的字段',
  });

export const knowledgePointNameSchema = z.string().trim().min(1).max(64);
export const knowledgePointIdSchema = z.uuid();

export const knowledgePointGradeIdsSchema = z
  .array(gradeIdSchema)
  .min(1)
  .max(6)
  .refine((gradeIds) => new Set(gradeIds).size === gradeIds.length, {
    message: '年级不能重复',
  });

export const knowledgePointSchema = z
  .object({
    id: knowledgePointIdSchema,
    name: knowledgePointNameSchema,
    status: catalogueStatusSchema,
    gradeIds: knowledgePointGradeIdsSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const knowledgePointListDataSchema = z.array(knowledgePointSchema);

export const knowledgePointCreateRequestSchema = z
  .object({
    name: knowledgePointNameSchema,
    gradeIds: knowledgePointGradeIdsSchema,
  })
  .strict();

export const knowledgePointUpdateRequestSchema = z
  .object({
    name: knowledgePointNameSchema.optional(),
    status: catalogueStatusSchema.optional(),
    gradeIds: knowledgePointGradeIdsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少提交一个需要修改的字段',
  });

export type CatalogueStatus = z.infer<typeof catalogueStatusSchema>;
export type Grade = z.infer<typeof gradeSchema>;
export type GradeUpdateRequest = z.infer<typeof gradeUpdateRequestSchema>;
export type KnowledgePoint = z.infer<typeof knowledgePointSchema>;
export type KnowledgePointCreateRequest = z.infer<
  typeof knowledgePointCreateRequestSchema
>;
export type KnowledgePointUpdateRequest = z.infer<
  typeof knowledgePointUpdateRequestSchema
>;
