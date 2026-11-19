import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, contextKey, validWeakCache } from '../shared/storage.js';

test('legacy account settings retain goal, numeric difficulty and mode', () => {
    assert.deepEqual(normalizeSettings({ solvedId: 'old', goal_old: 'job', diff_old: '2', mode_old: true }),
        { handle: 'old', goal: 'job', difficulty: 2, mode: 'custom' });
});
test('first run and malformed settings have safe defaults', () => {
    assert.equal(normalizeSettings({}).difficulty, 0);
    assert.equal(normalizeSettings({ goal_x: '<script>', diff_x: 'NaN' }, 'x').goal, 'contest');
    assert.equal(normalizeSettings({ diff_x: 'NaN' }, 'x').difficulty, 0);
});
test('cache context varies by account and every setting', () => {
    const a = normalizeSettings({ solvedId: 'a' });
    for (const change of [{ handle: 'b' }, { goal: 'job' }, { difficulty: 1 }, { mode: 'custom' }]) {
        assert.notEqual(contextKey(a), contextKey({ ...a, ...change }));
    }
    assert.equal(validWeakCache(undefined, 1), false);
    assert.equal(validWeakCache({ version: 3, profileId: 1, createdAt: 100, keys: [] }, 1, 101), false);
    assert.equal(validWeakCache({ version: 4, profileId: 1, createdAt: 100, keys: [] }, 2, 101), false);
});
