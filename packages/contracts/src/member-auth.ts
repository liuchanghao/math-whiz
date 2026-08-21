import { z } from 'zod';

export const memberPhoneSchema = z.string().regex(/^1[3-9]\d{9}$/);

const submittedPasswordSchema = z.string().min(1).max(256);
export const memberNewPasswordSchema = z.string().min(6).max(128);
export const opaqueTokenSchema = z.string().min(43).max(128);

export const memberLoginRequestSchema = z
  .object({
    phone: memberPhoneSchema,
    password: submittedPasswordSchema,
  })
  .strict();

export const memberRefreshRequestSchema = z
  .object({ refreshToken: opaqueTokenSchema })
  .strict();

export const memberLogoutRequestSchema = memberRefreshRequestSchema;

export const memberChangePasswordRequestSchema = z
  .object({
    currentPassword: submittedPasswordSchema,
    newPassword: memberNewPasswordSchema,
    confirmNewPassword: memberNewPasswordSchema,
  })
  .strict()
  .refine((input) => input.newPassword === input.confirmNewPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmNewPassword'],
  });

export const memberPublicSchema = z.object({
  id: z.uuid(),
  phone: memberPhoneSchema,
});

export const memberSessionDataSchema = z.object({
  member: memberPublicSchema,
  accessToken: opaqueTokenSchema,
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: opaqueTokenSchema,
  refreshTokenExpiresAt: z.iso.datetime(),
});

export const memberMeDataSchema = z.object({ member: memberPublicSchema });

export type MemberLoginRequest = z.infer<typeof memberLoginRequestSchema>;
export type MemberRefreshRequest = z.infer<typeof memberRefreshRequestSchema>;
export type MemberLogoutRequest = z.infer<typeof memberLogoutRequestSchema>;
export type MemberChangePasswordRequest = z.infer<
  typeof memberChangePasswordRequestSchema
>;
export type MemberPublic = z.infer<typeof memberPublicSchema>;
export type MemberSessionData = z.infer<typeof memberSessionDataSchema>;
export type MemberMeData = z.infer<typeof memberMeDataSchema>;
