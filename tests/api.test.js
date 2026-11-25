import test from 'node:test';
import assert from 'node:assert/strict';
import { api, request } from '../shared/api.js';

test('old analysis servers require a restart instead of displaying the previous metric', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ groups: [] }) });
    await assert.rejects(api.analyze({ handle: 'test' }), error => error.code === 'ANALYSIS_VERSION_MISMATCH');
});

test('restored rating results keep the request settings and make one fetch', async () => {
    let calls = 0;
    const settings = { handle: 'test', goal: 'job', difficulty: 2, mode: 'custom' };
    globalThis.fetch = async input => {
        calls++;
        assert.equal(new URL(input).searchParams.get('difficulty'), '2');
        return { ok: true, json: async () => ({ ratingModel: 'legacy-tag-v1', settings }) };
    };
    assert.deepEqual((await api.analyze(settings)).settings, settings);
    assert.equal(calls, 1);
});

test('a timeout reports a timeout rather than claiming the local server is unavailable', async () => {
    globalThis.fetch = async () => { throw new DOMException('timed out', 'TimeoutError'); };
    await assert.rejects(request('/api/analysis'), error => error.code === 'REQUEST_TIMEOUT');
});

test('cancelling an analysis remains an AbortError with no automatic retry', async () => {
    let calls = 0;
    globalThis.fetch = async (_input, { signal }) => {
        calls++;
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    };
    const controller = new AbortController();
    const pending = api.analyze({ handle: 'test' }, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(calls, 1);
});
