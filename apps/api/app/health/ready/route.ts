import { createError, createSuccess } from '@math-whiz/contracts';
import { NextResponse } from 'next/server';

import { checkDatabaseReadiness } from '@/src/infrastructure/database';

export const dynamic = 'force-dynamic';

export const GET = async () => {
  const ready = await checkDatabaseReadiness();

  if (!ready) {
    return NextResponse.json(
      createError(503, '服务未就绪', 'DATABASE_UNAVAILABLE'),
      { status: 503 },
    );
  }

  return NextResponse.json(
    createSuccess('服务就绪', { status: 'ready' as const }),
  );
};
