let cachedUserData = null;

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginBtn');
    const inputField = document.getElementById('solvedId');
    const resultDiv = document.getElementById('result');
    const recommendButton = document.getElementById('recommendBtn');
    const recommendByWeakTagsButton = document.getElementById('weakRecommendBtn');
    const settingButton = document.getElementById('settingBtn');

    loginButton.addEventListener('click', () => handleSearch(inputField, resultDiv));

    inputField.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') handleSearch(inputField, resultDiv);
    });

    recommendButton.addEventListener('click', () => recommendProblem(cachedUserData.tier));

    recommendByWeakTagsButton.addEventListener('click', () => recommendedProblemByWeakTags(cachedUserData.tier));

    inputField.focus();

    chrome.storage.local.get(['solvedId'], (result) => {
        if (result.solvedId) {
            inputField.value = result.solvedId;
            handleSearch(inputField, resultDiv);
        }
    });

    if (settingButton) {
        settingButton.addEventListener('click', () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options/options.html'));
            }
        });
    }
});

async function handleSearch(inputField, resultDiv) {
    const userId = inputField.value;
    if (!userId) {
        alert('ID를 입력해주세요.');
        inputField.focus();
        return;
    }
    try {
        const data = await fetchSolvedData(userId);
        cachedUserData = data;
        chrome.storage.local.set({
            solvedId : data.handle,
            solvedTier : data.tier,
            solvedRating : data.rating,
            solvedCount : data.solvedCount,
            solvedRatingByProblemsSum : data.ratingByProblemsSum
        });
        
        const tierInfo = calculateTierInfo(data.tier);

        const goalKey = `goal_${data.handle}`;
        const diffKey = `diff_${data.handle}`;
        const storedData = await getStorageData([goalKey, diffKey]);

        updateResultUI(resultDiv, data, tierInfo, storedData[goalKey], storedData[diffKey]);

        const recommendSection = document.getElementById('recommend-section');
        if (recommendSection) {
            recommendSection.style.display = 'block';
        }
    } catch (error) {
        resultDiv.innerHTML = `<span style="color: red;">${error.message}</span>`;
        document.getElementById('recommend-section').style.display = 'none';
    }
}

async function fetchSolvedData(userId) {
    const url = `https://solved.ac/api/v3/user/show?handle=${userId}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('유저 정보를 가져올 수 없습니다.');
    }
    return await response.json();
}

function updateResultUI(targetDiv, userData, tierInfo, userGoal, userDiff) {
    let rightSideHtml = '';
    
    if (!userGoal) {
        rightSideHtml = `
        <div class="goal-empty">
            <span>목표를 먼저</span>
            <span>설정해주세요!</span>
        </div>`;
    } else {
        const recommendRange = calculateRecommendTier(userData.tier, userGoal, parseInt(userDiff || '0'));
        const loInfo = calculateTierInfo(recommendRange.lo);
        const hiInfo = calculateTierInfo(recommendRange.hi);
        
        const goalMap = {
            'beginner': '코딩 입문 🐣',
            'job': '취업 준비 💼',
            'contest': '대회 준비 🏆'
        };
        const goalText = goalMap[userGoal] || '목표 설정됨';

        rightSideHtml = `
        <div class="goal-profile">
            <div class="goal-label">현재 목표</div>
            <div class="goal-value">${goalText}</div>
            <div class="goal-label" style="margin-top: 6px;">추천 난이도</div>
            <div class="tier-range">
                <span style="color: ${loInfo.color}; font-weight: bold;">${loInfo.name}</span>
                <span class="range-tilde">~</span>
                <span style="color: ${hiInfo.color}; font-weight: bold;">${hiInfo.name}</span>
            </div>
        </div>`;
    }

    targetDiv.innerHTML = `
    <div class="result-layout">
        <div class="user-profile">
            <div class="user-handle">${userData.handle}</div>
            <div class="user-stat">
                레이팅 <span class="stat-value" style="color: ${tierInfo.color};">${userData.rating}</span>
            </div>
            <div class="user-stat">
                티어 <span class="stat-value" style="color: ${tierInfo.color};">${tierInfo.name}</span>
            </div>
        </div>
        <div class="result-divider"></div>
        ${rightSideHtml}
    </div>
    `;
}

async function recommendProblem(userTier) {
    const problemDiv = document.getElementById('problem-view');
    problemDiv.innerHTML = '문제 찾는 중...';
    
    try {
        const userId = cachedUserData.handle;
        const goalKey = `goal_${userId}`;
        const diffKey = `diff_${userId}`;

        const storedData = await getStorageData([goalKey, diffKey]);
        const userGoal = storedData[goalKey];
        const userDiff = storedData[diffKey] ? storedData[diffKey] : 0;

        
        const recommendRange = calculateRecommendTier(userTier, userGoal, parseInt(userDiff));
        const queryString = `*${recommendRange.lo}..${recommendRange.hi} !@$me %ko s#100..`;
        const url = `https://solved.ac/api/v3/search/problem?query=${encodeURIComponent(queryString)}&sort=random`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('문제 정보를 가져올 수 없습니다.');
        }
        const data = await response.json();

        if (data.count === 0) {
            problemDiv.innerHTML = '추천할 문제가 다 떨어졌어요 😭';
            return;
        }
        const recommendedProblem = data.items[0];
        problemDiv.innerHTML = `
            <a href="https://www.acmicpc.net/problem/${recommendedProblem.problemId}" target="_blank" class="problem-link">
                <span class="problem-id">${recommendedProblem.problemId}번</span>
                <span>${recommendedProblem.titleKo}</span>
            </a>
        `;
    } catch (error) {
        problemDiv.innerHTML = `<span style="color: red;">${error.message}</span>`;
    }
}

function getStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => {
            resolve(result);
        });
    });
}

async function recommendedProblemByWeakTags(userTier) {
    const problemDiv = document.getElementById('problem-view');
    problemDiv.innerHTML = '문제 찾는 중...';
    
    try {
        const userId = cachedUserData.handle;
        const goalKey = `goal_${userId}`;
        const diffKey = `diff_${userId}`;
        const weakTagsKey = `weakTags_${userId}`;

        const storedData = await getStorageData([goalKey, diffKey, weakTagsKey]);
        const userGoal = storedData[goalKey];
        const userDiff = storedData[diffKey] ? storedData[diffKey] : 0;
        
        let userWeakTags = storedData[weakTagsKey];
        if (userWeakTags.length === 0) {
            problemDiv.innerHTML = '약점이 없거나 아직 대시보드에서 태그 분석이 이루어지지 않았어요!';
            return;
        }
        userWeakTags.sort(() => Math.random() - 0.5);

        const recommendTag = userWeakTags[0];
        const recommendRange = calculateRecommendTier(userTier, userGoal, parseInt(userDiff));
        
        for (const tagQuery of [recommendTag, `(${userWeakTags.join(' | ')})`]) {
            const queryString = `*${recommendRange.lo}..${recommendRange.hi} ${tagQuery} !@$me %ko s#100..`;
            console.log(queryString);
            const url = `https://solved.ac/api/v3/search/problem?query=${encodeURIComponent(queryString)}&sort=random`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('문제 정보를 가져올 수 없습니다.');
            }
            const data = await response.json();
            if (data.items.length != 0) {
                const recommendedProblem = data.items[0];
                problemDiv.innerHTML = `
                    <a href="https://www.acmicpc.net/problem/${recommendedProblem.problemId}" target="_blank" class="problem-link">
                        <span class="problem-id">${recommendedProblem.problemId}번</span>
                        <span>${recommendedProblem.titleKo}</span>
                    </a>
                `;
                console.log(queryString);
                console.log(url);
                break;
            }
        }
    } catch (error) {
        problemDiv.innerHTML = `<span style="color: red;">${error.message}</span>`;
    }
}