import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginErrorMessage } from '../src/components/identity/login-errors.ts';

test('login outages and network failures do not suggest incorrect credentials', () => {
  for (const status of [503, 500, undefined]) {
    assert.match(loginErrorMessage(status), /temporarily unavailable/);
    assert.doesNotMatch(loginErrorMessage(status), /password/);
  }
  assert.match(loginErrorMessage(401), /email and password/);
  assert.match(loginErrorMessage(429), /Too many sign-in attempts/);
});
