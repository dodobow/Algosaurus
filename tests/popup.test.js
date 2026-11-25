import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
    constructor() { this.children = []; this.events = {}; this.style = {}; this.value = ''; this.attributes = {}; this.text = ''; }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(' '); }
    addEventListener(name, callback) { this.events[name] = callback; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.text = ''; this.children = children; }
    focus() {}
}

const profile = (handle = 'solved_name') => ({ id: handle === 'new_user' ? 2 : 1, handle, tier: 10, rating: 700, solvedCount: 250,
    ojAccounts: [{ ojId: 'boj', handle: 'old_boj', verified: true }] });
const recommended = { profileId: 1, handle: 'solved_name', problem: { title: '<unsafe>', url: 'https://www.acmicpc.net/problem/1000', bojProblemId: '1000' } };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let serial = 0;

async function setup(raw = {}, fetcher = async url => url.pathname === '/api/profile' ? profile(url.searchParams.get('handle')) : recommended) {
    const ids = ['solvedId', 'result', 'loginBtn', 'recommend-section', 'problem-view', 'settingBtn', 'recommendBtn', 'weakRecommendBtn'];
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    let ready;
    globalThis.document = {
        getElementById(id) { return elements[id]; },
        createElement() { return new Element(); },
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; },
    };
    const listeners = [];
    const storage = structuredClone(raw);
    globalThis.chrome = {
        storage: {
            local: {
                async get(keys) { return keys === null ? { ...storage } : Object.fromEntries(keys.filter(k => k in storage).map(k => [k, storage[k]])); },
                async set(values) {
                    const changes = {};
                    for (const [key, value] of Object.entries(values)) {
                        if (storage[key] !== value) changes[key] = { newValue: value, oldValue: storage[key] };
                        storage[key] = value;
                    }
                    for (const listener of listeners) await listener(changes, 'local');
                },
            },
            onChanged: { addListener(callback) { listeners.push(callback); } },
        },
        runtime: { openOptionsPage() {} },
    };
    globalThis.fetch = async input => {
        const data = await fetcher(new URL(input));
        return { ok: !data.error, json: async () => data };
    };
    await import(`../popup/popup.js?test=${serial++}`);
    await ready();
    return { elements, storage };
}

test('first run → profile → actual OJ link; settings invalidate the result', async () => {
    const { elements: e, storage } = await setup();
    assert.match(e.result.textContent, /아이디를 입력하고/);
    e.solvedId.value = 'solved_name';
    await e.loginBtn.events.click();
    assert.equal(e.result.children[0].className, 'result-layout');
    assert.match(e.result.children[0].children[0].children[0].title, /solved.ac: solved_name · BOJ: old_boj/);
    assert.equal(storage.solvedId, 'solved_name');
    await e.recommendBtn.events.click();
    assert.equal(e['problem-view'].children[0].href, 'https://www.acmicpc.net/problem/1000');
    assert.match(e['problem-view'].textContent, /<unsafe>/);
    await chrome.storage.local.set({ goal_solved_name: 'job' });
    assert.match(e['problem-view'].textContent, /설정이 바뀌었어/);
});

test('late profile response cannot replace a newer account', async () => {
    const first = deferred();
    const { elements: e, storage } = await setup({}, async url => url.searchParams.get('handle') === 'old_user' ? first.promise : profile('new_user'));
    e.solvedId.value = 'old_user';
    const pending = e.loginBtn.events.click();
    e.solvedId.value = 'new_user';
    await e.loginBtn.events.click();
    first.resolve(profile('old_user'));
    await pending;
    assert.equal(storage.solvedId, 'new_user');
    assert.match(e.result.textContent, /new_user/);
    assert.doesNotMatch(e.result.textContent, /old_user/);
});

test('late recommendation cannot survive a setting change', async () => {
    const recommendation = deferred();
    const { elements: e } = await setup({}, async url => url.pathname === '/api/profile' ? profile() : recommendation.promise);
    e.solvedId.value = 'solved_name';
    await e.loginBtn.events.click();
    const pending = e.recommendBtn.events.click();
    await new Promise(setImmediate);
    await chrome.storage.local.set({ diff_solved_name: 2 });
    recommendation.resolve(recommended);
    await pending;
    assert.match(e['problem-view'].textContent, /설정이 바뀌었어/);
    assert.equal(e['problem-view'].children.length, 0);
});

test('legacy account requires explicit solved.ac lookup and migrates verified BOJ settings', async () => {
    let calls = 0;
    const { elements: e, storage } = await setup({ solvedId: 'old_boj', goal_old_boj: 'job', diff_old_boj: '2' }, async () => { calls++; return profile(); });
    assert.equal(calls, 0);
    assert.match(e.result.textContent, /기존 ID는 BOJ 핸들/);
    e.solvedId.value = 'solved_name';
    await e.loginBtn.events.click();
    assert.equal(storage.goal_solved_name, 'job');
    assert.equal(storage.diff_solved_name, '2');
    assert.equal(storage.goal_old_boj, 'job');
});

test('missing analysis and rate limit are actionable errors', async () => {
    const { elements: e } = await setup({}, async url => url.pathname === '/api/profile' ? profile() :
        { error: { code: 'ANALYSIS_REQUIRED', message: '태그 분석을 먼저 실행해 줘.' } });
    e.solvedId.value = 'solved_name';
    await e.loginBtn.events.click();
    await e.weakRecommendBtn.events.click();
    assert.match(e['problem-view'].textContent, /태그 분석을 먼저/);
    globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: { code: 'UPSTREAM_429', message: '호출 제한이야.', retryAfter: 30 } }) });
    await e.recommendBtn.events.click();
    assert.match(e['problem-view'].textContent, /30초 후 재시도/);
});
