import json
import math
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


def upstream_open(request, timeout):
    return build_opener(NoRedirect).open(request, timeout=timeout)


class ApiError(Exception):
    def __init__(self, status, code, message, retry_after=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.retry_after = retry_after


class SolvedApi:
    BASE = "https://solved.ac/api/v4"

    def __init__(self, client_id="", client_secret="", transport=upstream_open, clock=time.monotonic):
        self.client_id = client_id
        self.client_secret = client_secret
        self.transport = transport
        self.clock = clock
        self.lock = threading.Lock()
        self.tokens = 60.0
        self.updated = clock()
        self.blocked_until = 0
        self.slots = threading.BoundedSemaphore(3)

    def get(self, path, **params):
        if not self.client_id or not self.client_secret:
            raise ApiError(503, "APP_NOT_CONFIGURED", "서버의 SOLVED_CLIENT_ID와 SOLVED_CLIENT_SECRET을 설정해 줘.")
        if not self.slots.acquire(blocking=False):
            raise ApiError(429, "SERVER_BUSY", "처리 중인 요청이 많아. 잠시 후 다시 시도해 줘.", 2)
        try:
            self._reserve(3 if path == "/problems" or path.startswith("/search/") else 1)
            url = self.BASE + path
            if params:
                url += "?" + urlencode(params)
            request = Request(url, headers={
                "x-client-id": self.client_id,
                "x-client-secret": self.client_secret,
                "Accept": "application/json",
                "User-Agent": "Algosaurus/1.0",
            })
            try:
                with self.transport(request, timeout=20) as response:
                    data = json.load(response)
            except HTTPError as exc:
                retry = None
                if exc.code == 429:
                    try:
                        retry = max(1, min(86400, math.ceil(float(exc.headers.get("Retry-After", "30")))))
                    except (ValueError, OverflowError):
                        retry = 30
                    with self.lock:
                        self.blocked_until = max(self.blocked_until, self.clock() + retry)
                messages = {
                    401: "앱 인증 또는 검색 제한을 확인해 줘.",
                    403: "앱의 API 접근 권한을 확인해 줘.",
                    404: "계정이나 문제를 찾을 수 없어. solved.ac 핸들을 확인해 줘.",
                    429: "solved.ac 호출 제한에 도달했어. 안내한 시간 뒤 다시 시도해 줘.",
                }
                exc.close()
                raise ApiError(exc.code if exc.code in messages else 502,
                               f"UPSTREAM_{exc.code}", messages.get(exc.code, "solved.ac 응답에 실패했어."), retry) from None
            except (URLError, TimeoutError, OSError):
                raise ApiError(502, "UPSTREAM_UNAVAILABLE", "solved.ac에 연결하지 못했어. 잠시 후 다시 시도해 줘.") from None
            except (ValueError, UnicodeError):
                raise ApiError(502, "INVALID_RESPONSE", "solved.ac 응답 형식이 올바르지 않아.") from None
            if not isinstance(data, dict):
                raise ApiError(502, "INVALID_RESPONSE", "solved.ac 응답 형식이 올바르지 않아.")
            return data
        finally:
            self.slots.release()

    def _reserve(self, cost):
        with self.lock:
            now = self.clock()
            self.tokens = min(60, self.tokens + max(0, now - self.updated))
            self.updated = now
            wait = max(self.blocked_until - now, cost - self.tokens)
            if wait > 0:
                raise ApiError(429, "RATE_LIMITED", "호출 제한 보호 중이야. 잠시 후 다시 시도해 줘.", math.ceil(wait))
            self.tokens -= cost
