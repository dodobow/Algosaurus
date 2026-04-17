const GOAL_TAGS = {
    'default': [
        { key : ['#dp'], name : '다이나믹 프로그래밍' },
        { key : ['#implementation'], name : '구현' },
        { key : ['#graphs'], name : '그래프 이론' },
        { key : ['#greedy'], name : '그리디 알고리즘' },
        { key : ['#data_structures'], name : '자료 구조' },
        { key : ['#string'], name : '문자열' },
        { key : ['#math'], name : '수학' },
        { key : ['#geometry'], name : '기하학' }
    ],
    'beginner': [
        {key : ['#implementation', '#simulation'], name : '구현'},
        {key : ['#bruteforcing'], name : '브루트포스 알고리즘'},
        {key : ['#binary_search'], name : '이분 탐색'},
        {key : ['#math', '#arithmetic'], name : '수학'},
        {key : ['#stack', '#queue', '#deque'], name : '선형 자료구조'},
        {key : ['#string'], name : '문자열'},
        {key : ['#sorting'], name : '정렬'},
        {key : ['#ad_hoc'], name : '애드 혹'},
        {key : ['#recursion', '#set'], name : '재귀 및 집합'},
        {key : ['#dp', '#greedy'], name : '기초 알고리즘'}
    ],
    'job': [
        {key : ['#dp', '#knapsack', '#dp_tree'], name : '다이나믹 프로그래밍'},
        {key : ['#greedy'], name : '그리디 알고리즘'},
        {key : ['#graphs', '#shortest_path', '#bfs', '#dfs'], name : '그래프와 최단 거리'},
        {key : ['#priority_queue', '#disjoint_set', '#stack', '#queue', '#set', '#deque'], name : '다양한 자료구조'},
        {key : ['#binary_search', '#parametric_search'], name : '이분 탐색'},
        {key : ['#backtracking', '#bruteforcing'], name : '완전 탐색'},
        {key : ['#simulation', '#implementation', '#case_work'], name : '구현 능력'},
        {key : ['#string'], name : '문자열'},
        {key : ['#prefix_sum'], name : '누적 합'},
        {key : ['#two_pointer', '#sliding_window', '#sweeping'], name : '다양한 테크닉'}
    ],
    'contest': [
        {key : ['#segtree', '#lazyprop', '#pst', '#merge_sort_tree'], name : '세그먼트 트리'},
        {key : ['#string', '#kmp', '#trie', '#suffix_array'], name : '문자열'},
        {key : ['#number_theory', '#probability', '#combinatorics'], name : '정수론/조합론'},
        {key : ['#ad_hoc'], name : '애드 혹'},
        {key : ['#greedy'], name : '그리디 알고리즘'},
        {key : ['#dp', '#dp_tree', '#dp_digit', '#dp_bitfield', '#tsp', '#cht'], name : '다이나믹 프로그래밍'},
        {key : ['#graphs', '#trees', '#flow', '#mcmf', '#mfmc', '#scc', '#2_sat', '#bipartite_matching', '#lca', '#centroid'], name : '그래프와 트리'},
        {key : ['#geometry', '#convex_hull', '#line_intersection', '#rotating_calipers', '#polygon_area'], name : '기하학'},
        {key : ['#mo', '#offline_queries', '#sqrt_decomposition', '#smaller_to_larger', '#coordinate_compression'], name : '쿼리와 최적화'},
        {key : ['#bitmask', '#mitm', '#sweeping', '#permutation_cycle_decomposition', '#game_theory', '#sprague_grundy', '#euler_tour_technique'], name : '다양한 테크닉'}
    ]
};

const TAG_ENG_TO_KOR = {
    'dp' : '다이나믹 프로그래밍',
    'implementation' : '구현',
    'greedy' : '그리디 알고리즘',
    'data_structures' : '자료 구조',
    'string' : '문자열',
    'math' : '수학',
    'geometry' : '기하학',
    'simulation' : '시뮬레이션',
    'bruteforcing' : '브루트포스 알고리즘',
    'binary_search' : '이분 탐색',
    'arithmetic' : '사칙연산',
    'stack' : '스택',
    'queue' : '큐',
    'deque' : '덱',
    'sorting' : '정렬',
    'recursion' : '재귀',
    'set' : '집합과 맵',
    'knapsack' : '배낭 문제',
    'shortest_path' : '최단 경로',
    'bfs' : '너비 우선 탐색',
    'dfs' : '깊이 우선 탐색',
    'priority_queue' : '우선순위 큐',
    'disjoint_set' : '분리 집합',
    'parametric_search' : '매개 변수 탐색',
    'backtracking' : '백트래킹',
    'case_work' : '많은 조건 분기',
    'prefix_sum' : '누적 합',
    'sliding_window' : '슬라이딩 윈도우',
    'sweeping' : '스위핑',
    'segtree' : '세그먼트 트리',
    'lazyprop' : '느리게 갱신되는 세그먼트 트리',
    'pst' : '퍼시스턴트 세그먼트 트리',
    'merge_sort_tree' : '머지 소트 트리',
    'kmp' : 'KMP',
    'trie' : '트라이',
    'number_theory' : '정수론',
    'probability' : '확률론',
    'combinatorics' : '조합론',
    'tsp' : '외판원 순회 문제',
    'cht' : '볼록 껍질을 이용한 최적화',
    'flow' : '최대 유량',
    'mcmf' : '최소 비용 최대 유량',
    'mfmc' : '최대 유량 최소 컷 정리',
    'scc' : '강한 연결 요소',
    'bipartite_matching' : '이분 매칭',
    'lca' : '최소 공통 조상',
    'convex_hull' : '볼록 껍질',
    'rotating_calipers' : '회전하는 캘리퍼스',
    'offline_queries' : '오프라인 쿼리',
    'sqrt_decomposition' : '제곱근 분할법',
    'smaller_to_larger' : '작은 집합에서 큰 집합으로 합치는 테크닉',
    'bitmask' : '비트마스킹',
    'permutation_cycle_decomposition' : '순열 사이클 분할',
    'game_theory' : '게임 이론',
    'euler_tour_technique' : '오일러 경로 테크닉',

    'dp_tree' : '트리에서의 DP',
    'two_pointer' : '투 포인터',
    'coordinate_compression' : '값 / 좌표 압축',
    'dp_digit' : '자릿수를 이용한 DP',
    'line_intersection' : '선분 교차 판정',
    'mo' : 'mo\'s',
    'graphs' : '그래프 이론',
    'mitm' : '중간에서 만나기',
    '2_sat' : '2-sat',
    'trees' : '트리',
    'ad_hoc' : '애드 혹',
    'sprague_grundy' : '스프라그 그런디 정리',
    'suffix_array' : '접미사 배열과 LCP 배열',
    'dp_bitfield' : '비트필드를 이용한 DP',
    'polygon_area' : '다각형의 넓이',
    'centroid' : '센트로이드'
}

let radarChartInstances = {};

function calculateRatingToTier(rating) {
    const TIER_RATING = [
        0,
        30, 60, 90, 120, 150,
        200, 300, 400, 500, 650,
        800, 950, 1100, 1250, 1400,
        1600, 1750, 1900, 2000, 2100,
        2200, 2300, 2400, 2500, 2600,
        2700, 2800, 2850, 2900, 2950,
        3000, 9999
    ]
    for (let i = 0; i < TIER_RATING.length; i++) {
        if (rating < TIER_RATING[i + 1]) return i;
    }
}

function calculateTierInfo(tierNum) {
    const TIER_COLORS = [
        '#000000',
        '#ad5600', '#b85b00', '#c46100', '#cf6700', '#db6c00',
        '#435f7a', '#476582', '#4b6b8a', '#507292', '#54789a',
        '#ec9a00', '#fba400', '#ffae00', '#ffb800', '#ffc300',
        '#25d69b', '#27e2a4', '#28edac', '#2af8b4', '#2cffbc',
        '#00b4fc', '#00c0ff', '#00ccff', '#00d8ff', '#00e4ff',
        '#cc004e', '#dd0054', '#ee005b', '#ff0062', '#ff0068',
        '#AC9FFF'
    ];
    let name = ''
    if (tierNum == 0) {
        name = 'Unrated';
    } else if (tierNum == 31) {
        name = 'Master';
    } else {
        name = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby'][Math.floor((tierNum - 1) / 5)] + ' ' + ['V', 'IV', 'III', 'II', 'I'][(tierNum + 4) % 5];
    }
    const badgeUrl = `assets/tiers/${tierNum}.svg`;
    return {name, color : TIER_COLORS[tierNum], badgeUrl};
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('search-btn');
    const handleInput = document.getElementById('handle-input');
    
    // 분석 전 결과 영역이 보이지 않도록 초기에 숨깁니다.
    document.getElementById('capture-area').style.display = 'none';

    searchBtn.addEventListener('click', runAnalysis);
    handleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runAnalysis();
    });
    
    // 메인 타이틀을 아카이브 감성으로 동적 변경 (index.html 역할 대체)
    const dashboardTitle = document.getElementById('dashboard-title');
    if (dashboardTitle) dashboardTitle.innerHTML = '백준 데이터 아카이브 - 나의 알고리즘 여정과 소중한 기록들';

    document.getElementById('save-btn').addEventListener('click', captureAndSave);
});

async function runAnalysis() {
    const handleInput = document.getElementById('handle-input');
    const handle = handleInput.value.trim();
    const statusMsg = document.getElementById('status-message');
    const captureArea = document.getElementById('capture-area');
    const saveBtn = document.getElementById('save-btn');
    const reportTitle = document.getElementById('report-title');
    const searchBtn = document.getElementById('search-btn');

    if (searchBtn.disabled) return; // 이미 분석 중인 경우 중복 실행을 완벽히 차단합니다.

    if (!handle) {
        statusMsg.innerHTML = '<span style="color: red;">아이디를 입력해주세요.</span>';
        return;
    }

    captureArea.style.display = 'none';
    saveBtn.style.display = 'none';
    searchBtn.disabled = true;
    handleInput.disabled = true;

    // 전체 분석 단계(API 호출 횟수) 계산: 유저정보(1) + 내실검사(3) + 각 목표별 태그 개수
    let totalSteps = 1 + 3 + Object.values(GOAL_TAGS).reduce((sum, tags) => sum + tags.length, 0);
    let currentStep = 0;

    const updateProgress = () => {
        const percent = Math.floor((currentStep / totalSteps) * 100);
        statusMsg.innerHTML = `🔄 데이터를 순차적으로 수집하고 분석 중입니다... (${percent}%)`;
    };

    updateProgress();

    try {
        // 1. 유저 정보 조회
        const targetUrl = `https://solved.ac/api/v3/user/show?handle=${handle}`;
        const userRes = await fetch(`https://cors.eu.org/${targetUrl}`);
        if (!userRes.ok) {
            if (userRes.status === 404) {
                throw new Error(`'${handle}' 사용자를 찾을 수 없습니다. 아이디를 확인해주세요.`);
            }
            throw new Error('유저 정보를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.');
        }
        const userData = await userRes.json();

        currentStep++;
        updateProgress();

        const userTierInfo = calculateTierInfo(userData.tier);
        reportTitle.innerText = `${userData.handle}`;
        document.getElementById('user-tier-badge').src = userTierInfo.badgeUrl;
        document.getElementById('user-stat-msg').innerHTML = `<span style="color: ${userTierInfo.color}; font-weight: 800;">${userTierInfo.name}</span> <span style="color: #ccc; margin: 0 6px;">|</span> Rating: ${userData.rating.toLocaleString()}`;

        // 2. 내실 검사 및 태그 분석을 순차적으로 실행하여 프록시 서버 부하를 줄입니다.
        await analyzeInnerStability(userData.handle, userData.ratingByProblemsSum, userData.solvedCount, () => {
            currentStep++;
            updateProgress();
        });

        const goals = [
            { id: 'default', title: '기본 태그' },
            { id: 'beginner', title: '🌱 입문 목표' },
            { id: 'job', title: '💼 취업 목표' },
            { id: 'contest', title: '🏆 대회 목표' }
        ];
        
        const allTagsContainer = document.getElementById('all-tags-container');
        allTagsContainer.innerHTML = '';
        
        for (const goal of goals) {
            const section = document.createElement('section');
            section.className = 'card tag-analysis-card';
            const chartId = `radar-chart-${goal.id}`;
            const tagsId = `tags-container-${goal.id}`;
            
            section.innerHTML = `
                <div class="chart-side">
                    <div class="card-header">
                        <h2>📊 ${goal.title} 밸런스</h2>
                    </div>
                    <div class="card-body">
                        <div class="chart-container">
                            <canvas id="${chartId}"></canvas>
                        </div>
                    </div>
                </div>
                <div class="tags-side">
                    <div class="card-header">
                        <h2>🔎 강점 / 약점 리포트</h2>
                    </div>
                    <div class="card-body" id="${tagsId}">
                        <div class="spinner" style="margin-top: 40px;"></div>
                        <p style="text-align: center; color: #666; margin-top: 15px;">데이터 분석 중...</p>
                    </div>
                </div>
            `;
            allTagsContainer.appendChild(section);
            
            await analyzeTagsForGoal(userData.handle, goal.id, chartId, tagsId, () => {
                currentStep++;
                updateProgress();
            });
        }

        statusMsg.innerHTML = '✅ 분석 완료!';
        captureArea.style.display = 'block';
        saveBtn.style.display = 'block';

    } catch (error) {
        console.error(error);
        statusMsg.innerHTML = `<span style="color: red;">❌ 에러 발생: ${error.message}</span>`;
    } finally {
        searchBtn.disabled = false;
        handleInput.disabled = false;
    }
}

async function analyzeInnerStability(userId, ratingBy100Problem, solvedCount, onProgress) {
    const innerComment = document.getElementById('inner-comment');
    const innerScore = document.getElementById('inner-score');

    try {
        const pageNums = [2, 3, 4];
        let ratingBySeq = [0, 0, 0];
        let easyLevel = 0;
        let hardLevel = 0;
        
        for (const pageNum of pageNums) {
            const url = `https://solved.ac/api/v3/search/problem?query=s@${userId}&sort=level&direction=desc&page=${pageNum}`;
            const response = await fetch(`https://cors.eu.org/${url}`);
            if (!response.ok) {
                if (onProgress) onProgress();
                continue;
            }
            
            const data = await response.json();
            data.items.forEach(problem => {ratingBySeq[pageNum - 2] += problem.level});
            
            if (pageNum === 2 && data.items.length > 0) hardLevel = data.items[0].level;
            if (pageNum === 4 && data.items.length > 0) easyLevel = data.items[data.items.length - 1].level;

            await delay(300); // 프록시 서버의 과부하를 막기 위해 딜레이를 추가합니다.
            if (onProgress) onProgress();
        }
        
        const ratingBy1to50 = ratingBy100Problem - ratingBySeq[0];
        const ratingBy51to100 = ratingBySeq[0];
        const ratingBy101to150 = ratingBySeq[1];
        const ratingBy151to200 = ratingBySeq[2];

        let innerStabilty = -1;
        if (solvedCount >= 200) {
            innerStabilty = Math.round(((ratingBy101to150 + ratingBy151to200) / (ratingBy1to50 + ratingBy51to100) + ((ratingBy101to150 + ratingBy151to200) / 100) / (ratingBy51to100 / 50)) * 5000) / 100;
        }

        let innerStabiltyComment = '';
        if (innerStabilty === -1) {
            innerStabiltyComment = '시작의 설렘이 가득했던 순간들입니다.<br><br>처음 <b>맞았습니다!!</b>를 보고 기뻐했던 그 마음을 영원히 기억할게요!';
            innerScore.textContent = '-';
        } else {
            innerScore.textContent = innerStabilty;
            if (innerStabilty >= 95) {
                innerStabiltyComment = '어떤 문제든 묵묵히 풀어냈던 <b>완벽한 발자취</b>입니다.<br>당신이 쌓아올린 견고한 내실은 앞으로의 여정에도 큰 힘이 될 거예요.';
            } else if (innerStabilty >= 90) {
                innerStabiltyComment = '끊임없이 고민하고 도전했던 <b>아름다운 기록</b>입니다.<br>고르게 다져진 실력만큼이나 멋진 성장을 이루셨네요.';
            } else if (innerStabilty >= 85) {
                innerStabiltyComment = '밤낮없이 키보드를 두드리며 만들어낸 <b>소중한 궤적</b>입니다.<br>포기하지 않고 한 걸음씩 나아갔던 당신의 열정을 응원합니다.';
            } else if (innerStabilty >= 80) {
                innerStabiltyComment = '치열하게 고민하며 <b>몰두했던 시간들</b>입니다.<br>알고리즘에 쏟았던 그 깊이 있는 탐구는 당신만의 특별한 강점이 되었을 거예요.';
            } else {
                innerStabiltyComment = '한계를 뛰어넘기 위해 <b>한 우물을 파고들었던</b> 열정의 증명입니다.<br>어려운 문제에 끝까지 맞서 싸운 당신의 용기를 잊지 않겠습니다.';
            }
            
            const loInfo = calculateTierInfo(easyLevel);
            const hiInfo = calculateTierInfo(hardLevel);
            innerStabiltyComment += `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #cbf3e4; font-size: 0.95em; color: #444;">💡 <b>추억의 난이도:</b> 주로 <span style="color: ${loInfo.color}; font-weight: bold;">${loInfo.name}</span> ~ <span style="color: ${hiInfo.color}; font-weight: bold;">${hiInfo.name}</span> 난이도와 함께 치열하게 고민하셨군요. 정말 고생 많으셨습니다!</div>`;
        }
        innerComment.innerHTML = innerStabiltyComment;
    } catch (error) {
        innerComment.innerHTML = '내실 데이터를 분석하는 데 실패했습니다.';
        console.error(error);
    }
}

async function analyzeTagsForGoal(userId, goalId, chartId, tagsId, onProgress) {
    const TARGET_TAGS = GOAL_TAGS[goalId];
    
    const results = [];
    for (const tag of TARGET_TAGS) {
        const queryString = `s@${userId} (${tag.key.join(' | ')})`;
        // 프록시 통신 중 '#' 기호(URL Fragment)가 잘려나가는 것을 막기 위해 이중 인코딩(Double Encoding)을 적용합니다.
        const doubleEncodedQuery = encodeURIComponent(encodeURIComponent(queryString));
        const url = `https://solved.ac/api/v3/search/problem?query=${doubleEncodedQuery}&sort=level&direction=desc`;
        console.log(url);
        const response = await fetch(`https://cors.eu.org/${url}`);
        if (!response.ok) throw new Error(`API 통신 실패`);

        const data = await response.json();
        console.log(data);
        let rating = 0;
        data.items.forEach(problem => {rating += problem.level;});
        rating = Math.round(rating * 2 + 200 * (1 - Math.pow(0.99, data.count)));

        const tierNum = calculateRatingToTier(rating);
        const tierInfo = calculateTierInfo(tierNum);

        results.push({
            name: tag.name,
            rating: rating,
            tierInfo: tierInfo,
            keys: tag.key
        });

        await delay(300); // 프록시 서버의 과부하를 막기 위해 딜레이를 추가합니다.
        if (onProgress) onProgress();
    }

    results.sort((a, b) => b.rating - a.rating);

    const totalRating = results.reduce((sum, data) => sum + data.rating, 0);
    const avgRating = totalRating / TARGET_TAGS.length;
    
    let strongTags = [], normalTags = [], weakTags = [];
    
    results.forEach(data => {
        const relativeTagRating = avgRating === 0 ? 0 : (data.rating - avgRating) / avgRating * 100;
        
        let korTags = data.keys.map(k => `<span class="hash-tag-item">#${TAG_ENG_TO_KOR[k.slice(1)] || k.slice(1)}</span>`);
        data.hashString = korTags.join('');

        if (relativeTagRating < -10) weakTags.push(data);
        else if (relativeTagRating > 10) strongTags.push(data);
        else normalTags.push(data);
    });

    renderRadarChart(results, chartId, goalId);
    renderTagCards(strongTags, normalTags, weakTags, tagsId);
}

function renderRadarChart(results, chartId, goalId) {
    const ctx = document.getElementById(chartId).getContext('2d');
    const labels = results.map(r => r.name.replace('&nbsp;', ' '));
    const data = results.map(r => r.rating);

    if (radarChartInstances[goalId]) {
        radarChartInstances[goalId].destroy();
    }

    radarChartInstances[goalId] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: '태그별 점수 (Rating)',
                data: data,
                backgroundColor: 'rgba(11, 99, 71, 0.2)',
                borderColor: '#0b6347',
                pointBackgroundColor: '#0b6347',
                borderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderTagCards(strong, normal, weak, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<p class="subtitle">당신이 걸어온 길을 되돌아보는 소중한 기록입니다.</p>`;

    const createSection = (title, icon, items, typeClass) => {
        if(items.length === 0) return '';
        
        let cardsHTML = items.map(item => `
            <div class="tag-card">
                <span class="tag-name">${item.name}</span>
                <div class="tag-rating-container">
                    <img src="${item.tierInfo.badgeUrl}" alt="${item.tierInfo.name}" class="tag-badge-img" width="20" height="20">
                    <span class="tag-score" style="color: ${item.tierInfo.color};">${item.rating}점</span>
                </div>
                <div class="tag-hash">${item.hashString}</div>
            </div>
        `).join('');

        return `
            <div class="tag-group-section ${typeClass}">
                <h3>${icon} ${title}</h3>
                <div class="group-grid">${cardsHTML}</div>
            </div>
        `;
    };

    container.innerHTML += createSection('빛나는 훈장', '🏅', strong, 'strong');
    container.innerHTML += createSection('견고한 발판', '🧱', normal, 'normal');
    container.innerHTML += createSection('열정의 흔적', '🔥', weak, 'weak');
}

async function captureAndSave() {
    const captureArea = document.getElementById('capture-area');
    const saveBtn = document.getElementById('save-btn');
    const originalBtnText = saveBtn.innerText;
    
    // UX: 버튼 상태 변경 및 클릭 방지
    saveBtn.innerText = '이미지 생성 중... ⏳';
    saveBtn.disabled = true;

    // 1. html2canvas의 SVG 렌더링 버그(단색 네모로 나오는 현상)를 완벽히 피하기 위해
    // 캡쳐 직전에 모든 SVG를 브라우저 네이티브 Canvas를 이용해 고화질 PNG로 변환합니다.
    const images = captureArea.querySelectorAll('img');
    for (let img of images) {
        if (img.src.includes('.svg') && !img.src.startsWith('data:')) {
            try {
                const res = await fetch(img.src);
                const svgText = await res.text();
                
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, "image/svg+xml");
                const svg = doc.documentElement;
                
                // SVG 파일에 명시적인 크기가 없을 경우를 대비해 렌더링 크기를 강제 주입
                const width = img.width || img.clientWidth || 80;
                const height = img.height || img.clientHeight || 80;
                svg.setAttribute('width', width);
                svg.setAttribute('height', height);
                
                const base64 = btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))));
                const dataUrl = `data:image/svg+xml;base64,${base64}`;
                
                const pngDataUrl = await new Promise((resolve) => {
                    const tempImg = new Image();
                    tempImg.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = width * 2; // 선명한 캡쳐를 위해 해상도 2배 뻥튀기
                        canvas.height = height * 2;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    tempImg.onerror = () => resolve(dataUrl); // 실패 시 base64 SVG로 폴백
                    tempImg.src = dataUrl;
                });
                
                img.dataset.originalSrc = img.src; // 원본 복구를 위해 저장
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                    img.src = pngDataUrl;
                });
            } catch (error) {
                console.error('SVG -> PNG 변환 실패:', error);
            }
        }
    }

    // 2. CSS filter (drop-shadow) 렌더링 버그 방지를 위해 캡쳐 중 필터 임시 제거
    const userBadge = document.getElementById('user-tier-badge');
    const originalFilter = userBadge.style.filter || '';
    userBadge.style.filter = 'none';
    
    // 3. 워터마크 생성 및 추가
    const watermark = document.createElement('div');
    watermark.className = 'watermark';
    const today = new Date();
    const dateString = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    const reportTitleText = document.getElementById('report-title').innerText;
    const handleText = reportTitleText.replace('🦖 ', '').trim();
    
    watermark.innerHTML = `Recorded on ${dateString}<br><b>- ${handleText} -</b>`;
    captureArea.appendChild(watermark);

    await delay(150); // 브라우저가 화면에 이미지를 완벽하게 그릴(Paint) 때까지 잠시 대기합니다.

    // 4. html2canvas 실행
    try {
        const canvas = await html2canvas(captureArea, {
            scale: 2, // 고해상도 캡쳐
            useCORS: true,
            backgroundColor: '#f8f9fa'
        });
        
        const link = document.createElement('a');
        link.download = `Algosaurus_Archive_${handleText}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('캡쳐 실패:', error);
        alert('이미지 저장 중 오류가 발생했습니다.');
    } finally {
        // 5. 캡쳐 완료 후 화면 및 버튼 상태 원상 복구
        captureArea.removeChild(watermark);
        userBadge.style.filter = originalFilter;
        images.forEach(img => {
            if (img.dataset.originalSrc) {
                img.src = img.dataset.originalSrc;
                delete img.dataset.originalSrc;
            }
        });
        saveBtn.innerText = originalBtnText;
        saveBtn.disabled = false;
    }
}