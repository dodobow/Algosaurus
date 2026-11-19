import unittest
import json
import subprocess
from pathlib import Path

from server.api import ApiError
from server.service import Service, recommend_range
from tests.fixtures import FixtureApi


class RecommendationTests(unittest.TestCase):
    def setUp(self):
        self.api = FixtureApi()
        self.service = Service(self.api)

    def test_profile_separates_accounts(self):
        profile = self.service.profile('solved_name')
        self.assertEqual(profile['handle'], 'solved_name')
        self.assertEqual(profile['ojAccounts'][0]['handle'], 'boj_other')

    def test_unsolved_query_and_actual_link_and_subtask(self):
        result = self.service.recommend({'handle': 'solved_name', 'goal': 'job', 'difficulty': '1'})
        query = next(params['q'] for path, params in self.api.calls if path == '/problems')
        self.assertEqual(query, '*6..10 !@solved_name %ko solvablein:boj')
        self.assertNotIn('boj_other', query)
        self.assertEqual(result['problem']['url'], 'https://www.acmicpc.net/problem/1000')
        self.assertNotIn('/777', result['problem']['url'])
        self.assertEqual(self.api.calls[-1], ('/problems/777', {'sub': 'a'}))

    def test_empty_search(self):
        self.api.problems = []
        self.assertIsNone(self.service.recommend({'handle': 'solved_name'})['problem'])

    def test_missing_weak_analysis(self):
        with self.assertRaises(ApiError) as ctx:
            self.service.recommend({'handle': 'solved_name', 'weak': 'true'})
        self.assertEqual(ctx.exception.code, 'ANALYSIS_REQUIRED')

    def test_diagnostics_cannot_silently_drop_exclusion(self):
        self.api.diagnostics = [{'code': 'unknown-handle', 'severity': 'warning'}]
        with self.assertRaises(ApiError) as ctx:
            self.service.recommend({'handle': 'solved_name'})
        self.assertEqual(ctx.exception.code, 'SEARCH_DIAGNOSTIC')

    def test_untrusted_link_is_not_rendered(self):
        self.api.problems[0]['ojLinks'][0]['url'] = 'https://evil.example/problem/1000'
        self.assertIsNone(self.service.recommend({'handle': 'solved_name'})['problem'])

    def test_range_bounds_goals_and_adjustment(self):
        for tier in range(32):
            for goal in ['beginner', 'job', 'contest']:
                for diff in range(-2, 3):
                    lo, hi = recommend_range(tier, goal, diff)
                    self.assertTrue(1 <= lo <= hi <= 30)
        self.assertNotEqual(recommend_range(20, 'beginner', 0), recommend_range(20, 'contest', 0))
        self.assertNotEqual(recommend_range(20, 'beginner', 0), recommend_range(20, 'beginner', 2))

    def test_private_tier_is_not_used_as_zero(self):
        self.api.user['tier'] = None
        with self.assertRaises(ApiError) as ctx:
            self.service.recommend({'handle': 'solved_name'})
        self.assertEqual(ctx.exception.code, 'TIER_UNAVAILABLE')

    def test_extension_preview_and_server_ranges_agree_for_all_settings(self):
        script = """
import { calculateRecommendTier } from './utils.js';
const rows = [];
for (let tier = 0; tier <= 31; tier++) for (const goal of ['beginner', 'job', 'contest']) for (let diff = -2; diff <= 2; diff++) {
  rows.push([tier, goal, diff, calculateRecommendTier(tier, goal, diff)]);
}
console.log(JSON.stringify(rows));
"""
        output = subprocess.run(['node', '--input-type=module', '-e', script], check=True,
                                capture_output=True, text=True, cwd=Path(__file__).resolve().parents[1])
        for tier, goal, diff, expected in json.loads(output.stdout):
            self.assertEqual(recommend_range(tier, goal, diff), (expected['lo'], expected['hi']))
