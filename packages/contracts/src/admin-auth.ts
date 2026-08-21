import { z } from 'zod';

export const adminUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);

export const adminLoginRequestSchema = z
  .object({
    username: adminUsernameSchema,
    password: z.string().min(1).max(256),
  })
  .strict();

export const adminPublicSchema = z.object({
  id: z.uuid(),
  username: adminUsernameSchema,
});

export const adminSessionDataSchema = z.object({
  admin: adminPublicSchema,
  csrfToken: z.string().min(32).max(128),
});

export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;
export type AdminPublic = z.infer<typeof adminPublicSchema>;
export type AdminSessionData = z.infer<typeof adminSessionDataSchema>;
