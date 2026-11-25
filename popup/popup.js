import { api } from '../shared/api.js';
import { readSettings, contextKey, accountSelection } from '../shared/storage.js';
import { $, LatestRequest, showError } from '../shared/ui.js';
import { renderProfileCard, problemLink } from '../shared/presentation.js';
import { calculateRecommendTier } from '../utils.js';

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
        const previous = await chrome.storage.local.get(null);
        if (!request.current()) return;
        await chrome.storage.local.set(accountSelection(data, previous));
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
    const [settings, raw] = await Promise.all([readSettings(data.handle), chrome.storage.local.get([`goal_${data.handle}`])]);
    if (!request.current() || data !== profile) return;
    const range = calculateRecommendTier(data.tier, settings.goal, settings.difficulty);
    renderProfileCard($('result'), data, settings, ['beginner', 'job', 'contest'].includes(raw[`goal_${data.handle}`]));
    $('recommend-section').style.display = range ? 'block' : 'none';
}

async function recommend(weak) {
    if (!profile) return;
    const request = recommendationRequest.start();
    const data = profile;
    const settings = await readSettings(data.handle);
    if (!request.current()) return;
    $('problem-view').textContent = '문제 찾는 중...';
    try {
        const result = await api.recommend(settings, weak, request);
        const latest = await readSettings();
        if (!request.current() || profile !== data || contextKey(settings) !== contextKey(latest)) return;
        if (!result.problem) {
            $('problem-view').textContent = result.reason === 'NO_WEAK_TAGS' ? '현재 분석에서 약점 태그가 없어.' :
                result.reason === 'NO_WEAK_RESULTS' ? '이번에 검색한 약점 태그(최대 3개)에 맞는 문제가 없어. 난이도를 조정해 봐.' :
                    '이번 검색에서 열 수 있는 추천 문제가 없어. 난이도를 조정하거나 다시 추천받아 줘.';
            return;
        }
        const problem = result.problem;
        if (result.profileId !== data.id || result.handle !== data.handle) throw new Error('조회 중 계정 정보가 바뀌었어. 프로필을 다시 조회해 줘.');
        $('problem-view').replaceChildren(problemLink(problem));
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
        const raw = await chrome.storage.local.get(['accountVersion']);
        if (raw.accountVersion === 4) await search();
        else $('result').textContent = '기존 ID는 BOJ 핸들일 수 있어. solved.ac 핸들을 확인하고 조회를 눌러 줘. 목표·난이도 설정은 보존돼.';
    } else if (!settings.handle) {
        $('result').replaceChildren(document.createElement('span'));
        $('result').children[0].textContent = '아이디를 입력하고';
        $('result').append(document.createElement('br'), document.createElement('span'));
        $('result').children[2].textContent = '티어를 확인해보세요!';
    }
    $('solvedId').title = 'solved.ac 핸들을 입력해 주세요. BOJ 핸들과 다를 수 있습니다.';
    $('solvedId').focus();
});
