import { describe, expect, it } from 'vitest';

import { createOpaqueToken, digestToken, tokensMatch } from './token';

describe('administrator session tokens', () => {
  it('creates opaque 256-bit tokens and stores only their digest', () => {
    const token = createOpaqueToken();
    const digest = digestToken(token);

    expect(token).toHaveLength(43);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(token);
    expect(tokensMatch(token, digest)).toBe(true);
    expect(tokensMatch(`${token}x`, digest)).toBe(false);
  });
});
