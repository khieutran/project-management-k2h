import { describe, expect, it } from 'vitest';

import { createAccessTokenStore } from './access-token-store';

describe('createAccessTokenStore', () => {
  it('keeps, replaces and clears an access token in memory', () => {
    const store = createAccessTokenStore();

    expect(store.get()).toBeNull();

    store.set('first-token');
    expect(store.get()).toBe('first-token');

    store.set('replacement-token');
    expect(store.get()).toBe('replacement-token');

    store.clear();
    expect(store.get()).toBeNull();
  });
});
