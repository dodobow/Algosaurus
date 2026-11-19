import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from server.analysis import canonical_groups, tag_queries, unique_rated, inner_score
from server.api import ApiError
from server.service import Service, checked_page
from tests.fixtures import FixtureApi, problem


class AnalysisTests(unittest.TestCase):
    def test_aliases_resolve_to_v4_keys(self):
        api = FixtureApi()
        groups = canonical_groups(api.get('/tags')['tags'], 'default', 'contest')
        self.assertEqual(groups[1]['keys'], ['impl'])
        self.assertEqual(groups[2]['keys'], ['graph'])

    def test_query_chunks_respect_100_chars_and_8_terms(self):
        keys = ['long_tag_name_' + str(i) for i in range(12)]
        for query in tag_queries('abc', keys):
            self.assertLessEqual(len(query), 100)
            self.assertLessEqual(query.count('#') + 2, 8)
        with self.assertRaises(ApiError):
            tag_queries('x' * 64, ['x' * 64])

    def test_duplicate_sets_and_subtasks_take_highest_rating(self):
        rows = [problem(1, 'a', 5), problem(1, 'b', 10), problem(1, 'b', 10), problem(2, '', 7)]
        rows.append({**problem(3, '', 30), 'givesNoRating': True})
        self.assertEqual([p['level'] for p in unique_rated(rows)], [10, 7])

    def test_inner_insufficient_or_finite(self):
        self.assertIsNone(inner_score([])['score'])
        self.assertIsNone(inner_score([problem(i, '', 0) for i in range(200)])['score'])
        self.assertEqual(inner_score([problem(i, '', 10) for i in range(200)])['score'], 100)
        rows = [problem(i, '', 20 if i < 100 else 10) for i in range(200)]
        self.assertEqual(inner_score(rows)['score'], 50)

    def test_analyze_and_recommend_share_scoped_server_cache(self):
        api = FixtureApi()
        service = Service(api)
        result = service.analyze({'handle': 'solved_name'})
        self.assertEqual(result['inner']['status'], 'ok')
        self.assertTrue(any(g['keys'] == ['impl'] for g in result['groups']))
        self.assertEqual(next(g for g in result['groups'] if g['keys'] == ['dp'])['officialRating'], 900)
        self.assertTrue(service.weak_keys(api.user, 'contest', 0, 'default'))
        for args in [('job', 0, 'default'), ('contest', 1, 'default'), ('contest', 0, 'custom')]:
            with self.assertRaises(ApiError):
                service.weak_keys(api.user, *args)
        api.user['id'] = 18
        with self.assertRaises(ApiError):
            service.weak_keys(api.user, 'contest', 0, 'default')

    def test_all_goal_groups_resolve(self):
        api = FixtureApi()
        for goal in ['beginner', 'job', 'contest']:
            result = Service(api).analyze({'handle': 'solved_name', 'goal': goal, 'mode': 'custom'})
            self.assertEqual(len(result['groups']), 10)

    def test_no_solved_data_is_not_a_normal_score(self):
        api = FixtureApi()
        api.solved = []
        service = Service(api)
        result = service.analyze({'handle': 'solved_name'})
        self.assertTrue(all(g['category'] == 'insufficient' for g in result['groups']))
        self.assertIsNone(result['inner']['score'])
        with self.assertRaises(ApiError) as ctx:
            service.weak_keys(api.user, 'contest', 0, 'default')
        self.assertEqual(ctx.exception.code, 'ANALYSIS_INSUFFICIENT')

    def test_partial_failure_never_populates_cache(self):
        api = FixtureApi()
        api.diagnostics = [{'code': 'unknown-tag'}]
        service = Service(api)
        with self.assertRaises(ApiError):
            service.analyze({'handle': 'solved_name'})
        self.assertEqual(service.analysis_cache, {})

    def test_cache_expires(self):
        api = FixtureApi()
        service = Service(api)
        service.analyze({'handle': 'solved_name'})
        key = service.analysis_key(api.user, 'contest', 0, 'default')
        when, data = service.analysis_cache[key]
        service.analysis_cache[key] = (when - 901, data)
        with self.assertRaises(ApiError):
            service.weak_keys(api.user, 'contest', 0, 'default')

    def test_same_context_concurrent_analysis_runs_once(self):
        api = FixtureApi()
        service = Service(api)
        entered, release = threading.Event(), threading.Event()
        original = service.top_sets
        calls = []
        def blocked(*args):
            calls.append(args)
            entered.set()
            release.wait(3)
            return original(*args)
        waiting = threading.Event()
        with patch.object(service, 'top_sets', blocked), ThreadPoolExecutor(2) as pool:
            first = pool.submit(service.analyze, {'handle': 'solved_name'})
            self.assertTrue(entered.wait(3))
            pending = next(iter(service.pending.values()))
            original_result = pending.result
            def wait_for_owner(*args, **kwargs):
                waiting.set()
                return original_result(*args, **kwargs)
            with patch.object(pending, 'result', wait_for_owner):
                second = pool.submit(service.analyze, {'handle': 'solved_name'})
                self.assertTrue(waiting.wait(3))
                release.set()
                self.assertEqual(first.result(), second.result())
        self.assertEqual(len(calls), 9)

    def test_more_than_four_pages_needed_when_subtasks_overlap(self):
        api = FixtureApi()
        api.solved = [problem(i // 2, str(i % 2), 10) for i in range(450)]
        rows = Service(api).top_sets('@solved_name rated:true', 200)
        self.assertEqual(len(rows), 200)
        self.assertEqual(len(api.calls), 8)

    def test_scan_limit_is_an_error_not_a_partial_score(self):
        api = FixtureApi()
        api.solved = [problem(1, str(i), 10) for i in range(900)]
        with self.assertRaises(ApiError) as ctx:
            Service(api).top_sets('@solved_name rated:true', 200)
        self.assertEqual(ctx.exception.code, 'ANALYSIS_LIMIT')

    def test_missing_rows_are_failure_even_on_last_page(self):
        with self.assertRaises(ApiError) as ctx:
            checked_page({'problems': [], 'total': 1, 'page': 1, 'pageSize': 50})
        self.assertEqual(ctx.exception.code, 'INCOMPLETE_PAGE')
