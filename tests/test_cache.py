import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock, patch

from server.cache import SharedCache


class CacheTests(unittest.TestCase):
    def test_expiry_and_bounded_lru(self):
        now = [0]
        cache = SharedCache(30, 2, clock=lambda: now[0])
        load = Mock(side_effect=range(10))
        self.assertEqual(cache.get('a', load), 0)
        self.assertEqual(cache.get('b', load), 1)
        self.assertEqual(cache.get('a', load), 0)
        self.assertEqual(cache.get('c', load), 2)
        self.assertEqual(cache.get('b', load), 3)
        now[0] = 30
        self.assertEqual(cache.get('c', load), 4)
        self.assertEqual(len(cache.values), 2)

    def test_failure_is_not_cached_and_can_be_retried(self):
        cache = SharedCache(30, 2)
        load = Mock(side_effect=[ValueError('failed'), 42])
        with self.assertRaises(ValueError):
            cache.get('a', load)
        self.assertFalse(cache.values)
        self.assertFalse(cache.pending)
        self.assertEqual(cache.get('a', load), 42)

    def test_concurrent_reads_of_the_same_page_share_one_loader(self):
        cache = SharedCache(30, 2)
        entered, release, waiting = threading.Event(), threading.Event(), threading.Event()
        def load():
            entered.set()
            self.assertTrue(release.wait(3))
            return 42
        with ThreadPoolExecutor(2) as pool:
            first = pool.submit(cache.get, 'page', load)
            self.assertTrue(entered.wait(3))
            future = cache.pending['page']
            original = future.result
            def result(*args, **kwargs):
                waiting.set()
                return original(*args, **kwargs)
            with patch.object(future, 'result', result):
                second = pool.submit(cache.get, 'page', Mock(side_effect=AssertionError('duplicate search')))
                self.assertTrue(waiting.wait(3))
                release.set()
                self.assertEqual(first.result(), second.result())
