import { api } from '../shared/api.js';
import { readSettings, normalizeSettings, saveSettings, contextKey } from '../shared/storage.js';
import { $, LatestRequest, showError, profileText, textElement } from '../shared/ui.js';
import { renderRange, tagCard, renderInner, GROUP_LABELS } from '../shared/presentation.js';
import { calculateTierInfo, calculateRecommendTier } from '../utils.js';

const loading = new LatestRequest();
const analysis = new LatestRequest();
let profile = null;
let currentSettings;
let selectedGoal = false;
let analysisTimer;

const GOAL_MESSAGES = {
    beginner: '코딩 입문을 위해서는 간단한 브론즈, 실버 문제를 풀며 문법에 익숙해지는 과정이 중요해요!',
    job: '코딩테스트의 안정적인 합격을 위해서는 어려운 실버 문제와 골드 문제들을 푸는 연습이 필요해요!',
    contest: '대규모 대회 수상이 목적이라면, 골드는 물론이고 플레티넘 문제들도 풀 수 있어야 해요!',
};

function spinner(target, text) {
    target.replaceChildren(textElement('div', '', 'spinner'), textElement('p', text));
    target.style.display = 'block';
}

function resetAnalysis() {
    clearTimeout(analysisTimer);
    analysis.cancel();
    $('analysis-result').style.display = 'none';
    $('inner-result').style.display = 'none';
    $('inner-start-box').style.display = 'none';
    spinner($('loading-spinner'), '데이터 분석 중...');
    spinner($('inner-loading'), '내 진짜 실력을 파헤치는 중...');
}

function renderSettings() {
    for (const card of document.querySelectorAll('.goal-card')) card.classList.toggle('selected', selectedGoal && card.dataset.value === currentSettings.goal);
    for (const card of document.querySelectorAll('.diff-card')) card.classList.toggle('selected', Number(card.dataset.value) === currentSettings.difficulty);
    $('tag-toggle').classList.toggle('custom-mode', currentSettings.mode === 'custom');
    $('status-msg').textContent = selectedGoal ? GOAL_MESSAGES[currentSettings.goal] : '';
    if (!profile) $('expected-tier-display').textContent = '팝업에서 계정 연동을 먼저 진행해주세요!';
    else if (!selectedGoal) $('expected-tier-display').textContent = '목표를 먼저 선택해주세요!';
    else renderRange($('expected-tier-display'), calculateRecommendTier(profile.tier, currentSettings.goal, currentSettings.difficulty));
}

function renderAnalysis(result) {
    for (const category of ['strong', 'normal', 'weak']) $(`grid-${category}`).replaceChildren();
    const labels = GROUP_LABELS[result.settings.mode === 'custom' ? result.settings.goal : 'default'];
    const groups = result.groups.map((group, index) => ({ ...group, label: labels[index] || group.name }));
    const insufficient = groups.every(group => group.category === 'insufficient');
    if (!insufficient) {
        const displayValue = group => result.settings.mode === 'default' && Number.isFinite(group.officialRating) ? group.officialRating : group.score;
        for (const group of [...groups].sort((a, b) => displayValue(b) - displayValue(a))) {
            const category = ['strong', 'weak'].includes(group.category) ? group.category : 'normal';
            $(`grid-${category}`).append(tagCard(group, group.label, result.settings.mode));
        }
    }
    const weak = groups.filter(group => group.category === 'weak').map(group => group.label);
    const strong = groups.filter(group => group.category === 'strong').map(group => group.label);
    const comment = $('analysis-comment');
    comment.replaceChildren();
    if (insufficient) comment.textContent = '레이팅 대상 풀이가 없어 강점과 약점을 판단할 수 없습니다.';
    else if (weak.length && strong.length) comment.append(textElement('span', '🔥 '), textElement('b', weak.join(', ')),
        textElement('span', ' 보완이 필요하지만,'), document.createElement('br'), textElement('span', '💪 '),
        textElement('b', strong.join(', ')), textElement('span', ' 분야는 훌륭해요!'));
    else if (weak.length) comment.append(textElement('span', '🔥 '), textElement('b', weak.join(', ')), textElement('span', ' 보완이 필요해요!'));
    else if (strong.length) comment.append(textElement('span', '💪 '), textElement('b', strong.join(', ')), textElement('span', ' 분야에서 강점을 보이고 있어요!'));
    else comment.textContent = '⚖️ 모든 태그가 놀라울 정도로 균형 잡혀 있어요!';
    comment.title = '강점·약점은 그룹 평균 난이도합 대비 ±10%로 분류합니다. 태그군 중첩의 영향을 받는 자체 지표입니다.';
    $('loading-spinner').style.display = 'none';
    $('analysis-result').style.display = 'block';
    renderInner($('inner-comment'), $('inner-rating-text'), result.inner);
    $('inner-loading').style.display = 'none';
    $('inner-result').style.display = 'block';
}

async function analyze() {
    if (!profile) return;
    const request = analysis.start();
    const settings = { ...currentSettings };
    const account = profile;
    try {
        const result = await api.analyze(settings, request);
        const latest = await readSettings();
        if (!request.current() || profile !== account || contextKey(settings) !== contextKey(latest)) return;
        if (result.profileId !== account.id || result.handle !== settings.handle) throw new Error('계정 정보가 변경되었습니다. 프로필을 다시 조회해주세요.');
        renderAnalysis(result);
    } catch (error) {
        if (request.current() && error.name !== 'AbortError') {
            showError($('loading-spinner'), error);
            showError($('inner-loading'), error);
        }
    }
}

async function reload() {
    resetAnalysis();
    const request = loading.start();
    const raw = await chrome.storage.local.get(null);
    if (!request.current()) return;
    currentSettings = normalizeSettings(raw);
    selectedGoal = ['beginner', 'job', 'contest'].includes(raw[`goal_${currentSettings.handle}`]);
    if (profile?.handle !== currentSettings.handle) profile = null;
    renderSettings();
    if (!currentSettings.handle || raw.accountVersion !== 4) {
        $('dashboard-title').textContent = '팝업에서 solved.ac 계정을 먼저 연동해주세요.';
        $('loading-spinner').textContent = 'solved.ac 핸들은 BOJ 핸들과 다를 수 있습니다.';
        $('inner-loading').style.display = 'none';
        return;
    }
    try {
        const data = profile || await api.profile(currentSettings.handle, request);
        if (!request.current()) return;
        profile = data;
        const handle = textElement('span', data.handle);
        Object.assign(handle.style, { color: calculateTierInfo(data.tier).color, fontWeight: 'bold' });
        $('dashboard-title').replaceChildren(textElement('span', '✈️ '), handle, textElement('span', ' 님의 목표는 무엇인가요?'));
        $('dashboard-title').title = profileText(data);
        renderSettings();
        analysisTimer = setTimeout(analyze, 300);
    } catch (error) {
        if (request.current() && error.name !== 'AbortError') {
            showError($('dashboard-title'), error);
            showError($('loading-spinner'), error);
            $('inner-loading').style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    for (const card of document.querySelectorAll('.goal-card, .diff-card')) {
        card.addEventListener('click', async () => {
            if (!currentSettings?.handle) return;
            await saveSettings(currentSettings.handle, card.classList.contains('goal-card') ? { goal: card.dataset.value } : { difficulty: Number(card.dataset.value) });
        });
    }
    $('tag-toggle').addEventListener('click', async () => {
        if (currentSettings?.handle) await saveSettings(currentSettings.handle, { mode: currentSettings.mode === 'custom' ? 'default' : 'custom' });
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.solvedId || Object.keys(changes).some(key => ['goal_', 'diff_', 'mode_'].some(prefix => key === prefix + currentSettings?.handle)))) return reload();
    });
    $('refresh-inner-btn').addEventListener('click', () => { resetAnalysis(); return analyze(); });
    await reload();
});
