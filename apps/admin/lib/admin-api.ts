import {
  adminSessionDataSchema,
  errorEnvelopeSchema,
  gradeListDataSchema,
  gradeSchema,
  knowledgePointListDataSchema,
  knowledgePointSchema,
  nullDataSchema,
  successEnvelopeSchema,
  type AdminLoginRequest,
  type AdminSessionData,
  type Grade,
  type GradeUpdateRequest,
  type KnowledgePoint,
  type KnowledgePointCreateRequest,
  type KnowledgePointUpdateRequest,
} from '@math-whiz/contracts';

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

type EnvelopeParser<TData> = {
  safeParse: (
    input: unknown,
  ) => { success: true; data: { data: TData } } | { success: false };
};

const parseDataResponse = async <TData>(
  response: Response,
  parser: EnvelopeParser<TData>,
): Promise<TData> => {
  const body: unknown = await response.json().catch(() => undefined);

  if (response.status === 200) {
    const result = parser.safeParse(body);
    if (result.success) {
      return result.data.data;
    }
  } else {
    const result = errorEnvelopeSchema.safeParse(body);
    if (result.success && result.data.status === response.status) {
      throw new AdminApiError(
        result.data.message,
        result.data.status,
        result.data.data.errorCode,
      );
    }
  }

  throw new AdminApiError('服务响应异常，请稍后重试', 502, 'INVALID_RESPONSE');
};

const parseAdminSessionResponse = (response: Response) =>
  parseDataResponse(response, successEnvelopeSchema(adminSessionDataSchema));

export const login = async (
  input: AdminLoginRequest,
): Promise<AdminSessionData> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseAdminSessionResponse(response);
};

export const restoreSession = async (): Promise<AdminSessionData> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/me`, {
    credentials: 'include',
  });

  return parseAdminSessionResponse(response);
};

export const logout = async (csrfToken: string): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-csrf-token': csrfToken },
  });

  await parseDataResponse(response, successEnvelopeSchema(nullDataSchema));
};

export const getGrades = async (): Promise<Grade[]> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/grades`, {
    credentials: 'include',
  });
  return parseDataResponse(
    response,
    successEnvelopeSchema(gradeListDataSchema),
  );
};

export const updateGrade = async (
  gradeId: number,
  input: GradeUpdateRequest,
  csrfToken: string,
): Promise<Grade> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/grades/${gradeId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(input),
  });
  return parseDataResponse(response, successEnvelopeSchema(gradeSchema));
};

export const getKnowledgePoints = async (): Promise<KnowledgePoint[]> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/knowledge-points`, {
    credentials: 'include',
  });
  return parseDataResponse(
    response,
    successEnvelopeSchema(knowledgePointListDataSchema),
  );
};

export const createKnowledgePoint = async (
  input: KnowledgePointCreateRequest,
  csrfToken: string,
): Promise<KnowledgePoint> => {
  const response = await fetch(`${apiBaseUrl}/api/v1/admin/knowledge-points`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    body: JSON.stringify(input),
  });
  return parseDataResponse(
    response,
    successEnvelopeSchema(knowledgePointSchema),
  );
};

export const updateKnowledgePoint = async (
  knowledgePointId: string,
  input: KnowledgePointUpdateRequest,
  csrfToken: string,
): Promise<KnowledgePoint> => {
  const response = await fetch(
    `${apiBaseUrl}/api/v1/admin/knowledge-points/${knowledgePointId}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(input),
    },
  );
  return parseDataResponse(
    response,
    successEnvelopeSchema(knowledgePointSchema),
  );
};
