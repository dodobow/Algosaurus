export function calculateTierInfo(tier) {
    if (!Number.isInteger(tier) || tier < 0 || tier > 31) return { name: '티어 비공개', color: '#666' };
    const colors = [
        '#000000',
        '#ad5600', '#b85b00', '#c46100', '#cf6700', '#db6c00',
        '#435f7a', '#476582', '#4b6b8a', '#507292', '#54789a',
        '#ec9a00', '#fba400', '#ffae00', '#ffb800', '#ffc300',
        '#25d69b', '#27e2a4', '#28edac', '#2af8b4', '#2cffbc',
        '#00b4fc', '#00c0ff', '#00ccff', '#00d8ff', '#00e4ff',
        '#cc004e', '#dd0054', '#ee005b', '#ff0062', '#ff0068', '#AC9FFF',
    ];
    const name = tier === 0 ? 'Unrated' : tier === 31 ? 'Master' :
        `${['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ruby'][Math.floor((tier - 1) / 5)]} ${['V', 'IV', 'III', 'II', 'I'][(tier - 1) % 5]}`;
    return { name, color: colors[tier], badgeUrl: new URL(`./assets/tiers/${tier}.svg`, import.meta.url).href };
}

export function calculateRatingToTier(rating) {
    if (!Number.isFinite(rating) || rating < 0) return null;
    const thresholds = [0, 30, 60, 90, 120, 150, 200, 300, 400, 500, 650,
        800, 950, 1100, 1250, 1400, 1600, 1750, 1900, 2000, 2100,
        2200, 2300, 2400, 2500, 2600, 2700, 2800, 2850, 2900, 2950, 3000];
    for (let tier = thresholds.length - 1; tier >= 0; tier--) if (rating >= thresholds[tier]) return tier;
    return 0;
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
