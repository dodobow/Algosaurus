"""실제 HTML/JS를 확인하는 localhost 전용 테스트 서버. --live에서만 실 API를 호출해."""
import argparse
import mimetypes
import os
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from server.app import handler_for
from server.api import SolvedApi
from server.config import load_env
from server.service import Service
from .fixtures import FixtureApi


ROOT = Path(__file__).resolve().parents[1]
def handler_with_assets(service):
    class DemoHandler(handler_for(service)):
        def do_GET(self):
            path = urlsplit(self.path).path.lstrip('/')
            if path.startswith('api/') or path == 'health':
                return super().do_GET()
            allowed = {'popup/popup.html', 'popup/popup.js', 'popup/popup.css', 'options/options.html',
                       'options/options.js', 'options/options.css', 'utils.js', 'common.css',
                       'shared/api.js', 'shared/storage.js', 'shared/ui.js', 'tests/browser-shim.js',
                       'shared/presentation.js',
                       'assets/algoIcon128.png'}
            allowed.update(f'assets/tiers/{tier}.svg' for tier in range(32))
            if path not in allowed:
                self.send_error(404)
                return
            data = (ROOT / path).read_bytes()
            if path.endswith('.html'):
                data = data.replace(b'<head>', b'<head><script src="/tests/browser-shim.js"></script>')
            self.send_response(200)
            content_type = 'text/javascript' if path.endswith('.js') else mimetypes.guess_type(path)[0] or 'application/octet-stream'
            self.send_header('Content-Type', content_type + '; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

    return DemoHandler


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true', help='실제 앱 인증정보와 solved.ac API 사용 (Chrome 저장소는 대역)')
    args = parser.parse_args()
    if args.live:
        load_env()
        api = SolvedApi(os.environ.get('SOLVED_CLIENT_ID', ''), os.environ.get('SOLVED_CLIENT_SECRET', ''))
    else:
        api = FixtureApi()
    server = ThreadingHTTPServer(('127.0.0.1', 8765), handler_with_assets(Service(api)))
    mode = 'LIVE API / Chrome storage shim' if args.live else 'MOCK API ONLY'
    print(f'{mode}: http://127.0.0.1:8765/popup/popup.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
