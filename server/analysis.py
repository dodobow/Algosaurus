from .api import ApiError


GROUPS = {
    'default': [
        ('다이나믹 프로그래밍', ['dp']), ('구현', ['implementation']),
        ('그래프', ['graphs']), ('그리디', ['greedy']), ('자료 구조', ['data_structures']),
        ('문자열', ['string']), ('수학', ['math']), ('기하학', ['geometry']),
    ],
    'beginner': [
        ('구현', ['implementation', 'simulation']), ('완전 탐색', ['bruteforcing']),
        ('이분 탐색', ['binary_search']), ('수학', ['math', 'arithmetic']),
        ('선형 자료 구조', ['stack', 'queue', 'deque']), ('문자열', ['string']),
        ('정렬', ['sorting']), ('애드 혹', ['ad_hoc']),
        ('재귀와 집합', ['recursion', 'set']), ('기초 알고리즘', ['dp', 'greedy']),
    ],
    'job': [
        ('DP', ['dp', 'knapsack', 'dp_tree']), ('그리디', ['greedy']),
        ('그래프와 최단 거리', ['graphs', 'shortest_path', 'bfs', 'dfs']),
        ('자료 구조', ['priority_queue', 'disjoint_set', 'stack', 'queue', 'set', 'deque']),
        ('이분 탐색', ['binary_search', 'parametric_search']), ('완전 탐색', ['backtracking', 'bruteforcing']),
        ('구현', ['simulation', 'implementation', 'case_work']), ('문자열', ['string']),
        ('누적 합', ['prefix_sum']), ('다양한 테크닉', ['two_pointer', 'sliding_window', 'sweeping']),
    ],
    'contest': [
        ('세그먼트 트리', ['segtree', 'lazyprop', 'pst', 'merge_sort_tree']),
        ('문자열', ['string', 'kmp', 'trie', 'suffix_array']),
        ('정수론과 확률', ['number_theory', 'probability', 'combinatorics']),
        ('애드 혹', ['ad_hoc']), ('그리디', ['greedy']),
        ('DP', ['dp', 'dp_tree', 'dp_digit', 'dp_bitfield', 'tsp', 'cht']),
        ('그래프와 트리', ['graphs', 'trees', 'flow', 'mcmf', 'mfmc', 'scc', '2_sat', 'bipartite_matching', 'lca', 'centroid']),
        ('기하학', ['geometry', 'convex_hull', 'line_intersection', 'rotating_calipers', 'polygon_area']),
        ('쿼리와 최적화', ['mo', 'offline_queries', 'sqrt_decomposition', 'smaller_to_larger', 'coordinate_compression']),
        ('다양한 테크닉', ['bitmask', 'mitm', 'sweeping', 'permutation_cycle_decomposition', 'game_theory', 'sprague_grundy', 'euler_tour_technique']),
    ],
}


def canonical_groups(catalog, mode, goal):
    aliases = {}
    for tag in catalog:
        key = tag.get('key')
        if not isinstance(key, str) or not key or not all(c.isascii() and (c.isalnum() or c in '_-') for c in key):
            raise ApiError(502, 'INVALID_TAGS', '태그 키 형식이 올바르지 않아.')
        for alias in [key, *tag.get('aliases', [])]:
            aliases[alias] = key
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
    average = sum(group['score'] for group in groups) / len(groups) if groups else 0
    for group in groups:
        group['category'] = 'insufficient' if average == 0 else (
            'weak' if group['score'] < average * 0.9 else 'strong' if group['score'] > average * 1.1 else 'normal')
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
