import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const createOpaqueToken = () => randomBytes(32).toString('base64url');

export const digestToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export const tokensMatch = (token: string, expectedDigest: string) => {
  const actual = Buffer.from(digestToken(token), 'hex');
  const expected = Buffer.from(expectedDigest, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
