export function calculateTierInfo(tier) {
    if (!Number.isInteger(tier) || tier < 0 || tier > 31) return { name: '티어 비공개', color: '#666' };
    const colors = ['#666', '#ad5600', '#435f7a', '#ec9a00', '#25b684', '#009fd6', '#dd0054', '#8975db'];
    const name = tier === 0 ? 'Unrated' : tier === 31 ? 'Master' :
        `${['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby'][Math.floor((tier - 1) / 5)]} ${['V', 'IV', 'III', 'II', 'I'][(tier - 1) % 5]}`;
    return { name, color: colors[tier === 31 ? 7 : tier === 0 ? 0 : Math.floor((tier - 1) / 5) + 1] };
}

export function calculateRecommendTier(tier, goal, difficulty = 0) {
    if (!Number.isInteger(tier) || tier < 0 || tier > 31) return null;
    const offset = Number.isInteger(difficulty) ? Math.max(-2, Math.min(2, difficulty)) : 0;
    let lo = Math.max(1, Math.floor(tier / 2));
    let hi = lo + Math.floor(tier / 5) + 2;
    if (goal === 'beginner') { lo = 1; hi = Math.min(hi, 10); }
    if (goal === 'job') { lo = Math.min(lo, 8); hi = Math.min(hi, 15); }
    lo = Math.max(1, Math.min(30, lo + offset));
    hi = Math.max(lo, Math.min(30, hi + offset));
    return { lo, hi };
}
