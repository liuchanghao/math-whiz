export {
  errorResponse,
  jsonResponse,
  parseJsonBody,
} from '@/src/infrastructure/http';

export const readBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization');
  const match = /^Bearer ([A-Za-z0-9_-]{43,128})$/.exec(authorization ?? '');
  return match?.[1];
};
