export class ApiError extends Error {
    constructor(message, code, retryAfter) {
        super(message);
        this.code = code;
        this.retryAfter = retryAfter;
    }
}

export const API_BASE = 'http://127.0.0.1:8765';

export async function request(path, params = {}, { signal, timeout = 90000 } = {}) {
    let response;
    try {
        response = await fetch(`${API_BASE}${path}?${new URLSearchParams(params)}`, {
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
            cache: 'no-store',
        });
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        if (error.name === 'TimeoutError') throw new ApiError('요청 대기 시간이 초과됐어. 조회한 페이지는 서버에 보관되니 새로고침해서 다시 시도해 줘.', 'REQUEST_TIMEOUT');
        throw new ApiError('로컬 API 서버에 연결하지 못했어. README대로 서버를 실행해 줘.', 'SERVER_UNAVAILABLE');
    }
    let data;
    try { data = await response.json(); }
    catch { throw new ApiError('서버 응답 형식이 올바르지 않아.', 'INVALID_RESPONSE'); }
    if (!response.ok) {
        const retryAfter = data.error?.retryAfter;
        const suffix = retryAfter ? ` (${retryAfter}초 후 재시도)` : '';
        throw new ApiError((data.error?.message || 'API 요청에 실패했어.') + suffix, data.error?.code, retryAfter);
    }
    return data;
}

export const api = {
    profile: (handle, options) => request('/api/profile', { handle }, options),
    analyze: async (settings, options) => {
        const result = await request('/api/analysis', settings, { ...options, timeout: 600000 });
        if (result.ratingModel !== 'legacy-tag-v1') throw new ApiError('레이팅 계산 방식이 바뀌었어. 로컬 API 서버를 재시작하고 다시 분석해 줘.', 'ANALYSIS_VERSION_MISMATCH');
        return result;
    },
    recommend: (settings, weak = false, options) => request('/api/recommend', {
        handle: settings.handle, goal: settings.goal, difficulty: settings.difficulty,
        mode: settings.mode, weak: weak ? 'true' : 'false',
    }, options),
};
