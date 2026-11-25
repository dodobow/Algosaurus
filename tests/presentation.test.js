import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderProfileCard, problemLink, tagCard, renderInner } from '../shared/presentation.js';
import { calculateTierInfo, calculateRatingToTier } from '../utils.js';

class Element {
    constructor(tag = 'div') { this.tagName = tag; this.style = {}; this.children = []; this.text = ''; }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.text = ''; this.children = children; }
}
globalThis.document = { createElement: tag => new Element(tag) };
const account = { handle: 'solved_name', tier: 21, rating: 2224, ojAccounts: [{ ojId: 'boj', handle: 'different_boj', verified: true }] };
const settings = { goal: 'job', difficulty: 1 };

test('profile keeps the original two-column card, goal prompt and colors', () => {
    const target = new Element();
    renderProfileCard(target, account, settings, false);
    const layout = target.children[0];
    assert.equal(layout.className, 'result-layout');
    assert.deepEqual(layout.children.map(child => child.className), ['user-profile', 'result-divider', 'goal-empty']);
    assert.match(layout.children[2].textContent, /My Page에서목표를 먼저설정해주세요!/);
    assert.match(layout.children[0].children[0].title, /different_boj/);
    assert.equal(layout.children[0].children[1].children[1].style.color, '#00b4fc');
    renderProfileCard(target, account, settings, true);
    assert.equal(target.children[0].children[2].className, 'goal-profile');
    assert.match(target.textContent, /현재 목표취업 준비 💼추천 난이도Silver II ~ Platinum V/);
});

test('problem card retains its two spans and uses the provided OJ URL', () => {
    const link = problemLink({ bojProblemId: '1000', title: '<script>', url: 'https://www.acmicpc.net/problem/1000' });
    assert.equal(link.href, 'https://www.acmicpc.net/problem/1000');
    assert.equal(link.children[0].className, 'problem-id');
    assert.equal(link.children[0].textContent, '1000번');
    assert.equal(link.children[1].textContent, '<script>');
    assert.throws(() => problemLink({ url: 'https://evil.example' }));
});

test('tag cards keep tier badges and Korean tags inside the original hover tooltip', () => {
    const group = { name: '구현', category: 'weak', keys: ['impl'], score: 648, count: 50, officialRating: 1495, rating: 1423, ratingCount: 100 };
    const card = tagCard(group, '구현', 'default');
    assert.equal(card.children[0].className, 'tag-name');
    assert.equal(card.children[1].children[0].tagName, 'img');
    assert.equal(card.children[1].children[1].textContent, '1495');
    assert.equal(card.children[2].className, 'tag-tooltip');
    assert.match(card.children[2].textContent, /#구현/);
    const custom = tagCard(group, '구현', 'custom');
    assert.equal(custom.children[1].children[1].textContent, '1423');
    assert.match(custom.children[2].textContent, /공식 레이팅 아님/);
    assert.match(custom.children[1].children[0].src, /tiers\/15.svg$/);
    assert.equal(custom.children[1].children[0].alt, '맞춤 태그 레이팅 Gold I');
    assert.equal(custom.children[1].children[1].style.color, calculateTierInfo(15).color);
    assert.match(custom.children[2].textContent, /기존 맞춤 레이팅/);
});

test('basic and custom ratings share the original tier thresholds, with no average-difficulty conversion', () => {
    for (const rating of [0, 29, 30, 649, 650, 799, 800, 937, 1423, 1709, 3200]) {
        const group = { name: '태그', category: 'normal', keys: ['dp'], score: 444, count: 28, rating, ratingCount: 28, officialRating: rating };
        const basic = tagCard(group, '', 'default'), custom = tagCard(group, '', 'custom');
        assert.equal(custom.children[1].children[0].src, basic.children[1].children[0].src);
        assert.equal(custom.children[1].children[1].textContent, String(rating));
        assert.equal(custom.children[1].children[1].style.color, basic.children[1].children[1].style.color);
        assert.doesNotMatch(custom.textContent, /평균 문제 난이도/);
    }
    const capped = tagCard({ keys: [], rating: 2000, ratingCount: 597, ratingCountCapped: true }, '', 'custom');
    assert.match(capped.textContent, /597개 이상/);
});

test('old or malformed custom data cannot silently fall back to a raw sum or average', () => {
    for (const rating of [undefined, NaN, Infinity, -1, 1.5]) {
        const card = tagCard({ name: '태그', keys: [], score: 791, count: 50, rating }, '', 'custom');
        assert.match(card.children[1].children[0].src, /tiers\/0.svg$/);
        assert.equal(card.children[1].children[1].textContent, '—');
        assert.doesNotMatch(card.textContent, /NaN|Infinity/);
    }
});

test('inner score uses the original text slot and never turns missing data into a number', () => {
    const comment = new Element(), score = new Element();
    renderInner(comment, score, { status: 'ok', score: 87.87, range: { lo: 14, hi: 17 } });
    assert.equal(score.textContent, '87.87');
    assert.match(comment.textContent, /적당한 균형/);
    renderInner(comment, score, { status: 'insufficient', score: null });
    assert.equal(score.textContent, '무한한 가능성이 있어요!');
    assert.doesNotMatch(score.textContent, /NaN|Infinity/);
});

test('original CSS bytes and static option layout stay unchanged', () => {
    const contract = JSON.parse(readFileSync(new URL('./data/ui-baseline.json', import.meta.url), 'utf8'));
    for (const [path, expected] of Object.entries(contract.css)) {
        assert.equal(createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex'), expected, path);
    }
    const clean = html => html.replace(/<script\b[^>]*><\/script>/g, '').replace(/\s+/g, ' ').trim();
    const html = readFileSync(new URL('../options/options.html', import.meta.url), 'utf8');
    assert.equal(createHash('sha256').update(clean(html)).digest('hex'), contract.optionsHtml);
    assert.doesNotMatch(html, /analyze-btn/);
});

test('tier thresholds and per-level palette preserve original badges without unsafe numbers', () => {
    assert.equal(calculateRatingToTier(2224), 21);
    assert.equal(calculateRatingToTier(10000), 31);
    assert.equal(calculateRatingToTier(NaN), null);
    assert.equal(calculateTierInfo(10).color, '#54789a');
    assert.equal(calculateTierInfo(31).color, '#AC9FFF');
});
