import math

from .api import ApiError


RATING_MODEL = 'legacy-tag-v1'
BONUS_SATURATION_COUNT = 597


def legacy_tag_rating(problems):
    best = unique_rated(problems)
    top = best[:50]
    count = min(len(best), BONUS_SATURATION_COUNT)
    score = sum(problem['level'] for problem in top)
    bonus = math.floor(200 * (1 - 0.99 ** count) + 0.5)
    return {'score': score, 'count': len(top), 'ratingCount': count,
            'ratingCountCapped': count == BONUS_SATURATION_COUNT,
            'rating': 2 * score + bonus}


GROUPS = {
    'default': [
        ('다이나믹 프로그래밍', ['dp']), ('구현', ['impl']),
        ('그래프', ['graph']), ('그리디', ['greedy']), ('자료 구조', ['ds']),
        ('문자열', ['string']), ('수학', ['math']), ('기하학', ['geom']),
    ],
    'beginner': [
        ('구현', ['impl', 'sim']), ('완전 탐색', ['brute']),
        ('이분 탐색', ['binary_search']), ('수학', ['math', 'arithmetic']),
        ('선형 자료 구조', ['stack', 'queue', 'deque']), ('문자열', ['string']),
        ('정렬', ['sort']), ('애드 혹', ['adhoc']),
        ('재귀와 집합', ['recursion', 'set']), ('기초 알고리즘', ['dp', 'greedy']),
    ],
    'job': [
        ('DP', ['dp', 'knapsack', 'tree_dp']), ('그리디', ['greedy']),
        ('그래프와 최단 거리', ['graph', 'shortest_path', 'bfs', 'dfs']),
        ('자료 구조', ['pq', 'dsu', 'stack', 'queue', 'set', 'deque']),
        ('이분 탐색', ['binary_search', 'parametric_search']), ('완전 탐색', ['backtrack', 'brute']),
        ('구현', ['sim', 'impl', 'casework']), ('문자열', ['string']),
        ('누적 합', ['prefix_sum']), ('다양한 테크닉', ['two_pointer', 'window', 'sweep']),
    ],
    'contest': [
        ('세그먼트 트리', ['segtree', 'lazyprop', 'pst', 'mergesort_tree']),
        ('문자열', ['string', 'kmp', 'trie', 'suffix_array']),
        ('정수론과 확률', ['number_theory', 'prob', 'combinatorics']),
        ('애드 혹', ['adhoc']), ('그리디', ['greedy']),
        ('DP', ['dp', 'tree_dp', 'digit_dp', 'bit_dp', 'tsp', 'cht']),
        ('그래프와 트리', ['graph', 'tree', 'flow', 'mcmf', 's_t_mincut', 'scc', '2sat', 'bipartite_matching', 'lca', 'centroid']),
        ('기하학', ['geom', 'hull', 'line_intersect', 'calipers', 'poly_area']),
        ('쿼리와 최적화', ['mo', 'offline', 'sqrt_decomp', 'small_to_large', 'value_compress']),
        ('다양한 테크닉', ['bitmask', 'mitm', 'sweep', 'cycle_decomp', 'game', 'sprague_grundy', 'ett']),
    ],
}


def canonical_groups(catalog, mode, goal):
    aliases = {}
    for tag in catalog:
        key = tag.get('key')
        if not isinstance(key, str) or not key or not all(c.isascii() and (c.isalnum() or c in '_-') for c in key):
            raise ApiError(502, 'INVALID_TAGS', '태그 키 형식이 올바르지 않아.')
        aliases[key] = key
    for tag in catalog:
        for alias in tag.get('aliases', []):
            aliases.setdefault(alias, tag['key'])
    groups = []
    for name, keys in GROUPS[goal if mode == 'custom' else 'default']:
        if any(key not in aliases for key in keys):
            raise ApiError(502, 'TAG_CATALOG_CHANGED', f'{name} 그룹의 태그 사양이 변경됐어. 태그 목록을 확인해야 해.')
        groups.append({'name': name, 'keys': list(dict.fromkeys(aliases[key] for key in keys))})
    return groups


def tag_queries(handle, keys):
    prefix = f'@{handle} rated:true '
    chunks, current = [], []
    for key in keys:
        trial = current + [key]
        query = prefix + '(' + ' | '.join('#' + tag for tag in trial) + ')'
        if len(query) > 100 or len(trial) > 6:
            if not current:
                raise ApiError(422, 'QUERY_TOO_LONG', '계정과 태그 조합이 비로그인 검색 제한을 넘어.')
            chunks.append(prefix + '(' + ' | '.join('#' + tag for tag in current) + ')')
            current = [key]
            if len(prefix + '(#' + key + ')') > 100:
                raise ApiError(422, 'QUERY_TOO_LONG', '계정과 태그 조합이 비로그인 검색 제한을 넘어.')
        else:
            current = trial
    if current:
        chunks.append(prefix + '(' + ' | '.join('#' + tag for tag in current) + ')')
    return chunks


def unique_rated(problems):
    best = {}
    for problem in problems:
        pid, level = problem.get('problemId'), problem.get('level')
        if not isinstance(pid, int) or not isinstance(level, int) or not 0 <= level <= 30:
            raise ApiError(502, 'INVALID_PROBLEM', '문제 난이도나 세트 ID가 올바르지 않아.')
        if problem.get('givesNoRating') is not False or level == 0:
            continue
        if pid not in best or level > best[pid]['level']:
            best[pid] = problem
    return sorted(best.values(), key=lambda problem: (-problem['level'], problem['problemId']))


def classify_groups(groups):
    average = sum(group['rating'] for group in groups) / len(groups) if groups else 0
    for group in groups:
        group['category'] = 'insufficient' if average == 0 else (
            'weak' if group['rating'] < average * 0.9 else 'strong' if group['rating'] > average * 1.1 else 'normal')
    return groups


def inner_score(problems):
    levels = [problem['level'] for problem in unique_rated(problems)[:200]]
    if len(levels) < 200:
        return {'status': 'insufficient', 'score': None, 'count': len(levels)}
    first, second, third, fourth = (sum(levels[i:i + 50]) for i in range(0, 200, 50))
    if first + second <= 0 or second <= 0:
        return {'status': 'insufficient', 'score': None, 'count': len(levels)}
    score = ((third + fourth) / (first + second) + (third + fourth) / (2 * second)) * 50
    return {'status': 'ok', 'score': round(score, 2), 'count': 200,
            'range': {'lo': levels[-1], 'hi': levels[50]}}
