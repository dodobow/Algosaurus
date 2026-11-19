import re
from urllib.parse import quote

from .api import ApiError


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
            or data["total"] < 0 or data.get("pageSize") != 50):
        raise ApiError(502, "INVALID_PROBLEMS", "문제 목록 응답 형식이 올바르지 않아.")
    if data.get("diagnostics"):
        raise ApiError(422, "SEARCH_DIAGNOSTIC", "검색 조건을 적용하지 못했어. 계정·태그와 API 검색 사양을 확인해 줘.")
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

    def profile(self, handle):
        data = self.api.get("/users/" + quote(handle_value(handle), safe=""))
        if (not isinstance(data.get("id"), int) or not isinstance(data.get("handle"), str)
                or not isinstance(data.get("ojAccounts"), list)
                or not isinstance(data.get("rating"), int)
                or data.get("tier") is not None and not isinstance(data.get("tier"), int)):
            raise ApiError(502, "INVALID_PROFILE", "프로필 응답에 필요한 정보가 없어.")
        return data

    def weak_keys(self, profile, goal, difficulty, mode):
        raise ApiError(409, "ANALYSIS_REQUIRED", "설정에서 태그 분석을 먼저 실행해 줘.")

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
                if not lo <= problem.get("level", -1) <= hi:
                    continue
                problem_id, sub = problem.get("problemId"), problem.get("subId")
                if not isinstance(problem_id, int) or not isinstance(sub, str):
                    raise ApiError(502, "INVALID_PROBLEM", "문제 식별자가 올바르지 않아.")
                detail = self.api.get(f"/problems/{problem_id}", sub=sub)
                for link in detail.get("ojLinks", []):
                    if link.get("ojId") == "boj" and re.fullmatch(r"https://(?:www\.)?acmicpc\.net/problem/[0-9]+", link.get("url", "")):
                        return {"problem": {"problemId": problem_id, "subId": sub,
                                "title": problem_title(detail), "level": problem["level"],
                                "bojProblemId": link.get("nativeProblemId", ""), "url": link["url"], "tag": tag},
                                "profileId": profile["id"], "handle": canonical, "range": {"lo": lo, "hi": hi}}
        return {"problem": None, "reason": "NO_RESULTS", "range": {"lo": lo, "hi": hi}}
