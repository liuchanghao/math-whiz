import {
  errorEnvelopeSchema,
  memberMeDataSchema,
  memberSessionDataSchema,
  nullDataSchema,
  successEnvelopeSchema,
  type MemberLoginRequest,
  type MemberChangePasswordRequest,
  type MemberPublic,
  type MemberSessionData,
} from '@math-whiz/contracts';

const apiBaseUrl = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

const memberSessionResponseSchema = successEnvelopeSchema(
  memberSessionDataSchema,
);
const memberMeResponseSchema = successEnvelopeSchema(memberMeDataSchema);
const nullResponseSchema = successEnvelopeSchema(nullDataSchema);

type SuccessParser<TData> = {
  safeParse: (
    input: unknown,
  ) => { success: true; data: { data: TData } } | { success: false };
};

export class MemberApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = 'MemberApiError';
  }
}

const parseError = async (response: Response): Promise<never> => {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (parsed.success && parsed.data.status === response.status) {
    throw new MemberApiError(
      parsed.data.message,
      parsed.data.status,
      parsed.data.data.errorCode,
    );
  }
  throw new MemberApiError('服务响应异常，请稍后重试', 502, 'INVALID_RESPONSE');
};

const parseSuccess = async <TData>(
  response: Response,
  schema: SuccessParser<TData>,
): Promise<TData> => {
  if (response.status >= 400) {
    return parseError(response);
  }
  if (response.status !== 200) {
    throw new MemberApiError(
      '服务响应异常，请稍后重试',
      502,
      'INVALID_RESPONSE',
    );
  }
  const parsed = schema.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    throw new MemberApiError(
      '服务响应异常，请稍后重试',
      502,
      'INVALID_RESPONSE',
    );
  }
  return parsed.data.data;
};

export const loginMember = async (
  input: MemberLoginRequest,
): Promise<MemberSessionData> =>
  parseSuccess(
    await fetch(`${apiBaseUrl}/api/v1/mobile/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
    memberSessionResponseSchema,
  );

export const refreshMember = async (
  refreshToken: string,
): Promise<MemberSessionData> =>
  parseSuccess(
    await fetch(`${apiBaseUrl}/api/v1/mobile/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }),
    memberSessionResponseSchema,
  );

export const getMember = async (accessToken: string): Promise<MemberPublic> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/mobile/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return (await parseSuccess(response, memberMeResponseSchema)).member;
};

export const changeMemberPassword = async (
  accessToken: string,
  input: MemberChangePasswordRequest,
) => {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/mobile/auth/change-password`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  await parseSuccess(response, nullResponseSchema);
};

export const logoutMember = async (refreshToken: string) => {
  const response = await fetch(`${apiBaseUrl}/api/v1/mobile/auth/logout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  await parseSuccess(response, nullResponseSchema);
};
