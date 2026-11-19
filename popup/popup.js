import { api } from '../shared/api.js';
import { readSettings, contextKey } from '../shared/storage.js';
import { $, LatestRequest, showError, textElement, profileText } from '../shared/ui.js';
import { calculateTierInfo, calculateRecommendTier } from '../utils.js';

const searchRequest = new LatestRequest();
const recommendationRequest = new LatestRequest();
let profile = null;
let pendingSelection = null;

function clearProfile() {
    searchRequest.cancel();
    recommendationRequest.cancel();
    profile = null;
    $('recommend-section').style.display = 'none';
    $('problem-view').replaceChildren();
}

async function search() {
    clearProfile();
    const handle = $('solvedId').value.trim();
    if (!handle) { $('result').textContent = 'solved.ac 핸들을 입력해 줘. BOJ 핸들과 다를 수 있어.'; return; }
    const request = searchRequest.start();
    $('result').textContent = '프로필 조회 중...';
    try {
        const data = await api.profile(handle, request);
        if (!request.current()) return;
        pendingSelection = data.handle;
        await chrome.storage.local.set({ solvedId: data.handle, accountVersion: 4 });
        pendingSelection = null;
        if (!request.current()) return;
        if ((await readSettings()).handle !== data.handle || !request.current()) return;
        profile = data;
        await renderProfile(request);
    } catch (error) {
        pendingSelection = null;
        if (request.current() && error.name !== 'AbortError') showError($('result'), error);
    }
}

async function renderProfile(request) {
    const data = profile;
    const settings = await readSettings(data.handle);
    if (!request.current() || data !== profile) return;
    const tier = calculateTierInfo(data.tier);
    const range = calculateRecommendTier(data.tier, settings.goal, settings.difficulty);
    $('result').replaceChildren(
        textElement('p', profileText(data)),
        textElement('p', `${tier.name} · 레이팅 ${data.rating} · 해결 ${data.solvedCount}문제`),
        textElement('p', range ? `${{ beginner: '입문', job: '취업', contest: '대회' }[settings.goal]} · ${calculateTierInfo(range.lo).name} ~ ${calculateTierInfo(range.hi).name}` : '티어 비공개: 추천 범위를 계산할 수 없어.'),
    );
    $('recommend-section').style.display = range ? 'block' : 'none';
}

async function recommend(weak) {
    if (!profile) return;
    const request = recommendationRequest.start();
    const data = profile;
    const settings = await readSettings(data.handle);
    if (!request.current()) return;
    $('problem-view').textContent = '안 푼 BOJ 문제 찾는 중...';
    try {
        const result = await api.recommend(settings, weak, request);
        const latest = await readSettings();
        if (!request.current() || profile !== data || contextKey(settings) !== contextKey(latest)) return;
        if (!result.problem) {
            $('problem-view').textContent = result.reason === 'NO_WEAK_TAGS' ? '현재 분석에서 약점 태그가 없어.' : '이 조건에 맞는 추천 문제가 없어. 난이도를 조정해 봐.';
            return;
        }
        const problem = result.problem;
        const link = textElement('a', `BOJ ${problem.bojProblemId} · ${problem.title}`, 'problem-link');
        if (!/^https:\/\/(?:www\.)?acmicpc\.net\/problem\/\d+$/.test(problem.url)) throw new Error('BOJ 문제 링크가 올바르지 않아.');
        link.href = problem.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        $('problem-view').replaceChildren(link);
    } catch (error) {
        if (request.current() && error.name !== 'AbortError') showError($('problem-view'), error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    $('loginBtn').addEventListener('click', search);
    $('solvedId').addEventListener('keydown', event => { if (event.key === 'Enter') search(); });
    $('solvedId').addEventListener('input', () => {
        clearProfile();
        $('result').textContent = '입력한 solved.ac 핸들로 조회를 눌러 줘.';
    });
    $('settingBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
    $('recommendBtn').addEventListener('click', () => recommend(false));
    $('weakRecommendBtn').addEventListener('click', () => recommend(true));
    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area !== 'local') return;
        if (changes.solvedId && changes.solvedId.newValue !== pendingSelection) {
            clearProfile();
            $('solvedId').value = changes.solvedId.newValue || '';
            $('result').textContent = '선택 계정이 바뀌었어. 조회를 눌러 줘.';
        } else if (profile && Object.keys(changes).some(key => ['goal_', 'diff_', 'mode_'].some(prefix => key === prefix + profile.handle))) {
            recommendationRequest.cancel();
            $('problem-view').textContent = '설정이 바뀌었어. 다시 추천받아 줘.';
            await renderProfile(searchRequest.start());
        }
    });
    const settings = await readSettings();
    if (settings.handle && !$('solvedId').value) {
        $('solvedId').value = settings.handle;
        await search();
    } else if (!settings.handle) {
        $('result').textContent = 'solved.ac 핸들을 입력해 줘. BOJ 핸들과 다를 수 있어.';
    }
});
