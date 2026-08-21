import { optionsResponse } from '@/src/modules/identity/admin-auth/http';
import { changePrizeStatus } from '@/src/modules/rewards/status-route';

export const dynamic = 'force-dynamic';
export const OPTIONS = optionsResponse;

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ prizeId: string }> },
) => {
  return changePrizeStatus(request, params, 'ACTIVE');
};
