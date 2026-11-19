// 테스트 전용. 실제 확장에서는 로드하지 않아.
const storageKey = 'algosaurus-test-storage';
const listeners = [];
const read = () => JSON.parse(localStorage.getItem(storageKey) || '{}');
window.chrome = {
    storage: {
        local: {
            async get(keys) {
                const raw = read();
                return keys === null ? raw : Object.fromEntries(keys.filter(key => key in raw).map(key => [key, raw[key]]));
            },
            async set(values) {
                const before = read();
                localStorage.setItem(storageKey, JSON.stringify({ ...before, ...values }));
                const changes = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(before[k]) !== JSON.stringify(v))
                    .map(([key, value]) => [key, { oldValue: before[key], newValue: value }]));
                for (const listener of listeners) listener(changes, 'local');
            },
        },
        onChanged: { addListener(listener) { listeners.push(listener); } },
    },
    runtime: { openOptionsPage() { window.open('/options/options.html', '_blank'); } },
};
window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    const old = JSON.parse(event.oldValue || '{}');
    const current = JSON.parse(event.newValue || '{}');
    const changes = Object.fromEntries([...new Set([...Object.keys(old), ...Object.keys(current)])]
        .filter(key => JSON.stringify(old[key]) !== JSON.stringify(current[key]))
        .map(key => [key, { oldValue: old[key], newValue: current[key] }]));
    for (const listener of listeners) listener(changes, 'local');
});
