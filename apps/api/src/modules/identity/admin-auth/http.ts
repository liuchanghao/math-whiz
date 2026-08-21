import { randomUUID } from 'node:crypto';

import { createError } from '@math-whiz/contracts';
import { NextResponse } from 'next/server';

export const ADMIN_SESSION_COOKIE = '__Host-mw_admin';

const adminWebOrigin = () =>
  process.env.ADMIN_WEB_ORIGIN ?? 'http://localhost:3000';

const corsHeaders = () => ({
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': adminWebOrigin(),
  Vary: 'Origin',
});

export const isTrustedAdminOrigin = (request: Request) =>
  request.headers.get('origin') === adminWebOrigin();

export const jsonResponse = <T>(body: T, status = 200) =>
  NextResponse.json(body, { status, headers: corsHeaders() });

export const errorResponse = (
  status: number,
  message: string,
  errorCode: string,
  fields?: string[],
) => jsonResponse(createError(status, message, errorCode, fields), status);

export const forbiddenOriginResponse = () =>
  errorResponse(403, '请求来源不受信任', 'ADMIN_ORIGIN_FORBIDDEN');

export const optionsResponse = (request: Request) => {
  if (!isTrustedAdminOrigin(request)) {
    return forbiddenOriginResponse();
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(),
      'Access-Control-Allow-Headers':
        'Content-Type, X-CSRF-Token, X-Request-ID',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '600',
    },
  });
};

export const readCookie = (request: Request, name: string) => {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader === null) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...valueParts] = cookie.trim().split('=');
    if (cookieName === name) {
      return valueParts.join('=') || undefined;
    }
  }

  return undefined;
};

export const setAdminSessionCookie = (
  response: NextResponse,
  value: string,
  expires: Date,
) => {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value,
    expires,
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: true,
  });
};

export const clearAdminSessionCookie = (response: NextResponse) => {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    expires: new Date(0),
    maxAge: 0,
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: true,
  });
};

export const getRequestId = (request: Request) => {
  const candidate = request.headers.get('x-request-id');
  return candidate !== null && /^[A-Za-z0-9._-]{8,128}$/.test(candidate)
    ? candidate
    : randomUUID();
};

export const getClientIp = (request: Request) => {
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
};
