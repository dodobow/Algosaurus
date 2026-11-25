import json
import math
import subprocess
import time
import unittest
from unittest.mock import patch

from server.analysis import legacy_tag_rating, classify_groups, RATING_MODEL
from server.api import ApiError
from server.service import Service
from tests.fixtures import FixtureApi, problem


class LegacyRatingTests(unittest.TestCase):
    def test_matches_original_javascript_formula_for_bonus_counts_and_tier_boundaries(self):
        # Exact expression from f47f19e / 8baa49b options/options.js.
        counts = list(range(1001)) + [10000]
        script = '''
const counts = JSON.parse(process.argv[1]);
console.log(JSON.stringify(counts.map(n => 2 * Math.min(n, 50) * 15 + Math.round(200 * (1 - Math.pow(0.99, n))))));
'''
        original = json.loads(subprocess.check_output(['node', '-e', script, json.dumps(counts)], text=True))
        rows = [problem(i, '', 15) for i in range(max(counts))]
        for count, expected in zip(counts, original):
            self.assertEqual(legacy_tag_rating(rows[:count])['rating'], expected, count)

    def test_bonus_counts_all_solved_sets_not_just_the_top_fifty(self):
        rows = [problem(i, '', 10) for i in range(100)]
        first, full = legacy_tag_rating(rows[:50]), legacy_tag_rating(rows)
        self.assertEqual(first['rating'], 1079)
        self.assertEqual(full['rating'], 1127)
        self.assertEqual(full['count'], 50)
        self.assertEqual(full['ratingCount'], 100)

    def test_split_queries_and_subproblems_do_not_double_count_sets_or_bonus(self):
        api = FixtureApi()
        api.solved = [problem(i, 'a', 10, ['dp', 'greedy']) for i in range(120)]
        api.solved += [problem(i, 'b', 5, ['dp', 'greedy']) for i in range(120)]
        group = {'name': '복합', 'keys': ['dp', 'impl', 'graph', 'tree', 'bfs', 'dfs', 'greedy']}
        with patch('server.service.canonical_groups', return_value=[group]):
            result = Service(api).analyze({'handle': 'solved_name', 'mode': 'custom'})['groups'][0]
        self.assertEqual(result['ratingCount'], 120)
        self.assertEqual(result['count'], 50)
        self.assertEqual(result['rating'], 1000 + math.floor(200 * (1 - .99 ** 120) + .5))
        self.assertFalse(result['ratingCountCapped'])

    def test_bonus_saturation_stops_counting_without_changing_the_formula(self):
        api = FixtureApi()
        api.solved = [problem(i, '', 10) for i in range(1000)]
        with patch('server.service.canonical_groups', return_value=[{'name': 'DP', 'keys': ['dp']}]):
            result = Service(api).analyze({'handle': 'solved_name', 'mode': 'custom'})['groups'][0]
        self.assertEqual(result['rating'], 1200)
        self.assertEqual(result['ratingCount'], 597)
        self.assertTrue(result['ratingCountCapped'])
        self.assertEqual(sum(path == '/problems' and '#dp' in params['q'] for path, params in api.calls), 12)
        self.assertEqual(legacy_tag_rating(api.solved[:596])['rating'], 1199)

    def test_official_basic_rating_is_preserved_and_classification_uses_displayed_rating(self):
        service = Service(FixtureApi())
        result = service.analyze({'handle': 'solved_name'})
        dp = next(group for group in result['groups'] if group['keys'] == ['dp'])
        self.assertEqual(dp['rating'], 900)
        groups = classify_groups([{'rating': 1200, 'score': 500}, {'rating': 800, 'score': 800}])
        self.assertEqual([group['category'] for group in groups], ['strong', 'weak'])
        self.assertIn(RATING_MODEL, service.analysis_key(result | {'id': 17}, 'contest', 'default'))

    def test_empty_data_is_zero_and_deadline_is_an_error(self):
        self.assertEqual(legacy_tag_rating([])['rating'], 0)
        api = FixtureApi()
        with self.assertRaises(ApiError) as ctx:
            Service(api).top_sets('@solved_name rated:true', 50, deadline=time.monotonic() - 1)
        self.assertEqual(ctx.exception.code, 'ANALYSIS_TIMEOUT')
        self.assertFalse(api.calls)

    def test_weak_recommendation_prioritizes_rating_instead_of_raw_difficulty_sum(self):
        api = FixtureApi()
        service = Service(api)
        key = service.analysis_key(api.user, 'contest', 'custom')
        service.analysis_cache[key] = (time.monotonic(), {'groups': [
            {'keys': ['dp'], 'category': 'weak', 'score': 400, 'rating': 1000},
            {'keys': ['impl'], 'category': 'weak', 'score': 450, 'rating': 950},
        ]})
        self.assertEqual(service.weak_keys(api.user, 'contest', 0, 'custom'), ['impl', 'dp'])
