import { z } from 'zod';

export const successEnvelopeSchema = <TData extends z.ZodType>(
  dataSchema: TData,
) =>
  z.object({
    status: z.literal(200),
    message: z.string(),
    data: dataSchema,
  });

export const errorDataSchema = z.object({
  errorCode: z.string().min(1),
  fields: z.array(z.string().min(1)).optional(),
});

export const errorStatusSchema = z.number().int().min(400).max(599);

export const errorEnvelopeSchema = z.object({
  status: errorStatusSchema,
  message: z.string(),
  data: errorDataSchema,
});

export const paginationDataSchema = <TItem extends z.ZodType>(
  itemSchema: TItem,
) =>
  z.object({
    items: z.array(itemSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  });

export type SuccessEnvelope<TData> = {
  status: 200;
  message: string;
  data: TData;
};

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export type PaginationData<TItem> = {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
};

export const createSuccess = <TData>(
  message: string,
  data: TData,
): SuccessEnvelope<TData> => ({
  status: 200,
  message,
  data,
});

export const createError = (
  status: number,
  message: string,
  errorCode: string,
  fields?: string[],
): ErrorEnvelope => {
  const validatedStatus = errorStatusSchema.parse(status);

  return {
    status: validatedStatus,
    message,
    data: {
      errorCode,
      ...(fields === undefined ? {} : { fields }),
    },
  };
};
