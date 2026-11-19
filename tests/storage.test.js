import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, contextKey, accountSelection } from '../shared/storage.js';

test('legacy account settings retain goal, numeric difficulty and mode', () => {
    assert.deepEqual(normalizeSettings({ solvedId: 'old', goal_old: 'job', diff_old: '2', mode_old: true }),
        { handle: 'old', goal: 'job', difficulty: 2, mode: 'custom' });
});
test('legacy BOJ settings migrate only through verified OJ linkage', () => {
    const raw = { solvedId: 'boj_old', goal_boj_old: 'job', diff_boj_old: '2', weakTags_boj_old: ['#implementation'] };
    const profile = { handle: 'solved_new', ojAccounts: [{ ojId: 'boj', handle: 'boj_old', verified: true }] };
    assert.deepEqual(accountSelection(profile, raw), {
        solvedId: 'solved_new', accountVersion: 4, goal_solved_new: 'job', diff_solved_new: '2',
    });
    profile.ojAccounts[0].verified = false;
    assert.deepEqual(accountSelection(profile, raw), { solvedId: 'solved_new', accountVersion: 4 });
    profile.ojAccounts[0].verified = true;
    assert.equal(accountSelection(profile, { ...raw, goal_solved_new: 'beginner' }).goal_solved_new, undefined);
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
});
