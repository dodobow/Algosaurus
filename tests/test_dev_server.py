import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

from tests.dev_server import handler_with_assets
from tests.fixtures import FixtureApi
from server.service import Service


class BrowserHarnessTests(unittest.TestCase):
    def test_selected_service_and_asset_allowlist(self):
        api = FixtureApi()
        api.user['tier'] = 25
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler_with_assets(Service(api)))
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        def get(path):
            connection = HTTPConnection('127.0.0.1', server.server_port)
            connection.request('GET', path)
            response = connection.getresponse()
            status, body = response.status, response.read()
            connection.close()
            return status, body
        try:
            status, body = get('/api/profile?handle=test')
            self.assertEqual(status, 200)
            self.assertIn(b'"tier": 25', body)
            status, body = get('/popup/popup.html')
            self.assertEqual(status, 200)
            self.assertIn(b'/tests/browser-shim.js', body)
            for path in ['/.env', '/server/config.py', '/.git/config', '/popup/../.env']:
                self.assertEqual(get(path)[0], 404)
        finally:
            server.shutdown()
            server.server_close()
            worker.join()
