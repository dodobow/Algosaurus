import test from 'node:test';
import assert from 'node:assert/strict';

class Element {
    constructor() {
        this.children = []; this.events = {}; this.style = {}; this.text = '';
        this.classList = { toggle() {} };
    }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(' '); }
    addEventListener(name, callback) { this.events[name] = callback; }
    setAttribute() {}
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.text = ''; this.children = children; }
}

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
const result = (handle, mode = 'default', goal = 'contest') => ({ ratingModel: 'legacy-tag-v1', profileId: handle === 'other' ? 2 : 1, handle,
    settings: { mode, goal, difficulty: 0 }, groups: [], inner: { status: 'insufficient', score: null, count: 0 } });
let serial = 0;

async function setup(t, fetcher) {
    const ids = ['analysis-result', 'inner-result', 'inner-start-box', 'loading-spinner', 'inner-loading', 'status-msg',
        'expected-tier-display', 'dashboard-title', 'tag-toggle', 'grid-strong', 'grid-normal', 'grid-weak',
        'analysis-comment', 'inner-comment', 'inner-rating-text', 'refresh-inner-btn'];
    const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
    let ready;
    globalThis.document = {
        getElementById: id => elements[id], createElement: () => new Element(), querySelectorAll: () => [],
        addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; },
    };
    const storage = { solvedId: 'solved_name', accountVersion: 4 };
    const listeners = [], calls = [], timers = new Map();
    let timerId = 0;
    const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
    globalThis.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
    globalThis.clearTimeout = id => timers.delete(id);
    t.after(() => { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; });
    globalThis.chrome = { storage: {
        local: {
            async get() { return { ...storage }; },
            async set(values) {
                const changes = {};
                for (const [key, value] of Object.entries(values)) {
                    if (storage[key] !== value) changes[key] = { oldValue: storage[key], newValue: value };
                    storage[key] = value;
                }
                for (const listener of listeners) await listener(changes, 'local');
            },
        }, onChanged: { addListener(callback) { listeners.push(callback); } },
    } };
    globalThis.fetch = async (input, options) => {
        const url = new URL(input);
        calls.push({ url, signal: options.signal });
        const data = url.pathname === '/api/profile' ? { id: url.searchParams.get('handle') === 'other' ? 2 : 1,
            handle: url.searchParams.get('handle'), tier: 10, rating: 700, solvedCount: 250, ojAccounts: [] } : await fetcher(url);
        return { ok: !data.error, json: async () => data };
    };
    await import(`../options/options.js?test=${serial++}`);
    await ready();
    async function runTimers() {
        const pending = [...timers.values()];
        timers.clear();
        for (const callback of pending) callback();
        await tick();
    }
    return { elements, calls, runTimers, searches: () => calls.filter(call => call.url.pathname === '/api/analysis') };
}

test('difficulty and default goal changes keep the completed dashboard without another analysis', async t => {
    const { elements: e, runTimers, searches } = await setup(t, async () => result('solved_name'));
    await runTimers();
    assert.equal(e['analysis-result'].style.display, 'block');
    const comment = e['analysis-comment'].textContent;
    await chrome.storage.local.set({ diff_solved_name: 2, goal_solved_name: 'job' });
    await runTimers();
    assert.equal(searches().length, 1);
    assert.equal(e['analysis-result'].style.display, 'block');
    assert.equal(e['analysis-comment'].textContent, comment);
});

test('difficulty changes keep an in-flight analysis and allow its result to render', async t => {
    const pending = deferred();
    const { elements: e, runTimers, searches } = await setup(t, () => pending.promise);
    await runTimers();
    await chrome.storage.local.set({ diff_solved_name: -2 });
    await runTimers();
    assert.equal(searches().length, 1);
    assert.equal(searches()[0].signal.aborted, false);
    pending.resolve(result('solved_name'));
    await tick();
    assert.equal(e['analysis-result'].style.display, 'block');
});

test('dashboard sorting follows displayed ratings rather than the raw difficulty sums', async t => {
    const { elements: e, runTimers } = await setup(t, async () => ({ ...result('solved_name'), groups: [
        { name: 'raw-high', keys: ['dp'], category: 'normal', score: 800, rating: 900, officialRating: 900 },
        { name: 'rating-high', keys: ['impl'], category: 'normal', score: 500, rating: 1200, officialRating: 1200 },
    ] }));
    await runTimers();
    const cards = e['grid-normal'].children;
    assert.equal(cards[0].children[1].children[1].textContent, '1200');
    assert.equal(cards[1].children[1].children[1].textContent, '900');
});

test('mode and account changes invalidate late analysis responses', async t => {
    const old = deferred(), custom = deferred(), other = deferred();
    const { elements: e, runTimers, searches } = await setup(t, url => url.searchParams.get('handle') === 'other' ? other.promise :
        url.searchParams.get('mode') === 'custom' ? custom.promise : old.promise);
    await runTimers();
    await chrome.storage.local.set({ mode_solved_name: true });
    await runTimers();
    assert.equal(searches()[0].signal.aborted, true);
    old.resolve(result('solved_name'));
    await tick();
    assert.equal(e['analysis-result'].style.display, 'none');
    await chrome.storage.local.set({ solvedId: 'other' });
    await runTimers();
    assert.equal(searches()[1].signal.aborted, true);
    custom.resolve(result('solved_name', 'custom'));
    await tick();
    assert.equal(e['analysis-result'].style.display, 'none');
    other.resolve(result('other'));
    await tick();
    assert.equal(e['analysis-result'].style.display, 'block');
    assert.match(e['dashboard-title'].textContent, /other/);
});

test('rapid custom goals coalesce before starting analysis; latest goal wins', async t => {
    const { runTimers, searches } = await setup(t, async url => result('solved_name', url.searchParams.get('mode'), url.searchParams.get('goal')));
    await chrome.storage.local.set({ mode_solved_name: true, goal_solved_name: 'job' });
    await chrome.storage.local.set({ goal_solved_name: 'beginner' });
    await runTimers();
    assert.equal(searches().length, 1);
    assert.equal(searches()[0].url.searchParams.get('goal'), 'beginner');
});

test('an upstream error stays an error; an explicit retry succeeds without changing the UI', async t => {
    let attempts = 0;
    const { elements: e, runTimers, searches } = await setup(t, async () => ++attempts === 1 ?
        { error: { code: 'UPSTREAM_429', message: 'solved.ac 호출 제한', retryAfter: 30 } } : result('solved_name'));
    await runTimers();
    assert.equal(e['analysis-result'].style.display, 'none');
    assert.match(e['loading-spinner'].textContent, /30초 후 재시도/);
    await e['refresh-inner-btn'].events.click();
    assert.equal(e['analysis-result'].style.display, 'block');
    await chrome.storage.local.set({ diff_solved_name: 1 });
    await runTimers();
    assert.equal(searches().length, 2);
});
