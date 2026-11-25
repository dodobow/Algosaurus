import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from server.analysis import canonical_groups, tag_queries, unique_rated, inner_score
from server.api import ApiError, SolvedApi
from server.service import Service, checked_page
from tests.fixtures import FixtureApi, problem


class AnalysisTests(unittest.TestCase):
    def test_completed_analysis_reuses_scoped_cache_without_repeating_searches(self):
        api = FixtureApi()
        service = Service(api)
        first = service.analyze({'handle': 'solved_name'})
        searches = sum(path == '/problems' for path, _ in api.calls)
        second = service.analyze({'handle': 'solved_name'})
        self.assertEqual(first, second)
        self.assertEqual(sum(path == '/problems' for path, _ in api.calls), searches)

    def test_aliases_resolve_to_v4_keys(self):
        api = FixtureApi()
        tags = api.get('/tags')['tags']
        self.assertNotIn('implementation', next(tag for tag in tags if tag['key'] == 'impl')['aliases'])
        groups = canonical_groups(tags, 'default', 'contest')
        self.assertEqual(groups[1]['keys'], ['impl'])
        self.assertEqual(groups[2]['keys'], ['graph'])

    def test_canonical_key_wins_over_another_tags_alias(self):
        tags = FixtureApi().get('/tags')['tags']
        groups = canonical_groups(tags, 'custom', 'contest')
        self.assertIn('combinatorics', groups[2]['keys'])
        self.assertNotIn('stat', groups[2]['keys'])

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
        self.assertTrue(service.weak_keys(api.user, 'job', 2, 'default'))
        with self.assertRaises(ApiError):
            service.weak_keys(api.user, 'contest', 0, 'custom')
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
        api.user['tagRatings'] = []
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
        key = service.analysis_key(api.user, 'contest', 'default')
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
                second = pool.submit(service.analyze, {'handle': 'solved_name', 'goal': 'job', 'difficulty': '2'})
                self.assertTrue(waiting.wait(3))
                release.set()
                self.assertEqual(first.result()['groups'], second.result()['groups'])
                self.assertEqual(first.result()['settings'], {'goal': 'contest', 'difficulty': 0, 'mode': 'default'})
                self.assertEqual(second.result()['settings'], {'goal': 'job', 'difficulty': 2, 'mode': 'default'})
        self.assertEqual(len(calls), 9)

    def test_difficulty_and_default_goal_changes_reuse_analysis_with_current_settings(self):
        api = FixtureApi()
        service = Service(api)
        first = service.analyze({'handle': 'solved_name'})
        calls = list(api.calls)
        second = service.analyze({'handle': 'solved_name', 'goal': 'job', 'difficulty': '2'})
        self.assertEqual(api.calls, calls)
        self.assertEqual(first['groups'], second['groups'])
        self.assertEqual(second['settings'], {'goal': 'job', 'difficulty': 2, 'mode': 'default'})
        self.assertEqual(first['settings']['difficulty'], 0)
        self.assertTrue(service.weak_keys(api.user, 'job', 2, 'default'))

    def test_retry_resumes_successful_pages_without_caching_a_partial_score(self):
        class FailOnce(FixtureApi):
            def __init__(self):
                super().__init__()
                self.probes = []
                self.failed = False
            def get(self, path, **params):
                self.probes.append((path, params))
                if path == '/problems' and params.get('q') == '@solved_name rated:true' and params.get('page') == 2 and not self.failed:
                    self.failed = True
                    raise ApiError(429, 'UPSTREAM_429', '모의 호출 제한', 1)
                return super().get(path, **params)
        api = FailOnce()
        service = Service(api)
        with self.assertRaises(ApiError):
            service.analyze({'handle': 'solved_name'})
        self.assertEqual(service.analysis_cache, {})
        completed = list(api.calls)
        result = service.analyze({'handle': 'solved_name'})
        self.assertEqual(result['inner']['status'], 'ok')
        for call in completed:
            self.assertEqual(api.probes.count(call), 1)
        self.assertEqual(sum(path == '/problems' and params.get('page') == 2 and params.get('q') == '@solved_name rated:true' for path, params in api.probes), 2)

    def test_goal_switch_reuses_common_pages_and_waits_instead_of_repeating_rate_errors(self):
        class BudgetFixture(FixtureApi):
            def __init__(self):
                super().__init__()
                self.now, self.waited = 0, 0
                self.budget = SolvedApi('mock', 'mock', clock=lambda: self.now, sleep=self.sleep)
            def sleep(self, seconds):
                self.now += seconds
                self.waited += seconds
            def get(self, path, **params):
                self.budget._reserve(3 if path == '/problems' else 1)
                return super().get(path, **params)
        api = BudgetFixture()
        service = Service(api)
        for goal in ['contest', 'job', 'beginner']:
            result = service.analyze({'handle': 'solved_name', 'goal': goal, 'mode': 'custom'})
            self.assertEqual(len(result['groups']), 10)
        self.assertGreater(api.waited, 0)
        self.assertEqual(len(api.calls), len(set((path, tuple(params.items())) for path, params in api.calls)))
        self.assertGreaterEqual(api.budget.tokens, 0)

    def test_changed_profile_id_does_not_reuse_previous_accounts_pages(self):
        api = FixtureApi()
        service = Service(api)
        first = service.analyze({'handle': 'solved_name'})
        searches = sum(path == '/problems' for path, _ in api.calls)
        api.user['id'] = 99
        service.profiles.discard(lambda _: True)
        result = service.analyze({'handle': 'solved_name'})
        self.assertNotEqual(first['profileId'], result['profileId'])
        self.assertEqual(sum(path == '/problems' for path, _ in api.calls), searches * 2)

    def test_profile_cache_expires_and_accounts_are_separate(self):
        api = FixtureApi()
        service = Service(api)
        now = [0]
        service.profiles.clock = lambda: now[0]
        service.profile('first')
        service.profile('second')
        service.profile('first')
        self.assertEqual(len(api.calls), 2)
        now[0] = 30
        service.profile('first')
        self.assertEqual(len(api.calls), 3)

    def test_changed_total_discards_old_pages_before_retry(self):
        api = FixtureApi()
        service = Service(api)
        original = api.get
        failed = [False]
        def changing(path, **params):
            if path == '/problems' and params.get('page') == 2 and not failed[0]:
                failed[0] = True
                api.solved.pop()
            return original(path, **params)
        api.get = changing
        with self.assertRaises(ApiError) as ctx:
            service.top_sets('@solved_name rated:true', 200, 17)
        self.assertEqual(ctx.exception.code, 'DATA_CHANGED')
        self.assertFalse(service.pages.values)
        self.assertEqual(len(service.top_sets('@solved_name rated:true', 200, 17)), 200)

    def test_malformed_problem_does_not_poison_page_cache(self):
        api = FixtureApi()
        api.solved[0]['level'] = None
        service = Service(api)
        with self.assertRaises(ApiError):
            service.top_sets('@solved_name rated:true', 200, 17)
        self.assertFalse(service.pages.values)

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
