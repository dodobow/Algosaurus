import io
import unittest
from email.message import Message
from urllib.error import HTTPError, URLError

from server.api import ApiError, SolvedApi
from server.service import handle_value


class ApiTests(unittest.TestCase):
    def test_local_budget_waits_for_tokens_without_sending_an_extra_request(self):
        now, sleeps, calls = [100.0], [], []
        def sleep(seconds):
            sleeps.append(seconds)
            now[0] += seconds
        def transport(*args, **kwargs):
            calls.append(args)
            return io.BytesIO(b'{}')
        api = SolvedApi('app', 'secret', transport, clock=lambda: now[0], sleep=sleep)
        for _ in range(21):
            api.get('/problems')
        self.assertEqual(len(calls), 21)
        self.assertEqual(sleeps, [3])
        self.assertEqual(api.tokens, 0)

    def test_local_wait_is_bounded_when_other_requests_keep_spending_tokens(self):
        now, sleeps = [0.0], []
        api = SolvedApi('app', 'secret', clock=lambda: now[0])
        api.tokens = 0
        def sleep(seconds):
            sleeps.append(seconds)
            now[0] += seconds
            api.tokens, api.updated = 0, now[0]
        api.sleep = sleep
        with self.assertRaises(ApiError) as ctx:
            api._reserve(3)
        self.assertEqual(ctx.exception.code, 'RATE_LIMITED')
        self.assertEqual(sum(sleeps), 10)

    def test_missing_credentials_never_calls_upstream(self):
        with self.assertRaises(ApiError) as ctx:
            SolvedApi(transport=lambda *_: self.fail()).get('/users/test')
        self.assertEqual(ctx.exception.code, 'APP_NOT_CONFIGURED')

    def test_headers_and_query_encoding(self):
        def transport(request, timeout):
            self.assertEqual(request.get_header('X-client-secret'), 'secret')
            self.assertIn('q=%2A1..10+%21%40other', request.full_url)
            self.assertEqual(timeout, 20)
            return io.BytesIO(b'{"problems":[]}')
        self.assertEqual(SolvedApi('app', 'secret', transport).get('/problems', q='*1..10 !@other'), {'problems': []})

    def test_rate_limit_blocks_subsequent_calls(self):
        calls = []
        def transport(request, timeout):
            calls.append(request)
            headers = Message()
            headers['Retry-After'] = '7'
            raise HTTPError(request.full_url, 429, '', headers, None)
        api = SolvedApi('app', 'secret', transport, clock=lambda: 100)
        for _ in range(2):
            with self.assertRaises(ApiError) as ctx:
                api.get('/problems')
            self.assertEqual(ctx.exception.retry_after, 7)
        self.assertEqual(ctx.exception.code, 'UPSTREAM_COOLDOWN')
        self.assertEqual(len(calls), 1)

    def test_invalid_json_and_network_error(self):
        for result in [b'<html>blocked</html>', b'[]']:
            with self.assertRaises(ApiError) as ctx:
                SolvedApi('a', 'b', lambda *a, **kw: io.BytesIO(result)).get('/tags')
            self.assertEqual(ctx.exception.code, 'INVALID_RESPONSE')
        def offline(*a, **kw):
            raise URLError('offline')
        with self.assertRaises(ApiError):
            SolvedApi('a', 'b', offline).get('/tags')

    def test_query_injection_is_rejected(self):
        for handle in ['x !@other', 'x#dp', '../tags', '', 'me']:
            with self.assertRaises(ApiError):
                handle_value(handle)


if __name__ == '__main__':
    unittest.main()
