export class ApiError extends Error {
    constructor(message, code, retryAfter) {
        super(message);
        this.code = code;
        this.retryAfter = retryAfter;
    }
}

export const API_BASE = 'http://127.0.0.1:8765';

export async function request(path, params = {}, { signal } = {}) {
    let response;
    try {
        response = await fetch(`${API_BASE}${path}?${new URLSearchParams(params)}`, {
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000),
            cache: 'no-store',
        });
    } catch (error) {
        if (error.name === 'AbortError') throw error;
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
};
