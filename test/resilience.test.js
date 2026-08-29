import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptiveRefreshDelay } from '../resilience.js';

test('adaptive refresh slows down when hidden or offline', () => {
  assert.equal(adaptiveRefreshDelay({ visible: true, online: true }), 15000);
  assert.equal(adaptiveRefreshDelay({ visible: false, online: true }), 60000);
  assert.equal(adaptiveRefreshDelay({ visible: true, online: false }), 120000);
});

test('adaptive refresh backs off repeated failures', () => {
  assert.equal(adaptiveRefreshDelay({ failures: 1 }), 30000);
  assert.equal(adaptiveRefreshDelay({ failures: 2 }), 60000);
  assert.equal(adaptiveRefreshDelay({ failures: 20 }), 120000);
});
