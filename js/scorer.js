import { FACE_RANKS } from './constants.js';

export function evaluateHand(cards) {
  const suitTotals = {};
  for (const card of cards) {
    suitTotals[card.suit] = (suitTotals[card.suit] || 0) + card.value;
  }

  let bestSuit = null;
  let bestScore = 0;
  for (const [suit, total] of Object.entries(suitTotals)) {
    if (total > bestScore) {
      bestScore = total;
      bestSuit = suit;
    }
  }

  return { score: bestScore, suit: bestSuit };
}

export function isAllSameSuit(cards) {
  if (cards.length === 0) return false;
  const suit = cards[0].suit;
  return cards.every(c => c.suit === suit);
}

export function isInstantWin(cards) {
  // Check all 3-card combinations (supports 3 or 4 card hands)
  const combos = cards.length === 3
    ? [cards]
    : cards.length === 4
      ? [[cards[0],cards[1],cards[2]], [cards[0],cards[1],cards[3]], [cards[0],cards[2],cards[3]], [cards[1],cards[2],cards[3]]]
      : [];

  for (const trio of combos) {
    if (_isInstantWinTrio(trio)) return true;
  }
  return false;
}

function _isInstantWinTrio(cards) {
  // All three cards must be the same suit
  const suit = cards[0].suit;
  if (cards[1].suit !== suit || cards[2].suit !== suit) return false;

  const ranks = new Set(cards.map(c => c.rank));

  // Must have exactly: an Ace, a face card (J/Q/K), and a 10
  const hasAce = ranks.has('A');
  const hasTen = ranks.has('10');
  const hasFace = cards.some(c => FACE_RANKS.has(c.rank));

  return hasAce && hasTen && hasFace;
}
