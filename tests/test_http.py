import json
import threading
import unittest
from unittest.mock import Mock
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

from server.api import SolvedApi
from server.app import handler_for
from server.service import Service
from tests.fixtures import FixtureApi


class HttpTests(unittest.TestCase):
    def test_client_cancellation_does_not_retry_a_closed_connection(self):
        handler = object.__new__(handler_for(Service(FixtureApi())))
        for error in [ConnectionAbortedError, ConnectionResetError, BrokenPipeError]:
            handler._reply = Mock(side_effect=error('client cancelled'))
            handler.reply(200, {'ok': True})
            handler._reply.assert_called_once_with(200, {'ok': True}, None)

    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), handler_for(Service(FixtureApi())))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def get(self, path, headers=None):
        connection = HTTPConnection('127.0.0.1', self.server.server_port)
        connection.request('GET', path, headers=headers or {})
        response = connection.getresponse()
        data = json.load(response)
        status, headers = response.status, dict(response.headers)
        connection.close()
        return status, data, headers

    def test_profile_and_recommendation_through_real_http(self):
        status, profile, _ = self.get('/api/profile?handle=solved_name')
        self.assertEqual(status, 200)
        self.assertEqual(profile['ojAccounts'][0]['handle'], 'boj_other')
        status, data, _ = self.get('/api/recommend?handle=solved_name&goal=job&difficulty=1')
        self.assertEqual(status, 200)
        self.assertEqual(data['problem']['url'], 'https://www.acmicpc.net/problem/1000')

    def test_not_a_generic_proxy(self):
        for path in ['/proxy?url=https://example.com', '/api/profile?handle=x&q=ignored', '/api/profile?handle=x&handle=y']:
            self.assertIn(self.get(path)[0], [400, 404])

    def test_origin_and_host_restrictions(self):
        self.assertEqual(self.get('/health', {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.get('/health', {'Host': 'evil.example'})[0], 403)
        status, _, headers = self.get('/health', {'Origin': 'chrome-extension://' + 'a' * 32})
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], 'chrome-extension://' + 'a' * 32)

    def test_errors_keep_status_and_retry_after(self):
        self.assertEqual(self.get('/api/profile?handle=missing')[0], 404)
        status, data, headers = self.get('/api/profile?handle=limited')
        self.assertEqual(status, 429)
        self.assertEqual(data['error']['retryAfter'], 30)
        self.assertEqual(headers['Retry-After'], '30')

    def test_analysis_then_weak_recommendation(self):
        status, analysis, _ = self.get('/api/analysis?handle=solved_name&goal=job&difficulty=0&mode=custom')
        self.assertEqual(status, 200)
        self.assertEqual(len(analysis['groups']), 10)
        status, reused, _ = self.get('/api/analysis?handle=solved_name&goal=job&difficulty=2&mode=custom')
        self.assertEqual(status, 200)
        self.assertEqual(analysis['groups'], reused['groups'])
        self.assertEqual(reused['settings']['difficulty'], 2)
        status, recommendation, _ = self.get('/api/recommend?handle=solved_name&goal=job&difficulty=2&mode=custom&weak=true')
        self.assertEqual(status, 200)
        self.assertIsNotNone(recommendation['problem'])
        self.assertIsNotNone(recommendation['problem']['tag'])

    def test_missing_credentials_is_actionable(self):
        with self.assertRaises(Exception) as ctx:
            Service(SolvedApi()).profile('someone')
        self.assertEqual(ctx.exception.status, 503)
