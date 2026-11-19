import { api } from '../shared/api.js';
import { readSettings, saveSettings } from '../shared/storage.js';
import { $, LatestRequest, showError, profileText } from '../shared/ui.js';
import { calculateTierInfo, calculateRecommendTier } from '../utils.js';

const loading = new LatestRequest();
let profile;
let currentSettings;

function renderSettings() {
    for (const card of document.querySelectorAll('.goal-card')) card.classList.toggle('selected', card.dataset.value === currentSettings.goal);
    for (const card of document.querySelectorAll('.diff-card')) card.classList.toggle('selected', Number(card.dataset.value) === currentSettings.difficulty);
    $('tag-toggle').classList.toggle('custom-mode', currentSettings.mode === 'custom');
    const range = profile && calculateRecommendTier(profile.tier, currentSettings.goal, currentSettings.difficulty);
    $('expected-tier-display').textContent = range ? `${calculateTierInfo(range.lo).name} ~ ${calculateTierInfo(range.hi).name}` : '팝업에서 프로필을 먼저 조회해 줘.';
}

async function reload() {
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
    $('loading-spinner').textContent = '태그 분석은 후속 분석 기능에서 연결돼.';
    $('inner-start-box').textContent = '내실 분석은 후속 분석 기능에서 연결돼.';
    await reload();
});
