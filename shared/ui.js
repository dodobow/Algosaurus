export const $ = id => document.getElementById(id);

export class LatestRequest {
    constructor() { this.sequence = 0; }
    cancel() {
        this.sequence++;
        this.controller?.abort();
    }
    start() {
        this.cancel();
        this.controller = new AbortController();
        const sequence = this.sequence;
        return { signal: this.controller.signal, current: () => sequence === this.sequence };
    }
}

export function showError(target, error) {
    target.textContent = error.message || '처리 중 오류가 발생했어.';
    target.setAttribute('role', 'alert');
}

export function textElement(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
}

export function profileText(profile) {
    const accounts = profile.ojAccounts.filter(account => account.ojId === 'boj');
    const boj = accounts.length ? accounts.map(account => `${account.handle}${account.verified ? ' (인증됨)' : ' (미인증)'}`).join(', ') : '연결된 계정 없음';
    return `solved.ac: ${profile.handle} · BOJ: ${boj}`;
}
