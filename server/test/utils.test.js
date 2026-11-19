import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../src/utils/ApiError.js';
import { hmac, randomOtp, randomToken, safeEqual, sha256 } from '../src/utils/crypto.js';
import { pageMeta, paginate } from '../src/utils/pagination.js';

test('randomOtp is always 6 digits', () => {
  for (let i = 0; i < 200; i++) assert.match(randomOtp(), /^\d{6}$/);
});

test('hmac is deterministic and secret-dependent', () => {
  assert.equal(hmac('s1', 'a'), hmac('s1', 'a'));
  assert.notEqual(hmac('s1', 'a'), hmac('s2', 'a'));
});

test('safeEqual compares correctly, including different lengths', () => {
  assert.ok(safeEqual(sha256('x'), sha256('x')));
  assert.ok(!safeEqual(sha256('x'), sha256('y')));
  assert.ok(!safeEqual('abc', 'abcd'));
});

test('refresh tokens are unique and long', () => {
  const a = randomToken(), b = randomToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 60);
});

test('ApiError helpers set status and code', () => {
  assert.equal(ApiError.unauthorized().status, 401);
  assert.equal(ApiError.forbidden().code, 'FORBIDDEN');
  assert.equal(ApiError.conflict().status, 409);
});

test('pagination math', () => {
  assert.deepEqual(paginate({ page: 3, limit: 20 }), { limit: 20, offset: 40 });
  assert.deepEqual(pageMeta(45, { page: 1, limit: 20 }), { total: 45, page: 1, limit: 20, pages: 3 });
});
