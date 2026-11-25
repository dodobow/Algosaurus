import re
import threading
import time
from concurrent.futures import Future, TimeoutError as FutureTimeout
from urllib.parse import quote

from .api import ApiError
from .cache import SharedCache
from .analysis import (
    canonical_groups, tag_queries, unique_rated, classify_groups, inner_score,
    legacy_tag_rating, RATING_MODEL, BONUS_SATURATION_COUNT,
)


def settings_values(params):
    handle = handle_value(params.get("handle"))
    goal = params.get("goal", "contest")
    mode = params.get("mode", "default")
    if goal not in {"beginner", "job", "contest"} or mode not in {"default", "custom"}:
        raise ApiError(400, "INVALID_SETTINGS", "목표와 분석 모드를 확인해 줘.")
    if str(params.get("difficulty", "0")) not in {"-2", "-1", "0", "1", "2"}:
        raise ApiError(400, "INVALID_SETTINGS", "난이도 조정은 -2~2 정수여야 해.")
    return handle, goal, int(params.get("difficulty", 0)), mode


def recommend_range(tier, goal, difficulty):
    if not isinstance(tier, int) or isinstance(tier, bool) or not 0 <= tier <= 31:
        raise ApiError(422, "TIER_UNAVAILABLE", "티어가 비공개여서 추천 난이도를 계산할 수 없어.")
    lo = max(1, tier // 2)
    hi = lo + tier // 5 + 2
    if goal == "beginner":
        lo, hi = 1, min(hi, 10)
    elif goal == "job":
        lo, hi = min(lo, 8), min(hi, 15)
    lo = max(1, min(30, lo + difficulty))
    return lo, max(lo, min(30, hi + difficulty))


def checked_page(data):
    if (not isinstance(data.get("problems"), list) or not isinstance(data.get("total"), int)
            or data["total"] < 0 or data.get("pageSize") != 50
            or len(data['problems']) > 50 or not all(isinstance(p, dict) for p in data['problems'])):
        raise ApiError(502, "INVALID_PROBLEMS", "문제 목록 응답 형식이 올바르지 않아.")
    if data.get("diagnostics"):
        raise ApiError(422, "SEARCH_DIAGNOSTIC", "검색 조건을 적용하지 못했어. 계정·태그와 API 검색 사양을 확인해 줘.")
    page = data.get('page')
    if not isinstance(page, int) or page < 1 or len(data['problems']) != min(50, max(0, data['total'] - (page - 1) * 50)):
        raise ApiError(502, 'INCOMPLETE_PAGE', '분석·추천에 필요한 문제 페이지가 누락됐어.')
    return data


def problem_title(problem):
    titles = problem.get("titles", [])
    return next((t["title"] for t in titles if t.get("language") == "ko"),
                next((t["title"] for t in titles if t.get("title")), "제목 없음"))


def handle_value(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_]{1,64}", value):
        raise ApiError(400, "INVALID_HANDLE", "solved.ac 핸들은 영문·숫자·밑줄 1~64자로 입력해 줘.")
    if value.lower() == "me":
        raise ApiError(400, "RESERVED_HANDLE", "검색에서 me는 로그인 계정을 뜻해서 이 핸들은 지원하지 않아.")
    return value


class Service:
    def __init__(self, api):
        self.api = api
        self.lock = threading.Lock()
        self.analysis_cache = {}
        self.pending = {}
        self.tags = SharedCache(86400, 1)
        self.profiles = SharedCache(30, 64)
        self.pages = SharedCache(900, 512)

    def profile(self, handle):
        handle = handle_value(handle)
        return self.profiles.get(handle, lambda: self._profile(handle))

    def _profile(self, handle):
        data = self.api.get("/users/" + quote(handle, safe=""))
        if (not isinstance(data.get("id"), int) or not isinstance(data.get("handle"), str)
                or not isinstance(data.get("ojAccounts"), list)
                or not isinstance(data.get("rating"), int) or not isinstance(data.get("solvedCount"), int)
                or data.get("tier") is not None and not isinstance(data.get("tier"), int)):
            raise ApiError(502, "INVALID_PROFILE", "프로필 응답에 필요한 정보가 없어.")
        return data

    def weak_keys(self, profile, goal, difficulty, mode):
        key = self.analysis_key(profile, goal, mode)
        with self.lock:
            cached = self.analysis_cache.get(key)
        if not cached or time.monotonic() - cached[0] >= 900:
            raise ApiError(409, "ANALYSIS_REQUIRED", "현재 설정으로 태그 분석을 먼저 실행해 줘. 서버 재시작·15분 경과 후에는 다시 분석해야 해.")
        if all(group['category'] == 'insufficient' for group in cached[1]['groups']):
            raise ApiError(422, 'ANALYSIS_INSUFFICIENT', '레이팅 대상 풀이가 없어 약점 태그를 판단할 수 없어.')
        groups = sorted((g for g in cached[1]['groups'] if g['category'] == 'weak'), key=lambda g: g['rating'])
        return list(dict.fromkeys(tag for group in groups for tag in group['keys']))

    @staticmethod
    def analysis_key(profile, goal, mode):
        return (4, RATING_MODEL, profile['id'], profile['handle'], mode, goal if mode == 'custom' else None)

    def top_sets(self, query, limit, profile_id=None, deadline=None):
        problems, total = [], None
        for page in range(1, 17):
            if deadline is not None and time.monotonic() >= deadline:
                raise ApiError(503, 'ANALYSIS_TIMEOUT', '분석 대기 시간이 길어졌어. 조회한 페이지는 보관했으니 새로고침해서 이어서 분석해 줘.')
            def load_page():
                data = checked_page(self.api.get('/problems', q=query, sort='level', direction='desc', page=page))
                if data.get('page') != page:
                    raise ApiError(502, 'INCOMPLETE_PAGE', '요청한 문제 페이지와 응답이 일치하지 않아.')
                unique_rated(data['problems'])
                return data
            data = self.pages.get((4, profile_id, query, page), load_page)
            if data.get('page') != page or total is not None and total != data['total']:
                self.pages.discard(lambda key: key[:3] == (4, profile_id, query))
                raise ApiError(409, 'DATA_CHANGED', '분석 도중 풀이 목록이 바뀌었어. 다시 실행해 줘.')
            total = data['total']
            problems.extend(data['problems'])
            best = unique_rated(problems)
            if len(best) >= limit or page * 50 >= total:
                return best[:limit]
        raise ApiError(422, 'ANALYSIS_LIMIT', '소문제·중복이 많아 분석 조회 한도에 도달했어. 불완전한 점수는 표시하지 않아.')

    def analyze(self, params):
        handle, goal, difficulty, mode = settings_values(params)
        profile = self.profile(handle)
        canonical = handle_value(profile['handle'])
        key = self.analysis_key(profile, goal, mode)
        def response(result):
            return {**result, 'settings': {'goal': goal, 'difficulty': difficulty, 'mode': mode}}
        with self.lock:
            cached = self.analysis_cache.get(key)
            if cached and time.monotonic() - cached[0] < 900:
                return response(cached[1])
            if key in self.pending:
                pending, owner = self.pending[key], False
            else:
                pending, owner = Future(), True
                self.pending[key] = pending
                self.analysis_cache.pop(key, None)
        if not owner:
            try:
                return response(pending.result(timeout=540))
            except FutureTimeout:
                raise ApiError(503, 'ANALYSIS_BUSY', '같은 설정의 분석이 진행 중이야. 잠시 후 다시 시도해 줘.') from None
        try:
            deadline = time.monotonic() + 480
            def load_catalog():
                catalog = self.api.get('/tags').get('tags')
                if not isinstance(catalog, list):
                    raise ApiError(502, 'INVALID_TAGS', '태그 목록을 읽을 수 없어.')
                return catalog
            catalog = self.tags.get(4, load_catalog)
            groups = canonical_groups(catalog, mode, goal)
            official = {rating['key']: rating['rating'] for rating in profile.get('tagRatings', [])
                        if isinstance(rating.get('rating'), int)}
            for group in groups:
                problems = []
                group['officialRating'] = official.get(group['keys'][0]) if len(group['keys']) == 1 else None
                use_official = mode == 'default' and group['officialRating'] is not None
                for query in tag_queries(canonical, group['keys']):
                    limit = 50 if use_official or len(unique_rated(problems)) >= BONUS_SATURATION_COUNT else BONUS_SATURATION_COUNT
                    problems.extend(self.top_sets(query, limit, profile['id'], deadline))
                group.update(legacy_tag_rating(problems))
                if use_official:
                    group['rating'] = group['officialRating']
                    group['ratingCount'] = group['ratingCountCapped'] = None
            inner = inner_score(self.top_sets(f'@{canonical} rated:true', 200, profile['id'], deadline))
            result = {'version': 4, 'ratingModel': RATING_MODEL, 'profileId': profile['id'], 'handle': canonical,
                      'settings': {'goal': goal, 'difficulty': difficulty, 'mode': mode},
                      'createdAt': int(time.time() * 1000), 'groups': classify_groups(groups), 'inner': inner}
            with self.lock:
                self.analysis_cache[key] = (time.monotonic(), result)
                while len(self.analysis_cache) > 64:
                    del self.analysis_cache[next(iter(self.analysis_cache))]
            pending.set_result(result)
            return response(result)
        except Exception as exc:
            pending.set_exception(exc)
            raise
        finally:
            with self.lock:
                self.pending.pop(key, None)

    def recommend(self, params):
        handle, goal, difficulty, mode = settings_values(params)
        if params.get("weak", "false") not in {"true", "false"}:
            raise ApiError(400, "INVALID_SETTINGS", "추천 모드를 확인해 줘.")
        profile = self.profile(handle)
        canonical = handle_value(profile["handle"])
        lo, hi = recommend_range(profile.get("tier"), goal, difficulty)
        tags = self.weak_keys(profile, goal, difficulty, mode) if params.get("weak") == "true" else [None]
        if not tags:
            return {"problem": None, "reason": "NO_WEAK_TAGS", "range": {"lo": lo, "hi": hi}}
        for tag in tags[:3]:
            query = f"*{lo}..{hi} !@{canonical} %ko solvablein:boj"
            if tag:
                query += " #" + tag
            if len(query) > 100:
                raise ApiError(422, "QUERY_TOO_LONG", "핸들과 태그 조합이 API의 비로그인 검색 100자 제한을 넘어.")
            data = checked_page(self.api.get("/problems", q=query, sort="random", page=1))
            for problem in data["problems"][:5]:
                if not isinstance(problem.get('level'), int):
                    raise ApiError(502, "INVALID_PROBLEM", "문제 난이도가 올바르지 않아.")
                if not lo <= problem["level"] <= hi:
                    continue
                problem_id, sub = problem.get("problemId"), problem.get("subId")
                if not isinstance(problem_id, int) or not isinstance(sub, str):
                    raise ApiError(502, "INVALID_PROBLEM", "문제 식별자가 올바르지 않아.")
                detail = self.api.get(f"/problems/{problem_id}", sub=sub)
                if detail.get('problemId') != problem_id or detail.get('subId') != sub:
                    raise ApiError(502, 'INVALID_PROBLEM', '요청한 소문제와 상세 응답이 일치하지 않아.')
                for link in detail.get("ojLinks", []):
                    if link.get("ojId") == "boj" and re.fullmatch(r"https://(?:www\.)?acmicpc\.net/problem/[0-9]+", link.get("url", "")):
                        return {"problem": {"problemId": problem_id, "subId": sub,
                                "title": problem_title(detail), "level": problem["level"],
                                "bojProblemId": link.get("nativeProblemId", ""), "url": link["url"], "tag": tag},
                                "profileId": profile["id"], "handle": canonical, "range": {"lo": lo, "hi": hi}}
        return {"problem": None, "reason": "NO_WEAK_RESULTS" if params.get('weak') == 'true' else "NO_RESULTS",
                "range": {"lo": lo, "hi": hi}}
