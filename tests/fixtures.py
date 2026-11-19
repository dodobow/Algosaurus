from copy import deepcopy

from server.api import ApiError
from server.analysis import GROUPS
import re


PROFILE = {
    "id": 17, "handle": "solved_name", "tier": 10, "rating": 700,
    "solvedCount": 250, "ratingByProblemsSum": 1500,
    "ojAccounts": [{"ojId": "boj", "ojName": "BOJ", "handle": "boj_other", "verified": True}],
    "tagRatings": [],
}


def problem(number=777, sub="a", level=7, tags=None):
    return {"id": number * 10 + len(sub), "problemId": number, "subId": sub, "level": level,
            "givesNoRating": False, "titles": [{"language": "ko", "title": "모의 문제"}],
            "tags": [{"key": key} for key in (tags or ["dp"])], "userStatus": None,
            "ojLinks": [{"ojId": "boj", "nativeProblemId": "1000", "url": "https://www.acmicpc.net/problem/1000"}]}


class FixtureApi:
    def __init__(self):
        self.calls = []
        self.problems = [problem()]
        self.diagnostics = []
        self.user = deepcopy(PROFILE)
        self.user['tagRatings'] = [{'key': 'dp', 'rating': 900}]
        self.solved = [problem(10000 + i, '', 10 - i // 50, ['dp' if i % 2 else 'impl']) for i in range(230)]

    def get(self, path, **params):
        self.calls.append((path, params))
        if path.startswith('/users/'):
            handle = path.split('/')[2]
            if handle == 'missing':
                raise ApiError(404, 'UPSTREAM_404', '계정을 찾을 수 없어.')
            if handle == 'limited':
                raise ApiError(429, 'UPSTREAM_429', '호출 제한이야.', 30)
            if handle == 'offline':
                raise ApiError(502, 'UPSTREAM_UNAVAILABLE', 'API 연결 실패야.')
            data = deepcopy(self.user)
            data['handle'] = handle
            return data
        if path == '/problems':
            if params.get('q', '').startswith('@'):
                tags = re.findall(r'#([\w-]+)', params['q'])
                solved = [p for p in self.solved if not tags or any(tag['key'] in tags for tag in p['tags'])]
                page = params.get('page', 1)
                items, total = solved[(page - 1) * 50:page * 50], len(solved)
            else:
                items, total = self.problems, len(self.problems)
            return {"problems": deepcopy(items), "total": total, "page": params.get('page', 1), "pageSize": 50,
                    "diagnostics": self.diagnostics}
        if path.startswith('/problems/'):
            return deepcopy(self.problems[0])
        if path == '/tags':
            mapping = {'implementation': 'impl', 'sorting': 'sort', 'graphs': 'graph'}
            keys = set(key for groups in GROUPS.values() for _, names in groups for key in names)
            return {'tags': [{'key': mapping.get(key, key), 'aliases': [key] if key in mapping else [],
                              'names': {'ko': key}, 'parents': [], 'rated': True} for key in sorted(keys)]}
        raise AssertionError((path, params))
