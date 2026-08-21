import { createSuccess } from '@math-whiz/contracts';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = () =>
  NextResponse.json(createSuccess('服务存活', { status: 'ok' as const }));
