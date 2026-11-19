import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRecommendTier, calculateTierInfo } from '../utils.js';
import { LatestRequest, profileText } from '../shared/ui.js';

test('all goals and offsets stay within rated levels', () => {
    for (let tier = 0; tier <= 31; tier++) for (const goal of ['beginner', 'job', 'contest']) for (let diff = -2; diff <= 2; diff++) {
        const { lo, hi } = calculateRecommendTier(tier, goal, diff);
        assert.ok(1 <= lo && lo <= hi && hi <= 30);
    }
    assert.notDeepEqual(calculateRecommendTier(20, 'beginner', 0), calculateRecommendTier(20, 'beginner', 2));
    assert.equal(calculateRecommendTier(null, 'job', 0), null);
    assert.equal(calculateTierInfo(null).name, '티어 비공개');
});
test('late requests and duplicate requests are invalidated', () => {
    const gate = new LatestRequest();
    const first = gate.start();
    const second = gate.start();
    assert.equal(first.current(), false);
    assert.equal(first.signal.aborted, true);
    assert.equal(second.current(), true);
    gate.cancel();
    assert.equal(second.current(), false);
});
test('profile labels distinguish solved.ac and BOJ handles', () => {
    assert.match(profileText({ handle: 'solved_name', ojAccounts: [{ ojId: 'boj', handle: 'boj_other' }] }), /solved.ac: solved_name · BOJ: boj_other/);
});
