import { evaluateHand, isInstantWin } from './scorer.js';
import { DIFFICULTY } from './constants.js';

const KNOCK_THRESHOLDS = {
  [DIFFICULTY.EASY]: 29,
  [DIFFICULTY.MEDIUM]: 27,
  [DIFFICULTY.HARD]: 25
};

const DISCARD_IMPROVEMENT_THRESHOLDS = {
  [DIFFICULTY.EASY]: 5,
  [DIFFICULTY.MEDIUM]: 3,
  [DIFFICULTY.HARD]: 1
};

export function decideAction(player, discardTopCard, gameState) {
  const difficulty = gameState.difficulty;
  const currentScore = player.getHandScore().score;
  const knockThreshold = KNOCK_THRESHOLDS[difficulty];

  // Desperate play: lower knock threshold if on last life
  const effectiveKnockThreshold = player.lives === 1
    ? Math.max(knockThreshold - 3, 22)
    : knockThreshold;

  // Consider knocking
  if (!gameState.knocker && gameState.turnsPlayed >= 2 && currentScore >= effectiveKnockThreshold) {
    return { action: 'knock' };
  }

  // Evaluate taking the discard card
  if (discardTopCard) {
    const bestSwap = evaluateBestSwap(player.hand, discardTopCard, difficulty);
    const improvementThreshold = DISCARD_IMPROVEMENT_THRESHOLDS[difficulty];

    if (bestSwap.improvement >= improvementThreshold) {
      return { action: 'draw', source: 'discard', discardIndex: bestSwap.discardIndex };
    }

    // Always take if it would create an instant win
    for (let i = 0; i < player.hand.length; i++) {
      const testHand = [...player.hand];
      testHand[i] = discardTopCard;
      if (isInstantWin(testHand)) {
        return { action: 'draw', source: 'discard', discardIndex: i };
      }
    }
  }

  // Default: draw from stock
  return { action: 'draw', source: 'stock', discardIndex: null };
}

export function chooseDiscard(player, difficulty) {
  const hand = player.hand; // 4 cards after drawing

  if (difficulty === DIFFICULTY.EASY && Math.random() < 0.2) {
    // Easy AI sometimes makes suboptimal discards
    return Math.floor(Math.random() * hand.length);
  }

  // Find the target suit (suit with highest contribution)
  const suitValues = {};
  for (const card of hand) {
    suitValues[card.suit] = (suitValues[card.suit] || 0) + card.value;
  }

  let targetSuit = null;
  let maxVal = 0;
  for (const [suit, val] of Object.entries(suitValues)) {
    if (val > maxVal) {
      maxVal = val;
      targetSuit = suit;
    }
  }

  // Hard AI: also check if removing each card results in a better overall hand
  if (difficulty === DIFFICULTY.HARD) {
    let bestDiscardIndex = 0;
    let bestScore = 0;
    for (let i = 0; i < hand.length; i++) {
      const remaining = hand.filter((_, idx) => idx !== i);
      const score = evaluateHand(remaining).score;
      if (score > bestScore) {
        bestScore = score;
        bestDiscardIndex = i;
      }
    }
    return bestDiscardIndex;
  }

  // Medium/Easy: discard the card contributing least to target suit
  let worstIndex = 0;
  let worstValue = Infinity;
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i];
    if (card.suit !== targetSuit) {
      if (card.value < worstValue) {
        worstValue = card.value;
        worstIndex = i;
      }
    }
  }

  // If all cards are target suit, discard the lowest value one
  if (worstValue === Infinity) {
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].value < worstValue) {
        worstValue = hand[i].value;
        worstIndex = i;
      }
    }
  }

  return worstIndex;
}

function evaluateBestSwap(hand, newCard, difficulty) {
  let bestImprovement = -Infinity;
  let bestDiscardIndex = 0;
  const currentScore = evaluateHand(hand).score;

  for (let i = 0; i < hand.length; i++) {
    const testHand = [...hand];
    testHand[i] = newCard;
    const newScore = evaluateHand(testHand).score;
    const improvement = newScore - currentScore;
    if (improvement > bestImprovement) {
      bestImprovement = improvement;
      bestDiscardIndex = i;
    }
  }

  return { improvement: bestImprovement, discardIndex: bestDiscardIndex };
}
