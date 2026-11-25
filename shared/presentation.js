import { textElement, profileText } from './ui.js';
import { calculateTierInfo, calculateRatingToTier, calculateRecommendTier } from '../utils.js';

function colored(text, color, className) {
    const element = textElement('span', text, className);
    element.style.color = color;
    element.style.fontWeight = 'bold';
    return element;
}

export function renderRange(target, range) {
    if (!range) { target.textContent = '티어가 비공개여서 추천 범위를 계산할 수 없습니다.'; return; }
    const lo = calculateTierInfo(range.lo), hi = calculateTierInfo(range.hi);
    target.replaceChildren(colored(lo.name, lo.color), textElement('span', ' ~ ', 'range-tilde'), colored(hi.name, hi.color));
}

export function renderProfileCard(target, profile, settings, selectedGoal) {
    const tier = calculateTierInfo(profile.tier);
    const layout = textElement('div', '', 'result-layout');
    const user = textElement('div', '', 'user-profile');
    const handle = textElement('div', profile.handle, 'user-handle');
    handle.title = profileText(profile);
    user.append(handle);
    for (const [label, value] of [['레이팅 ', profile.rating], ['티어 ', tier.name]]) {
        const line = textElement('div', '', 'user-stat');
        line.append(textElement('span', label), colored(value, tier.color, 'stat-value'));
        user.append(line);
    }
    layout.append(user, textElement('div', '', 'result-divider'));
    if (!selectedGoal) {
        const empty = textElement('div', '', 'goal-empty');
        empty.append(...['My Page에서', '목표를 먼저', '설정해주세요!'].map(text => textElement('span', text)));
        layout.append(empty);
    } else {
        const goal = textElement('div', '', 'goal-profile');
        const rangeLabel = textElement('div', '추천 난이도', 'goal-label');
        rangeLabel.style.marginTop = '6px';
        const range = textElement('div', '', 'tier-range');
        renderRange(range, calculateRecommendTier(profile.tier, settings.goal, settings.difficulty));
        goal.append(textElement('div', '현재 목표', 'goal-label'),
            textElement('div', { beginner: '코딩 입문 🐣', job: '취업 준비 💼', contest: '대회 준비 🏆' }[settings.goal], 'goal-value'), rangeLabel, range);
        layout.append(goal);
    }
    target.replaceChildren(layout);
}

export function problemLink(problem) {
    if (!/^https:\/\/(?:www\.)?acmicpc\.net\/problem\/\d+$/.test(problem.url)) throw new Error('BOJ 문제 링크가 올바르지 않아.');
    const link = textElement('a', '', 'problem-link');
    link.href = problem.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(textElement('span', `${problem.bojProblemId}번`, 'problem-id'), textElement('span', problem.title));
    return link;
}

export function tagCard(group, label, mode) {
    const official = mode === 'default' && Number.isFinite(group.officialRating);
    const value = official ? group.officialRating : group.score;
    const tier = calculateTierInfo(official ? calculateRatingToTier(value) : 0);
    const card = textElement('div', '', `tag-card ${group.category}`);
    card.append(textElement('span', label || group.name, 'tag-name'));
    const row = textElement('div', '');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '5px' });
    const badge = document.createElement('img');
    badge.src = tier.badgeUrl;
    badge.alt = official ? tier.name : '자체 학습 지표';
    Object.assign(badge.style, { height: '20px', transform: 'translateY(1px)' });
    const score = colored(value, tier.color, 'tag-tier');
    Object.assign(score.style, { display: 'inline-block', lineHeight: '1' });
    row.append(badge, score);
    const tooltip = textElement('div', '', 'tag-tooltip');
    const tags = textElement('span', '', 'tooltip-tags');
    for (const key of group.keys) tags.append(textElement('span', '#' + (TAG_LABELS[key] || key), 'tag-badge'));
    tooltip.append(tags, textElement('span', official ? '공식 태그 레이팅' : '상위 50개 고유 문제 세트 난이도합 · 공식 레이팅 아님'));
    card.append(row, tooltip);
    return card;
}

export function renderInner(comment, score, inner) {
    if (inner.status !== 'ok' || !Number.isFinite(inner.score)) {
        score.textContent = '무한한 가능성이 있어요!';
        comment.replaceChildren(textElement('span', '아직 푼 문제수가 적어서 분석이 힘들어요!'), document.createElement('br'),
            textElement('span', '지금은 내실 걱정보다 더 많은 문제를 접하는 게 더 도움이 될거예요!'));
        return;
    }
    score.textContent = inner.score;
    score.title = '고유 문제 세트 200개의 난이도 균형(%) · 공식 레이팅이나 실력 점수 아님';
    const words = inner.score >= 95 ? ['매우 균형', '완벽하게 다져진'] : inner.score >= 90 ? ['좋은 균형', '잘 다져진'] :
        inner.score >= 85 ? ['적당한 균형', '무난하게 다져진'] : inner.score >= 80 ? ['조금 불균형', '살짝 부족한'] : ['아주 불균형', '매우 부족한'];
    const connector = inner.score >= 95 ? '잡혀 있어요! 내실이 ' : inner.score >= 85 ? '을 이루고 있어요. 내실이 ' : '해요. 내실이 ';
    comment.replaceChildren(textElement('span', '상위 200문제가 '), textElement('b', words[0]),
        textElement('span', connector), textElement('b', words[1]), textElement('span', ' 상태입니다.'));
    comment.title = '레이팅 대상 고유 세트의 자체 균형 지표입니다. 실제 실력을 보장하지 않습니다.';
    if (inner.score < 95 && inner.range) {
        const range = textElement('span', '');
        renderRange(range, inner.range);
        comment.append(document.createElement('br'), range, textElement('span', ' 범위의 문제를 더 풀면 내실 향상에 도움이 될거에요!'));
    }
}

export const GROUP_LABELS = {
    "default": [
        "다이나믹 프로그래밍",
        "구현",
        "그래프 이론",
        "그리디 알고리즘",
        "자료 구조",
        "문자열",
        "수학",
        "기하학"
    ],
    "beginner": [
        "구현",
        "브루트포스 알고리즘",
        "이분 탐색",
        "수학",
        "선형 자료구조",
        "문자열",
        "정렬",
        "애드 혹",
        "재귀 함수와 집합과 맵",
        "기초 알고리즘"
    ],
    "job": [
        "다이나믹 프로그래밍",
        "그리디 알고리즘",
        "그래프와 최단 거리",
        "다양한 자료구조",
        "이분 탐색과 응용",
        "완전 탐색",
        "구현 능력",
        "문자열",
        "누적 합",
        "다양한 테크닉"
    ],
    "contest": [
        "세그먼트 트리와 응용",
        "문자열",
        "정수론과 조합론, 확률론",
        "애드 혹",
        "그리디 알고리즘",
        "다이나믹 프로그래밍",
        "그래프와 트리",
        "기하학",
        "쿼리와 최적화",
        "다양한 테크닉"
    ]
};

const TAG_LABELS = {
    "dp": "다이나믹 프로그래밍",
    "impl": "구현",
    "greedy": "그리디 알고리즘",
    "ds": "자료 구조",
    "string": "문자열",
    "math": "수학",
    "geom": "기하학",
    "sim": "시뮬레이션",
    "brute": "브루트포스 알고리즘",
    "binary_search": "이분 탐색",
    "arithmetic": "사칙연산",
    "stack": "스택",
    "queue": "큐",
    "deque": "덱",
    "sort": "정렬",
    "recursion": "재귀",
    "set": "집합과 맵",
    "knapsack": "배낭 문제",
    "shortest_path": "최단 경로",
    "bfs": "너비 우선 탐색",
    "dfs": "깊이 우선 탐색",
    "pq": "우선순위 큐",
    "dsu": "분리 집합",
    "parametric_search": "매개 변수 탐색",
    "backtrack": "백트래킹",
    "casework": "많은 조건 분기",
    "prefix_sum": "누적 합",
    "window": "슬라이딩 윈도우",
    "sweep": "스위핑",
    "segtree": "세그먼트 트리",
    "lazyprop": "느리게 갱신되는 세그먼트 트리",
    "pst": "퍼시스턴트 세그먼트 트리",
    "mergesort_tree": "머지 소트 트리",
    "kmp": "KMP",
    "trie": "트라이",
    "number_theory": "정수론",
    "prob": "확률론",
    "combinatorics": "조합론",
    "tsp": "외판원 순회 문제",
    "cht": "볼록 껍질을 이용한 최적화",
    "flow": "최대 유량",
    "mcmf": "최소 비용 최대 유량",
    "s_t_mincut": "최대 유량 최소 컷 정리",
    "scc": "강한 연결 요소",
    "bipartite_matching": "이분 매칭",
    "lca": "최소 공통 조상",
    "hull": "볼록 껍질",
    "calipers": "회전하는 캘리퍼스",
    "offline": "오프라인 쿼리",
    "sqrt_decomp": "제곱근 분할법",
    "small_to_large": "작은 집합에서 큰 집합으로 합치는 테크닉",
    "bitmask": "비트마스킹",
    "cycle_decomp": "순열 사이클 분할",
    "game": "게임 이론",
    "ett": "오일러 경로 테크닉",
    "tree_dp": "트리에서의 DP",
    "two_pointer": "투 포인터",
    "value_compress": "값 / 좌표 압축",
    "digit_dp": "자릿수를 이용한 DP",
    "line_intersect": "선분 교차 판정",
    "mo": "mo's",
    "graph": "그래프 이론",
    "mitm": "중간에서 만나기",
    "2sat": "2-sat",
    "tree": "트리",
    "adhoc": "애드 혹",
    "sprague_grundy": "스프라그 그런디 정리",
    "suffix_array": "접미사 배열과 LCP 배열",
    "bit_dp": "비트필드를 이용한 DP",
    "poly_area": "다각형의 넓이",
    "centroid": "센트로이드"
};
