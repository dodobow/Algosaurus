import unittest

from server.api import ApiError
from server.service import Service, recommend_range
from fixtures import FixtureApi


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
