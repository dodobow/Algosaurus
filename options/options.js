import { api } from '../shared/api.js';
import { readSettings, saveSettings, contextKey } from '../shared/storage.js';
import { $, LatestRequest, showError, profileText, textElement } from '../shared/ui.js';
import { calculateTierInfo, calculateRecommendTier } from '../utils.js';

const loading = new LatestRequest();
const analysis = new LatestRequest();
let profile;
let currentSettings;

function resetAnalysis() {
    analysis.cancel();
    $('analyze-btn').disabled = false;
    $('analysis-result').style.display = 'none';
    $('inner-result').style.display = 'none';
    $('inner-loading').style.display = 'none';
    $('loading-spinner').style.display = 'block';
    $('loading-spinner').textContent = '현재 계정·설정으로 분석하기를 눌러 줘.';
    $('inner-start-box').style.display = 'block';
    $('inner-start-box').textContent = '태그 분석과 함께 계산해.';
}

async function analyze() {
    if (!profile) return;
    const request = analysis.start();
    const settings = { ...currentSettings };
    const profileId = profile.id;
    $('analyze-btn').disabled = true;
    $('analysis-result').style.display = 'none';
    $('inner-result').style.display = 'none';
    $('inner-start-box').style.display = 'none';
    $('loading-spinner').style.display = 'block';
    $('loading-spinner').textContent = '태그·내실 분석 중...';
    try {
        const result = await api.analyze(settings, request);
        const latest = await readSettings();
        if (!request.current() || profile?.id !== profileId || contextKey(settings) !== contextKey(latest)) return;
        if (result.profileId !== profileId || result.handle !== settings.handle) throw new Error('조회 중 계정 정보가 바뀌었어. 프로필을 다시 조회해 줘.');
        renderAnalysis(result);
    } catch (error) {
        if (request.current() && error.name !== 'AbortError') {
            showError($('loading-spinner'), error);
            $('inner-start-box').style.display = 'block';
            $('inner-start-box').textContent = '분석에 실패해서 내실 점수를 표시하지 않았어.';
        }
    } finally {
        if (request.current()) $('analyze-btn').disabled = false;
    }
}

function renderAnalysis(result) {
    const insufficient = result.groups.every(group => group.category === 'insufficient');
    $('normal-group-title').textContent = insufficient ? '판단할 데이터 부족' : '⚖️ 균형 태그';
    for (const category of ['strong', 'normal', 'weak']) $(`grid-${category}`).replaceChildren();
    for (const group of result.groups) {
        const category = group.category === 'insufficient' ? 'normal' : group.category;
        const card = textElement('div', '', `tag-card ${category}`);
        card.append(textElement('strong', group.name, 'tag-name'),
            textElement('p', `난이도합 ${group.score} · ${group.count}세트`),
            textElement('p', group.officialRating === null ? (group.keys.length > 1 ? '복합 그룹: 별도 공식 레이팅 없음' : '공식 태그 레이팅: 데이터 없음') : `공식 태그 레이팅 ${group.officialRating}`),
            textElement('small', group.keys.map(key => '#' + key).join(' ')));
        $(`grid-${category}`).append(card);
    }
    $('analysis-comment').textContent = insufficient ? '레이팅 대상 풀이가 없어 강점·약점을 판단할 수 없어.' :
        '그룹 평균 난이도합 대비 ±10%를 기준으로 분류했어. 약점 추천은 이 계정·목표·난이도·모드에서 15분간 사용할 수 있어.';
    $('loading-spinner').style.display = 'none';
    $('analysis-result').style.display = 'block';
    const inner = result.inner;
    $('inner-rating-text').textContent = inner.status === 'ok' && Number.isFinite(inner.score) ? `${inner.score}%` : '데이터 부족';
    $('inner-comment').textContent = inner.status === 'ok' ?
        `상위 100세트와 다음 100세트의 난이도 균형 지표야. 보충 추천 범위: ${calculateTierInfo(inner.range.lo).name} ~ ${calculateTierInfo(inner.range.hi).name}` :
        `레이팅 대상 고유 세트가 ${inner.count}개야. 200개 이상일 때 계산할 수 있어.`;
    $('inner-result').style.display = 'block';
}

function renderSettings() {
    for (const card of document.querySelectorAll('.goal-card')) card.classList.toggle('selected', card.dataset.value === currentSettings.goal);
    for (const card of document.querySelectorAll('.diff-card')) card.classList.toggle('selected', Number(card.dataset.value) === currentSettings.difficulty);
    $('tag-toggle').classList.toggle('custom-mode', currentSettings.mode === 'custom');
    const range = profile && calculateRecommendTier(profile.tier, currentSettings.goal, currentSettings.difficulty);
    $('expected-tier-display').textContent = range ? `${calculateTierInfo(range.lo).name} ~ ${calculateTierInfo(range.hi).name}` : '팝업에서 프로필을 먼저 조회해 줘.';
}

async function reload() {
    resetAnalysis();
    const request = loading.start();
    profile = null;
    const settings = await readSettings();
    if (!request.current()) return;
    currentSettings = settings;
    renderSettings();
    if (!currentSettings.handle) {
        $('dashboard-title').textContent = '팝업에서 solved.ac 계정을 설정해 줘.';
        return;
    }
    const raw = await chrome.storage.local.get(['accountVersion']);
    if (!request.current()) return;
    if (raw.accountVersion !== 4) {
        $('dashboard-title').textContent = '기존 BOJ ID를 그대로 가정하지 않아. 팝업에서 solved.ac 핸들을 확인하고 조회해 줘.';
        return;
    }
    $('dashboard-title').textContent = '프로필 조회 중...';
    try {
        const data = await api.profile(currentSettings.handle, request);
        if (!request.current()) return;
        profile = data;
        $('dashboard-title').textContent = profileText(profile);
        renderSettings();
    } catch (error) {
        if (request.current() && error.name !== 'AbortError') showError($('dashboard-title'), error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    for (const card of document.querySelectorAll('.goal-card, .diff-card')) {
        card.addEventListener('click', async () => {
            if (!currentSettings?.handle) return;
            const changes = card.classList.contains('goal-card') ? { goal: card.dataset.value } : { difficulty: Number(card.dataset.value) };
            await saveSettings(currentSettings.handle, changes);
        });
    }
    $('tag-toggle').addEventListener('click', async () => {
        if (currentSettings?.handle) await saveSettings(currentSettings.handle, { mode: currentSettings.mode === 'custom' ? 'default' : 'custom' });
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.solvedId || Object.keys(changes).some(key => /^(goal|diff|mode)_/.test(key)))) reload();
    });
    $('analyze-btn').addEventListener('click', analyze);
    await reload();
});
