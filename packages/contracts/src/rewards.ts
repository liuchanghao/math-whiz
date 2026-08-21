import { z } from 'zod';

import {
  catalogueStatusSchema,
  gradeIdSchema,
  knowledgePointGradeIdsSchema,
} from './catalog';

export const prizeIdSchema = z.uuid();
export const prizeNameSchema = z.string().trim().min(1).max(64);
export const prizeDescriptionSchema = z.string().trim().min(1).max(1000);
export const prizeClaimInstructionsSchema = z.string().trim().min(1).max(1000);

export const prizeSchema = z
  .object({
    id: prizeIdSchema,
    name: prizeNameSchema,
    description: prizeDescriptionSchema,
    claimInstructions: prizeClaimInstructionsSchema,
    status: catalogueStatusSchema,
    gradeIds: knowledgePointGradeIdsSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const prizeListDataSchema = z.array(prizeSchema);

export const prizeCreateRequestSchema = z
  .object({
    name: prizeNameSchema,
    description: prizeDescriptionSchema,
    claimInstructions: prizeClaimInstructionsSchema,
    gradeIds: knowledgePointGradeIdsSchema,
  })
  .strict();

export const prizeUpdateRequestSchema = prizeCreateRequestSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少提交一个需要修改的字段',
  });

export const currentPrizeUpdateRequestSchema = z
  .object({ prizeId: prizeIdSchema })
  .strict();

export const availableGradeSchema = z
  .object({
    id: gradeIdSchema,
    name: z.string().trim().min(1).max(32),
    sortOrder: z.number().int().min(1).max(100),
    currentPrize: z
      .object({
        id: prizeIdSchema,
        name: prizeNameSchema,
        description: prizeDescriptionSchema,
      })
      .strict(),
  })
  .strict();

export const availableGradeListDataSchema = z.array(availableGradeSchema);

export type Prize = z.infer<typeof prizeSchema>;
export type PrizeCreateRequest = z.infer<typeof prizeCreateRequestSchema>;
export type PrizeUpdateRequest = z.infer<typeof prizeUpdateRequestSchema>;
export type CurrentPrizeUpdateRequest = z.infer<
  typeof currentPrizeUpdateRequestSchema
>;
export type AvailableGrade = z.infer<typeof availableGradeSchema>;
