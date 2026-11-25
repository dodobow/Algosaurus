import json
import logging
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from .api import ApiError, SolvedApi
from .service import Service
from .config import load_env


def handler_for(service, extension_ids=()):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def origin(self):
            origin = self.headers.get("Origin")
            if origin is None:
                return None
            match = re.fullmatch(r"chrome-extension://([a-p]{32})", origin)
            if not match or extension_ids and match[1] not in extension_ids:
                raise ApiError(403, "ORIGIN_DENIED", "허용되지 않은 확장 프로그램이야.")
            return origin

        def reply(self, status, data, retry_after=None):
            try:
                self._reply(status, data, retry_after)
            except ConnectionError:
                pass

        def _reply(self, status, data, retry_after=None):
            body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
            self.send_response(status)
            if getattr(self, "allowed_origin", None):
                self.send_header("Access-Control-Allow-Origin", self.allowed_origin)
                self.send_header("Vary", "Origin")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if retry_after:
                self.send_header("Retry-After", str(retry_after))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.reply(405, {"error": {"code": "METHOD_NOT_ALLOWED", "message": "GET만 지원해."}})

        def do_GET(self):
            try:
                if self.headers.get("Host") not in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}:
                    raise ApiError(403, "HOST_DENIED", "로컬 서버 주소를 확인해 줘.")
                self.allowed_origin = self.origin()
                url = urlsplit(self.path)
                params = parse_qs(url.query, keep_blank_values=True)
                if any(len(v) != 1 for v in params.values()):
                    raise ApiError(400, "INVALID_PARAMS", "중복된 요청 값이 있어.")
                params = {k: v[0] for k, v in params.items()}
                if url.path == "/health" and not params:
                    data = {"ok": True, "apiVersion": 4}
                elif url.path == "/api/profile" and set(params) == {"handle"}:
                    data = service.profile(params["handle"])
                else:
                    data = self.feature(url.path, params)
                self.reply(200, data)
            except ApiError as exc:
                self.reply(exc.status, {"error": {"code": exc.code, "message": str(exc), "retryAfter": exc.retry_after}}, exc.retry_after)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception:
                logging.exception("Request failed")
                self.reply(500, {"error": {"code": "INTERNAL_ERROR", "message": "서버 처리 중 오류가 발생했어."}})

        def feature(self, path, params):
            if path == "/api/analysis" and {"handle"} <= set(params) <= {"handle", "goal", "difficulty", "mode"}:
                return service.analyze(params)
            if path == "/api/recommend" and {"handle"} <= set(params) <= {"handle", "goal", "difficulty", "mode", "weak"}:
                return service.recommend(params)
            raise ApiError(404, "NOT_FOUND", "지원하지 않는 기능이야.")

    return Handler


def main():
    load_env()
    port = int(os.environ.get("PORT", "8765"))
    api = SolvedApi(os.environ.get("SOLVED_CLIENT_ID", ""), os.environ.get("SOLVED_CLIENT_SECRET", ""))
    ids = tuple(filter(None, os.environ.get("ALLOWED_EXTENSION_IDS", "").split(",")))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(Service(api), ids))
    print(f"Algosaurus: http://127.0.0.1:{port} (solved.ac API v4)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
