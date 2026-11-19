export function normalizeSettings(raw, handle = raw.solvedId || '') {
    const goal = raw[`goal_${handle}`];
    const diff = Number(raw[`diff_${handle}`] ?? 0);
    return {
        handle,
        goal: ['beginner', 'job', 'contest'].includes(goal) ? goal : 'contest',
        difficulty: Number.isInteger(diff) ? Math.max(-2, Math.min(2, diff)) : 0,
        mode: raw[`mode_${handle}`] === true ? 'custom' : 'default',
    };
}

export function contextKey(settings) {
    return JSON.stringify([settings.handle, settings.goal, settings.difficulty, settings.mode]);
}

export function accountSelection(profile, raw) {
    const values = { solvedId: profile.handle, accountVersion: 4 };
    const old = raw.solvedId;
    const linked = profile.ojAccounts.some(account => account.ojId === 'boj' && account.verified === true &&
        account.handle.toLowerCase() === String(old).toLowerCase());
    if (raw.accountVersion !== 4 && old && old !== profile.handle && linked) {
        for (const prefix of ['goal_', 'diff_', 'mode_']) {
            if (raw[prefix + profile.handle] === undefined && raw[prefix + old] !== undefined) {
                values[prefix + profile.handle] = raw[prefix + old];
            }
        }
    }
    return values;
}

export async function readSettings(handle) {
    const raw = await chrome.storage.local.get(null);
    return normalizeSettings(raw, handle ?? raw.solvedId ?? '');
}

export async function saveSettings(handle, changes) {
    const names = { goal: 'goal', difficulty: 'diff', mode: 'mode' };
    const values = {};
    for (const [key, value] of Object.entries(changes)) {
        if (names[key]) values[`${names[key]}_${handle}`] = key === 'mode' ? value === 'custom' : value;
    }
    await chrome.storage.local.set(values);
}
